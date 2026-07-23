import type { JournalTheme } from "../../data/journal-themes.ts";
import {
  defaultJournalTheme,
  journalTitleUsesDarkInk,
  resolveJournalTheme,
} from "../../data/journal-themes.ts";
import { journalConfig } from "../../data/journal.ts";
import {
  localDateKeyFromValue,
  normalizeLocalDateKey,
} from "../../data/local-date.ts";
import type {
  MemoryEntry,
  MemoryPhoto,
  PhotoCropMetadata,
} from "../../data/memory-demo.ts";
import {
  centerSquareCropMetadata,
  isPhotoCropMetadata,
} from "../scrap/crop-math.ts";
import { computePreparedPortraitFullFrameRect } from "../journal-theme-background.ts";

export const DAILY_STAMP_EXPORT_WIDTH = 1080;
export const DAILY_STAMP_EXPORT_HEIGHT = 1920;
export const DAILY_STAMP_EXPORT_ASPECT_RATIO =
  DAILY_STAMP_EXPORT_WIDTH / DAILY_STAMP_EXPORT_HEIGHT;
export const DAILY_STAMP_EXPORT_MIME_TYPE = "image/png";
export const DAILY_STAMP_EXPORT_LOGO_SRC =
  "/brand/mgp-full-logo-transparent.png";

const DEFAULT_DAILY_STAMP_EXPORT_JOURNAL_TITLE = "My Journal";

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

// Canvas exports must not depend on next/font web fonts. Some WebKit and
// embedded-browser builds can report a web font as loaded while fillText()
// still resolves its glyphs to tofu. Native stacks keep exported text
// readable offline and include explicit CJK fallbacks.
const displayFont =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", STSong, SimSun, Georgia, serif';
const utilityFont =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif';

