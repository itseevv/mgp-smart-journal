"use client";

import { useRef, useState } from "react";

import { PrivatePhoto } from "@/components/memory/photo-collection";
import { PhotoViewer } from "@/components/memory/photo-viewer";
import { StampFrameButton } from "@/components/stamp/stamp-frame";
import {
  buildStampFrameRows,
  getStampFrameAspectRatio,
  getStampLayout,
} from "@/data/stamp-layouts";
import type { MemoryPhoto } from "@/data/memory-demo";
import { cropMetadataToImageStyle } from "@/lib/scrap/crop-math";

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

export function StampGrid({ photos, resolvePhotoUrl }: StampGridProps) {
  const layout = getStampLayout(photos.length);
  const visiblePhotos = photos.slice(0, layout.visiblePhotoCount);
  const rows = buildStampFrameRows(
    visiblePhotos.map((photo, index) => ({ photo, index })),
  );
  const frameRatio = getStampFrameAspectRatio();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
        className="space-y-1.5 bg-[var(--journal-paper-muted)] p-1.5 shadow-[inset_0_0_0_1px_var(--journal-stamp-border)] sm:space-y-2 sm:p-2"
        aria-label="Daily Memory Stamp"
        data-stamp-layout={layout.variant}
        data-stamp-photo-count={layout.visiblePhotoCount}
        data-stamp-row-sizes={layout.rowSizes.join(",")}
        data-stamp-frame-ratio={frameRatio}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${row.items.length}, minmax(0, 1fr))`,
            }}
            data-stamp-row-size={row.items.length}
          >
            {row.items.map(({ photo, index }: StampPhotoItem) => {
              const cropStyle =
                index === 0
                  ? cropMetadataToImageStyle(photo.cropMetadata)
                  : undefined;
              return (
                <StampFrameButton
                  key={photo.id}
                  variant="sm"
                  type="button"
                  onClick={(event) => openViewer(index, event.currentTarget)}
                  className="relative aspect-square min-w-0 overflow-hidden bg-[var(--journal-filler-a)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--journal-accent-metal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--journal-paper)]"
                  data-stamp-photo-frame="true"
                  data-stamp-frame-fit="cover"
                  data-stamp-cover-crop={
                    index === 0
                      ? cropStyle
                        ? "metadata"
                        : "center"
                      : undefined
                  }
                  aria-label={`Open ${photo.name} full screen`}
                >
                  <PrivatePhoto
                    photo={photo}
                    variant="display"
                    priority={index === 0}
                    sizes="(min-width: 768px) 180px, 33vw"
                    className={cropStyle ? "max-w-none" : "object-cover"}
                    imageStyle={cropStyle}
                    resolvePhotoUrl={resolvePhotoUrl}
                  />
                </StampFrameButton>
              );
            })}
          </div>
        ))}
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
