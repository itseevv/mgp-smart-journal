"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import type { MemoryPhoto, PhotoCropMetadata } from "@/data/memory-demo";
import { StampFrame } from "@/components/stamp/stamp-frame";
import {
  centerSquareCropMetadata,
  clampCoverViewState,
  computeCoverCropMetadata,
  getCoverScale,
  viewStateFromCropMetadata,
} from "@/lib/scrap/crop-math";

type ScrapTableProps = {
  photo: MemoryPhoto;
  initialCropMetadata?: PhotoCropMetadata;
  onConfirmCrop: (cropMetadata: PhotoCropMetadata) => void;
  onCancel: () => void;
  onChooseAnother?: () => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
};

function photoUrl(photo: MemoryPhoto) {
  return photo.objectUrl ?? photo.thumbnailObjectUrl;
}

function photoSizeLabel(width: number, height: number) {
  if (!width || !height) return "";
  return `${Math.round(width)} x ${Math.round(height)}`;
}

export function ScrapTable({
  photo,
  initialCropMetadata,
  onConfirmCrop,
  onCancel,
  onChooseAnother,
}: ScrapTableProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const sourceUrl = photoUrl(photo);
  const [frameSize, setFrameSize] = useState(0);
  const [imageSize, setImageSize] = useState({
    width: photo.width ?? initialCropMetadata?.imageWidth ?? 0,
    height: photo.height ?? initialCropMetadata?.imageHeight ?? 0,
  });
  const [view, setView] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [confirmed, setConfirmed] = useState(false);
  const hasImageDimensions = imageSize.width > 0 && imageSize.height > 0;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameSize(rect.width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!frameSize || !hasImageDimensions) return;
    const frame = window.requestAnimationFrame(() => {
      setView(viewStateFromCropMetadata({
        cropMetadata: initialCropMetadata,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        frameSize,
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    frameSize,
    hasImageDimensions,
    imageSize.height,
    imageSize.width,
    initialCropMetadata,
    photo.id,
  ]);

  const safeFrameSize = frameSize || 1;
  const scale = hasImageDimensions
    ? getCoverScale({
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        frameSize: safeFrameSize,
        zoom: view.zoom,
      })
    : 1;
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const imageStyle = useMemo(
    (): CSSProperties =>
      hasImageDimensions
        ? {
            left: `${(safeFrameSize - renderedWidth) / 2 + view.offsetX}px`,
            top: `${(safeFrameSize - renderedHeight) / 2 + view.offsetY}px`,
            width: `${renderedWidth}px`,
            height: `${renderedHeight}px`,
            maxWidth: "none",
            maxHeight: "none",
          }
        : {
            left: "50%",
            top: "50%",
            width: "auto",
            height: "auto",
            maxWidth: "none",
            maxHeight: "none",
            transform: "translate(-50%, -50%)",
          },
    [
      hasImageDimensions,
      renderedHeight,
      renderedWidth,
      safeFrameSize,
      view.offsetX,
      view.offsetY,
    ],
  );

  const setClampedView = (nextView: typeof view) => {
    if (!hasImageDimensions) return;
    setView(
      clampCoverViewState({
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        frameSize: safeFrameSize,
        ...nextView,
      }),
    );
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasImageDimensions) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setClampedView({
      ...view,
      offsetX: drag.offsetX + event.clientX - drag.startX,
      offsetY: drag.offsetY + event.clientY - drag.startY,
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const reset = () => {
    setView(
      viewStateFromCropMetadata({
        cropMetadata: centerSquareCropMetadata({
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
        }),
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        frameSize: safeFrameSize,
      }),
    );
  };

  const confirm = () => {
    if (!sourceUrl || !hasImageDimensions || !frameSize) return;
    const cropMetadata = computeCoverCropMetadata({
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      frameSize: safeFrameSize,
      ...view,
    });
    setConfirmed(true);
    if ("vibrate" in navigator) navigator.vibrate?.(10);
    window.setTimeout(() => onConfirmCrop(cropMetadata), 140);
  };

  return (
    <article
      className="fixed inset-0 z-50 overflow-hidden bg-[#16201f] text-paper"
      data-scrap-table="true"
      data-scrap-table-mode="immersive"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scrap-table-title"
    >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_38%),linear-gradient(180deg,rgba(9,14,15,0.15),rgba(0,0,0,0.24))]" />
      <div
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-[27rem] flex-col overflow-y-auto px-3"
        data-scrap-mobile-shell="true"
        data-scrap-layout="tight-mobile"
      >
        <header className="flex items-start justify-between gap-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div>
            <h1
              id="scrap-table-title"
              className="font-serif text-[1.72rem] leading-none text-paper"
            >
              Find today&apos;s scrap
            </h1>
            <p className="mt-2 font-sans text-xs leading-relaxed text-paper/72">
              Move the photo under the finder.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-9 shrink-0 rounded-full border border-paper/18 px-3 font-sans text-xs font-semibold text-paper/78"
            aria-label="Close Scrap Table"
          >
            Close
          </button>
        </header>

        <div
          className="relative flex shrink-0 items-start justify-center pb-2 pt-1"
          data-scrap-photo-stage="true"
        >
          <div
            className={`relative w-[min(88vw,calc(100dvh-17rem),24.5rem)] rounded-[1.4rem] bg-[#b9cdd1] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(57,75,79,0.3)] ${
              confirmed ? "scrap-table-punch" : ""
            }`}
            data-finder-tool="physical-frame"
            data-scrap-finder-plate="true"
            data-punch-feedback="enabled"
            data-scrap-punch-feedback={confirmed ? "pressed" : "ready"}
          >
            <div className="absolute -right-2 top-1/2 h-24 w-5 -translate-y-1/2 rounded-r-[1rem] bg-[#8ca9af] shadow-[inset_1px_0_0_rgba(255,255,255,0.34),2px_8px_18px_rgba(0,0,0,0.14)]" />
            <div className="absolute left-1/2 top-1 h-2.5 w-16 -translate-x-1/2 rounded-b-full bg-[#d3e0e2] shadow-[inset_0_-1px_0_rgba(57,75,79,0.18)]" />
            <StampFrame
              ref={frameRef}
              variant="lg"
              className="relative aspect-square touch-none overflow-hidden rounded-[0.34rem] bg-ink"
              data-scrap-aperture="stamp-window"
              data-scrap-frame="square"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {sourceUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sourceUrl}
                  alt={photo.name}
                  draggable={false}
                  className="absolute max-w-none select-none"
                  data-scrap-photo-natural="true"
                  style={imageStyle}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setImageSize({
                      width: img.naturalWidth || photo.width || 1,
                      height: img.naturalHeight || photo.height || 1,
                    });
                  }}
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-paper-deep px-6 text-center font-sans text-xs text-ink-soft">
                  This photograph is not available.
                </span>
              )}
              <div
                className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.035)]"
                aria-hidden="true"
              />
            </StampFrame>
            <div
              className="pointer-events-none absolute inset-3 rounded-[0.86rem] border border-[#6d858b]/42 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)]"
              aria-hidden="true"
            />
          </div>
        </div>

        <footer
          className="pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1"
          data-scrap-controls="tight"
        >
          <div className="mx-auto max-w-md">
            <label
              htmlFor="scrap-zoom"
              className="mb-2 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper/62"
            >
              Zoom
            </label>
            <input
              id="scrap-zoom"
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={view.zoom}
              onChange={(event) =>
                setClampedView({
                  ...view,
                  zoom: Number(event.target.value),
                })
              }
              className="w-full accent-[#d8c28d]"
            />
            <p className="mt-2 font-sans text-[0.68rem] text-paper/58">
              {photoSizeLabel(imageSize.width, imageSize.height)}
            </p>

            <button
              type="button"
              onClick={confirm}
              disabled={!sourceUrl || !hasImageDimensions || !frameSize}
              className="mt-4 min-h-13 w-full rounded-sm bg-paper px-5 py-4 font-sans text-sm font-semibold text-ink shadow-[0_10px_24px_rgba(0,0,0,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use this scrap
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {onChooseAnother ? (
                <button
                  type="button"
                  onClick={onChooseAnother}
                  className="rounded-sm border border-paper/18 px-2 py-3 font-sans text-xs font-semibold text-paper/88"
                >
                  Choose another
                </button>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="rounded-sm border border-paper/18 px-2 py-3 font-sans text-xs font-semibold text-paper/88"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-sm border border-paper/18 px-2 py-3 font-sans text-xs font-semibold text-paper/70"
              >
                Cancel
              </button>
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}