const dailyStampExportLayout = {
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

export type DailyStampExportBrandMark =
  | {
      kind: "logo";
      src: string;
      alt: string;
    }
  | {
      kind: "none";
    };

export const defaultDailyStampExportBrandMark: DailyStampExportBrandMark = {
  kind: "logo",
  src: DAILY_STAMP_EXPORT_LOGO_SRC,
  alt: "Modern Goddess Patina",
};

export type DailyStampExportPhotoItem = {
  index: number;
  photo: MemoryPhoto;
  cropMetadata?: PhotoCropMetadata;
  cropMode: "metadata" | "center" | "cover";
};

export type DailyStampExportArtifactModel = {
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: typeof DAILY_STAMP_EXPORT_MIME_TYPE;
  journalTitle: string;
  dateLabel: string;
  localDate: string;
  title: string;
  photos: DailyStampExportPhotoItem[];
  brandMark: DailyStampExportBrandMark;
};

export type DailyStampExportRenderInput = {
  memory: MemoryEntry;
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
  theme?: JournalTheme;
  brandMark?: DailyStampExportBrandMark;
  journalTitle?: string;
};

type LoadedCanvasImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

type DrawnPhoto = DailyStampExportPhotoItem & {
  source: LoadedCanvasImage;
};

type ShareNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function localDateParts(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return { year, month, day };
}

function formatLocalDate(localDate: string) {
  const { year, month, day } = localDateParts(localDate);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Untitled stamp";
}

function normalizeJournalTitle(value: string) {
  const title =
    value.replace(/\s+/g, " ").trim() ||
    DEFAULT_DAILY_STAMP_EXPORT_JOURNAL_TITLE;
  return title.slice(0, journalConfig.maxTitleLength);
}

function safeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function finitePositive(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function rgbaFromHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isLightTheme(theme: JournalTheme) {
  return theme.logoVariant === "dark";
}

function exportTitleColor(theme: JournalTheme) {
  return isLightTheme(theme) ? brand.deepBurgundy : brand.warmIvory;
}

function exportUtilityColor(theme: JournalTheme) {
  return isLightTheme(theme)
    ? rgbaFromHex(brand.cocoaTaupe, 0.76)
    : rgbaFromHex(brand.champagnePeach, 0.78);
}

function exportJournalHeaderColor(theme: JournalTheme) {
  return journalTitleUsesDarkInk(theme)
    ? brand.deepBurgundy
    : rgbaFromHex(brand.champagnePeach, 0.86);
}

function photoDimensions(photo: MemoryPhoto) {
  return {
    width: finitePositive(photo.width ?? photo.thumbnailWidth),
    height: finitePositive(photo.height ?? photo.thumbnailHeight),
  };
}

export function dailyStampExportLocalDate(memory: MemoryEntry) {
  return (
    normalizeLocalDateKey(memory.localDate) ||
    localDateKeyFromValue(memory.capturedAt)
  );
}

export function dailyStampExportDateLabel(memory: MemoryEntry) {
  const localDate = dailyStampExportLocalDate(memory);
  return localDate ? formatLocalDate(localDate) : "";
}

export function dailyStampExportFilename(memory: MemoryEntry) {
  const localDate = dailyStampExportLocalDate(memory) || "undated";
  return `${safeFilenamePart(`scrap-the-day-${localDate}`)}.png`;
}

export function dailyStampExportPhotoItems(
  photos: MemoryPhoto[],
): DailyStampExportPhotoItem[] {
  return photos.slice(0, 9).map((photo, index) => {
    if (isPhotoCropMetadata(photo.cropMetadata)) {
      return {
        index,
        photo,
        cropMetadata: photo.cropMetadata,
        cropMode: "metadata",
      };
    }

    const { width, height } = photoDimensions(photo);
    if (width && height) {
      return {
        index,
        photo,
        cropMetadata: centerSquareCropMetadata({
          imageWidth: width,
          imageHeight: height,
        }),
        cropMode: "center",
      };
    }

    return {
      index,
      photo,
      cropMode: "cover",
    };
  });
}

export function dailyStampExportArtifactModel({
  memory,
  brandMark = defaultDailyStampExportBrandMark,
  journalTitle = DEFAULT_DAILY_STAMP_EXPORT_JOURNAL_TITLE,
}: Pick<
  DailyStampExportRenderInput,
  "memory" | "brandMark" | "journalTitle"
>): DailyStampExportArtifactModel {
  return {
    width: DAILY_STAMP_EXPORT_WIDTH,
    height: DAILY_STAMP_EXPORT_HEIGHT,
    aspectRatio: DAILY_STAMP_EXPORT_ASPECT_RATIO,
    mimeType: DAILY_STAMP_EXPORT_MIME_TYPE,
    journalTitle: normalizeJournalTitle(journalTitle),
    dateLabel: dailyStampExportDateLabel(memory),
    localDate: dailyStampExportLocalDate(memory),
    title: normalizeTitle(memory.title),
    photos: dailyStampExportPhotoItems(memory.photos),
    brandMark,
  };
}

function sourceRectForCrop(
  image: LoadedCanvasImage,
  cropMetadata?: PhotoCropMetadata,
) {
  if (isPhotoCropMetadata(cropMetadata)) {
    return {
      sx: clamp(cropMetadata.x, 0, 1) * image.width,
      sy: clamp(cropMetadata.y, 0, 1) * image.height,
      sw: clamp(cropMetadata.width, 0.000001, 1) * image.width,
      sh: clamp(cropMetadata.height, 0.000001, 1) * image.height,
    };
  }

  const cropSize = Math.min(image.width, image.height);
  return {
    sx: (image.width - cropSize) / 2,
    sy: (image.height - cropSize) / 2,
    sw: cropSize,
    sh: cropSize,
  };
}

function drawLeatherBackground(
  context: CanvasRenderingContext2D,
  theme: JournalTheme,
  texture?: LoadedCanvasImage,
) {
  context.fillStyle = theme.journalBackground;
  context.fillRect(0, 0, DAILY_STAMP_EXPORT_WIDTH, DAILY_STAMP_EXPORT_HEIGHT);

  if (texture) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const rect = computePreparedPortraitFullFrameRect({
      sourceWidth: texture.width,
      sourceHeight: texture.height,
      targetWidth: DAILY_STAMP_EXPORT_WIDTH,
      targetHeight: DAILY_STAMP_EXPORT_HEIGHT,
    });
    context.drawImage(
      texture.image,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      rect.dx,
      rect.dy,
      rect.dw,
      rect.dh,
    );
  }

  const artifactGradient = context.createLinearGradient(
    0,
    0,
    0,
    DAILY_STAMP_EXPORT_HEIGHT,
  );
  artifactGradient.addColorStop(0, "rgba(255,255,255,0.08)");
  artifactGradient.addColorStop(1, "rgba(0,0,0,0.14)");
  context.fillStyle = artifactGradient;
  context.fillRect(0, 0, DAILY_STAMP_EXPORT_WIDTH, DAILY_STAMP_EXPORT_HEIGHT);

  if (!texture) {
    const sheen = context.createLinearGradient(
      0,
      0,
      DAILY_STAMP_EXPORT_WIDTH,
      DAILY_STAMP_EXPORT_HEIGHT,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.09)");
    sheen.addColorStop(0.38, "rgba(255,255,255,0.01)");
    sheen.addColorStop(1, "rgba(0,0,0,0.18)");
    context.fillStyle = sheen;
    context.fillRect(0, 0, DAILY_STAMP_EXPORT_WIDTH, DAILY_STAMP_EXPORT_HEIGHT);

    context.save();
    context.globalAlpha = 0.32;
    context.fillStyle = "rgba(255,255,255,0.18)";
    for (let index = 0; index < 180; index += 1) {
      const x = (index * 137) % DAILY_STAMP_EXPORT_WIDTH;
      const y = (index * 251) % DAILY_STAMP_EXPORT_HEIGHT;
      context.beginPath();
      context.arc(x, y, index % 3 === 0 ? 1.2 : 0.7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  if (theme.overlayColor && theme.overlayOpacity > 0) {
    context.save();
    context.globalAlpha = theme.overlayOpacity;
    context.fillStyle = theme.overlayColor;
    context.fillRect(0, 0, DAILY_STAMP_EXPORT_WIDTH, DAILY_STAMP_EXPORT_HEIGHT);
    context.restore();
  }
}

function drawSingleLineText({
  context,
  text,
  x,
  y,
  maxWidth,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
}) {
  let line = text.replace(/\s+/g, " ").trim();

  if (context.measureText(line).width > maxWidth) {
    while (
      line.length > 1 &&
      context.measureText(`${line.trimEnd()}...`).width > maxWidth
    ) {
      line = line.slice(0, -1);
    }
    line = `${line.trimEnd()}...`;
  }

  context.fillText(line, x, y, maxWidth);

  return {
    line,
    bottom: y,
  };
}

function wrapUnbrokenText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";

  for (const character of Array.from(text)) {
    const candidate = `${line}${character}`;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    lines.push(line);
    line = character;
  }

  if (line) lines.push(line);
  return lines;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }

    if (line) {
      lines.push(line);
      line = "";
    }

    if (context.measureText(word).width <= maxWidth) {
      line = word;
      return;
    }

    const wrappedWord = wrapUnbrokenText(context, word, maxWidth);
    lines.push(...wrappedWord.slice(0, -1));
    line = wrappedWord[wrappedWord.length - 1] ?? "";
  });

  if (line) lines.push(line);
  return lines;
}

function clampWrappedLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number,
) {
  if (lines.length <= maxLines) return lines;

  const nextLines = lines.slice(0, maxLines);
  let lastLine = `${nextLines[nextLines.length - 1] ?? ""}...`;

  while (
    lastLine.length > 3 &&
    context.measureText(lastLine).width > maxWidth
  ) {
    lastLine = `${lastLine.slice(0, -4).trimEnd()}...`;
  }

  nextLines[nextLines.length - 1] = lastLine;
  return nextLines;
}

function drawCenteredWrappedText({
  context,
  text,
  x,
  centerY,
  maxWidth,
  lineHeight,
  maxLines,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  centerY: number;
  maxWidth: number;
  lineHeight: number;
  maxLines: number;
}) {
  const wrappedLines = clampWrappedLines(
    context,
    wrapText(context, text, maxWidth),
    maxLines,
    maxWidth,
  );
  const firstLineY = centerY - ((wrappedLines.length - 1) * lineHeight) / 2;

  wrappedLines.forEach((line, index) => {
    context.fillText(line, x, firstLineY + index * lineHeight, maxWidth);
  });

  return {
    lines: wrappedLines,
    bottom:
      firstLineY +
      (wrappedLines.length - 1) * lineHeight +
      lineHeight / 2,
  };
}

