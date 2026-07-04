"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { PlusIcon } from "@/components/memory/memory-icons";
import { SortablePhotoGrid } from "@/components/memory/sortable-photo-grid";
import {
  getMemoryFormProductRules,
  type MemoryFormProductMode,
} from "@/data/memory-form-product";
import type {
  MemoryMediaConfig,
  MemoryPhoto,
} from "@/data/memory-demo";

type PhotoPickerProps = {
  config: MemoryMediaConfig;
  photos: MemoryPhoto[];
  onAdd: (photos: MemoryPhoto[]) => void;
  onReorder: (photos: MemoryPhoto[]) => void;
  onRemove: (photo: MemoryPhoto) => void;
  registerObjectUrl: (url: string) => void;
  productMode?: MemoryFormProductMode;
};

function makePhotoId(file: File, index: number) {
  void index;
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

export function PhotoPicker({
  config,
  photos,
  onAdd,
  onReorder,
  onRemove,
  registerObjectUrl,
  productMode = "memory",
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const productRules = getMemoryFormProductRules(productMode);
  const { copy } = productRules;
  const maxPhotosPerEntry = Math.min(
    config.maxPhotosPerMemory,
    productRules.maxPhotosPerEntry,
  );
  const isAtLimit = photos.length >= maxPhotosPerEntry;

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const imageFiles = selectedFiles.filter(isImageSelection);
    const invalidTypeCount = selectedFiles.length - imageFiles.length;
    const allowedBySize = imageFiles.filter(
      (file) => file.size <= config.maxPhotoFileSizeBytes,
    );
    const oversizedCount = imageFiles.length - allowedBySize.length;
    const remainingSlots = Math.max(
      0,
      maxPhotosPerEntry - photos.length,
    );
    const acceptedFiles = allowedBySize.slice(0, remainingSlots);
    const overLimitCount = allowedBySize.length - acceptedFiles.length;

    const newPhotos = acceptedFiles.map((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      registerObjectUrl(objectUrl);
      return {
        id: makePhotoId(file, index),
        name: file.name,
        objectUrl,
        sizeBytes: file.size,
        mimeType: file.type,
        file,
        originalSizeBytes: file.size,
        status: "new" as const,
      };
    });

    if (newPhotos.length > 0) onAdd(newPhotos);

    const explanations: string[] = [];
    if (newPhotos.length > 0 && overLimitCount > 0) {
      explanations.push(
        copy.photoPartialLimitMessage(
          newPhotos.length,
          overLimitCount,
          maxPhotosPerEntry,
        ),
      );
    }
    if (invalidTypeCount > 0) {
      explanations.push(
        `${invalidTypeCount} ${invalidTypeCount === 1 ? "file was" : "files were"} not added because only images are supported.`,
      );
    }
    if (oversizedCount > 0) {
      explanations.push(copy.photoOversizedMessage(oversizedCount));
    }
    if (overLimitCount > 0 && newPhotos.length === 0) {
      explanations.push(
        copy.photoOverLimitMessage(overLimitCount, maxPhotosPerEntry),
      );
    }
    setMessage(
      explanations.length > 0
        ? explanations.join(" ")
        : copy.photoAddedMessage(newPhotos.length),
    );
  };

  return (
    <section aria-labelledby="photos-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="photos-title" className="font-sans text-sm font-semibold">
          {copy.photoSectionTitle}
        </h2>
        <span className="shrink-0 font-sans text-[0.68rem] text-ink-soft">
          {photos.length} of {maxPhotosPerEntry} {copy.photoCounterUnit}
        </span>
      </div>
      {copy.photoHelper ? (
        <p className="-mt-2 mb-3 font-sans text-[0.68rem] leading-relaxed text-ink-soft">
          {copy.photoHelper}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={isAtLimit}
        onChange={handleFiles}
        className="sr-only"
        aria-label={copy.photoChooseAriaLabel}
        aria-describedby={isAtLimit ? "photo-limit-message" : undefined}
      />
      <button
        type="button"
        disabled={isAtLimit}
        onClick={() => inputRef.current?.click()}
        aria-describedby={isAtLimit ? "photo-limit-message" : undefined}
        className="flex min-h-24 w-full items-center justify-center gap-3 rounded-sm border border-dashed border-oxblood/45 bg-paper-deep/20 px-3 font-sans text-sm font-semibold text-oxblood disabled:cursor-not-allowed disabled:border-rule disabled:bg-paper-deep/15 disabled:text-ink-soft/65"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-oxblood/45">
          <PlusIcon className="h-4 w-4" />
        </span>
        {isAtLimit
          ? copy.photoLimitReached
          : photos.length === 0
            ? copy.addEmptyPhotos
            : copy.addMorePhotos}
      </button>

      {isAtLimit ? (
        <p
          id="photo-limit-message"
          className="mt-2.5 font-sans text-[0.68rem] leading-relaxed text-ink-soft"
          role="status"
        >
          {copy.photoLimitMessage(maxPhotosPerEntry)}
        </p>
      ) : null}

      {message ? (
        <p className="mt-2.5 font-sans text-[0.68rem] leading-relaxed text-ink-soft" role="status">
          {message}
        </p>
      ) : null}

      {photos.some((photo) => photo.status === "failed" && photo.error) ? (
        <div className="mt-3 space-y-1.5" role="alert">
          {photos
            .filter((photo) => photo.status === "failed" && photo.error)
            .map((photo) => (
              <p
                key={photo.id}
                className="font-sans text-[0.68rem] leading-relaxed text-oxblood"
              >
                <span className="font-semibold">{photo.name}:</span>{" "}
                {photo.error}
              </p>
            ))}
          <p className="font-sans text-[0.68rem] text-ink-soft">
            {copy.failedPhotoRetry}
          </p>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-3">
          <SortablePhotoGrid
            photos={photos}
            onChange={onReorder}
            onRemove={onRemove}
            coverLabel={copy.coverLabel}
            itemLabel={copy.sortableItemLabel}
          />

          <p className="mt-2.5 font-sans text-[0.68rem] leading-relaxed text-ink-soft">
            {copy.reorderHelp}
          </p>
        </div>
      ) : null}
    </section>
  );
}
