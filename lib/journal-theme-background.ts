export type ObjectFitCoverRectInput = {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  focusX?: number;
  focusY?: number;
  zoom?: number;
};

export type ObjectFitCoverRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export const JOURNAL_THEME_BACKGROUND_MODE = {
  preparedPortraitFullFrame: "preparedPortraitFullFrame",
  advancedCrop: "advancedCrop",
} as const;

export type JournalThemeBackgroundMode =
  (typeof JOURNAL_THEME_BACKGROUND_MODE)[keyof typeof JOURNAL_THEME_BACKGROUND_MODE];

export const JOURNAL_THEME_BACKGROUND_DEFAULTS = {
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  overlayOpacity: 0,
} as const;

export const JOURNAL_THEME_PORTRAIT_ASPECT_RATIO = 9 / 16;
export const JOURNAL_THEME_ASPECT_RATIO_TOLERANCE = 0.04;

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function isCloseToPortraitBackgroundAspect({
  width,
  height,
  targetAspectRatio = JOURNAL_THEME_PORTRAIT_ASPECT_RATIO,
  tolerance = JOURNAL_THEME_ASPECT_RATIO_TOLERANCE,
}: {
  width?: number;
  height?: number;
  targetAspectRatio?: number;
  tolerance?: number;
}) {
  if (!width || !height || width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return Math.abs(ratio - targetAspectRatio) / targetAspectRatio <= tolerance;
}

export function computeObjectFitCoverRect({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focusX = 0.5,
  focusY = 0.5,
  zoom = 1,
}: ObjectFitCoverRectInput): ObjectFitCoverRect {
  const safeSourceWidth = Math.max(1, finiteNumber(sourceWidth, 1));
  const safeSourceHeight = Math.max(1, finiteNumber(sourceHeight, 1));
  const safeTargetWidth = Math.max(1, finiteNumber(targetWidth, 1));
  const safeTargetHeight = Math.max(1, finiteNumber(targetHeight, 1));
  const safeFocusX = clamp(finiteNumber(focusX, 0.5), 0, 1);
  const safeFocusY = clamp(finiteNumber(focusY, 0.5), 0, 1);
  const safeZoom = clamp(finiteNumber(zoom, 1), 1, 3);

  const coverScale =
    Math.max(
      safeTargetWidth / safeSourceWidth,
      safeTargetHeight / safeSourceHeight,
    ) * safeZoom;
  const sourceCropWidth = Math.min(safeSourceWidth, safeTargetWidth / coverScale);
  const sourceCropHeight = Math.min(
    safeSourceHeight,
    safeTargetHeight / coverScale,
  );
  const maxSx = Math.max(0, safeSourceWidth - sourceCropWidth);
  const maxSy = Math.max(0, safeSourceHeight - sourceCropHeight);

  return {
    sx: round(maxSx * safeFocusX),
    sy: round(maxSy * safeFocusY),
    sw: round(sourceCropWidth),
    sh: round(sourceCropHeight),
    dx: 0,
    dy: 0,
    dw: round(safeTargetWidth),
    dh: round(safeTargetHeight),
  };
}

export function computeObjectFitContainRect({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focusX = JOURNAL_THEME_BACKGROUND_DEFAULTS.focusX,
  focusY = JOURNAL_THEME_BACKGROUND_DEFAULTS.focusY,
}: ObjectFitCoverRectInput): ObjectFitCoverRect {
  const safeSourceWidth = Math.max(1, finiteNumber(sourceWidth, 1));
  const safeSourceHeight = Math.max(1, finiteNumber(sourceHeight, 1));
  const safeTargetWidth = Math.max(1, finiteNumber(targetWidth, 1));
  const safeTargetHeight = Math.max(1, finiteNumber(targetHeight, 1));
  const safeFocusX = clamp(finiteNumber(focusX, 0.5), 0, 1);
  const safeFocusY = clamp(finiteNumber(focusY, 0.5), 0, 1);
  const containScale = Math.min(
    safeTargetWidth / safeSourceWidth,
    safeTargetHeight / safeSourceHeight,
  );
  const drawWidth = safeSourceWidth * containScale;
  const drawHeight = safeSourceHeight * containScale;

  return {
    sx: 0,
    sy: 0,
    sw: round(safeSourceWidth),
    sh: round(safeSourceHeight),
    dx: round((safeTargetWidth - drawWidth) * safeFocusX),
    dy: round((safeTargetHeight - drawHeight) * safeFocusY),
    dw: round(drawWidth),
    dh: round(drawHeight),
  };
}

export function computePreparedPortraitFullFrameRect(
  input: ObjectFitCoverRectInput,
): ObjectFitCoverRect {
  return computeObjectFitContainRect({
    ...input,
    focusX: JOURNAL_THEME_BACKGROUND_DEFAULTS.focusX,
    focusY: JOURNAL_THEME_BACKGROUND_DEFAULTS.focusY,
    zoom: JOURNAL_THEME_BACKGROUND_DEFAULTS.zoom,
  });
}

export function computeJournalThemeBackgroundRect({
  mode = JOURNAL_THEME_BACKGROUND_MODE.preparedPortraitFullFrame,
  zoom = JOURNAL_THEME_BACKGROUND_DEFAULTS.zoom,
  ...input
}: ObjectFitCoverRectInput & {
  mode?: JournalThemeBackgroundMode;
}): ObjectFitCoverRect {
  if (mode === JOURNAL_THEME_BACKGROUND_MODE.preparedPortraitFullFrame) {
    return computePreparedPortraitFullFrameRect(input);
  }

  const safeZoom = clamp(finiteNumber(zoom, 1), 1, 3);

  if (safeZoom <= 1) {
    return computeObjectFitContainRect(input);
  }

  return computeObjectFitCoverRect({
    ...input,
    zoom: safeZoom,
  });
}
