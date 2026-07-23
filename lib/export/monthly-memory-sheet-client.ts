"use client";

import type { JournalMemorySummary } from "../../data/journal.ts";
import {
  defaultJournalTheme,
  journalTitleUsesDarkInk,
  resolveJournalTheme,
  type JournalTheme,
} from "../../data/journal-themes.ts";
import { isPhotoCropMetadata } from "../scrap/crop-math.ts";
import {
  MONTHLY_MEMORY_EDITION_MIME_TYPE,
  MONTHLY_MEMORY_EDITION_WIDTH,
  monthlyMemoryEditionLayout,
  monthlyMemoryEditionModel,
  monthlyMemoryEditionSurfaceLayerOpacity,
  monthlyMemoryEditionVisualSpec,
} from "./monthly-memory-sheet-export.ts";

type LoadedImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

type RenderInput = {
  journalTitle: string;
  monthKey: string;
  stamps: JournalMemorySummary[];
  thumbnailUrls: Record<string, string>;
  theme?: JournalTheme;
  signal?: AbortSignal;
};

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

const displayFont =
  '"Cormorant Garamond", "Songti SC", "Noto Sans CJK SC", Georgia, serif';
const utilityFont =
  'Inter, Avenir, "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif';

function rgbaFromHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function monthlyThemeColors(theme: JournalTheme) {
  const lightTheme = theme.logoVariant === "dark";
  const darkTitle = journalTitleUsesDarkInk(theme);
  return {
    journalTitle: darkTitle
      ? brand.deepBurgundy
      : theme.slug === "teal"
        ? brand.warmIvory
        : rgbaFromHex(brand.champagnePeach, 0.78),
    monthTitle: lightTheme ? brand.deepBurgundy : brand.warmIvory,
    subheader: lightTheme
      ? rgbaFromHex(brand.cocoaTaupe, 0.72)
      : rgbaFromHex(brand.champagnePeach, 0.72),
    sheetFill: rgbaFromHex(brand.vintageBlush, lightTheme ? 0.14 : 0.16),
    sheetGradientStart: rgbaFromHex(
      brand.warmIvory,
      lightTheme ? 0.16 : 0.1,
    ),
    sheetGradientEnd: rgbaFromHex(
      lightTheme ? brand.cocoaTaupe : brand.champagnePeach,
      lightTheme ? 0.08 : 0.07,
    ),
  };
}

