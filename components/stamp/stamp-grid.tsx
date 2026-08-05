"use client";

import { useRef, useState } from "react";

import { PrivatePhoto } from "@/components/memory/photo-collection";
import { PhotoViewer } from "@/components/memory/photo-viewer";
import {
  CroppedPrivateStampImage,
  stampCropRender,
} from "@/components/stamp/cropped-stamp-image";
import {
  getStampFrameAspectRatio,
  getStampLayout,
} from "@/data/stamp-layouts";
import type { MemoryPhoto } from "@/data/memory-demo";

type StampGridProps = {
  photos: MemoryPhoto[];
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
};

type StampPhotoItem = {
  index: number;
  photo: MemoryPhoto;
};

function gridColumns(photoCount: number) {
  if (photoCount <= 1) return 1;
  if (photoCount <= 4) return 2;
  return 3;
}

const gridColumnClassName: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function StampGrid({ photos, resolvePhotoUrl }: StampGridProps) {
  const layout = getStampLayout(photos.length);
  const visiblePhotos = photos.slice(0, layout.visiblePhotoCount);
  const items = visiblePhotos.map((photo, index) => ({ photo, index }));
  const columns = gridColumns(visiblePhotos.length);
  const frameRatio = getStampFrameAspectRatio();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const imageSizes = "(min-width: 768px) 420px, calc(100vw - 2rem)";

  const openViewer = (
    index: number,
    trigger: HTMLButtonElement,
  ) => {
    returnFocusRef.current = trigger;
    setViewerIndex(index);
  };

  return (
    <>
      <div
        className={`daily-detail-photo-grid grid ${gridColumnClassName[columns]} gap-1.5 sm:gap-2`}
        aria-label="Daily Memory Stamp"
        data-daily-detail-photo-grid="borderless-adaptive"
        data-stamp-app-grid="daily-detail-photo-grid"
        data-stamp-grid-columns={columns}
        data-stamp-layout={layout.variant}
        data-stamp-photo-count={layout.visiblePhotoCount}
        data-stamp-row-sizes={layout.rowSizes.join(",")}
        data-stamp-frame-ratio={frameRatio}
        data-daily-detail-photo-ratio={frameRatio}
      >
        {items.map(({ photo, index }: StampPhotoItem) => {
          const cropMode =
            index === 0
              ? stampCropRender({
                  cropMetadata: photo.cropMetadata,
                  width: photo.width ?? photo.thumbnailWidth,
                  height: photo.height ?? photo.thumbnailHeight,
                }).mode
              : undefined;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={(event) => openViewer(index, event.currentTarget)}
              className="daily-detail-photo-tile relative aspect-square min-w-0 overflow-hidden bg-[var(--journal-filler-a)]"
              data-daily-detail-photo-tile="borderless-square"
              data-daily-detail-photo-fit="cover"
              data-stamp-cover-crop={index === 0 ? cropMode : undefined}
              aria-label={`Open ${photo.name} full screen`}
            >
              {index === 0 ? (
                <CroppedPrivateStampImage
                  photo={photo}
                  variant="display"
                  priority
                  sizes={imageSizes}
                  resolvePhotoUrl={resolvePhotoUrl}
                />
              ) : (
                <PrivatePhoto
                  photo={photo}
                  variant="thumbnail"
                  sizes={imageSizes}
                  className="object-cover"
                  resolvePhotoUrl={resolvePhotoUrl}
                />
              )}
            </button>
          );
        })}
      </div>

      {viewerIndex !== null ? (
        <PhotoViewer
          photos={visiblePhotos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          returnFocusRef={returnFocusRef}
          resolvePhotoUrl={resolvePhotoUrl}
        />
      ) : null}
    </>
  );
}
