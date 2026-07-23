import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  defaultJournalTheme,
  journalTitleUsesDarkInk,
  resolveJournalTheme,
  type JournalTheme,
} from "../../../../data/journal-themes.ts";
import type {
  MemoryEntry,
  MemoryPhoto,
  PhotoCropMetadata,
} from "../../../../data/memory-demo.ts";
import { getAdminSupabaseClient } from "../../../../lib/admin/supabase.ts";
import {
  DAILY_STAMP_EXPORT_HEIGHT,
  DAILY_STAMP_EXPORT_MIME_TYPE,
  DAILY_STAMP_EXPORT_WIDTH,
  dailyStampExportArtifactModel,
} from "../../../../lib/export/daily-memory-stamp-export.ts";
import { isPhotoCropMetadata } from "../../../../lib/scrap/crop-math.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEMORY_MEDIA_BUCKET = "memory-media";
const JOURNAL_THEME_ASSET_BUCKET = "journal-theme-assets";
const MAX_EXPORTED_PHOTOS = 9;
const MAX_REQUEST_BODY_BYTES = 1_024;
const MAX_THUMBNAIL_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_DISPLAY_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_TEXTURE_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 75 * 1024 * 1024;
const MAX_THUMBNAIL_INPUT_PIXELS = 1_000_000;
const MAX_DISPLAY_INPUT_PIXELS = 20_000_000;
const MAX_TEXTURE_INPUT_PIXELS = 12_000_000;
const MAX_LOGO_INPUT_PIXELS = 4_000_000;
const MAX_PNG_RESPONSE_BYTES = 4 * 1024 * 1024;
const SERVER_EXPORT_FONT_FILES = [
  path.join(process.cwd(), "public/fonts/CormorantGaramond-Medium.ttf"),
  path.join(process.cwd(), "public/fonts/CormorantGaramond-SemiBold.ttf"),
  path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf"),
  path.join(process.cwd(), "public/fonts/NotoSansCJKsc-Regular.otf"),
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

const layout = {
  journalTitleCenterY: 202,
  journalTitleFontSize: 62,
  journalTitleLineHeight: 68,
  journalTitleMaxWidth: 540,
  overlayCenterY: DAILY_STAMP_EXPORT_HEIGHT / 2,
  overlayMinTop: 300,
  overlayX: 27,
  overlayWidth: 1026,
  overlayRadius: 18,
  overlayPadding: 23,
  dateBaselineOffset: 63,
  dateFontSize: 22,
  dateLetterSpacing: 3.5,
  titleBaselineOffset: 148,
  titleFontSize: 53,
  gridTopOffset: 175,
  gridGap: 18,
  singlePhotoMaxWidth: 981,
  logoBoxSize: 190,
  logoBottom: 170,
};

type ExportPhotoInput = {
  input: Buffer;
  cropMetadata?: PhotoCropMetadata;
  prepared?: boolean;
};

type StoredPhotoSource = {
  storagePath: string;
  maxBytes: number;
  maxInputPixels: number;
};

type DownloadBudget = {
  usedBytes: number;
  maxBytes: number;
};

export type ServerDailyStampRenderInput = {
  memory: MemoryEntry;
  journalTitle: string;
  theme?: JournalTheme;
  photos: ExportPhotoInput[];
  texture?: Buffer;
  logo?: Buffer;
};

type PhotoRow = {
  id: string;
  storage_path: string;
  thumbnail_storage_path: string | null;
  order_index: number;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  crop_metadata: unknown;
};

class ExportRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status: number,
    message = code,
  ) {
    super(message);
    this.name = "ExportRouteError";
    this.code = code;
    this.status = status;
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function xmlSafeText(value: string) {
  return value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu,
    "",
  );
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
  const clean = xmlSafeText(value).normalize("NFC");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(clean), ({ segment }) => segment);
}

