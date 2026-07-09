"use client";

import { MonthTile } from "@/components/journal/month-tile";
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
  app: "grid-cols-3 gap-1",
  export: "grid-cols-4 gap-2 bg-[var(--journal-paper-muted)] p-2 shadow-[inset_0_0_0_1px_var(--journal-stamp-border)]",
};

const APP_MONTH_SHEET_COLUMNS = 3;

export function MonthSheetGrid({
  stamps,
  thumbnailUrls,
  onOpen,
  variant = "app",
}: MonthSheetGridProps) {
  const positions = monthSheetStampPositions(stamps);

  return (
    <ol
      aria-label="Saved cover scraps arranged as a monthly sheet"
      className={`${variant === "app" ? "mt-2" : "mt-3"} grid ${variantClassName[variant]}`}
      data-month-sheet-app-columns={
        variant === "app" ? APP_MONTH_SHEET_COLUMNS : undefined
      }
      data-month-sheet-capacity={MONTH_SHEET_CAPACITY}
      data-month-sheet-columns={
        variant === "app" ? APP_MONTH_SHEET_COLUMNS : MONTH_SHEET_COLUMNS
      }
      data-month-sheet-grid="true"
      data-month-sheet-renders="sealed-days-only"
      data-month-sheet-rows={variant === "app" ? undefined : MONTH_SHEET_ROWS}
      data-month-sheet-variant={variant}
    >
      {positions.map(({ dayLabel, memory, position }) => (
        <MonthTile
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
