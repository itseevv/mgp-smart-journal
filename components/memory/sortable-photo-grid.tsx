"use client";

import Image from "next/image";
import { useState } from "react";
import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import {
  isSortable,
  useSortable,
} from "@dnd-kit/react/sortable";
import {
  AutoScroller,
  PointerActivationConstraints,
} from "@dnd-kit/dom";

import { TrashIcon } from "@/components/memory/memory-icons";
import { movePhoto } from "@/components/memory/photo-order";
import type { MemoryPhoto } from "@/data/memory-demo";

type SortablePhotoGridProps = {
  photos: MemoryPhoto[];
  onChange: (photos: MemoryPhoto[]) => void;
  onRemove: (photo: MemoryPhoto) => void;
  coverLabel?: string;
  itemLabel?: string;
  stampFramePreview?: boolean;
  disabled?: boolean;
};

type SortablePhotoTileProps = {
  photo: MemoryPhoto;
  index: number;
  total: number;
  onRemove: (photo: MemoryPhoto) => void;
  coverLabel: string;
  itemLabel: string;
  stampFramePreview: boolean;
  disabled: boolean;
};

const pointerSensors = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [
            new PointerActivationConstraints.Delay({
              value: 250,
              tolerance: 8,
            }),
          ]
        : [
            new PointerActivationConstraints.Distance({
              value: 5,
            }),
          ],
    preventActivation: (event) =>
      event.target instanceof Element &&
      Boolean(event.target.closest("[data-no-drag]")),
  }),
  KeyboardSensor,
];

function PhotoTileVisual({
  photo,
  index,
  coverLabel,
  stampFramePreview,
  overlay = false,
}: {
  photo: MemoryPhoto;
  index: number;
  coverLabel: string;
  stampFramePreview: boolean;
  overlay?: boolean;
}) {
  const frameClassName = stampFramePreview
    ? `journal-moment-photo-preview relative aspect-square overflow-hidden ${
        overlay ? "scale-[1.04]" : ""
      }`
    : `relative aspect-square overflow-hidden rounded-sm bg-paper-deep ${
        overlay
          ? "scale-[1.04] shadow-[0_18px_38px_rgba(35,29,24,0.35)] ring-1 ring-paper/70"
          : ""
      }`;
  const tileContent = (
    <>
      {photo.thumbnailObjectUrl ?? photo.objectUrl ? (
        <Image
          src={(photo.thumbnailObjectUrl ?? photo.objectUrl)!}
          alt=""
          fill
          unoptimized
          draggable={false}
          sizes="180px"
          className="pointer-events-none select-none object-cover"
        />
      ) : null}
      {index === 0 && coverLabel ? (
        <span className="absolute bottom-1.5 left-1.5 z-10 rounded-[2px] bg-paper/95 px-2 py-1 font-sans text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-oxblood shadow-sm">
          {coverLabel}
        </span>
      ) : null}
    </>
  );

  if (stampFramePreview) {
    return (
      <div
        className={frameClassName}
        data-photo-preview-fit="editorial-square"
        data-photo-preview-frame="borderless-editorial"
      >
        {tileContent}
      </div>
    );
  }

  return (
    <div className={frameClassName} data-photo-preview-fit="cover">
      {tileContent}
    </div>
  );
}

function SortablePhotoTile({
  photo,
  index,
  total,
  onRemove,
  coverLabel,
  itemLabel,
  stampFramePreview,
  disabled,
}: SortablePhotoTileProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: photo.id,
    index,
    data: { photoId: photo.id },
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  return (
    <div ref={ref} role="listitem" className="relative">
      <div
        ref={handleRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        data-photo-name={photo.name}
        aria-label={`${itemLabel} ${index + 1} of ${total}. Press to pick up and move.`}
        aria-roledescription="sortable photo"
        className={`journal-photo-sort-handle cursor-grab touch-pan-y select-none active:cursor-grabbing ${
          isDragging ? "opacity-25" : "opacity-100"
        }`}
      >
        <PhotoTileVisual
          photo={photo}
          index={index}
          coverLabel={coverLabel}
          stampFramePreview={stampFramePreview}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        data-no-drag
        onClick={() => onRemove(photo)}
        aria-label={`Remove ${photo.name}`}
        className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper/95 text-oxblood shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-oxblood"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SortablePhotoGrid({
  photos,
  onChange,
  onRemove,
  coverLabel = "First photo",
  itemLabel = "Photo",
  stampFramePreview = false,
  disabled = false,
}: SortablePhotoGridProps) {
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const activePhoto = photos.find((photo) => photo.id === activePhotoId);
  const activeIndex = activePhoto
    ? photos.findIndex((photo) => photo.id === activePhoto.id)
    : -1;

  return (
    <>
      <DragDropProvider
        sensors={pointerSensors}
        plugins={(defaults) =>
          defaults.map((plugin) =>
            plugin === AutoScroller
              ? AutoScroller.configure({
                  acceleration: 28,
                  threshold: { x: 0, y: 0.18 },
                })
              : plugin,
          )
        }
        onDragStart={(event) => {
          setActivePhotoId(String(event.operation.source?.id ?? ""));
          setAnnouncement("");
        }}
        onDragEnd={(event) => {
          setActivePhotoId(null);
          const { source, target } = event.operation;
          if (event.canceled || !target || !isSortable(source)) return;

          const { initialIndex, index } = source;
          if (initialIndex === index) return;

          const nextPhotos = movePhoto(photos, initialIndex, index);
          onChange(nextPhotos);
          setAnnouncement(
            `${nextPhotos[index].name} moved to position ${index + 1} of ${nextPhotos.length}.`,
          );
        }}
      >
        <div
          className={`grid grid-cols-3 gap-2 ${disabled ? "pointer-events-none opacity-60" : ""}`}
          role="list"
        >
          {photos.map((photo, index) => (
            <SortablePhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              total={photos.length}
              onRemove={onRemove}
              coverLabel={coverLabel}
              itemLabel={itemLabel}
              stampFramePreview={stampFramePreview}
              disabled={disabled}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activePhoto ? (
            <div className="w-[calc((min(100vw,30rem)-4rem)/3)] max-w-[8.75rem]">
              <PhotoTileVisual
                photo={activePhoto}
                index={activeIndex}
                coverLabel={coverLabel}
                stampFramePreview={stampFramePreview}
                overlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DragDropProvider>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
