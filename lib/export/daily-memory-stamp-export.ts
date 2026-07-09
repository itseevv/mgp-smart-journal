import type { JournalTheme } from "../../data/journal-themes.ts";
import {
  defaultJournalTheme,
  resolveJournalTheme,
} from "../../data/journal-themes.ts";
import {
  localDateKeyFromValue,
  normalizeLocalDateKey,
} from "../../data/local-date.ts";
import type {
  MemoryEntry,
  MemoryPhoto,
  PhotoCropMetadata,
} from "../../data/memory-demo.ts";
import { buildStampFrameRows } from "../../data/stamp-layouts.ts";
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
export const DAILY_STAMP_EXPORT_LOGO_SRC = "/brand/logo-square-mgp.jpeg";

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
}: Pick<DailyStampExportRenderInput, "memory" | "brandMark">): DailyStampExportArtifactModel {
  return {
    width: DAILY_STAMP_EXPORT_WIDTH,
    height: DAILY_STAMP_EXPORT_HEIGHT,
    aspectRatio: DAILY_STAMP_EXPORT_ASPECT_RATIO,
    mimeType: DAILY_STAMP_EXPORT_MIME_TYPE,
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

function drawPaperRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: JournalTheme,
) {
  context.save();
  context.shadowColor = "rgba(18,11,10,0.28)";
  context.shadowBlur = 42;
  context.shadowOffsetY = 20;
  context.fillStyle = theme.paperSurface;
  context.fillRect(x, y, width, height);
  context.restore();

  context.save();
  context.globalAlpha = 0.26;
  context.fillStyle = theme.mutedTextOnPaper;
  for (let index = 0; index < 90; index += 1) {
    const dotX = x + ((index * 43) % Math.max(1, width));
    const dotY = y + ((index * 71) % Math.max(1, height));
    context.fillRect(dotX, dotY, 1, 1);
  }
  context.restore();
}

function drawWrappedText({
  context,
  text,
  x,
  y,
  maxWidth,
  maxLines,
  lineHeight,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  maxLines: number;
  lineHeight: number;
}) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let finalLine = lines[maxLines - 1];
    while (
      finalLine.length > 1 &&
      context.measureText(`${finalLine}...`).width > maxWidth
    ) {
      finalLine = finalLine.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${finalLine}...`;
  }

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return {
    lines,
    bottom: y + Math.max(0, lines.length - 1) * lineHeight,
  };
}

function sheetSizeForRows(rowSizes: number[], maxWidth: number, maxHeight: number) {
  const gap = 18;
  const heightForWidth = (width: number) =>
    rowSizes.reduce((total, rowSize, index) => {
      const cell = (width - gap * (rowSize - 1)) / rowSize;
      return total + cell + (index > 0 ? gap : 0);
    }, 0);
  const fullHeight = heightForWidth(maxWidth);
  if (fullHeight <= maxHeight) {
    return { width: maxWidth, height: fullHeight, gap };
  }
  const scale = maxHeight / fullHeight;
  const width = maxWidth * scale;
  return { width, height: heightForWidth(width), gap };
}

function drawStampEdge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  theme: JournalTheme,
) {
  const rim = Math.max(8, size * 0.045);
  context.fillStyle = "rgba(246,238,218,0.97)";
  context.fillRect(x, y, size, size);
  context.strokeStyle = theme.stampBorder;
  context.lineWidth = Math.max(2, size * 0.008);
  context.strokeRect(x + rim * 0.5, y + rim * 0.5, size - rim, size - rim);

  context.save();
  context.fillStyle = "rgba(82,43,42,0.48)";
  const dotRadius = Math.max(1.6, size * 0.007);
  const step = Math.max(12, size * 0.08);
  for (let dx = step * 0.5; dx < size; dx += step) {
    context.beginPath();
    context.arc(x + dx, y + dotRadius, dotRadius, 0, Math.PI * 2);
    context.arc(x + dx, y + size - dotRadius, dotRadius, 0, Math.PI * 2);
    context.fill();
  }
  for (let dy = step * 0.5; dy < size; dy += step) {
    context.beginPath();
    context.arc(x + dotRadius, y + dy, dotRadius, 0, Math.PI * 2);
    context.arc(x + size - dotRadius, y + dy, dotRadius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  return rim;
}

function drawPhotoFrame({
  context,
  photo,
  x,
  y,
  size,
  theme,
}: {
  context: CanvasRenderingContext2D;
  photo: DrawnPhoto;
  x: number;
  y: number;
  size: number;
  theme: JournalTheme;
}) {
  const rim = drawStampEdge(context, x, y, size, theme);
  const innerX = x + rim;
  const innerY = y + rim;
  const innerSize = size - rim * 2;
  const source = sourceRectForCrop(photo.source, photo.cropMetadata);

  context.save();
  context.beginPath();
  context.rect(innerX, innerY, innerSize, innerSize);
  context.clip();
  context.drawImage(
    photo.source.image,
    source.sx,
    source.sy,
    source.sw,
    source.sh,
    innerX,
    innerY,
    innerSize,
    innerSize,
  );
  context.restore();
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

async function loadDrawnPhotos(
  model: DailyStampExportArtifactModel,
  resolvePhotoUrl?: DailyStampExportRenderInput["resolvePhotoUrl"],
) {
  const loaded: DrawnPhoto[] = [];
  try {
    for (const item of model.photos) {
      const url = await photoUrlForExport(item.photo, resolvePhotoUrl);
      loaded.push({
        ...item,
        source: await imageFromUrl(url),
      });
    }
    return loaded;
  } catch (error) {
    loaded.forEach((item) => item.source.close());
    throw error;
  }
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
}: {
  context: CanvasRenderingContext2D;
  brandLogo?: LoadedCanvasImage;
}) {
  if (!brandLogo) return;

  const size = 136;
  const x = DAILY_STAMP_EXPORT_WIDTH - 96 - size;
  const y = DAILY_STAMP_EXPORT_HEIGHT - 108 - size;
  const ratio = Math.min(size / brandLogo.width, size / brandLogo.height);
  const width = brandLogo.width * ratio;
  const height = brandLogo.height * ratio;

  context.save();
  context.globalAlpha = 0.92;
  context.drawImage(
    brandLogo.image,
    x + (size - width) / 2,
    y + (size - height) / 2,
    width,
    height,
  );
  context.restore();
}

export async function renderDailyMemoryStampExport({
  memory,
  resolvePhotoUrl,
  theme = defaultJournalTheme,
  brandMark = defaultDailyStampExportBrandMark,
}: DailyStampExportRenderInput): Promise<Blob> {
  const resolvedTheme = resolveJournalTheme(theme);
  const model = dailyStampExportArtifactModel({ memory, brandMark });
  const loadedPhotos = await loadDrawnPhotos(model, resolvePhotoUrl);
  const brandLogo = await loadBrandLogo(model.brandMark);
  const themeTexture = await loadThemeTexture(resolvedTheme);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = DAILY_STAMP_EXPORT_WIDTH;
    canvas.height = DAILY_STAMP_EXPORT_HEIGHT;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is not available.");

    drawLeatherBackground(context, resolvedTheme, themeTexture);

    context.fillStyle = resolvedTheme.mutedTextOnJournal;
    context.font = "600 30px Avenir Next, Helvetica Neue, Arial, sans-serif";
    context.fillText(model.dateLabel, 96, 230);

    context.fillStyle = resolvedTheme.textOnJournal;
    context.font =
      "700 84px Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif";
    const title = drawWrappedText({
      context,
      text: model.title,
      x: 96,
      y: 328,
      maxWidth: DAILY_STAMP_EXPORT_WIDTH - 192,
      maxLines: 3,
      lineHeight: 88,
    });

    const rowSizes = buildStampFrameRows(model.photos).map(
      (row) => row.items.length,
    );
    const maxSheetTop = Math.max(520, title.bottom + 92);
    const availableHeight = 1510 - maxSheetTop;
    const sheet = sheetSizeForRows(rowSizes, 828, availableHeight);
    const paperPadding = 34;
    const paperWidth = sheet.width + paperPadding * 2;
    const paperHeight = sheet.height + paperPadding * 2;
    const paperX = (DAILY_STAMP_EXPORT_WIDTH - paperWidth) / 2;
    const paperY = maxSheetTop;
    drawPaperRect(context, paperX, paperY, paperWidth, paperHeight, resolvedTheme);

    context.fillStyle = resolvedTheme.paperSurfaceMuted;
    context.fillRect(
      paperX + paperPadding,
      paperY + paperPadding,
      sheet.width,
      sheet.height,
    );

    let cursorY = paperY + paperPadding;
    const rows = buildStampFrameRows(loadedPhotos);
    rows.forEach((row, rowIndex) => {
      const rowSize = row.items.length;
      const cellSize = (sheet.width - sheet.gap * (rowSize - 1)) / rowSize;
      const rowX = paperX + paperPadding + (sheet.width - (cellSize * rowSize + sheet.gap * (rowSize - 1))) / 2;
      row.items.forEach((photo, index) => {
        drawPhotoFrame({
          context,
          photo,
          x: rowX + index * (cellSize + sheet.gap),
          y: cursorY,
          size: cellSize,
          theme: resolvedTheme,
        });
      });
      cursorY += cellSize + (rowIndex < rows.length - 1 ? sheet.gap : 0);
    });

    drawBrandMark({ context, brandLogo });

    return canvasToBlob(canvas, DAILY_STAMP_EXPORT_MIME_TYPE);
  } finally {
    loadedPhotos.forEach((item) => item.source.close());
    brandLogo?.close();
    themeTexture?.close();
  }
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
