"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { PlusIcon } from "@/components/memory/memory-icons";
import { SortablePhotoGrid } from "@/components/memory/sortable-photo-grid";
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
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const isAtLimit = photos.length >= config.maxPhotosPerMemory;

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
      config.maxPhotosPerMemory - photos.length,
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
        `${newPhotos.length} ${newPhotos.length === 1 ? "photo was" : "photos were"} added. ${overLimitCount} ${overLimitCount === 1 ? "was" : "were"} not added because this memory allows up to ${config.maxPhotosPerMemory} photos.`,
      );
    }
    if (invalidTypeCount > 0) {
      explanations.push(
        `${invalidTypeCount} ${invalidTypeCount === 1 ? "file was" : "files were"} not added because only images are supported.`,
      );
    }
    if (oversizedCount > 0) {
      explanations.push(
        `${oversizedCount} ${oversizedCount === 1 ? "photo was" : "photos were"} not added because each source file must be 25MB or smaller.`,
      );
    }
    if (overLimitCount > 0 && newPhotos.length === 0) {
      explanations.push(
        `${overLimitCount} ${overLimitCount === 1 ? "photo was" : "photos were"} not added because this memory allows up to ${config.maxPhotosPerMemory} photos.`,
      );
    }
    setMessage(
      explanations.length > 0
        ? explanations.join(" ")
        : `${newPhotos.length} ${newPhotos.length === 1 ? "photo" : "photos"} added.`,
    );
  };

  return (
    <section aria-labelledby="photos-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="photos-title" className="font-sans text-sm font-semibold">
          Photographs
        </h2>
        <span className="font-sans text-[0.68rem] text-ink-soft">
          {photos.length} of {config.maxPhotosPerMemory} photos
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={isAtLimit}
        onChange={handleFiles}
        className="sr-only"
        aria-label="Choose photographs"
        aria-describedby={isAtLimit ? "photo-limit-message" : undefined}
      />
      <button
        type="button"
        disabled={isAtLimit}
        onClick={() => inputRef.current?.click()}
        aria-describedby={isAtLimit ? "photo-limit-message" : undefined}
        className="flex min-h-24 w-full items-center justify-center gap-3 rounded-sm border border-dashed border-oxblood/45 bg-paper-deep/20 font-sans text-sm font-semibold text-oxblood disabled:cursor-not-allowed disabled:border-rule disabled:bg-paper-deep/15 disabled:text-ink-soft/65"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-oxblood/45">
          <PlusIcon className="h-4 w-4" />
        </span>
        {isAtLimit
          ? "Photo limit reached"
          : photos.length === 0
            ? "Add photos"
            : "Add more photos"}
      </button>

      {isAtLimit ? (
        <p
          id="photo-limit-message"
          className="mt-2.5 font-sans text-[0.68rem] leading-relaxed text-ink-soft"
          role="status"
        >
          This memory has reached its {config.maxPhotosPerMemory}-photo limit.
          Remove a photo to add another.
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
            Retry Save after correcting the issue, or remove the affected photo.
          </p>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-3">
          <SortablePhotoGrid
            photos={photos}
            onChange={onReorder}
            onRemove={onRemove}
          />

          <p className="mt-2.5 font-sans text-[0.68rem] leading-relaxed text-ink-soft">
            Press and drag to reorder. The first photo appears largest.
          </p>
        </div>
      ) : null}
    </section>
  );
}
