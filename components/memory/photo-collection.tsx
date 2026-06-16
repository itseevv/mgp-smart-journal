"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { PhotoViewer } from "@/components/memory/photo-viewer";
import type { MemoryPhoto } from "@/data/memory-demo";

type PhotoCollectionProps = {
  photos: MemoryPhoto[];
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
};

type PrivatePhotoProps = {
  photo: MemoryPhoto;
  variant: "display" | "thumbnail";
  priority?: boolean;
  sizes: string;
  className: string;
  resolvePhotoUrl?: PhotoCollectionProps["resolvePhotoUrl"];
  deferUntilVisible?: boolean;
  visibilityRootRef?: RefObject<HTMLDivElement | null>;
};

function PrivatePhoto({
  photo,
  variant,
  priority,
  sizes,
  className,
  resolvePhotoUrl,
  deferUntilVisible = false,
  visibilityRootRef,
}: PrivatePhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!deferUntilVisible);
  const initialUrl =
    variant === "thumbnail"
      ? photo.thumbnailObjectUrl ?? photo.objectUrl
      : photo.objectUrl;
  const [readyUrl, setReadyUrl] = useState<string>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [displayLoaded, setDisplayLoaded] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestPendingRef = useRef(false);
  const imageRetryRef = useRef(false);

  const replaceReadyUrl = useCallback((url: string) => {
    setDisplayLoaded(false);
    setReadyUrl(url);
  }, []);

  useEffect(() => {
    if (
      variant !== "display" ||
      !photo.thumbnailStoragePath ||
      !resolvePhotoUrl ||
      readyUrl ||
      previewUrl
    ) {
      return;
    }

    let active = true;
    void resolvePhotoUrl(photo, "thumbnail")
      .then((url) => {
        if (!active || displayLoaded) return;
        setPreviewLoaded(false);
        setPreviewUrl(url);
      })
      .catch(() => {
        // The display image remains the authoritative fallback.
      });

    return () => {
      active = false;
    };
  }, [
    photo,
    displayLoaded,
    previewUrl,
    readyUrl,
    resolvePhotoUrl,
    variant,
  ]);

  const resolveAndLoad = useCallback(
    async (forceRefresh = false) => {
      if (requestPendingRef.current) return;
      requestPendingRef.current = true;
      setLoadError("");
      try {
        const resolvedUrl =
          !forceRefresh && initialUrl
            ? initialUrl
            : await resolvePhotoUrl?.(photo, variant, forceRefresh);
        if (!resolvedUrl) {
          throw new Error("A private photograph URL could not be resolved.");
        }
        replaceReadyUrl(resolvedUrl);
      } catch (firstError) {
        if (!forceRefresh && resolvePhotoUrl) {
          try {
            const refreshedUrl = await resolvePhotoUrl(photo, variant, true);
            replaceReadyUrl(refreshedUrl);
            return;
          } catch {
            // Report the original failure after one fresh-URL retry.
          }
        }
        setLoadError("Photograph unavailable. Open to retry.");
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[private-media] photo preload failed",
            firstError instanceof Error ? firstError.message : "unknown error",
          );
        }
      } finally {
        requestPendingRef.current = false;
      }
    },
    [initialUrl, photo, replaceReadyUrl, resolvePhotoUrl, variant],
  );

  useEffect(() => {
    if (!deferUntilVisible || isVisible) return;
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        root: visibilityRootRef?.current ?? null,
        rootMargin: "0px 160px",
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [deferUntilVisible, isVisible, visibilityRootRef]);

  useEffect(() => {
    if (!isVisible || readyUrl || requestPendingRef.current) return;
    imageRetryRef.current = false;
    void resolveAndLoad();
  }, [isVisible, readyUrl, resolveAndLoad]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {isVisible && previewUrl ? (
        <Image
          src={previewUrl}
          alt=""
          aria-hidden="true"
          fill
          priority={priority}
          unoptimized
          sizes={sizes}
          className={`${className} transition-opacity duration-200 ${
            previewLoaded && !displayLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setPreviewLoaded(true)}
          onError={() => {
            setPreviewLoaded(false);
            setPreviewUrl(undefined);
          }}
        />
      ) : null}

      {isVisible && readyUrl ? (
        <Image
          src={readyUrl}
          alt={photo.name}
          fill
          priority={priority}
          loading={priority ? undefined : "lazy"}
          unoptimized
          sizes={sizes}
          className={`${className} transition-opacity duration-200 ${
            displayLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => {
            imageRetryRef.current = false;
            setDisplayLoaded(true);
            setPreviewUrl(undefined);
          }}
          onError={() => {
            setDisplayLoaded(false);
            setReadyUrl(undefined);
            if (!imageRetryRef.current && resolvePhotoUrl) {
              imageRetryRef.current = true;
              void resolveAndLoad(true);
              return;
            }
            setLoadError("Photograph unavailable. Open to retry.");
          }}
        />
      ) : null}

      {isVisible && loadError && !previewLoaded && !displayLoaded ? (
        <span className="absolute inset-0 flex items-center justify-center bg-paper-deep px-2 text-center font-sans text-[0.62rem] font-semibold leading-relaxed text-oxblood">
          Photograph unavailable. Open to retry.
        </span>
      ) : !previewLoaded && !displayLoaded ? (
        <span className="absolute inset-0 flex items-center justify-center bg-paper-deep/70">
          {isVisible ? (
            <span className="font-sans text-[0.62rem] text-ink-soft" role="status">
              Loading…
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export function PhotoCollection({
  photos,
  resolvePhotoUrl,
}: PhotoCollectionProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [firstPhoto, ...remainingPhotos] = photos;

  const openViewer = (
    index: number,
    trigger: HTMLButtonElement,
  ) => {
    returnFocusRef.current = trigger;
    setViewerIndex(index);
  };
  const closeViewer = useCallback(() => setViewerIndex(null), []);
  const changeViewerIndex = useCallback(
    (index: number) => setViewerIndex(index),
    [],
  );

  return (
    <div>
      <button
        type="button"
        onClick={(event) => openViewer(0, event.currentTarget)}
        aria-label={`Open ${firstPhoto.name} in photo viewer`}
        aria-haspopup="dialog"
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-sm bg-paper-deep"
      >
        <PrivatePhoto
          photo={firstPhoto}
          variant="display"
          priority
          sizes="(min-width: 640px) 560px, 100vw"
          className="object-cover"
          resolvePhotoUrl={resolvePhotoUrl}
        />
      </button>

      {remainingPhotos.length > 0 ? (
        <div
          ref={carouselRef}
          className="mt-2.5 flex snap-x gap-2 overflow-x-auto pb-1"
          aria-label="Additional photographs"
        >
          {remainingPhotos.map((photo, index) => (
            <button
              type="button"
              onClick={(event) =>
                openViewer(index + 1, event.currentTarget)
              }
              aria-label={`Open ${photo.name} in photo viewer`}
              aria-haspopup="dialog"
              className="relative aspect-square w-[4.65rem] shrink-0 snap-start overflow-hidden rounded-[2px] bg-paper-deep sm:w-[5.5rem]"
              key={photo.id}
            >
              <PrivatePhoto
                photo={photo}
                variant="thumbnail"
                sizes="100px"
                className="object-cover"
                resolvePhotoUrl={resolvePhotoUrl}
                deferUntilVisible
                visibilityRootRef={carouselRef}
              />
            </button>
          ))}
        </div>
      ) : null}

      {viewerIndex !== null ? (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={changeViewerIndex}
          onClose={closeViewer}
          returnFocusRef={returnFocusRef}
          resolvePhotoUrl={resolvePhotoUrl}
        />
      ) : null}
    </div>
  );
}