function drawTrackedText({
  context,
  text,
  x,
  y,
  letterSpacing,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  letterSpacing: number;
}) {
  let cursorX = x;

  for (const character of text) {
    context.fillText(character, cursorX, y);
    cursorX += context.measureText(character).width + letterSpacing;
  }
}

function photoGridColumns(photoCount: number) {
  if (photoCount <= 1) return 1;
  if (photoCount <= 4) return 2;
  return 3;
}

function drawPhotoTile({
  context,
  photo,
  x,
  y,
  size,
}: {
  context: CanvasRenderingContext2D;
  photo: DrawnPhoto;
  x: number;
  y: number;
  size: number;
}) {
  const source = sourceRectForCrop(photo.source, photo.cropMetadata);

  context.fillStyle = "#d8cec0";
  context.fillRect(x, y, size, size);
  context.save();
  context.beginPath();
  context.rect(x, y, size, size);
  context.clip();
  context.drawImage(
    photo.source.image,
    source.sx,
    source.sy,
    source.sw,
    source.sh,
    x,
    y,
    size,
    size,
  );
  context.restore();
}

function drawExportOverlay({
  context,
  theme,
  x,
  y,
  width,
  height,
}: {
  context: CanvasRenderingContext2D;
  theme: JournalTheme;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, dailyStampExportLayout.overlayRadius);
  context.clip();

  context.fillStyle = isLightTheme(theme)
    ? "rgba(255, 251, 240, 0.42)"
    : rgbaFromHex(brand.vintageBlush, 0.16);
  context.fillRect(x, y, width, height);

  const gradient = context.createLinearGradient(x, y, x, y + height);
  if (isLightTheme(theme)) {
    gradient.addColorStop(0, "rgba(255, 251, 240, 0.26)");
    gradient.addColorStop(1, rgbaFromHex(brand.cocoaTaupe, 0.08));
  } else {
    gradient.addColorStop(0, rgbaFromHex(brand.warmIvory, 0.1));
    gradient.addColorStop(1, rgbaFromHex(brand.champagnePeach, 0.07));
  }
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
  context.restore();
}

async function drawPhotoGrid({
  context,
  photos,
  resolvePhotoUrl,
  x,
  y,
  width,
  gap,
  singlePhotoMaxWidth,
}: {
  context: CanvasRenderingContext2D;
  photos: DailyStampExportPhotoItem[];
  resolvePhotoUrl?: DailyStampExportRenderInput["resolvePhotoUrl"];
  x: number;
  y: number;
  width: number;
  gap: number;
  singlePhotoMaxWidth: number;
}) {
  const columns = photoGridColumns(photos.length);
  const cellSize =
    columns === 1
      ? Math.min(width, singlePhotoMaxWidth)
      : (width - gap * (columns - 1)) / columns;
  const gridWidth = cellSize * columns + gap * (columns - 1);
  const gridX = x + (width - gridWidth) / 2;

  for (const [index, item] of photos.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let source: LoadedCanvasImage | undefined;

    try {
      source = await loadPhotoForExport(item.photo, resolvePhotoUrl);
      drawPhotoTile({
        context,
        photo: { ...item, source },
        x: gridX + column * (cellSize + gap),
        y: y + row * (cellSize + gap),
        size: cellSize,
      });
    } finally {
      source?.close();
    }
  }

  return {
    bottom:
      y +
      Math.ceil(photos.length / columns) * cellSize +
      Math.max(0, Math.ceil(photos.length / columns) - 1) * gap,
  };
}

async function loadPhotoForExport(
  photo: MemoryPhoto,
  resolvePhotoUrl?: DailyStampExportRenderInput["resolvePhotoUrl"],
) {
  try {
    const url = await photoUrlForExport(photo, resolvePhotoUrl);
    return await imageFromUrl(url);
  } catch (error) {
    if (!resolvePhotoUrl) throw error;
    const refreshedUrl = await resolvePhotoUrl(photo, "display", true);
    return imageFromUrl(refreshedUrl);
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Canvas export failed."));
    }, mimeType);
  });
}

