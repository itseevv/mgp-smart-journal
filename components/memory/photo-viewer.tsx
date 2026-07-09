"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/memory/memory-icons";
import type { MemoryPhoto } from "@/data/memory-demo";

type PhotoViewerProps = {
  photos: MemoryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
};

const SWIPE_THRESHOLD_PX = 48;

export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  returnFocusRef,
  resolvePhotoUrl,
}: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const [loadedPhotoId, setLoadedPhotoId] = useState<string>();
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});
  const pendingPhotoIdsRef = useRef(new Set<string>());
  const indexRef = useRef(index);
  const canGoPrevious = index > 0;
  const canGoNext = index < photos.length - 1;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!resolvePhotoUrl) return;
    const adjacentPhotos = [
      index > 0 ? photos[index - 1] : undefined,
      index < photos.length - 1 ? photos[index + 1] : undefined,
    ].filter((photo): photo is MemoryPhoto => Boolean(photo));
    adjacentPhotos.forEach((photo) => {
      const existingUrl = refreshedUrls[photo.id] ?? photo.objectUrl;
      if (existingUrl) {
        const image = new window.Image();
        image.src = existingUrl;
        return;
      }
      if (pendingPhotoIdsRef.current.has(photo.id)) return;
      pendingPhotoIdsRef.current.add(photo.id);
      void resolvePhotoUrl(photo, "display")
        .then((url) => {
          setRefreshedUrls((current) => ({
            ...current,
            [photo.id]: url,
          }));
          const image = new window.Image();
          image.src = url;
        })
        .finally(() => pendingPhotoIdsRef.current.delete(photo.id));
    });
  }, [index, photos, refreshedUrls, resolvePhotoUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const focusableElements = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          ) ?? [],
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (
          event.shiftKey &&
          document.activeElement === firstElement
        ) {
          event.preventDefault();
          lastElement.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === lastElement
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      } else if (event.key === "ArrowLeft" && indexRef.current > 0) {
        event.preventDefault();
        onIndexChange(indexRef.current - 1);
      } else if (
        event.key === "ArrowRight" &&
        indexRef.current < photos.length - 1
      ) {
        event.preventDefault();
        onIndexChange(indexRef.current + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [onClose, onIndexChange, photos.length, returnFocusRef]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    if (startX === null) return;

    const distance = event.clientX - startX;
    if (distance <= -SWIPE_THRESHOLD_PX && canGoNext) {
      onIndexChange(index + 1);
    } else if (distance >= SWIPE_THRESHOLD_PX && canGoPrevious) {
      onIndexChange(index - 1);
    }
  };

  const photo = photos[index];
  const displayUrl = refreshedUrls[photo.id] ?? photo.objectUrl;
  const isLoading = loadedPhotoId !== photo.id;

  useEffect(() => {
    if (
      displayUrl ||
      !resolvePhotoUrl ||
      pendingPhotoIdsRef.current.has(photo.id)
    ) {
      return;
    }
    pendingPhotoIdsRef.current.add(photo.id);
    void resolvePhotoUrl(photo, "display")
      .then((url) =>
        setRefreshedUrls((current) => ({
          ...current,
          [photo.id]: url,
        })),
      )
      .finally(() => pendingPhotoIdsRef.current.delete(photo.id));
  }, [displayUrl, photo, resolvePhotoUrl]);

  const viewer = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="photo-viewer-fullscreen fixed inset-0 flex flex-col bg-[#090908] text-white"
      data-photo-viewer-overlay="fullscreen-viewport"
      data-photo-viewer-portal="document-body"
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <span className="font-sans text-xs tracking-[0.12em] text-white/75">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-white"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartXRef.current = null;
        }}
      >
        {isLoading ? (
          <div
            className="absolute inset-0 flex items-center justify-center font-sans text-xs tracking-[0.08em] text-white/65"
            role="status"
          >
            Loading photograph…
          </div>
        ) : null}
        {displayUrl ? (
          <Image
            key={photo.id}
            src={displayUrl}
            alt={photo.name}
            fill
            unoptimized
            sizes="100vw"
            className="pointer-events-none object-contain"
            data-photo-viewer-image="original-display"
            priority
            onLoad={() => setLoadedPhotoId(photo.id)}
            onError={() => {
              if (
                !resolvePhotoUrl ||
                pendingPhotoIdsRef.current.has(photo.id)
              ) {
                return;
              }
              pendingPhotoIdsRef.current.add(photo.id);
              void resolvePhotoUrl(photo, "display", true)
                .then((url) =>
                  setRefreshedUrls((current) => ({
                    ...current,
                    [photo.id]: url,
                  })),
                )
                .finally(() =>
                  pendingPhotoIdsRef.current.delete(photo.id),
                );
            }}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between px-4 py-5 sm:px-6">
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          disabled={!canGoPrevious}
          aria-label="Previous photo"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronLeftIcon />
        </button>
        <p
          className="max-w-[55vw] truncate font-sans text-xs text-white/65"
          data-photo-viewer-caption="simple-label"
        >
          Photograph {index + 1}
        </p>
        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          disabled={!canGoNext}
          aria-label="Next photo"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(viewer, document.body);
}
