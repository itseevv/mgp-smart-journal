"use client";

import {
  CroppedStampImage,
  stampCropRender,
} from "@/components/stamp/cropped-stamp-image";
import { StampFrame } from "@/components/stamp/stamp-frame";
import { memoryLocalDateKey } from "@/data/journal-stamps";
import type { JournalMemorySummary } from "@/data/journal";

type StampTileProps = {
  memory: JournalMemorySummary;
  dayLabel?: string;
  position?: number;
  thumbnailUrl?: string;
  onOpen: () => void;
};

function dayLabel(memory: JournalMemorySummary) {
  return memoryLocalDateKey(memory).slice(-2);
}

export function StampTile({
  memory,
  dayLabel: providedDayLabel,
  position,
  thumbnailUrl,
  onOpen,
}: StampTileProps) {
  const day = providedDayLabel ?? dayLabel(memory);
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
    >
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full"
        aria-label={`Open ${memory.title}`}
        title={memory.title}
      >
        <StampFrame
          variant="sm"
          className="relative block aspect-square overflow-hidden bg-[var(--journal-filler-a)] shadow-[0_8px_18px_rgba(52,43,31,0.14)] transition-transform duration-300 group-hover:-translate-y-0.5"
          data-month-sheet-cover-crop={cropMode}
        >
          <span className="relative z-[1] block h-full overflow-hidden bg-[var(--journal-filler-a)]">
            {thumbnailUrl ? (
              <CroppedStampImage
                src={thumbnailUrl}
                alt=""
                sizes="(min-width: 1024px) 96px, (min-width: 640px) 14vw, 21vw"
                className="transition-transform duration-500 group-hover:scale-[1.035]"
                cropMetadata={memory.coverCropMetadata}
                width={coverWidth}
                height={coverHeight}
                createdAt={memory.createdAt}
              />
            ) : (
              <span className="absolute inset-0 bg-[linear-gradient(135deg,var(--journal-filler-a),var(--journal-filler-b))]" />
            )}
          </span>
          {day ? (
            <span className="absolute left-1 top-1 z-[2] min-w-5 bg-[var(--journal-paper)] px-1 py-0.5 text-center font-sans text-[0.5rem] font-semibold leading-none tabular-nums text-[var(--journal-paper-muted-text)] shadow-[0_1px_3px_rgba(32,24,18,0.14)] sm:left-1.5 sm:top-1.5 sm:text-[0.56rem]">
              {day}
            </span>
          ) : null}
        </StampFrame>
      </button>
    </li>
  );
}