async function imageFromUrl(url: string): Promise<LoadedCanvasImage> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Image could not be loaded.");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => {
          bitmap.close();
          URL.revokeObjectURL(objectUrl);
        },
      };
    } catch {
      // Some browsers cannot decode SVG blobs through createImageBitmap.
    }
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded."));
      element.src = objectUrl;
    });

    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function photoUrlForExport(
  photo: MemoryPhoto,
  resolvePhotoUrl?: DailyStampExportRenderInput["resolvePhotoUrl"],
) {
  if (resolvePhotoUrl) return resolvePhotoUrl(photo, "display");
  if (photo.objectUrl) return photo.objectUrl;
  if (photo.thumbnailObjectUrl) return photo.thumbnailObjectUrl;
  throw new Error("This photograph is not available for export.");
}

async function loadBrandLogo(brandMark: DailyStampExportBrandMark) {
  if (brandMark.kind !== "logo") return undefined;
  return imageFromUrl(brandMark.src);
}

async function loadThemeTexture(theme: JournalTheme) {
  if (!theme.textureUrl) return undefined;
  try {
    return await imageFromUrl(theme.textureUrl);
  } catch {
    return undefined;
  }
}

function drawBrandMark({
  context,
  brandLogo,
  theme,
}: {
  context: CanvasRenderingContext2D;
  brandLogo?: LoadedCanvasImage;
  theme: JournalTheme;
}) {
  if (!brandLogo) return;

  const size = dailyStampExportLayout.logoBoxSize;
  const x = (DAILY_STAMP_EXPORT_WIDTH - size) / 2;
  const y = DAILY_STAMP_EXPORT_HEIGHT - dailyStampExportLayout.logoBottom - size;
  const ratio = Math.min(size / brandLogo.width, size / brandLogo.height);
  const width = brandLogo.width * ratio;
  const height = brandLogo.height * ratio;
  const drawX = x + (size - width) / 2;
  const drawY = y + (size - height) / 2;

  if (isLightTheme(theme)) {
    const tintCanvas = document.createElement("canvas");
    tintCanvas.width = Math.max(1, Math.round(width));
    tintCanvas.height = Math.max(1, Math.round(height));
    const tintContext = tintCanvas.getContext("2d");

    if (tintContext) {
      tintContext.imageSmoothingEnabled = true;
      tintContext.imageSmoothingQuality = "high";
      tintContext.drawImage(
        brandLogo.image,
        0,
        0,
        tintCanvas.width,
        tintCanvas.height,
      );
      tintContext.globalCompositeOperation = "source-in";
      tintContext.fillStyle = brand.deepBurgundy;
      tintContext.fillRect(0, 0, tintCanvas.width, tintCanvas.height);

      context.save();
      context.globalAlpha = 0.72;
      context.drawImage(tintCanvas, drawX, drawY, width, height);
      context.restore();
      return;
    }
  }

  context.save();
  context.globalAlpha = 0.78;
  context.drawImage(brandLogo.image, drawX, drawY, width, height);
  context.restore();
}