function serverSafeText(value: string) {
  return graphemes(value)
    .map((grapheme) => {
      if (/^[\uFE0E\uFE0F]$/u.test(grapheme)) return "";
      if (/^[❤♥♡💕💖💗💓💞💛🧡💚💙💜🖤🤍🤎]\uFE0F?$/u.test(grapheme)) {
        return "♥";
      }
      if (/\p{Extended_Pictographic}/u.test(grapheme)) return "•";
      return grapheme;
    })
    .join("");
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

function truncateLine(text: string, fontSize: number, maxWidth: number) {
  const characters = graphemes(text.replace(/\s+/g, " ").trim());
  if (estimatedTextWidth(characters.join(""), fontSize) <= maxWidth) {
    return characters.join("");
  }

  while (
    characters.length > 1 &&
    estimatedTextWidth(`${characters.join("").trimEnd()}...`, fontSize) >
      maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join("").trimEnd()}...`;
}

function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimatedTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";

    if (estimatedTextWidth(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }

    for (const character of graphemes(word)) {
      const characterCandidate = `${line}${character}`;
      if (!line || estimatedTextWidth(characterCandidate, fontSize) <= maxWidth) {
        line = characterCandidate;
      } else {
        lines.push(line);
        line = character;
      }
    }
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  return [
    ...lines.slice(0, maxLines - 1),
    truncateLine(lines.slice(maxLines - 1).join(" "), fontSize, maxWidth),
  ];
}

function photoGridColumns(photoCount: number) {
  if (photoCount <= 1) return 1;
  if (photoCount <= 4) return 2;
  return 3;
}

function photoCellSize(photoCount: number) {
  const columns = photoGridColumns(photoCount);
  const innerWidth = layout.overlayWidth - layout.overlayPadding * 2;
  return columns === 1
    ? Math.min(innerWidth, layout.singlePhotoMaxWidth)
    : (innerWidth - layout.gridGap * (columns - 1)) / columns;
}

async function squarePhotoTile({
  input,
  cropMetadata,
  size,
  maxInputPixels = MAX_DISPLAY_INPUT_PIXELS,
}: ExportPhotoInput & { size: number; maxInputPixels?: number }) {
  const normalized = await sharp(input, {
    failOn: "error",
    limitInputPixels: maxInputPixels,
  })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const width = normalized.info.width;
  const height = normalized.info.height;
  let image = sharp(normalized.data, {
    failOn: "error",
    limitInputPixels: maxInputPixels,
  });

  if (width && height && isPhotoCropMetadata(cropMetadata)) {
    const left = Math.floor(clamp(cropMetadata.x, 0, 1) * width);
    const top = Math.floor(clamp(cropMetadata.y, 0, 1) * height);
    const right = Math.min(
      width,
      Math.max(left + 1, Math.ceil(clamp(cropMetadata.x + cropMetadata.width, 0, 1) * width)),
    );
    const bottom = Math.min(
      height,
      Math.max(top + 1, Math.ceil(clamp(cropMetadata.y + cropMetadata.height, 0, 1) * height)),
    );
    image = image.extract({
      left: Math.min(left, width - 1),
      top: Math.min(top, height - 1),
      width: Math.max(1, right - Math.min(left, width - 1)),
      height: Math.max(1, bottom - Math.min(top, height - 1)),
    });
  }

  return image
    .resize(size, size, {
      fit: isPhotoCropMetadata(cropMetadata) ? "fill" : "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

export async function prepareStoredPhotoInput({
  sources,
  cropMetadata,
  size,
  download,
}: {
  sources: StoredPhotoSource[];
  cropMetadata?: PhotoCropMetadata;
  size: number;
  download: (storagePath: string, maxBytes: number) => Promise<Buffer>;
}) {
  for (const source of sources) {
    try {
      const input = await download(source.storagePath, source.maxBytes);
      const prepared = await squarePhotoTile({
        input,
        cropMetadata,
        size,
        maxInputPixels: source.maxInputPixels,
      });
      return { input: prepared, prepared: true } satisfies ExportPhotoInput;
    } catch {
      // A missing, oversized, corrupt, or unsupported preferred source should
      // fall through to the next stored variant.
    }
  }
  throw new ExportRouteError("MEDIA_UNAVAILABLE", 503);
}

async function preparedLogo(logo: Buffer, theme: JournalTheme) {
  const resized = await sharp(logo, {
    failOn: "error",
    limitInputPixels: MAX_LOGO_INPUT_PIXELS,
  })
    .resize(layout.logoBoxSize, layout.logoBoxSize, { fit: "inside" })
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
      resized.data[offset + 3] = Math.round(resized.data[offset + 3] * 0.72);
    }
  } else {
    for (let offset = 3; offset < resized.data.length; offset += 4) {
      resized.data[offset] = Math.round(resized.data[offset] * 0.78);
    }
  }

  return {
    input: await sharp(resized.data, {
      raw: {
        width: resized.info.width,
        height: resized.info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer(),
    width: resized.info.width,
    height: resized.info.height,
  };
}

function artifactSvg({
  theme,
  overlayTop,
  overlayHeight,
}: {
  theme: JournalTheme;
  overlayTop: number;
  overlayHeight: number;
}) {
  const lightTheme = theme.logoVariant === "dark";
  const panelFill = lightTheme ? "#fffbf0" : brand.vintageBlush;
  const panelOpacity = lightTheme ? 0.42 : 0.16;
  const panelGradientStart = lightTheme ? "#fffbf0" : brand.warmIvory;
  const panelGradientStartOpacity = lightTheme ? 0.26 : 0.1;
  const panelGradientEnd = lightTheme ? brand.cocoaTaupe : brand.champagnePeach;
  const panelGradientEndOpacity = lightTheme ? 0.08 : 0.07;
  const themeOverlay =
    theme.overlayColor && theme.overlayOpacity > 0
      ? `<rect width="${DAILY_STAMP_EXPORT_WIDTH}" height="${DAILY_STAMP_EXPORT_HEIGHT}" fill="${escapeXml(safeCssColor(theme.overlayColor, "transparent"))}" fill-opacity="${clamp(theme.overlayOpacity, 0, 1)}"/>`
      : "";

  return Buffer.from(`
    <svg width="${DAILY_STAMP_EXPORT_WIDTH}" height="${DAILY_STAMP_EXPORT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="artifact-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.14"/>
        </linearGradient>
        <linearGradient id="panel-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${panelGradientStart}" stop-opacity="${panelGradientStartOpacity}"/>
          <stop offset="1" stop-color="${panelGradientEnd}" stop-opacity="${panelGradientEndOpacity}"/>
        </linearGradient>
      </defs>
      <rect width="${DAILY_STAMP_EXPORT_WIDTH}" height="${DAILY_STAMP_EXPORT_HEIGHT}" fill="url(#artifact-shade)"/>
      ${themeOverlay}
      <rect x="${layout.overlayX}" y="${overlayTop}" width="${layout.overlayWidth}" height="${overlayHeight}" rx="${layout.overlayRadius}" fill="${panelFill}" fill-opacity="${panelOpacity}"/>
      <rect x="${layout.overlayX}" y="${overlayTop}" width="${layout.overlayWidth}" height="${overlayHeight}" rx="${layout.overlayRadius}" fill="url(#panel-shade)"/>
    </svg>
  `);
}

type ServerExportBrandFamily = "Cormorant Garamond" | "Inter";

export function serverTextRuns(
  text: string,
  brandFamily: ServerExportBrandFamily,
) {
  const runs = graphemes(text).reduce<
    Array<{ text: string; family: string }>
  >((result, grapheme) => {
    const isBrandGlyph =
      /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]+$/u.test(
        grapheme,
      ) && !/^[♥•]$/u.test(grapheme);
    const family = isBrandGlyph ? brandFamily : "Noto Sans CJK SC";
    const previous = result.at(-1);
    if (previous?.family === family) {
      previous.text += grapheme;
    } else {
      result.push({ text: grapheme, family });
    }
    return result;
  }, []);

  return runs;
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

function renderResvgTextLine({
  text,
  brandFamily,
  fontSize,
  weight,
  color,
  alpha = 1,
  letterSpacing = 0,
}: {
  text: string;
  brandFamily: ServerExportBrandFamily;
  fontSize: number;
  weight: number;
  color: string;
  alpha?: number;
  letterSpacing?: number;
}) {
  const baseline = fontSize * 1.25;
  const spaceAdvance = fontSize * 0.25 + letterSpacing;
  let cursor = 0;
  const measuredRuns = serverTextRuns(text, brandFamily)
    .map((run) => {
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
        return undefined;
      }

      const measureSvg = `
        <svg width="4096" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="${baseline}" font-family="${run.family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}">${escapeXml(visibleText)}</text>
        </svg>
      `;
      const bbox = new Resvg(measureSvg, resvgFontOptions()).getBBox();
      if (!bbox) return undefined;

      const measured = {
        family: run.family,
        text: visibleText,
        x: cursor + leadingWidth - bbox.x,
        bbox: {
          x: cursor + leadingWidth,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        },
      };
      cursor += leadingWidth + bbox.width + trailingWidth;
      return measured;
    })
    .filter((run): run is NonNullable<typeof run> => Boolean(run));

  if (!measuredRuns.length) {
    const rendered = new Resvg(
      '<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"/>',
    )
      .render()
      .asPng();
    return { input: Buffer.from(rendered), width: 1, height: 1, baseline: 1 };
  }

  const minY = Math.floor(Math.min(...measuredRuns.map((run) => run.bbox.y)));
  const maxY = Math.ceil(
    Math.max(...measuredRuns.map((run) => run.bbox.y + run.bbox.height)),
  );
  const width = Math.max(1, Math.ceil(cursor));
  const height = Math.max(1, maxY - minY);
  const runElements = measuredRuns
    .map(
      (run) =>
        `<text x="${run.x}" y="${baseline}" font-family="${run.family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}" fill="${escapeXml(color)}" fill-opacity="${clamp(alpha, 0, 1)}">${escapeXml(run.text)}</text>`,
    )
    .join("");
  const lineSvg = `
    <svg width="${width}" height="${height}" viewBox="0 ${minY} ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${runElements}
    </svg>
  `;
  const rendered = new Resvg(lineSvg, resvgFontOptions()).render().asPng();
  return {
    input: Buffer.from(rendered),
    width,
    height,
    baseline: baseline - minY,
  };
}

async function artifactTextLayers({
  theme,
  journalTitle,
  dateLabel,
  title,
  overlayTop,
}: {
  theme: JournalTheme;
  journalTitle: string;
  dateLabel: string;
  title: string;
  overlayTop: number;
}): Promise<sharp.OverlayOptions[]> {
  const lightTheme = theme.logoVariant === "dark";
  const journalTitleColor = journalTitleUsesDarkInk(theme)
    ? brand.deepBurgundy
    : brand.champagnePeach;
  const journalTitleAlpha = journalTitleUsesDarkInk(theme) ? 1 : 0.86;
  const titleColor = lightTheme ? brand.deepBurgundy : brand.warmIvory;
  const utilityColor = lightTheme ? brand.cocoaTaupe : brand.champagnePeach;
  const utilityAlpha = lightTheme ? 0.76 : 0.78;
  const journalLines = wrapText(
    serverSafeText(journalTitle),
    layout.journalTitleFontSize,
    layout.journalTitleMaxWidth,
    2,
  );
  const memoryTitle = truncateLine(
    serverSafeText(title),
    layout.titleFontSize,
    layout.overlayWidth - layout.overlayPadding * 2,
  );
  const textLeft = layout.overlayX + layout.overlayPadding;
  const firstJournalLineY =
    layout.journalTitleCenterY -
    ((journalLines.length - 1) * layout.journalTitleLineHeight) / 2;
  const journalLayers = journalLines.map((line, index) => {
    const rendered = renderResvgTextLine({
      text: line,
      brandFamily: "Cormorant Garamond",
      fontSize: layout.journalTitleFontSize,
      weight: 600,
      color: journalTitleColor,
      alpha: journalTitleAlpha,
    });
    return {
      input: rendered.input,
      left: Math.round((DAILY_STAMP_EXPORT_WIDTH - rendered.width) / 2),
      top: Math.round(
        firstJournalLineY +
          index * layout.journalTitleLineHeight -
          rendered.height / 2,
      ),
    };
  });
  const dateLayer = renderResvgTextLine({
    text: serverSafeText(dateLabel),
    brandFamily: "Inter",
    fontSize: layout.dateFontSize,
    weight: 600,
    color: utilityColor,
    alpha: utilityAlpha,
    letterSpacing: layout.dateLetterSpacing,
  });
  const titleLayer = renderResvgTextLine({
    text: memoryTitle,
    brandFamily: "Cormorant Garamond",
    fontSize: layout.titleFontSize,
    weight: 500,
    color: titleColor,
  });
  return [
    ...journalLayers,
    {
      input: dateLayer.input,
      left: textLeft,
      top: Math.round(
        overlayTop + layout.dateBaselineOffset - dateLayer.baseline,
      ),
    },
    {
      input: titleLayer.input,
      left: textLeft,
      top: Math.round(
        overlayTop + layout.titleBaselineOffset - titleLayer.baseline,
      ),
    },
  ];
}

export async function renderServerDailyStampPng({
  memory,
  journalTitle,
  theme = defaultJournalTheme,
  photos,
  texture,
  logo,
}: ServerDailyStampRenderInput) {
  if (photos.length > MAX_EXPORTED_PHOTOS) {
    throw new Error("A daily stamp can contain at most 9 exported photos.");
  }
  const resolvedTheme = resolveJournalTheme(theme);
  const model = dailyStampExportArtifactModel({ memory, journalTitle });
  if (model.photos.length !== photos.length) {
    throw new Error("The export photo inputs do not match the memory.");
  }

  const columns = photoGridColumns(photos.length);
  const innerWidth = layout.overlayWidth - layout.overlayPadding * 2;
  const cell = photoCellSize(photos.length);
  const rows = photos.length ? Math.ceil(photos.length / columns) : 0;
  const gridHeight = photos.length
    ? rows * cell + Math.max(0, rows - 1) * layout.gridGap
    : 0;
  const overlayHeight = layout.gridTopOffset + gridHeight + layout.overlayPadding;
  const overlayTop = Math.max(
    layout.overlayMinTop,
    Math.round(layout.overlayCenterY - overlayHeight / 2),
  );
  const gridWidth = cell * columns + layout.gridGap * (columns - 1);
  const gridX =
    layout.overlayX + layout.overlayPadding + (innerWidth - gridWidth) / 2;
  const gridY = overlayTop + layout.gridTopOffset;

  let preparedTexture: Buffer | undefined;
  if (texture) {
    try {
      preparedTexture = await sharp(texture, {
        failOn: "error",
        limitInputPixels: MAX_TEXTURE_INPUT_PIXELS,
      })
        .rotate()
        .resize(DAILY_STAMP_EXPORT_WIDTH, DAILY_STAMP_EXPORT_HEIGHT, {
          fit: "cover",
          position: "centre",
        })
        .png()
        .toBuffer();
    } catch {
      console.warn(
        "Daily stamp export theme texture could not be decoded; using fallback.",
      );
    }
  }
  const base = preparedTexture ??
    await sharp({
        create: {
          width: DAILY_STAMP_EXPORT_WIDTH,
          height: DAILY_STAMP_EXPORT_HEIGHT,
          channels: 4,
          background: safeCssColor(
            resolvedTheme.journalBackground,
            defaultJournalTheme.journalBackground,
          ),
        },
      })
        .png()
        .toBuffer();

  const photoLayers: sharp.OverlayOptions[] = [];
  for (const [index, photo] of photos.entries()) {
    const input = photo.prepared
      ? photo.input
      : await squarePhotoTile({
          ...photo,
          cropMetadata: model.photos[index]?.cropMetadata,
          size: Math.max(1, Math.round(cell)),
        });
    photoLayers.push({
      input,
      left: Math.round(gridX + (index % columns) * (cell + layout.gridGap)),
      top: Math.round(gridY + Math.floor(index / columns) * (cell + layout.gridGap)),
    });
  }

  const textLayers = await artifactTextLayers({
    theme: resolvedTheme,
    journalTitle: model.journalTitle,
    dateLabel: model.dateLabel,
    title: model.title,
    overlayTop,
  });
  const layers: sharp.OverlayOptions[] = [
    {
      input: artifactSvg({
        theme: resolvedTheme,
        overlayTop,
        overlayHeight,
      }),
      left: 0,
      top: 0,
    },
    ...textLayers,
    ...photoLayers,
  ];

  if (logo) {
    const prepared = await preparedLogo(logo, resolvedTheme);
    layers.push({
      input: prepared.input,
      left: Math.round((DAILY_STAMP_EXPORT_WIDTH - prepared.width) / 2),
      top: Math.round(
        DAILY_STAMP_EXPORT_HEIGHT -
          layout.logoBottom -
          layout.logoBoxSize +
          (layout.logoBoxSize - prepared.height) / 2,
      ),
    });
  }

  const png = await sharp(base)
    .composite(layers)
    .flatten({
      background: safeCssColor(
        resolvedTheme.journalBackground,
        defaultJournalTheme.journalBackground,
      ),
    })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      effort: 6,
      palette: true,
      colours: 256,
      dither: 0.8,
    })
    .toBuffer();
  if (png.byteLength > MAX_PNG_RESPONSE_BYTES) {
    throw new ExportRouteError("EXPORT_TOO_LARGE", 503);
  }
  return png;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function requireAuthorizedMemory(request: Request, memoryId: string) {
  const token = bearerToken(request);
  if (!token) throw new ExportRouteError("AUTH_REQUIRED", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ExportRouteError("UNAVAILABLE", 503);

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const userResult = await client.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    throw new ExportRouteError("AUTH_REQUIRED", 401);
  }

  const result = await client
    .from("memories")
    .select("id")
    .eq("id", memoryId)
    .maybeSingle();
  if (result.error) throw new ExportRouteError("UNAVAILABLE", 503);
  if (!result.data) throw new ExportRouteError("NOT_FOUND", 404);
}

async function downloadStorageBuffer(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  bucket: string,
  storagePath: string,
  maxBytes: number,
  budget: DownloadBudget,
) {
  const result = await admin.storage.from(bucket).download(storagePath);
  if (result.error || !result.data) {
    throw new ExportRouteError("MEDIA_UNAVAILABLE", 503);
  }
  if (result.data.size > maxBytes) {
    throw new ExportRouteError("MEDIA_TOO_LARGE", 422);
  }
  if (budget.usedBytes + result.data.size > budget.maxBytes) {
    throw new ExportRouteError("MEDIA_BUDGET_EXCEEDED", 422);
  }
  budget.usedBytes += result.data.size;
  return Buffer.from(await result.data.arrayBuffer());
}

function mapTheme(row: Record<string, unknown> | null): JournalTheme {
  if (!row) return defaultJournalTheme;
  return resolveJournalTheme({
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
    textureStoragePath:
      typeof row.texture_storage_path === "string"
        ? row.texture_storage_path
        : undefined,
    texturePublicUrl:
      typeof row.texture_public_url === "string"
        ? row.texture_public_url
        : undefined,
    textureWidth: Number(row.texture_width) || undefined,
    textureHeight: Number(row.texture_height) || undefined,
    textureMimeType:
      typeof row.texture_mime_type === "string"
        ? row.texture_mime_type
        : undefined,
    focusX: Number(row.focus_x),
    focusY: Number(row.focus_y),
    zoom: Number(row.zoom),
    overlayColor:
      typeof row.overlay_color === "string" ? row.overlay_color : undefined,
    overlayOpacity: Number(row.overlay_opacity),
    fallbackBackgroundColor: String(row.fallback_background_color ?? ""),
    textPrimary: String(row.text_primary ?? ""),
    textSecondary: String(row.text_secondary ?? ""),
    paperSurface: String(row.paper_surface ?? ""),
    paperSurfaceMuted: String(row.paper_surface_muted ?? ""),
    stampBorder: String(row.stamp_border ?? ""),
    accentColor: String(row.accent_color ?? ""),
    logoVariant: String(row.logo_variant ?? ""),
  });
}

async function loadExportData(memoryId: string) {
  const admin = getAdminSupabaseClient();
  const downloadBudget: DownloadBudget = {
    usedBytes: 0,
    maxBytes: MAX_TOTAL_SOURCE_BYTES,
  };
  const memoryResult = await admin
    .from("memories")
    .select(
      "id,capsule_id,title,occurred_at,local_date,local_timezone,photos(id,storage_path,thumbnail_storage_path,order_index,mime_type,size_bytes,width,height,crop_metadata)",
    )
    .eq("id", memoryId)
    .maybeSingle();
  if (memoryResult.error) throw new ExportRouteError("UNAVAILABLE", 503);
  if (!memoryResult.data) throw new ExportRouteError("NOT_FOUND", 404);

  const capsuleResult = await admin
    .from("capsules")
    .select("id,title,journal_theme_id")
    .eq("id", memoryResult.data.capsule_id)
    .maybeSingle();
  if (capsuleResult.error) throw new ExportRouteError("UNAVAILABLE", 503);
  if (!capsuleResult.data) throw new ExportRouteError("NOT_FOUND", 404);

  let theme = defaultJournalTheme;
  if (capsuleResult.data.journal_theme_id) {
    const themeResult = await admin
      .from("journal_themes")
      .select(
        "id,slug,name,status,texture_storage_path,texture_public_url,texture_width,texture_height,texture_mime_type,focus_x,focus_y,zoom,overlay_color,overlay_opacity,fallback_background_color,text_primary,text_secondary,paper_surface,paper_surface_muted,stamp_border,accent_color,logo_variant",
      )
      .eq("id", capsuleResult.data.journal_theme_id)
      .maybeSingle();
    if (themeResult.error) throw new ExportRouteError("UNAVAILABLE", 503);
    theme = mapTheme(themeResult.data as Record<string, unknown> | null);
  }

  const rows = [...((memoryResult.data.photos ?? []) as PhotoRow[])]
    .sort((left, right) => left.order_index - right.order_index)
    .slice(0, MAX_EXPORTED_PHOTOS);
  const photos: MemoryPhoto[] = rows.map((photo) => ({
    id: String(photo.id),
    name: `Photograph ${photo.order_index + 1}`,
    sizeBytes: Number(photo.size_bytes),
    mimeType: String(photo.mime_type),
    width: photo.width == null ? undefined : Number(photo.width),
    height: photo.height == null ? undefined : Number(photo.height),
    cropMetadata: isPhotoCropMetadata(photo.crop_metadata)
      ? photo.crop_metadata
      : undefined,
    status: "persisted",
  }));
  const memory: MemoryEntry = {
    title: String(memoryResult.data.title ?? ""),
    capturedAt: String(memoryResult.data.occurred_at),
    localDate:
      memoryResult.data.local_date == null
        ? undefined
        : String(memoryResult.data.local_date),
    localTimezone:
      memoryResult.data.local_timezone == null
        ? null
        : String(memoryResult.data.local_timezone),
    photos,
    voiceMemos: [],
  };

  const photoInputs: ExportPhotoInput[] = [];
  const targetPhotoSize = Math.max(1, Math.round(photoCellSize(rows.length)));
  const prefersThumbnails = rows.length >= 5;
  for (const [index, row] of rows.entries()) {
    const thumbnailSource = row.thumbnail_storage_path
      ? {
          storagePath: row.thumbnail_storage_path,
          maxBytes: MAX_THUMBNAIL_SOURCE_BYTES,
          maxInputPixels: MAX_THUMBNAIL_INPUT_PIXELS,
        }
      : undefined;
    const displaySource = {
      storagePath: row.storage_path,
      maxBytes: MAX_DISPLAY_SOURCE_BYTES,
      maxInputPixels: MAX_DISPLAY_INPUT_PIXELS,
    };
    const sources = prefersThumbnails
      ? [thumbnailSource, displaySource]
      : [displaySource, thumbnailSource];
    photoInputs.push(
      await prepareStoredPhotoInput({
        sources: sources.filter(
          (source): source is StoredPhotoSource => Boolean(source),
        ),
        cropMetadata: photos[index]?.cropMetadata,
        size: targetPhotoSize,
        download: (storagePath, maxBytes) =>
          downloadStorageBuffer(
            admin,
            MEMORY_MEDIA_BUCKET,
            storagePath,
            maxBytes,
            downloadBudget,
          ),
      }),
    );
  }

  let texture: Buffer | undefined;
  if (theme.textureStoragePath) {
    try {
      texture = await downloadStorageBuffer(
        admin,
        JOURNAL_THEME_ASSET_BUCKET,
        theme.textureStoragePath,
        MAX_TEXTURE_SOURCE_BYTES,
        downloadBudget,
      );
    } catch (error) {
      console.warn(
        "Daily stamp export theme texture unavailable; using fallback.",
        error instanceof ExportRouteError ? error.code : "UNKNOWN",
      );
    }
  }

  let logo: Buffer | undefined;
  try {
    logo = await readFile(
      path.join(process.cwd(), "public/brand/mgp-full-logo-transparent.png"),
    );
  } catch {
    console.warn("Daily stamp export logo unavailable; continuing without it.");
  }

  return {
    memory,
    journalTitle: String(capsuleResult.data.title ?? "My Journal"),
    theme,
    photos: photoInputs,
    texture,
    logo,
  };
}

function jsonError(code: string, status: number) {
  return Response.json(
    { ok: false, code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function parseRequestBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new ExportRouteError("REQUEST_TOO_LARGE", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ExportRouteError("INVALID_REQUEST", 400);
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new ExportRouteError("REQUEST_TOO_LARGE", 413);
    }
    chunks.push(chunk.value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      memoryId?: unknown;
    };
  } catch {
    throw new ExportRouteError("INVALID_REQUEST", 400);
  }
}

export async function POST(request: Request) {
  let body: { memoryId?: unknown };
  try {
    body = await parseRequestBody(request);
  } catch (error) {
    const routeError =
      error instanceof ExportRouteError
        ? error
        : new ExportRouteError("INVALID_REQUEST", 400);
    return jsonError(routeError.code, routeError.status);
  }
  const memoryId = typeof body.memoryId === "string" ? body.memoryId : "";
  if (!UUID_PATTERN.test(memoryId)) return jsonError("INVALID_REQUEST", 400);

  try {
    await requireAuthorizedMemory(request, memoryId);
    const png = await renderServerDailyStampPng(await loadExportData(memoryId));
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": DAILY_STAMP_EXPORT_MIME_TYPE,
        "Content-Length": String(png.byteLength),
        "Content-Disposition": `attachment; filename="scrap-the-day-${memoryId}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const routeError =
      error instanceof ExportRouteError
        ? error
        : new ExportRouteError("EXPORT_FAILED", 503);
    if (routeError.status >= 500) {
      console.error(
        "Daily stamp server export failed.",
        routeError.code,
        error instanceof Error ? error.name : "unknown",
      );
    }
    return jsonError(routeError.code, routeError.status);
  }
}