function throwIfAborted(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

async function loadImage(
  source: string,
  signal?: AbortSignal,
): Promise<LoadedImage> {
  throwIfAborted(signal);
  const response = await fetch(source, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Monthly export image could not be loaded.");
  const blob = await response.blob();
  throwIfAborted(signal);

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    if (signal?.aborted) {
      bitmap.close();
      signal.throwIfAborted();
    }
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      const cleanup = () => {
        signal?.removeEventListener("abort", onAbort);
        element.onload = null;
        element.onerror = null;
      };
      const onAbort = () => {
        cleanup();
        element.src = "";
        reject(new DOMException("Monthly export aborted.", "AbortError"));
      };
      element.onload = () => {
        cleanup();
        resolve(element);
      };
      element.onerror = () => {
        cleanup();
        reject(new Error("Monthly export image failed."));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      element.src = objectUrl;
      if (signal?.aborted) onAbort();
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  source: LoadedImage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / source.width, height / source.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (source.width - sourceWidth) / 2);
  const sourceY = Math.max(0, (source.height - sourceHeight) / 2);
  context.drawImage(
    source.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function drawStampImage(
  context: CanvasRenderingContext2D,
  source: LoadedImage,
  memory: JournalMemorySummary,
  x: number,
  y: number,
  size: number,
) {
  const crop = memory.coverCropMetadata;
  if (!isPhotoCropMetadata(crop)) {
    drawImageCover(context, source, x, y, size, size);
    return;
  }

  const sourceX = Math.max(0, Math.min(source.width - 1, crop.x * source.width));
  const sourceY = Math.max(
    0,
    Math.min(source.height - 1, crop.y * source.height),
  );
  const sourceWidth = Math.max(
    1,
    Math.min(source.width - sourceX, crop.width * source.width),
  );
  const sourceHeight = Math.max(
    1,
    Math.min(source.height - sourceY, crop.height * source.height),
  );
  context.drawImage(
    source.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    size,
    size,
  );
}

function drawFallbackStamp(
  context: CanvasRenderingContext2D,
  theme: JournalTheme,
  x: number,
  y: number,
  size: number,
) {
  const gradient = context.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, theme.fillerSurfaceA);
  gradient.addColorStop(1, theme.fillerSurfaceB);
  context.fillStyle = gradient;
  context.fillRect(x, y, size, size);
}

function wrapTitle(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const graphemes = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  );
  if (context.measureText(text).width <= maxWidth) return [text];

  let bestIndex = 1;
  for (let index = 1; index < graphemes.length; index += 1) {
    const line = graphemes.slice(0, index).join("").trimEnd();
    if (context.measureText(line).width <= maxWidth) bestIndex = index;
    else break;
  }
  return [
    graphemes.slice(0, bestIndex).join("").trim(),
    graphemes.slice(bestIndex).join("").trim(),
  ].filter(Boolean);
}

function drawCenteredLetterSpacedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  letterSpacing: number,
) {
  const graphemes = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  );
  const width =
    graphemes.reduce(
      (total, grapheme) => total + context.measureText(grapheme).width,
      0,
    ) + Math.max(0, graphemes.length - 1) * letterSpacing;
  let x = centerX - width / 2;
  context.save();
  context.textAlign = "left";
  for (const grapheme of graphemes) {
    context.fillText(grapheme, x, centerY);
    x += context.measureText(grapheme).width + letterSpacing;
  }
  context.restore();
}

function drawLeatherGrain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number,
) {
  context.save();
  context.globalAlpha = opacity;
  const grain = monthlyMemoryEditionVisualSpec.grain;
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = grain.patternWidth;
  patternCanvas.height = grain.patternHeight;
  const patternContext = patternCanvas.getContext("2d");
  if (patternContext) {
    patternContext.fillStyle = rgbaFromHex(
      grain.lightDot.color,
      grain.lightDot.alpha,
    );
    patternContext.beginPath();
    patternContext.arc(
      grain.lightDot.x,
      grain.lightDot.y,
      grain.lightDot.radius,
      0,
      Math.PI * 2,
    );
    patternContext.fill();
    patternContext.fillStyle = rgbaFromHex(
      grain.darkDot.color,
      grain.darkDot.alpha,
    );
    patternContext.beginPath();
    patternContext.arc(
      grain.darkDot.x,
      grain.darkDot.y,
      grain.darkDot.radius,
      0,
      Math.PI * 2,
    );
    patternContext.fill();
    const pattern = context.createPattern(patternCanvas, "repeat");
    if (pattern) {
      context.fillStyle = pattern;
      context.fillRect(0, 0, width, height);
    }
  }

  const sheen = context.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(
    0,
    `rgba(255,255,255,${grain.sheenStartAlpha})`,
  );
  sheen.addColorStop(0.38, "rgba(255,255,255,0)");
  sheen.addColorStop(1, `rgba(0,0,0,${grain.sheenEndAlpha})`);
  context.fillStyle = sheen;
  context.fillRect(0, 0, width, height);
  context.restore();
}

