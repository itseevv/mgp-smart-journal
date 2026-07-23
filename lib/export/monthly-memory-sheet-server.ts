import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

import {
  defaultJournalTheme,
  journalTitleUsesDarkInk,
  resolveJournalTheme,
  type JournalTheme,
} from "../../data/journal-themes.ts";
import { dailyStampEmojiCodepoint } from "./daily-memory-stamp-export.ts";
import {
  MONTHLY_MEMORY_EDITION_MAX_STAMPS,
  MONTHLY_MEMORY_EDITION_WIDTH,
  monthlyMemoryEditionHeight,
  monthlyMemoryEditionLayout,
  monthlyMemoryEditionMonthName,
} from "./monthly-memory-sheet-export.ts";
import { monthTitle } from "../../data/journal-stamps.ts";

const SERVER_EXPORT_FONT_FILES = [
  path.join(process.cwd(), "public/fonts/CormorantGaramond-Medium.ttf"),
  path.join(process.cwd(), "public/fonts/CormorantGaramond-SemiBold.ttf"),
  path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf"),
  path.join(process.cwd(), "public/fonts/NotoSansCJKsc-Regular.otf"),
];
const TWEMOJI_SVG_DIRECTORY = path.join(
  process.cwd(),
  "node_modules/@twemoji/api/assets/svg",
);
const TWEMOJI_CODEPOINT_PATTERN = /^[0-9a-f]+(?:-[0-9a-f]+)*$/u;
const MAX_TEXTURE_INPUT_PIXELS = 24_000_000;
const MAX_LOGO_INPUT_PIXELS = 4_000_000;

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

export type ServerMonthlyMemoryEditionStamp = {
  dayLabel: string;
  input?: Buffer;
};

export type ServerMonthlyMemoryEditionRenderInput = {
  journalTitle: string;
  monthKey: string;
  theme?: JournalTheme;
  stamps: ServerMonthlyMemoryEditionStamp[];
  texture?: Buffer;
  logo?: Buffer;
};

type BrandFamily = "Cormorant Garamond" | "Inter";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function xmlSafeText(value: string) {
  return value
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu,
      "",
    )
    .normalize("NFC");
}

function escapeXml(value: string) {
  return xmlSafeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeCssColor(value: string | undefined, fallback: string) {
  const color = value?.trim() ?? "";
  return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\))$/i.test(
    color,
  )
    ? color
    : fallback;
}

function graphemes(value: string) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(xmlSafeText(value)), ({ segment }) => segment);
}