export async function renderDailyMemoryStampExport({
  memory,
  resolvePhotoUrl,
  theme = defaultJournalTheme,
  brandMark = defaultDailyStampExportBrandMark,
  journalTitle,
}: DailyStampExportRenderInput): Promise<Blob> {
  const resolvedTheme = resolveJournalTheme(theme);
  const model = dailyStampExportArtifactModel({ memory, brandMark, journalTitle });

  const canvas = document.createElement("canvas");
  canvas.width = DAILY_STAMP_EXPORT_WIDTH;
  canvas.height = DAILY_STAMP_EXPORT_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is not available.");

  const themeTexture = await loadThemeTexture(resolvedTheme);
  try {
    drawLeatherBackground(context, resolvedTheme, themeTexture);
  } finally {
    themeTexture?.close();
  }

  const layout = dailyStampExportLayout;
  const overlayX = layout.overlayX;
  const overlayWidth = layout.overlayWidth;
  const overlayPadding = layout.overlayPadding;
  const overlayInnerX = overlayX + overlayPadding;
  const overlayInnerWidth = overlayWidth - overlayPadding * 2;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = exportJournalHeaderColor(resolvedTheme);
  context.font = `600 ${layout.journalTitleFontSize}px ${displayFont}`;
  drawCenteredWrappedText({
    context,
    text: model.journalTitle,
    x: DAILY_STAMP_EXPORT_WIDTH / 2,
    centerY: layout.journalTitleCenterY,
    maxWidth: layout.journalTitleMaxWidth,
    lineHeight: layout.journalTitleLineHeight,
    maxLines: 2,
  });

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const gridColumns = photoGridColumns(model.photos.length);
  const gridGap = layout.gridGap;
  const gridCell =
    gridColumns === 1
      ? Math.min(overlayInnerWidth, layout.singlePhotoMaxWidth)
      : (overlayInnerWidth - gridGap * (gridColumns - 1)) / gridColumns;
  const gridRows = Math.ceil(model.photos.length / gridColumns);
  const gridHeight =
    model.photos.length > 0
      ? gridRows * gridCell + Math.max(0, gridRows - 1) * gridGap
      : 0;
  const overlayHeight = layout.gridTopOffset + gridHeight + overlayPadding;
  const overlayTop = Math.max(
    layout.overlayMinTop,
    Math.round(layout.overlayCenterY - overlayHeight / 2),
  );
  const dateBaseline = overlayTop + layout.dateBaselineOffset;
  const titleBaseline = overlayTop + layout.titleBaselineOffset;
  const gridTop = overlayTop + layout.gridTopOffset;

  drawExportOverlay({
    context,
    theme: resolvedTheme,
    x: overlayX,
    y: overlayTop,
    width: overlayWidth,
    height: overlayHeight,
  });

  context.fillStyle = exportUtilityColor(resolvedTheme);
  context.font = `600 ${layout.dateFontSize}px ${utilityFont}`;
  drawTrackedText({
    context,
    text: model.dateLabel,
    x: overlayInnerX,
    y: dateBaseline,
    letterSpacing: layout.dateLetterSpacing,
  });

  context.fillStyle = exportTitleColor(resolvedTheme);
  context.font = `500 ${layout.titleFontSize}px ${displayFont}`;
  drawSingleLineText({
    context,
    text: model.title,
    x: overlayInnerX,
    y: titleBaseline,
    maxWidth: overlayInnerWidth,
  });

  await drawPhotoGrid({
    context,
    photos: model.photos,
    resolvePhotoUrl,
    x: overlayInnerX,
    y: gridTop,
    width: overlayInnerWidth,
    gap: layout.gridGap,
    singlePhotoMaxWidth: layout.singlePhotoMaxWidth,
  });

  const brandLogo = await loadBrandLogo(model.brandMark);
  try {
    drawBrandMark({ context, brandLogo, theme: resolvedTheme });
  } finally {
    brandLogo?.close();
  }

  return canvasToBlob(canvas, DAILY_STAMP_EXPORT_MIME_TYPE);
}

export function createDailyStampExportFile(blob: Blob, filename: string) {
  return new File([blob], filename, { type: DAILY_STAMP_EXPORT_MIME_TYPE });
}

export function canShareDailyStampExport(
  shareNavigator: ShareNavigator | undefined,
  file: File,
) {
  if (!shareNavigator?.share || !shareNavigator.canShare) return false;
  try {
    return shareNavigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareDailyStampExportBlob(
  blob: Blob,
  filename: string,
  title: string,
  shareNavigator: ShareNavigator = navigator,
) {
  const file = createDailyStampExportFile(blob, filename);
  if (!canShareDailyStampExport(shareNavigator, file)) {
    return { shared: false, reason: "unsupported" as const };
  }

  await shareNavigator.share?.({
    files: [file],
    title,
  });
  return { shared: true as const };
}

export function saveDailyStampExportBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  if ("download" in anchor) {
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