async function drawBrandLogo({
  context,
  theme,
  x,
  y,
  size,
  signal,
}: {
  context: CanvasRenderingContext2D;
  theme: JournalTheme;
  x: number;
  y: number;
  size: number;
  signal?: AbortSignal;
}) {
  try {
    const logo = await loadImage(
      "/brand/mgp-full-logo-transparent.png",
      signal,
    );
    try {
      const scale = Math.min(size / logo.width, size / logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      const drawX = x + (size - width) / 2;
      const drawY = y + (size - height) / 2;
      context.save();
      context.globalAlpha = 0.82;
      if (theme.logoVariant === "dark") {
        const tintCanvas = document.createElement("canvas");
        tintCanvas.width = Math.ceil(width);
        tintCanvas.height = Math.ceil(height);
        const tintContext = tintCanvas.getContext("2d");
        if (tintContext) {
          tintContext.drawImage(logo.image, 0, 0, width, height);
          tintContext.globalCompositeOperation = "source-in";
          tintContext.fillStyle = brand.deepBurgundy;
          tintContext.fillRect(0, 0, width, height);
          context.drawImage(tintCanvas, drawX, drawY, width, height);
        }
      } else {
        context.drawImage(logo.image, drawX, drawY, width, height);
      }
      context.restore();
    } finally {
      logo.close();
    }
  } catch {
    // Branding is intentionally quiet; a missing local asset must not discard
    // the complete monthly artifact.
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Monthly export PNG could not be created.")),
      MONTHLY_MEMORY_EDITION_MIME_TYPE,
    );
  });
}

