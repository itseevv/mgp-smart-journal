"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import { JournalPrimaryCTA } from "@/components/journal/journal-visual-primitives";
import {
  defaultJournalTheme,
  journalThemeStyle,
  type JournalTheme,
} from "@/data/journal-themes";
import type { MemoryPhoto, PhotoCropMetadata } from "@/data/memory-demo";
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
  theme?: JournalTheme;
  "data-scrap-finder-portal"?: "body-overlay";
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

export function ScrapTable({
  photo,
  initialCropMetadata,
  onConfirmCrop,
  onCancel,
  onChooseAnother,
  theme = defaultJournalTheme,
  "data-scrap-finder-portal": finderPortal,
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
  const themeStyle = useMemo(() => journalThemeStyle(theme), [theme]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
      className="scrap-table-overlay"
      data-scrap-table="true"
      data-scrap-finder-portal={finderPortal}
      data-scrap-table-mode="immersive"
      data-scrap-table-presentation="dedicated-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scrap-table-title"
      style={themeStyle}
    >
      <div
        className="scrap-table-screen journal-themed-background relative flex flex-col bg-[var(--journal-background)] text-[var(--journal-text)]"
        data-scrap-table-screen="mobile-standalone"
        data-scrap-finder-background="themed-leather"
        style={themeStyle}
      >
        <div className="editorial-leather-vignette absolute inset-0" />
        <div
          className="relative mx-auto flex h-full min-h-0 w-full max-w-[27rem] flex-col overflow-hidden px-3"
          data-scrap-mobile-shell="true"
          data-scrap-layout="dedicated-mobile"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
            <div>
              <h1
                id="scrap-table-title"
                className="scrap-finder-title font-serif text-[1.72rem] leading-none text-[var(--journal-home-month-title)]"
              >
                Find Your Cover Scrap
              </h1>
              <p className="scrap-finder-helper mt-2 font-sans text-xs leading-relaxed text-[var(--journal-muted)]">
                Move the photo under the finder.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="scrap-finder-close-button min-h-9 shrink-0 px-3 font-sans text-xs font-semibold opacity-80"
              aria-label="Close"
              data-scrap-action="close"
            >
              Close
            </button>
          </header>

          <div
            className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-2"
            data-scrap-photo-stage="true"
          >
            <div
              className={`scrap-finder-surface relative w-[min(88vw,calc(100dvh-17rem),24.5rem)] p-3 ${
                confirmed ? "scrap-table-punch" : ""
              }`}
              data-finder-tool="editorial-finder"
              data-scrap-finder-plate="true"
              data-punch-feedback="enabled"
              data-scrap-punch-feedback={confirmed ? "pressed" : "ready"}
            >
              <div
                ref={frameRef}
                className="scrap-finder-window relative aspect-square touch-none overflow-hidden"
                data-scrap-aperture="finder-window"
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
                  <span className="absolute inset-0 flex items-center justify-center bg-[var(--journal-paper-muted)] px-6 text-center font-sans text-xs text-[var(--journal-paper-muted-text)]">
                    This photograph is not available.
                  </span>
                )}
                <div className="scrap-finder-window-mask pointer-events-none absolute inset-0" aria-hidden="true" />
              </div>
              <div
                className="scrap-finder-boundary pointer-events-none absolute inset-3"
                aria-hidden="true"
              />
            </div>
            <div
              className="scrap-finder-zoom-safe-zone mx-auto"
              data-scrap-zoom-group="finder-photo"
              data-scrap-zoom-safe-zone="centered"
            >
              <label
                htmlFor="scrap-zoom"
                className="mb-2 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--journal-muted)]"
              >
                Zoom
              </label>
              <input
                id="scrap-zoom"
                type="range"
                suppressHydrationWarning
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
                className="scrap-finder-zoom-slider"
                data-scrap-zoom-control="safe-range"
              />
            </div>
          </div>

          <footer
            className="shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
            data-scrap-controls="action-row"
          >
            <div className="mx-auto max-w-md">
              <JournalPrimaryCTA
                type="button"
                onClick={confirm}
                disabled={!sourceUrl || !hasImageDimensions || !frameSize}
                className="scrap-finder-primary-button journal-primary-bottom-cta"
                data-scrap-primary-action="use-this-scrap"
                data-scrap-primary-cta-visual="journal-primary-bottom-cta"
              >
                Use this scrap
              </JournalPrimaryCTA>
              <div
                className={`mt-2 grid gap-2 ${
                  onChooseAnother ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                {onChooseAnother ? (
                  <button
                    type="button"
                    onClick={onChooseAnother}
                    className="scrap-finder-secondary-button px-2 py-3 font-sans text-xs font-semibold opacity-90"
                    data-scrap-secondary-action="choose-another"
                  >
                    Choose another
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={reset}
                  className="scrap-finder-secondary-button px-2 py-3 font-sans text-xs font-semibold opacity-90"
                  data-scrap-secondary-action="reset"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="scrap-finder-secondary-button px-2 py-3 font-sans text-xs font-semibold opacity-70"
                  data-scrap-secondary-action="cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}
