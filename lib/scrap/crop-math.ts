import type { PhotoCropMetadata } from "../../data/memory-demo";

type CropInput = {
  imageWidth: number;
  imageHeight: number;
  createdAt?: string;
};

type CoverCropInput = CropInput & {
  frameSize: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type CropStyle = {
  position: "absolute";
  left: string;
  top: string;
  right: "auto";
  bottom: "auto";
  width: string;
  height: string;
  maxWidth: "none";
  objectFit: "fill";
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function nowIso(createdAt?: string) {
  return createdAt ?? new Date().toISOString();
}

export function centerSquareCropMetadata({
  imageWidth,
  imageHeight,
  createdAt,
}: CropInput): PhotoCropMetadata {
  const safeWidth = finitePositive(imageWidth, 1);
  const safeHeight = finitePositive(imageHeight, 1);
  const cropSize = Math.min(safeWidth, safeHeight);
  const x = (safeWidth - cropSize) / 2 / safeWidth;
  const y = (safeHeight - cropSize) / 2 / safeHeight;

  return {
    kind: "cover-scrap",
    aspectRatio: 1,
    x,
    y,
    width: cropSize / safeWidth,
    height: cropSize / safeHeight,
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    createdAt: nowIso(createdAt),
  };
}

export function getCoverScale({
  imageWidth,
  imageHeight,
  frameSize,
  zoom,
}: {
  imageWidth: number;
  imageHeight: number;
  frameSize: number;
  zoom: number;
}) {
  const safeWidth = finitePositive(imageWidth, 1);
  const safeHeight = finitePositive(imageHeight, 1);
  const safeFrame = finitePositive(frameSize, 1);
  const safeZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  return Math.max(safeFrame / safeWidth, safeFrame / safeHeight) * safeZoom;
}

export function clampCoverViewState({
  imageWidth,
  imageHeight,
  frameSize,
  zoom,
  offsetX,
  offsetY,
}: Omit<CoverCropInput, "createdAt">) {
  const safeWidth = finitePositive(imageWidth, 1);
  const safeHeight = finitePositive(imageHeight, 1);
  const safeFrame = finitePositive(frameSize, 1);
  const safeZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = getCoverScale({
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    frameSize: safeFrame,
    zoom: safeZoom,
  });
  const renderedWidth = safeWidth * scale;
  const renderedHeight = safeHeight * scale;
  const centeredLeft = (safeFrame - renderedWidth) / 2;
  const centeredTop = (safeFrame - renderedHeight) / 2;
  const minOffsetX = safeFrame - renderedWidth - centeredLeft;
  const maxOffsetX = -centeredLeft;
  const minOffsetY = safeFrame - renderedHeight - centeredTop;
  const maxOffsetY = -centeredTop;

  return {
    zoom: safeZoom,
    offsetX:
      minOffsetX > maxOffsetX
        ? 0
        : clamp(offsetX, minOffsetX, maxOffsetX),
    offsetY:
      minOffsetY > maxOffsetY
        ? 0
        : clamp(offsetY, minOffsetY, maxOffsetY),
  };
}

export function computeCoverCropMetadata({
  imageWidth,
  imageHeight,
  frameSize,
  zoom,
  offsetX,
  offsetY,
  createdAt,
}: CoverCropInput): PhotoCropMetadata {
  const safeWidth = finitePositive(imageWidth, 1);
  const safeHeight = finitePositive(imageHeight, 1);
  const safeFrame = finitePositive(frameSize, 1);
  const view = clampCoverViewState({
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    frameSize: safeFrame,
    zoom,
    offsetX,
    offsetY,
  });
  const scale = getCoverScale({
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    frameSize: safeFrame,
    zoom: view.zoom,
  });
  const renderedWidth = safeWidth * scale;
  const renderedHeight = safeHeight * scale;
  const imageLeft = (safeFrame - renderedWidth) / 2 + view.offsetX;
  const imageTop = (safeFrame - renderedHeight) / 2 + view.offsetY;
  const cropPixelSize = Math.min(safeFrame / scale, safeWidth, safeHeight);
  const cropX = clamp(-imageLeft / scale, 0, safeWidth - cropPixelSize);
  const cropY = clamp(-imageTop / scale, 0, safeHeight - cropPixelSize);

  return {
    kind: "cover-scrap",
    aspectRatio: 1,
    x: cropX / safeWidth,
    y: cropY / safeHeight,
    width: cropPixelSize / safeWidth,
    height: cropPixelSize / safeHeight,
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    createdAt: nowIso(createdAt),
  };
}

export function viewStateFromCropMetadata({
  cropMetadata,
  imageWidth,
  imageHeight,
  frameSize,
}: {
  cropMetadata?: PhotoCropMetadata;
  imageWidth: number;
  imageHeight: number;
  frameSize: number;
}) {
  if (!cropMetadata) {
    return { zoom: 1, offsetX: 0, offsetY: 0 };
  }

  const safeWidth = finitePositive(imageWidth, cropMetadata.imageWidth || 1);
  const safeHeight = finitePositive(imageHeight, cropMetadata.imageHeight || 1);
  const safeFrame = finitePositive(frameSize, 1);
  const cropPixelWidth = finitePositive(cropMetadata.width * safeWidth, safeFrame);
  const baseScale = Math.max(safeFrame / safeWidth, safeFrame / safeHeight);
  const scale = safeFrame / cropPixelWidth;
  const zoom = clamp(scale / baseScale, MIN_ZOOM, MAX_ZOOM);
  const renderedWidth = safeWidth * baseScale * zoom;
  const renderedHeight = safeHeight * baseScale * zoom;
  const centeredLeft = (safeFrame - renderedWidth) / 2;
  const centeredTop = (safeFrame - renderedHeight) / 2;
  const imageLeft = -(cropMetadata.x * safeWidth * baseScale * zoom);
  const imageTop = -(cropMetadata.y * safeHeight * baseScale * zoom);

  return clampCoverViewState({
    imageWidth: safeWidth,
    imageHeight: safeHeight,
    frameSize: safeFrame,
    zoom,
    offsetX: imageLeft - centeredLeft,
    offsetY: imageTop - centeredTop,
  });
}

export function isPhotoCropMetadata(value: unknown): value is PhotoCropMetadata {
  if (!value || typeof value !== "object") return false;
  const crop = value as Partial<PhotoCropMetadata>;
  return (
    crop.kind === "cover-scrap" &&
    crop.aspectRatio === 1 &&
    Number.isFinite(crop.x) &&
    Number.isFinite(crop.y) &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    Number.isFinite(crop.imageWidth) &&
    Number.isFinite(crop.imageHeight) &&
    typeof crop.createdAt === "string" &&
    crop.x! >= 0 &&
    crop.y! >= 0 &&
    crop.width! > 0 &&
    crop.height! > 0 &&
    crop.x! + crop.width! <= 1.000001 &&
    crop.y! + crop.height! <= 1.000001
  );
}

export function cropMetadataToImageStyle(
  cropMetadata?: PhotoCropMetadata,
): CropStyle | undefined {
  if (!cropMetadata || !isPhotoCropMetadata(cropMetadata)) return undefined;

  return {
    position: "absolute",
    left: `${-(cropMetadata.x / cropMetadata.width) * 100}%`,
    top: `${-(cropMetadata.y / cropMetadata.height) * 100}%`,
    right: "auto",
    bottom: "auto",
    width: `${100 / cropMetadata.width}%`,
    height: `${100 / cropMetadata.height}%`,
    maxWidth: "none",
    objectFit: "fill",
  };
}