export async function renderMonthlyMemorySheetExport({
  journalTitle,
  monthKey,
  stamps,
  thumbnailUrls,
  theme = defaultJournalTheme,
  signal,
}: RenderInput) {
  throwIfAborted(signal);
  const resolvedTheme = resolveJournalTheme(theme);
  const model = monthlyMemoryEditionModel({ journalTitle, monthKey, stamps });
  const layout = monthlyMemoryEditionLayout;
  await Promise.all([
    document.fonts.load(`600 ${layout.journalTitleFontSize}px ${displayFont}`),
    document.fonts.load(`500 ${layout.monthTitleFontSize}px ${displayFont}`),
    document.fonts.load(`600 ${layout.dateFontSize}px ${utilityFont}`),
  ]).catch(() => undefined);
  throwIfAborted(signal);

  const canvas = document.createElement("canvas");
  canvas.width = MONTHLY_MEMORY_EDITION_WIDTH;
  canvas.height = model.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is not available.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.fillStyle = resolvedTheme.journalBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);
  let hasRenderedTexture = false;
  if (resolvedTheme.textureUrl) {
    try {
      const texture = await loadImage(resolvedTheme.textureUrl, signal);
      try {
        drawImageCover(context, texture, 0, 0, canvas.width, canvas.height);
        hasRenderedTexture = true;
      } finally {
        texture.close();
      }
    } catch {
      // The production theme fallback remains the source of truth if the
      // uploaded texture is unavailable.
    }
  }
  drawLeatherGrain(
    context,
    canvas.width,
    canvas.height,
    monthlyMemoryEditionSurfaceLayerOpacity(hasRenderedTexture),
  );
  if (resolvedTheme.overlayColor && resolvedTheme.overlayOpacity > 0) {
    context.save();
    context.globalAlpha = resolvedTheme.overlayOpacity;
    context.fillStyle = resolvedTheme.overlayColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }

  const colors = monthlyThemeColors(resolvedTheme);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = colors.journalTitle;
  context.font = `600 ${layout.journalTitleFontSize}px ${displayFont}`;
  const journalLines = wrapTitle(
    context,
    model.journalTitle,
    layout.journalTitleMaxWidth,
  ).slice(0, 2);
  const journalCenterY = layout.outerTop + layout.journalHeaderHeight / 2;
  journalLines.forEach((line, index) => {
    context.fillText(
      line,
      canvas.width / 2,
      journalCenterY +
        (index - (journalLines.length - 1) / 2) *
          layout.journalTitleLineHeight,
    );
  });

  const sheetTop =
    layout.outerTop + layout.journalHeaderHeight + layout.journalHeaderGap;
  const gridHeight =
    model.rows * layout.stampSize +
    Math.max(0, model.rows - 1) * layout.stampGap;
  const sheetHeight =
    layout.sheetPaddingTop +
    layout.sheetHeaderHeight +
    layout.sheetHeaderGap +
    gridHeight +
    layout.sheetPaddingBottom;
  context.fillStyle = colors.sheetFill;
  context.fillRect(
    layout.outerPaddingX,
    sheetTop,
    canvas.width - layout.outerPaddingX * 2,
    sheetHeight,
  );
  const sheetGradient = context.createLinearGradient(
    0,
    sheetTop,
    0,
    sheetTop + sheetHeight,
  );
  sheetGradient.addColorStop(0, colors.sheetGradientStart);
  sheetGradient.addColorStop(1, colors.sheetGradientEnd);
  context.fillStyle = sheetGradient;
  context.fillRect(
    layout.outerPaddingX,
    sheetTop,
    canvas.width - layout.outerPaddingX * 2,
    sheetHeight,
  );
  context.save();
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 1;
  context.strokeRect(
    layout.outerPaddingX + 0.5,
    sheetTop + 0.5,
    canvas.width - layout.outerPaddingX * 2 - 1,
    sheetHeight - 1,
  );
  context.restore();

  const sheetHeaderTop = sheetTop + layout.sheetPaddingTop;
  const groupHeight =
    layout.monthTitleFontSize * 1.1 + 12 + layout.monthSubheaderFontSize * 1.25;
  const groupTop =
    sheetHeaderTop + (layout.sheetHeaderHeight - groupHeight) / 2;
  context.fillStyle = colors.monthTitle;
  context.font = `500 ${layout.monthTitleFontSize}px ${displayFont}`;
  context.fillText(
    model.editionTitle,
    canvas.width / 2,
    groupTop + (layout.monthTitleFontSize * 1.1) / 2,
  );
  context.fillStyle = colors.subheader;
  context.font = `500 ${layout.monthSubheaderFontSize}px ${utilityFont}`;
  drawCenteredLetterSpacedText(
    context,
    model.subheader,
    canvas.width / 2,
    groupTop +
      layout.monthTitleFontSize * 1.1 +
      12 +
      (layout.monthSubheaderFontSize * 1.25) / 2,
    layout.monthSubheaderFontSize *
      monthlyMemoryEditionVisualSpec.subheaderTrackingEm,
  );

  const gridX = layout.outerPaddingX + layout.sheetPaddingX;
  const gridTop =
    sheetHeaderTop + layout.sheetHeaderHeight + layout.sheetHeaderGap;
  for (let row = 0; row < model.rows; row += 1) {
    throwIfAborted(signal);
    const rowStamps = model.stamps.slice(
      row * model.columns,
      (row + 1) * model.columns,
    );
    const rowWidth =
      rowStamps.length * layout.stampSize +
      Math.max(0, rowStamps.length - 1) * layout.stampGap;
    const fullGridWidth =
      model.columns * layout.stampSize +
      (model.columns - 1) * layout.stampGap;
    const rowX =
      rowStamps.length === model.columns
        ? gridX
        : gridX + (fullGridWidth - rowWidth) / 2;
    for (const [column, stamp] of rowStamps.entries()) {
      const x = rowX + column * (layout.stampSize + layout.stampGap);
      const y = gridTop + row * (layout.stampSize + layout.stampGap);
      drawFallbackStamp(
        context,
        resolvedTheme,
        x,
        y,
        layout.stampSize,
      );
      const sourceUrl = thumbnailUrls[stamp.memory.id];
      if (sourceUrl) {
        try {
          const image = await loadImage(sourceUrl, signal);
          try {
            drawStampImage(
              context,
              image,
              stamp.memory,
              x,
              y,
              layout.stampSize,
            );
          } finally {
            image.close();
          }
        } catch {
          // One unavailable photo uses the production theme fallback without
          // clipping or failing the rest of the month.
        }
      }
      context.save();
      context.fillStyle = brand.warmIvory;
      context.font = `700 ${layout.dateFontSize}px ${utilityFont}`;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.shadowColor = "rgba(18,11,10,0.86)";
      context.shadowBlur = 7;
      context.shadowOffsetY = 2;
      context.fillText(stamp.dayLabel, x + 16, y + 15);
      context.restore();
    }
  }

  const footerTop = sheetTop + sheetHeight + layout.footerGap;
  await drawBrandLogo({
    context,
    theme: resolvedTheme,
    x: (canvas.width - layout.logoSize) / 2,
    y: footerTop,
    size: layout.logoSize,
    signal,
  });

  throwIfAborted(signal);
  return canvasToBlob(canvas);
}