function estimatedTextWidth(text: string, fontSize: number) {
  return graphemes(text).reduce((width, character) => {
    if (/\s/u.test(character)) return width + fontSize * 0.25;
    if (/[ilI1'.,:;]/u.test(character)) return width + fontSize * 0.25;
    if (/[MW@#%&]/u.test(character)) return width + fontSize * 0.78;
    if (/[A-Z0-9]/u.test(character)) return width + fontSize * 0.58;
    if (/^[\x00-\x7F]$/u.test(character)) return width + fontSize * 0.48;
    return width + fontSize;
  }, 0);
}

function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
) {
  const characters = graphemes(text.replace(/\s+/gu, " ").trim());
  if (estimatedTextWidth(characters.join(""), fontSize) <= maxWidth) {
    return [characters.join("")];
  }

  const lines: string[] = [];
  let line = "";
  for (const character of characters) {
    const candidate = `${line}${character}`;
    if (!line || estimatedTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line.trim());
      line = character;
    }
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length <= maxLines) return lines;
  return [
    ...lines.slice(0, maxLines - 1),
    `${lines.slice(maxLines - 1).join("").slice(0, -1)}…`,
  ];
}

function resvgFontOptions() {
  return {
    font: {
      fontFiles: SERVER_EXPORT_FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Noto Sans CJK SC",
    },
  } as const;
}

function textRuns(text: string, brandFamily: BrandFamily) {
  return graphemes(text).reduce<
    Array<{ text: string; family: string; emojiCodepoint?: string }>
  >((runs, grapheme) => {
    const emojiCodepoint = dailyStampEmojiCodepoint(grapheme);
    if (emojiCodepoint) {
      runs.push({ text: grapheme, family: "Twemoji", emojiCodepoint });
      return runs;
    }
    const isBrandGlyph =
      /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]+$/u.test(
        grapheme,
      );
    const family = isBrandGlyph ? brandFamily : "Noto Sans CJK SC";
    const previous = runs.at(-1);
    if (previous?.family === family && !previous.emojiCodepoint) {
      previous.text += grapheme;
    } else {
      runs.push({ text: grapheme, family });
    }
    return runs;
  }, []);
}

const twemojiSvgCache = new Map<string, Promise<Buffer>>();

function readTwemojiSvg(codepoint: string) {
  if (
    codepoint.length > 128 ||
    !TWEMOJI_CODEPOINT_PATTERN.test(codepoint)
  ) {
    throw new Error("Invalid emoji codepoint.");
  }
  const cached = twemojiSvgCache.get(codepoint);
  if (cached) return cached;
  const pending = readFile(
    path.join(TWEMOJI_SVG_DIRECTORY, `${codepoint}.svg`),
  ).catch((error) => {
    twemojiSvgCache.delete(codepoint);
    throw error;
  });
  twemojiSvgCache.set(codepoint, pending);
  return pending;
}

async function renderTextLine({
  text,
  brandFamily,
  fontSize,
  weight,
  color,
  alpha = 1,
  letterSpacing = 0,
}: {
  text: string;
  brandFamily: BrandFamily;
  fontSize: number;
  weight: number;
  color: string;
  alpha?: number;
  letterSpacing?: number;
}) {
  const baseline = fontSize * 1.25;
  const spaceAdvance = fontSize * 0.25 + letterSpacing;
  const emojiSize = fontSize;
  const emojiTop = baseline - emojiSize * 0.84;
  let cursor = 0;
  const measured: Array<{
    kind: "text" | "emoji";
    text: string;
    family: string;
    x: number;
    svg?: Buffer;
    bbox: { x: number; y: number; width: number; height: number };
  }> = [];

  for (const run of textRuns(text, brandFamily)) {
    if (run.emojiCodepoint) {
      const svg = await readTwemojiSvg(run.emojiCodepoint);
      measured.push({
        kind: "emoji",
        text: run.text,
        family: run.family,
        x: cursor,
        svg,
        bbox: { x: cursor, y: emojiTop, width: emojiSize, height: emojiSize },
      });
      cursor += emojiSize + letterSpacing;
      continue;
    }

    const leadingSpaces = run.text.match(/^ +/u)?.[0].length ?? 0;
    const trailingSpaces = run.text.match(/ +$/u)?.[0].length ?? 0;
    const visibleEnd = trailingSpaces
      ? run.text.length - trailingSpaces
      : run.text.length;
    const visibleText = run.text.slice(leadingSpaces, visibleEnd);
    const leadingWidth = leadingSpaces * spaceAdvance;
    const trailingWidth = trailingSpaces * spaceAdvance;
    if (!visibleText) {
      cursor += leadingWidth + trailingWidth;
      continue;
    }

    const measureSvg = `
      <svg width="4096" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="${baseline}" font-family="${run.family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}">${escapeXml(visibleText)}</text>
      </svg>
    `;
    const bbox = new Resvg(measureSvg, resvgFontOptions()).getBBox();
    if (!bbox) continue;
    measured.push({
      kind: "text",
      text: visibleText,
      family: run.family,
      x: cursor + leadingWidth - bbox.x,
      bbox: {
        x: cursor + leadingWidth,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      },
    });
    cursor += leadingWidth + bbox.width + trailingWidth;
  }

  if (!measured.length) {
    return {
      input: Buffer.from(
        new Resvg(
          '<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"/>',
        )
          .render()
          .asPng(),
      ),
      width: 1,
      height: 1,
    };
  }

  const minY = Math.floor(Math.min(...measured.map((run) => run.bbox.y)));
  const maxY = Math.ceil(
    Math.max(...measured.map((run) => run.bbox.y + run.bbox.height)),
  );
  const width = Math.max(1, Math.ceil(cursor));
  const height = Math.max(1, maxY - minY);
  const elements = measured
    .map((run) =>
      run.kind === "emoji"
        ? `<image x="${run.x}" y="${emojiTop}" width="${emojiSize}" height="${emojiSize}" opacity="${clamp(alpha, 0, 1)}" href="data:image/svg+xml;base64,${run.svg?.toString("base64") ?? ""}"/>`
        : `<text x="${run.x}" y="${baseline}" font-family="${run.family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}" fill="${escapeXml(color)}" fill-opacity="${clamp(alpha, 0, 1)}">${escapeXml(run.text)}</text>`,
    )
    .join("");
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 ${minY} ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${elements}
    </svg>
  `;
  return {
    input: Buffer.from(
      new Resvg(svg, resvgFontOptions()).render().asPng(),
    ),
    width,
    height,
  };
}

function themeColors(theme: JournalTheme) {
  const lightTheme = theme.logoVariant === "dark";
  const darkTitle = journalTitleUsesDarkInk(theme);
  return {
    journalTitle: darkTitle
      ? brand.deepBurgundy
      : theme.slug === "teal"
        ? brand.warmIvory
        : brand.champagnePeach,
    journalTitleAlpha: darkTitle || theme.slug === "teal" ? 1 : 0.78,
    monthTitle: lightTheme ? brand.deepBurgundy : brand.warmIvory,
    subheader: lightTheme ? brand.cocoaTaupe : brand.champagnePeach,
    subheaderAlpha: 0.72,
    sheetFill: brand.vintageBlush,
    sheetFillAlpha: lightTheme ? 0.14 : 0.16,
    sheetGradientStart: brand.warmIvory,
    sheetGradientStartAlpha: lightTheme ? 0.16 : 0.1,
    sheetGradientEnd: lightTheme
      ? brand.cocoaTaupe
      : brand.champagnePeach,
    sheetGradientEndAlpha: lightTheme ? 0.08 : 0.07,
  };
}

function decorationLayer({
  theme,
  height,
  sheetTop,
  sheetHeight,
  includeLeatherGrain,
}: {
  theme: JournalTheme;
  height: number;
  sheetTop: number;
  sheetHeight: number;
  includeLeatherGrain: boolean;
}) {
  const colors = themeColors(theme);
  const themeOverlay =
    theme.overlayColor && theme.overlayOpacity > 0
      ? `<rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="${escapeXml(safeCssColor(theme.overlayColor, "transparent"))}" fill-opacity="${clamp(theme.overlayOpacity, 0, 1)}"/>`
      : "";
  const grain = includeLeatherGrain
    ? `<rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="url(#leather-grain)"/>
       <rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="url(#artifact-sheen)"/>`
    : "";
  return Buffer.from(`
    <svg width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="leather-grain" width="8" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2.5" r="0.55" fill="#ffffff" fill-opacity="0.06"/>
          <circle cx="6.5" cy="6.5" r="0.65" fill="#140a0c" fill-opacity="0.18"/>
        </pattern>
        <linearGradient id="artifact-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.055"/>
          <stop offset="0.38" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.13"/>
        </linearGradient>
        <linearGradient id="sheet-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${colors.sheetGradientStart}" stop-opacity="${colors.sheetGradientStartAlpha}"/>
          <stop offset="1" stop-color="${colors.sheetGradientEnd}" stop-opacity="${colors.sheetGradientEndAlpha}"/>
        </linearGradient>
      </defs>
      ${grain}
      ${themeOverlay}
      <rect x="${monthlyMemoryEditionLayout.outerPaddingX}" y="${sheetTop}" width="${MONTHLY_MEMORY_EDITION_WIDTH - monthlyMemoryEditionLayout.outerPaddingX * 2}" height="${sheetHeight}" fill="${colors.sheetFill}" fill-opacity="${colors.sheetFillAlpha}"/>
      <rect x="${monthlyMemoryEditionLayout.outerPaddingX}" y="${sheetTop}" width="${MONTHLY_MEMORY_EDITION_WIDTH - monthlyMemoryEditionLayout.outerPaddingX * 2}" height="${sheetHeight}" fill="url(#sheet-shade)"/>
      <rect x="${monthlyMemoryEditionLayout.outerPaddingX + 0.5}" y="${sheetTop + 0.5}" width="${MONTHLY_MEMORY_EDITION_WIDTH - monthlyMemoryEditionLayout.outerPaddingX * 2 - 1}" height="${sheetHeight - 1}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
    </svg>
  `);
}

function fallbackStampLayer({
  theme,
  height,
  positions,
}: {
  theme: JournalTheme;
  height: number;
  positions: Array<{ x: number; y: number }>;
}) {
  const tiles = positions
    .map(
      ({ x, y }, index) => `
        <linearGradient id="stamp-${index}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${escapeXml(safeCssColor(theme.fillerSurfaceA, defaultJournalTheme.fillerSurfaceA))}"/>
          <stop offset="1" stop-color="${escapeXml(safeCssColor(theme.fillerSurfaceB, defaultJournalTheme.fillerSurfaceB))}"/>
        </linearGradient>
        <rect x="${x}" y="${y}" width="${monthlyMemoryEditionLayout.stampSize}" height="${monthlyMemoryEditionLayout.stampSize}" fill="url(#stamp-${index})"/>
      `,
    )
    .join("");
  return Buffer.from(`
    <svg width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>${tiles}</defs>
      ${positions
        .map(
          ({ x, y }, index) =>
            `<rect x="${x}" y="${y}" width="${monthlyMemoryEditionLayout.stampSize}" height="${monthlyMemoryEditionLayout.stampSize}" fill="url(#stamp-${index})"/>`,
        )
        .join("")}
    </svg>
  `);
}

function stampPositions(stampCount: number) {
  const layout = monthlyMemoryEditionLayout;
  const rows = Math.ceil(stampCount / 3);
  const gridX = layout.outerPaddingX + layout.sheetPaddingX;
  const sheetTop =
    layout.outerTop + layout.journalHeaderHeight + layout.journalHeaderGap;
  const gridTop =
    sheetTop +
    layout.sheetPaddingTop +
    layout.sheetHeaderHeight +
    layout.sheetHeaderGap;
  const fullGridWidth =
    3 * layout.stampSize + 2 * layout.stampGap;
  return Array.from({ length: stampCount }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const rowCount = Math.min(3, stampCount - row * 3);
    const rowWidth =
      rowCount * layout.stampSize + Math.max(0, rowCount - 1) * layout.stampGap;
    const rowX = rowCount === 3 ? gridX : gridX + (fullGridWidth - rowWidth) / 2;
    return {
      x: Math.round(rowX + column * (layout.stampSize + layout.stampGap)),
      y: Math.round(gridTop + row * (layout.stampSize + layout.stampGap)),
      row,
      rows,
    };
  });
}

async function preparedTexture(texture: Buffer, height: number) {
  return sharp(texture, {
    failOn: "error",
    limitInputPixels: MAX_TEXTURE_INPUT_PIXELS,
  })
    .rotate()
    .resize(MONTHLY_MEMORY_EDITION_WIDTH, height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

async function preparedLogo(logo: Buffer, theme: JournalTheme) {
  const size = monthlyMemoryEditionLayout.logoSize;
  const resized = await sharp(logo, {
    failOn: "error",
    limitInputPixels: MAX_LOGO_INPUT_PIXELS,
  })
    .resize(size, size, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (theme.logoVariant === "dark") {
    const red = Number.parseInt(brand.deepBurgundy.slice(1, 3), 16);
    const green = Number.parseInt(brand.deepBurgundy.slice(3, 5), 16);
    const blue = Number.parseInt(brand.deepBurgundy.slice(5, 7), 16);
    for (let offset = 0; offset < resized.data.length; offset += 4) {
      resized.data[offset] = red;
      resized.data[offset + 1] = green;
      resized.data[offset + 2] = blue;
      resized.data[offset + 3] = Math.round(
        resized.data[offset + 3] * 0.82,
      );
    }
  } else {
    for (let offset = 3; offset < resized.data.length; offset += 4) {
      resized.data[offset] = Math.round(resized.data[offset] * 0.82);
    }
  }
  return sharp(resized.data, {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

async function textLayers({
  journalTitle,
  monthKey,
  theme,
  height,
  positions,
  stamps,
}: {
  journalTitle: string;
  monthKey: string;
  theme: JournalTheme;
  height: number;
  positions: Array<{ x: number; y: number }>;
  stamps: ServerMonthlyMemoryEditionStamp[];
}) {
  const layout = monthlyMemoryEditionLayout;
  const colors = themeColors(theme);
  const journalLines = wrapText(
    journalTitle,
    layout.journalTitleFontSize,
    layout.journalTitleMaxWidth,
    2,
  );
  const journalCenterY = layout.outerTop + layout.journalHeaderHeight / 2;
  const selectedMonthTitle = `${monthTitle(monthKey)} Edition`;
  const sheetTop =
    layout.outerTop + layout.journalHeaderHeight + layout.journalHeaderGap;
  const sheetHeaderTop = sheetTop + layout.sheetPaddingTop;
  const groupHeight =
    layout.monthTitleFontSize * 1.1 +
    12 +
    layout.monthSubheaderFontSize * 1.25;
  const groupTop =
    sheetHeaderTop + (layout.sheetHeaderHeight - groupHeight) / 2;
  const monthTitleCenterY =
    groupTop + (layout.monthTitleFontSize * 1.1) / 2;
  const subheaderCenterY =
    groupTop +
    layout.monthTitleFontSize * 1.1 +
    12 +
    (layout.monthSubheaderFontSize * 1.25) / 2;

  const layers: sharp.OverlayOptions[] = [];
  for (const [index, line] of journalLines.entries()) {
    const rendered = await renderTextLine({
      text: line,
      brandFamily: "Cormorant Garamond",
      fontSize: layout.journalTitleFontSize,
      weight: 600,
      color: colors.journalTitle,
      alpha: colors.journalTitleAlpha,
    });
    layers.push({
      input: rendered.input,
      left: Math.round((MONTHLY_MEMORY_EDITION_WIDTH - rendered.width) / 2),
      top: Math.round(
        journalCenterY +
          (index - (journalLines.length - 1) / 2) *
            layout.journalTitleLineHeight -
          rendered.height / 2,
      ),
    });
  }

  const monthLine = await renderTextLine({
    text: selectedMonthTitle,
    brandFamily: "Cormorant Garamond",
    fontSize: layout.monthTitleFontSize,
    weight: 500,
    color: colors.monthTitle,
  });
  layers.push({
    input: monthLine.input,
    left: Math.round((MONTHLY_MEMORY_EDITION_WIDTH - monthLine.width) / 2),
    top: Math.round(monthTitleCenterY - monthLine.height / 2),
  });

  const subheaderLine = await renderTextLine({
    text: "The whole month, kept together",
    brandFamily: "Inter",
    fontSize: layout.monthSubheaderFontSize,
    weight: 500,
    color: colors.subheader,
    alpha: colors.subheaderAlpha,
    letterSpacing: 0.56,
  });
  layers.push({
    input: subheaderLine.input,
    left: Math.round((MONTHLY_MEMORY_EDITION_WIDTH - subheaderLine.width) / 2),
    top: Math.round(subheaderCenterY - subheaderLine.height / 2),
  });

  const dateSvg = `
    <svg width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="date-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#120b0a" flood-opacity="0.86"/>
        </filter>
      </defs>
      ${positions
        .map(
          ({ x, y }, index) =>
            `<text x="${x + 16}" y="${y + 15 + layout.dateFontSize}" fill="${brand.warmIvory}" font-family="Inter" font-size="${layout.dateFontSize}" font-weight="700" filter="url(#date-shadow)">${escapeXml(stamps[index]?.dayLabel ?? "")}</text>`,
        )
        .join("")}
    </svg>
  `;
  layers.push({
    input: Buffer.from(
      new Resvg(dateSvg, resvgFontOptions()).render().asPng(),
    ),
    left: 0,
    top: 0,
  });
  return layers;
}

export async function renderServerMonthlyMemoryEditionPng({
  journalTitle,
  monthKey,
  theme = defaultJournalTheme,
  stamps,
  texture,
  logo,
}: ServerMonthlyMemoryEditionRenderInput) {
  if (!stamps.length) throw new Error("A Monthly Memory Edition needs a stamp.");
  if (stamps.length > MONTHLY_MEMORY_EDITION_MAX_STAMPS) {
    throw new Error("A Monthly Memory Edition supports at most 31 stamps.");
  }

  const resolvedTheme = resolveJournalTheme(theme);
  const height = monthlyMemoryEditionHeight(stamps.length);
  const rows = Math.ceil(stamps.length / 3);
  const layout = monthlyMemoryEditionLayout;
  const sheetTop =
    layout.outerTop + layout.journalHeaderHeight + layout.journalHeaderGap;
  const gridHeight =
    rows * layout.stampSize + Math.max(0, rows - 1) * layout.stampGap;
  const sheetHeight =
    layout.sheetPaddingTop +
    layout.sheetHeaderHeight +
    layout.sheetHeaderGap +
    gridHeight +
    layout.sheetPaddingBottom;
  const positions = stampPositions(stamps.length);
  const base = sharp({
    create: {
      width: MONTHLY_MEMORY_EDITION_WIDTH,
      height,
      channels: 4,
      background: safeCssColor(
        resolvedTheme.journalBackground,
        defaultJournalTheme.journalBackground,
      ),
    },
  });
  const layers: sharp.OverlayOptions[] = [];

  let decodedTexture: Buffer | undefined;
  if (texture) {
    try {
      decodedTexture = await preparedTexture(texture, height);
      layers.push({ input: decodedTexture, left: 0, top: 0 });
    } catch {
      decodedTexture = undefined;
    }
  }
  layers.push({
    input: decorationLayer({
      theme: resolvedTheme,
      height,
      sheetTop,
      sheetHeight,
      includeLeatherGrain: !decodedTexture,
    }),
    left: 0,
    top: 0,
  });
  layers.push({
    input: fallbackStampLayer({ theme: resolvedTheme, height, positions }),
    left: 0,
    top: 0,
  });
  stamps.forEach((stamp, index) => {
    if (!stamp.input) return;
    layers.push({
      input: stamp.input,
      left: positions[index].x,
      top: positions[index].y,
    });
  });
  layers.push(
    ...(await textLayers({
      journalTitle: xmlSafeText(journalTitle).replace(/\s+/gu, " ").trim() ||
        "My Journal",
      monthKey,
      theme: resolvedTheme,
      height,
      positions,
      stamps,
    })),
  );

  if (logo) {
    try {
      const prepared = await preparedLogo(logo, resolvedTheme);
      const footerTop = sheetTop + sheetHeight + layout.footerGap;
      layers.push({
        input: prepared.data,
        left: Math.round(
          (MONTHLY_MEMORY_EDITION_WIDTH - prepared.info.width) / 2,
        ),
        top: Math.round(
          footerTop + (layout.footerHeight - prepared.info.height) / 2,
        ),
      });
    } catch {
      // The complete sheet remains exportable if the quiet brand mark fails.
    }
  }

  return base
    .composite(layers)
    .flatten({
      background: safeCssColor(
        resolvedTheme.journalBackground,
        defaultJournalTheme.journalBackground,
      ),
    })
    .png({ compressionLevel: 8, adaptiveFiltering: true, effort: 7 })
    .toBuffer();
}

export function monthlyMemoryEditionServerLabel(monthKey: string) {
  return `Your ${monthlyMemoryEditionMonthName(monthKey)} Memory Edition`;
}
