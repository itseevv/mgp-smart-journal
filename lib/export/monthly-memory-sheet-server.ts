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
  MONTHLY_MEMORY_EDITION_COLUMNS,
  MONTHLY_MEMORY_EDITION_WIDTH,
  monthlyMemoryEditionHeight,
  monthlyMemoryEditionJournalTitle,
  monthlyMemoryEditionLayout,
  monthlyMemoryEditionSurfaceLayerOpacity,
  monthlyMemoryEditionTitle,
  monthlyMemoryEditionVisualSpec,
} from "./monthly-memory-sheet-export.ts";
import { isPhotoCropMetadata } from "../scrap/crop-math.ts";

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
const COVER_SHARP_TIMEOUT_SECONDS = 2;
const TEXTURE_SHARP_TIMEOUT_SECONDS = 4;
const LOGO_SHARP_TIMEOUT_SECONDS = 2;
const RENDER_SHARP_TIMEOUT_SECONDS = 10;

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

function throwIfAborted(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

function destroySharpOnAbort(pipeline: sharp.Sharp, signal?: AbortSignal) {
  if (!signal) return () => undefined;
  const onAbort = () => {
    pipeline.destroy(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException("Monthly export aborted.", "AbortError"),
    );
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  return () => signal.removeEventListener("abort", onAbort);
}

async function sharpBuffer(pipeline: sharp.Sharp, signal?: AbortSignal) {
  throwIfAborted(signal);
  const cleanup = destroySharpOnAbort(pipeline, signal);
  try {
    return await pipeline.toBuffer();
  } finally {
    cleanup();
  }
}

async function sharpBufferWithInfo(
  pipeline: sharp.Sharp,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const cleanup = destroySharpOnAbort(pipeline, signal);
  try {
    return await pipeline.toBuffer({ resolveWithObject: true });
  } finally {
    cleanup();
  }
}

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
    const family = `${brandFamily}, Noto Sans CJK SC`;
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

type RenderedTextLine = Awaited<ReturnType<typeof renderTextLine>>;

async function renderFittedTextLines({
  text,
  maxWidth,
  maxLines,
  render,
}: {
  text: string;
  maxWidth: number;
  maxLines: number;
  render: (line: string) => Promise<RenderedTextLine>;
}) {
  const characters = graphemes(text.replace(/\s+/gu, " ").trim());
  const lines: RenderedTextLine[] = [];
  let offset = 0;

  for (let lineIndex = 0; lineIndex < maxLines && offset < characters.length; lineIndex += 1) {
    while (characters[offset] && /\s/u.test(characters[offset])) offset += 1;
    const remaining = characters.slice(offset);
    const complete = await render(remaining.join(""));
    if (complete.width <= maxWidth) {
      lines.push(complete);
      break;
    }

    const finalLine = lineIndex === maxLines - 1;
    let low = 1;
    let high = remaining.length;
    let bestCount = 0;
    let best: RenderedTextLine | undefined;
    while (low <= high) {
      const count = Math.floor((low + high) / 2);
      const candidateText =
        remaining.slice(0, count).join("").trimEnd() +
        (finalLine ? "…" : "");
      const candidate = await render(candidateText);
      if (candidate.width <= maxWidth) {
        bestCount = count;
        best = candidate;
        low = count + 1;
      } else {
        high = count - 1;
      }
    }
    if (!best || bestCount < 1) {
      best = await render(finalLine ? "…" : remaining[0]);
      bestCount = 1;
    }
    lines.push(best);
    offset += bestCount;
  }
  return lines;
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
  surfaceLayerOpacity,
}: {
  theme: JournalTheme;
  height: number;
  sheetTop: number;
  sheetHeight: number;
  includeLeatherGrain: boolean;
  surfaceLayerOpacity: number;
}) {
  const colors = themeColors(theme);
  const grainSpec = monthlyMemoryEditionVisualSpec.grain;
  const themeOverlay =
    theme.overlayColor && theme.overlayOpacity > 0
      ? `<rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="${escapeXml(safeCssColor(theme.overlayColor, "transparent"))}" fill-opacity="${clamp(theme.overlayOpacity, 0, 1)}"/>`
      : "";
  const grain = includeLeatherGrain
    ? `<g opacity="${clamp(surfaceLayerOpacity, 0, 1)}">
         <rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="url(#leather-grain)"/>
         <rect width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" fill="url(#artifact-sheen)"/>
       </g>`
    : "";
  return Buffer.from(`
    <svg width="${MONTHLY_MEMORY_EDITION_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="leather-grain" width="${grainSpec.patternWidth}" height="${grainSpec.patternHeight}" patternUnits="userSpaceOnUse">
          <circle cx="${grainSpec.lightDot.x}" cy="${grainSpec.lightDot.y}" r="${grainSpec.lightDot.radius}" fill="${grainSpec.lightDot.color}" fill-opacity="${grainSpec.lightDot.alpha}"/>
          <circle cx="${grainSpec.darkDot.x}" cy="${grainSpec.darkDot.y}" r="${grainSpec.darkDot.radius}" fill="${grainSpec.darkDot.color}" fill-opacity="${grainSpec.darkDot.alpha}"/>
        </pattern>
        <linearGradient id="artifact-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="${grainSpec.sheenStartAlpha}"/>
          <stop offset="0.38" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="${grainSpec.sheenEndAlpha}"/>
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

export function monthlyMemoryEditionStampPositions(stampCount: number) {
  const layout = monthlyMemoryEditionLayout;
  const rows = Math.ceil(stampCount / MONTHLY_MEMORY_EDITION_COLUMNS);
  const gridX = layout.outerPaddingX + layout.sheetPaddingX;
  const sheetTop =
    layout.outerTop + layout.journalHeaderHeight + layout.journalHeaderGap;
  const gridTop =
    sheetTop +
    layout.sheetPaddingTop +
    layout.sheetHeaderHeight +
    layout.sheetHeaderGap;
  const fullGridWidth =
    MONTHLY_MEMORY_EDITION_COLUMNS * layout.stampSize +
    (MONTHLY_MEMORY_EDITION_COLUMNS - 1) * layout.stampGap;
  return Array.from({ length: stampCount }, (_, index) => {
    const row = Math.floor(index / MONTHLY_MEMORY_EDITION_COLUMNS);
    const column = index % MONTHLY_MEMORY_EDITION_COLUMNS;
    const rowCount = Math.min(
      MONTHLY_MEMORY_EDITION_COLUMNS,
      stampCount - row * MONTHLY_MEMORY_EDITION_COLUMNS,
    );
    const rowWidth =
      rowCount * layout.stampSize + Math.max(0, rowCount - 1) * layout.stampGap;
    const rowX =
      rowCount === MONTHLY_MEMORY_EDITION_COLUMNS
        ? gridX
        : gridX + (fullGridWidth - rowWidth) / 2;
    return {
      x: Math.round(rowX + column * (layout.stampSize + layout.stampGap)),
      y: Math.round(gridTop + row * (layout.stampSize + layout.stampGap)),
      row,
      rows,
    };
  });
}

export async function prepareServerMonthlyCoverPhoto(
  input: Buffer,
  cropMetadata: unknown,
  maxInputPixels = 20_000_000,
  signal?: AbortSignal,
) {
  const normalized = await sharpBufferWithInfo(
    sharp(input, {
      failOn: "error",
      limitInputPixels: maxInputPixels,
    })
      .rotate()
      .timeout({ seconds: COVER_SHARP_TIMEOUT_SECONDS }),
    signal,
  );
  const sourceWidth = normalized.info.width;
  const sourceHeight = normalized.info.height;
  let image = sharp(normalized.data, {
    failOn: "error",
    limitInputPixels: maxInputPixels,
  });

  if (sourceWidth && sourceHeight && isPhotoCropMetadata(cropMetadata)) {
    const left = Math.min(
      sourceWidth - 1,
      Math.floor(clamp(cropMetadata.x, 0, 1) * sourceWidth),
    );
    const top = Math.min(
      sourceHeight - 1,
      Math.floor(clamp(cropMetadata.y, 0, 1) * sourceHeight),
    );
    const right = Math.min(
      sourceWidth,
      Math.max(
        left + 1,
        Math.ceil(
          clamp(cropMetadata.x + cropMetadata.width, 0, 1) * sourceWidth,
        ),
      ),
    );
    const bottom = Math.min(
      sourceHeight,
      Math.max(
        top + 1,
        Math.ceil(
          clamp(cropMetadata.y + cropMetadata.height, 0, 1) * sourceHeight,
        ),
      ),
    );
    image = image.extract({
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    });
  }

  return sharpBuffer(
    image
      .resize(
        monthlyMemoryEditionLayout.stampSize,
        monthlyMemoryEditionLayout.stampSize,
        {
          fit: isPhotoCropMetadata(cropMetadata) ? "fill" : "cover",
          position: "centre",
        },
      )
      .png()
      .timeout({ seconds: COVER_SHARP_TIMEOUT_SECONDS }),
    signal,
  );
}

async function preparedTexture(
  texture: Buffer,
  height: number,
  signal?: AbortSignal,
) {
  return sharpBuffer(
    sharp(texture, {
      failOn: "error",
      limitInputPixels: MAX_TEXTURE_INPUT_PIXELS,
    })
      .rotate()
      .resize(MONTHLY_MEMORY_EDITION_WIDTH, height, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .timeout({ seconds: TEXTURE_SHARP_TIMEOUT_SECONDS }),
    signal,
  );
}

async function preparedLogo(
  logo: Buffer,
  theme: JournalTheme,
  signal?: AbortSignal,
) {
  const size = monthlyMemoryEditionLayout.logoSize;
  const resized = await sharpBufferWithInfo(
    sharp(logo, {
      failOn: "error",
      limitInputPixels: MAX_LOGO_INPUT_PIXELS,
    })
      .resize(size, size, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .timeout({ seconds: LOGO_SHARP_TIMEOUT_SECONDS }),
    signal,
  );

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
  return sharpBufferWithInfo(
    sharp(resized.data, {
      raw: {
        width: resized.info.width,
        height: resized.info.height,
        channels: 4,
      },
    })
      .png()
      .timeout({ seconds: LOGO_SHARP_TIMEOUT_SECONDS }),
    signal,
  );
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
  const journalLines = await renderFittedTextLines({
    text: monthlyMemoryEditionJournalTitle(journalTitle),
    maxWidth: layout.journalTitleMaxWidth,
    maxLines: 2,
    render: (line) =>
      renderTextLine({
        text: line,
        brandFamily: "Cormorant Garamond",
        fontSize: layout.journalTitleFontSize,
        weight: 600,
        color: colors.journalTitle,
        alpha: colors.journalTitleAlpha,
      }),
  });
  const journalCenterY = layout.outerTop + layout.journalHeaderHeight / 2;
  const selectedMonthTitle = monthlyMemoryEditionTitle(monthKey);
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
  for (const [index, rendered] of journalLines.entries()) {
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
    text: monthlyMemoryEditionVisualSpec.subheader,
    brandFamily: "Inter",
    fontSize: layout.monthSubheaderFontSize,
    weight: 500,
    color: colors.subheader,
    alpha: colors.subheaderAlpha,
    letterSpacing:
      layout.monthSubheaderFontSize *
      monthlyMemoryEditionVisualSpec.subheaderTrackingEm,
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
}: ServerMonthlyMemoryEditionRenderInput, {
  signal,
}: {
  signal?: AbortSignal;
} = {}) {
  throwIfAborted(signal);
  if (!stamps.length) throw new Error("A Monthly Memory Edition needs a stamp.");
  if (stamps.length > MONTHLY_MEMORY_EDITION_MAX_STAMPS) {
    throw new Error("A Monthly Memory Edition supports at most 31 stamps.");
  }

  const resolvedTheme = resolveJournalTheme(theme);
  const height = monthlyMemoryEditionHeight(stamps.length);
  const rows = Math.ceil(stamps.length / MONTHLY_MEMORY_EDITION_COLUMNS);
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
  const positions = monthlyMemoryEditionStampPositions(stamps.length);
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
  let hasRenderedTexture = false;

  if (texture) {
    try {
      layers.push({
        input: await preparedTexture(texture, height, signal),
        left: 0,
        top: 0,
      });
      hasRenderedTexture = true;
    } catch {
      signal?.throwIfAborted();
      // The resolved theme fill remains behind the always-on grain and sheen.
    }
  }
  layers.push({
    input: decorationLayer({
      theme: resolvedTheme,
      height,
      sheetTop,
      sheetHeight,
      includeLeatherGrain: true,
      surfaceLayerOpacity:
        monthlyMemoryEditionSurfaceLayerOpacity(hasRenderedTexture),
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
  throwIfAborted(signal);

  if (logo) {
    try {
      const prepared = await preparedLogo(logo, resolvedTheme, signal);
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
      signal?.throwIfAborted();
      // The complete sheet remains exportable if the quiet brand mark fails.
    }
  }

  throwIfAborted(signal);
  return sharpBuffer(
    base
      .composite(layers)
      .flatten({
        background: safeCssColor(
          resolvedTheme.journalBackground,
          defaultJournalTheme.journalBackground,
        ),
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        effort: 10,
      })
      .timeout({ seconds: RENDER_SHARP_TIMEOUT_SECONDS }),
    signal,
  );
}
