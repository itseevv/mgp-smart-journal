import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  DEFAULT_STAMP_FRAME_ASPECT_RATIO,
  STAMP_FRAME_RATIO_MODE,
} from "./journal-product.ts";

export type StampLayoutVariant =
  | "single"
  | "two-up"
  | "cover-plus-two"
  | "balanced-four"
  | "cover-plus-four"
  | "six-grid"
  | "cover-three-three"
  | "two-three-three"
  | "three-three-three";

export type StampLayout = {
  variant: StampLayoutVariant;
  visiblePhotoCount: number;
  rowSizes: number[];
};

export type StampLayoutRow<T> = {
  id: string;
  items: T[];
};

export function getStampFrameAspectRatio() {
  if (STAMP_FRAME_RATIO_MODE === "square") {
    return DEFAULT_STAMP_FRAME_ASPECT_RATIO;
  }

  return DEFAULT_STAMP_FRAME_ASPECT_RATIO;
}

export function getStampLayout(photoCount: number): StampLayout {
  const visiblePhotoCount = Math.min(
    Math.max(0, photoCount),
    DAILY_MEMORY_STAMP_MAX_PHOTOS,
  );

  if (visiblePhotoCount <= 1) {
    return { variant: "single", visiblePhotoCount, rowSizes: [visiblePhotoCount] };
  }
  if (visiblePhotoCount === 2) {
    return { variant: "two-up", visiblePhotoCount, rowSizes: [2] };
  }
  if (visiblePhotoCount === 3) {
    return { variant: "cover-plus-two", visiblePhotoCount, rowSizes: [1, 2] };
  }
  if (visiblePhotoCount === 4) {
    return { variant: "balanced-four", visiblePhotoCount, rowSizes: [2, 2] };
  }
  if (visiblePhotoCount === 5) {
    return { variant: "cover-plus-four", visiblePhotoCount, rowSizes: [1, 2, 2] };
  }
  if (visiblePhotoCount === 6) {
    return { variant: "six-grid", visiblePhotoCount, rowSizes: [3, 3] };
  }
  if (visiblePhotoCount === 7) {
    return {
      variant: "cover-three-three",
      visiblePhotoCount,
      rowSizes: [1, 3, 3],
    };
  }
  if (visiblePhotoCount === 8) {
    return {
      variant: "two-three-three",
      visiblePhotoCount,
      rowSizes: [2, 3, 3],
    };
  }

  return {
    variant: "three-three-three",
    visiblePhotoCount,
    rowSizes: [3, 3, 3],
  };
}

export function buildStampFrameRows<T>(items: T[]): StampLayoutRow<T>[] {
  const layout = getStampLayout(items.length);
  const visibleItems = items.slice(0, layout.visiblePhotoCount);
  let cursor = 0;

  return layout.rowSizes
    .filter((rowSize) => rowSize > 0)
    .map((rowSize, index) => {
      const rowItems = visibleItems.slice(cursor, cursor + rowSize);
      cursor += rowSize;
      return {
        id: `stamp-row-${index + 1}`,
        items: rowItems,
      };
    });
}
