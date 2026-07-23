"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

import { PlusIcon } from "@/components/memory/memory-icons";
import { SortablePhotoGrid } from "@/components/memory/sortable-photo-grid";
import { ScrapTable } from "@/components/scrap/scrap-table";
import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  dailyStampAdditionalMomentCapacity,
} from "@/data/journal-product";
import type { JournalTheme } from "@/data/journal-themes";
import type { MemoryMediaConfig, MemoryPhoto } from "@/data/memory-demo";
import { createPhotoEditorPreview } from "@/lib/media/photo-optimisation";
import { cropMetadataToImageStyle } from "@/lib/scrap/crop-math";

type JournalPhotoPickerProps = {
  config: MemoryMediaConfig;
  photos: MemoryPhoto[];
  onChange: (photos: MemoryPhoto[]) => void;
  onRemovePhoto: (photo: MemoryPhoto) => void;
  registerObjectUrl: (url: string) => void;
  onPreparingChange?: (preparing: boolean) => void;
  theme?: JournalTheme;
};

function makePhotoId() {
  return crypto.randomUUID();
}

function isImageSelection(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].some(
      (extension) => name.endsWith(extension),
    )
  );
}

function draftPhoto(file: File, registerObjectUrl: (url: string) => void) {
  const objectUrl = URL.createObjectURL(file);
  registerObjectUrl(objectUrl);
  return {
    id: makePhotoId(),
    name: file.name,
    objectUrl,
    sizeBytes: file.size,
    mimeType: file.type,
    file,
    originalSizeBytes: file.size,
    status: "new" as const,
  };
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function draftAdditionalPhoto(
  file: File,
  config: MemoryMediaConfig,
  registerObjectUrl: (url: string) => void,
) {
  const preview = await createPhotoEditorPreview(file, config);
  const previewUrl = URL.createObjectURL(preview.file);
  registerObjectUrl(previewUrl);
  return {
    id: makePhotoId(),
    name: file.name,
    objectUrl: previewUrl,
    thumbnailObjectUrl: previewUrl,
    sizeBytes: file.size,
    mimeType: file.type,
    file,
    originalSizeBytes: file.size,
    status: "new" as const,
  };
}

function photoPreviewUrl(photo?: MemoryPhoto) {
  return photo?.objectUrl ?? photo?.thumbnailObjectUrl;
}

export function JournalPhotoPicker({
  config,
  photos,
  onChange,
  onRemovePhoto,
  registerObjectUrl,
  onPreparingChange,
  theme,
}: JournalPhotoPickerProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  const cover = photos[0];
  const additionalPhotos = photos.slice(1, DAILY_MEMORY_STAMP_MAX_PHOTOS);
  const [additionalOpen, setAdditionalOpen] = useState(
    additionalPhotos.length > 0,
  );
  const [message, setMessage] = useState("");
  const [pendingCover, setPendingCover] = useState<MemoryPhoto | null>(null);
  const [adjustingCover, setAdjustingCover] = useState(false);
  const [isPreparingAdditional, setIsPreparingAdditional] = useState(false);
  const coverCropStyle = cropMetadataToImageStyle(cover?.cropMetadata);
  const additionalCapacity = dailyStampAdditionalMomentCapacity(
    photos.length,
    config.maxPhotosPerMemory,
  );

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const firstUsableImage = (files: File[]) => {
    const imageFile = files.find(isImageSelection);
    if (!imageFile) {
      setMessage("Only images can become a Cover Scrap.");
      return undefined;
    }
    if (imageFile.size > config.maxPhotoFileSizeBytes) {
      setMessage("That image is larger than 25MB.");
      return undefined;
    }
    return imageFile;
  };

  const handleCover = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const imageFile = firstUsableImage(selectedFiles);
    if (!imageFile) return;

    const nextCover = draftPhoto(imageFile, registerObjectUrl);
    if (pendingCover) onRemovePhoto(pendingCover);
    setPendingCover(nextCover);
    setAdjustingCover(false);
    setMessage("");
  };

  const handleAdditional = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0 || !cover || isPreparingAdditional) return;

    const imageFiles = selectedFiles.filter(isImageSelection);
    const invalidTypeCount = selectedFiles.length - imageFiles.length;
    const allowedBySize = imageFiles.filter(
      (file) => file.size <= config.maxPhotoFileSizeBytes,
    );
    const oversizedCount = imageFiles.length - allowedBySize.length;
    const remainingAdditionalSlots = additionalCapacity.remaining;
    const acceptedFiles = allowedBySize.slice(0, remainingAdditionalSlots);
    const overLimitCount = allowedBySize.length - acceptedFiles.length;

    const explanations: string[] = [];
    if (invalidTypeCount > 0) {
      explanations.push("Only images can be added as moments.");
    }
    if (oversizedCount > 0) {
      explanations.push("Images larger than 25MB were not added.");
    }
    if (overLimitCount > 0) {
      explanations.push(
        additionalCapacity.limitedByJournalCapacity
          ? "This journal has reached its photo limit."
          : "This stamp already has its optional moments.",
      );
    }
    const nextPhotos: MemoryPhoto[] = [];
    setIsPreparingAdditional(true);
    onPreparingChange?.(true);
    try {
      for (let index = 0; index < acceptedFiles.length; index += 1) {
        setMessage(
          `Preparing moment ${index + 1} of ${acceptedFiles.length}…`,
        );
        await yieldToBrowser();
        try {
          nextPhotos.push(
            await draftAdditionalPhoto(
              acceptedFiles[index],
              config,
              registerObjectUrl,
            ),
          );
        } catch {
          explanations.push(
            `${acceptedFiles[index].name} could not be prepared.`,
          );
        }
      }

      const currentPhotos = photosRef.current;
      const currentCover = currentPhotos[0];
      const currentAdditional = currentPhotos.slice(
        1,
        DAILY_MEMORY_STAMP_MAX_PHOTOS,
      );
      if (currentCover?.id === cover.id && nextPhotos.length > 0) {
        onChange([currentCover, ...currentAdditional, ...nextPhotos]);
        setAdditionalOpen(true);
      }
    } finally {
      setIsPreparingAdditional(false);
      onPreparingChange?.(false);
    }
    setMessage(explanations.join(" "));
  };

  const removeCover = () => {
    if (!cover) return;
    onRemovePhoto(cover);
    onChange(additionalPhotos);
  };

  const removeAdditional = (photo: MemoryPhoto) => {
    onRemovePhoto(photo);
    onChange(photos.filter((candidate) => candidate.id !== photo.id));
  };

  const reorderAdditional = (nextAdditionalPhotos: MemoryPhoto[]) => {
    if (!cover) return;
    onChange([cover, ...nextAdditionalPhotos]);
  };

  const confirmCoverCrop = (cropMetadata: MemoryPhoto["cropMetadata"]) => {
    if (pendingCover) {
      const nextCover = { ...pendingCover, cropMetadata };
      if (cover) onRemovePhoto(cover);
      onChange([nextCover, ...additionalPhotos]);
      setPendingCover(null);
      setAdjustingCover(false);
      return;
    }

    if (cover) {
      onChange([{ ...cover, cropMetadata }, ...additionalPhotos]);
      setAdjustingCover(false);
    }
  };

  const cancelScrapTable = () => {
    if (pendingCover) {
      onRemovePhoto(pendingCover);
      setPendingCover(null);
    }
    setAdjustingCover(false);
  };

  const chooseAnotherCover = () => {
    if (pendingCover) {
      onRemovePhoto(pendingCover);
      setPendingCover(null);
    }
    setAdjustingCover(false);
    window.setTimeout(() => coverInputRef.current?.click(), 0);
  };

  const scrapTablePhoto = pendingCover ?? (adjustingCover ? cover : undefined);

  if (scrapTablePhoto) {
    if (typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <ScrapTable
        data-scrap-finder-portal="body-overlay"
        photo={scrapTablePhoto}
        initialCropMetadata={
          adjustingCover ? scrapTablePhoto.cropMetadata : undefined
        }
        onConfirmCrop={confirmCoverCrop}
        onCancel={cancelScrapTable}
        onChooseAnother={chooseAnotherCover}
        theme={theme}
      />,
      document.body,
    );
  }

  return (
    <section aria-labelledby="cover-scrap-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cover-scrap-title" className="font-sans text-sm font-semibold">
          Cover Scrap
        </h2>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCover}
        className="sr-only"
        aria-label="Choose today’s Cover Scrap"
      />

      {cover ? (
        <div className="mt-3">
          <div
            className="journal-cover-photo-preview relative aspect-square overflow-hidden bg-[var(--journal-filler-a)]"
            data-journal-cover-preview="editorial-photo"
            data-journal-cover-treatment="borderless-editorial"
            data-journal-cover-crop={cover?.cropMetadata ? "metadata" : "center"}
          >
            {photoPreviewUrl(cover) && coverCropStyle ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreviewUrl(cover)!}
                alt={cover.name}
                className="max-w-none"
                style={coverCropStyle}
              />
            ) : photoPreviewUrl(cover) ? (
              <Image
                src={photoPreviewUrl(cover)!}
                alt={cover.name}
                fill
                unoptimized
                sizes="(min-width: 480px) 430px, 100vw"
                className={coverCropStyle ? "max-w-none" : "object-cover"}
                style={coverCropStyle}
              />
            ) : (
              <span className="absolute inset-0 bg-[linear-gradient(135deg,var(--journal-filler-a),var(--journal-filler-b))]" />
            )}
            <span className="journal-cover-photo-label absolute left-3 top-3 z-10 px-2 py-1 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.12em]">
              Cover Scrap
            </span>
          </div>
          <div className="mt-3 flex gap-3 font-sans text-xs">
            <button
              type="button"
              onClick={() => setAdjustingCover(true)}
              disabled={isPreparingAdditional}
              className="font-semibold text-oxblood underline underline-offset-4"
            >
              Adjust scrap
            </button>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isPreparingAdditional}
              className="font-semibold text-oxblood underline underline-offset-4"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={removeCover}
              disabled={isPreparingAdditional}
              className="text-ink-soft underline underline-offset-4"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="journal-cover-empty-button mt-3 flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-sm px-4 text-center font-sans text-sm font-semibold"
        >
          <span className="journal-cover-empty-button__icon flex h-9 w-9 items-center justify-center rounded-full">
            <PlusIcon className="h-4 w-4" />
          </span>
          Choose today’s Cover Scrap
          <span className="max-w-[22ch] font-normal leading-relaxed">
            One photo is enough to seal the day.
          </span>
        </button>
      )}

      {cover ? (
        <section
          className="mt-6 border-t border-rule pt-4"
          aria-labelledby="additional-moments-title"
        >
          <button
            type="button"
            onClick={() => setAdditionalOpen((current) => !current)}
            disabled={isPreparingAdditional}
            className="flex w-full items-center justify-between gap-3 font-sans text-sm font-semibold text-ink"
            aria-expanded={additionalOpen}
            aria-controls="additional-moments-panel"
          >
            <span id="additional-moments-title">
              Add more moments (optional)
            </span>
            <PlusIcon
              className={`h-4 w-4 text-oxblood transition-transform ${
                additionalOpen ? "rotate-45" : ""
              }`}
            />
          </button>

          {additionalOpen ? (
            <div id="additional-moments-panel" className="mt-3">
              <p className="font-sans text-[0.68rem] leading-relaxed text-ink-soft">
                {additionalCapacity.remaining > 0 ? (
                  <>
                    Add up to {additionalCapacity.remaining} more{" "}
                    {additionalCapacity.remaining === 1 ? "moment" : "moments"}.
                  </>
                ) : additionalCapacity.limitedByJournalCapacity ? (
                  "This journal has reached its photo limit."
                ) : (
                  "This stamp already has all 8 optional moments."
                )}
              </p>
              <input
                ref={additionalInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={
                  additionalCapacity.remaining === 0 || isPreparingAdditional
                }
                onChange={(event) => void handleAdditional(event)}
                className="sr-only"
                aria-label="Add more moments"
              />
              <button
                type="button"
                disabled={
                  additionalCapacity.remaining === 0 || isPreparingAdditional
                }
                onClick={() => additionalInputRef.current?.click()}
                className="journal-add-moments-button mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-sm px-3 font-sans text-sm font-semibold disabled:cursor-not-allowed"
              >
                <PlusIcon className="h-4 w-4" />
                {isPreparingAdditional
                  ? "Preparing moments…"
                  : "Add moments"}
              </button>

              {additionalPhotos.length > 0 ? (
                <div className="mt-3">
                  <SortablePhotoGrid
                    photos={additionalPhotos}
                    onChange={reorderAdditional}
                    onRemove={removeAdditional}
                    disabled={isPreparingAdditional}
                    coverLabel=""
                    itemLabel="Moment"
                    stampFramePreview
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p
          className="mt-3 font-sans text-[0.68rem] leading-relaxed text-oxblood"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
