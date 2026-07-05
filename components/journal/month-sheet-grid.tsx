"use client";

import { StampTile } from "@/components/journal/stamp-tile";
import type { JournalMemorySummary } from "@/data/journal";
import {
  MONTH_SHEET_CAPACITY,
  MONTH_SHEET_COLUMNS,
  MONTH_SHEET_ROWS,
  monthSheetStampPositions,
} from "@/data/journal-stamps";

type MonthSheetGridProps = {
  stamps: JournalMemorySummary[];
  thumbnailUrls: Record<string, string>;
  onOpen: (memory: JournalMemorySummary) => void;
  variant?: "app" | "export";
};

const variantClassName = {
  app: "gap-1.5 p-1.5 sm:gap-2 sm:p-2",
  export: "gap-2 p-2",
};

export function MonthSheetGrid({
  stamps,
  thumbnailUrls,
  onOpen,
  variant = "app",
}: MonthSheetGridProps) {
  const positions = monthSheetStampPositions(stamps);

  return (
    <ol
      aria-label="Saved scraps arranged as a monthly stamp sheet"
      className={`mt-6 grid grid-cols-4 bg-[var(--journal-paper-muted)] shadow-[inset_0_0_0_1px_var(--journal-stamp-border)] ${variantClassName[variant]}`}
      data-month-sheet-capacity={MONTH_SHEET_CAPACITY}
      data-month-sheet-columns={MONTH_SHEET_COLUMNS}
      data-month-sheet-grid="true"
      data-month-sheet-rows={MONTH_SHEET_ROWS}
      data-month-sheet-variant={variant}
    >
      {positions.map(({ dayLabel, memory, position }) => (
        <StampTile
          key={memory.id}
          dayLabel={dayLabel}
          memory={memory}
          position={position}
          thumbnailUrl={thumbnailUrls[memory.id]}
          onOpen={() => onOpen(memory)}
        />
      ))}
    </ol>
  );
}
