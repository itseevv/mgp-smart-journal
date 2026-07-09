"use client";

import {
  CroppedStampImage,
  stampCropRender,
} from "@/components/stamp/cropped-stamp-image";
import { memoryLocalDateKey } from "@/data/journal-stamps";
import type { JournalMemorySummary } from "@/data/journal";

type MonthTileProps = {
  memory: JournalMemorySummary;
  dayLabel?: string;
  position?: number;
  thumbnailUrl?: string;
  onOpen: () => void;
};

function dayLabel(memory: JournalMemorySummary) {
  return memoryLocalDateKey(memory).slice(-2);
}

export function MonthTile({
  memory,
  dayLabel: providedDayLabel,
  position,
  thumbnailUrl,
  onOpen,
}: MonthTileProps) {
  const day = providedDayLabel ?? dayLabel(memory);
  const displayedDay = day ? String(Number.parseInt(day, 10) || day) : "";
  const coverWidth = memory.firstPhotoWidth ?? memory.thumbnailWidth;
  const coverHeight = memory.firstPhotoHeight ?? memory.thumbnailHeight;
  const cropMode = thumbnailUrl
    ? stampCropRender({
        cropMetadata: memory.coverCropMetadata,
        width: coverWidth,
        height: coverHeight,
        createdAt: memory.createdAt,
      }).mode
    : undefined;

  return (
    <li
      className="min-w-0"
      data-month-sheet-day={day || undefined}
      data-month-sheet-position={position}
      data-month-sheet-tile="true"
      data-month-sheet-date-placement="photo"
    >
      <button
        type="button"
        onClick={onOpen}
        className="month-sheet-photo-button group block w-full text-left"
        aria-label={`Open ${memory.title}`}
        title={memory.title}
      >
        <span
          className="month-sheet-photo-tile relative block aspect-square overflow-hidden"
          data-month-sheet-photo-frame="cover-scrap"
          data-month-sheet-photo-treatment="clean-cover-scrap"
          data-month-sheet-photo-border="none"
          data-month-sheet-cover-crop={cropMode}
        >
          {displayedDay ? (
            <span
              className="month-sheet-photo-date-marker absolute left-2 top-1.5 z-10 font-sans text-[0.63rem] font-semibold leading-none tabular-nums"
              data-month-sheet-date-marker="photo-text"
            >
              {displayedDay}
            </span>
          ) : null}
          {thumbnailUrl ? (
            <CroppedStampImage
              src={thumbnailUrl}
              alt=""
              sizes="(min-width: 1024px) 132px, (min-width: 640px) 28vw, 30vw"
              className="transition-transform duration-500 group-hover:scale-[1.025]"
              cropMetadata={memory.coverCropMetadata}
              width={coverWidth}
              height={coverHeight}
              createdAt={memory.createdAt}
            />
          ) : (
            <span
              className="month-sheet-photo-fallback absolute inset-0"
              data-month-sheet-photo-fallback="theme-fill"
            />
          )}
        </span>
      </button>
    </li>
  );
}
