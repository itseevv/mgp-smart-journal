"use client";

import type { MonthlyStampSheet as MonthlyStampSheetData } from "@/data/journal-stamps";
import type { JournalMemorySummary } from "@/data/journal";
import { StampTile } from "@/components/journal/stamp-tile";

type MonthlyStampSheetProps = {
  sheet: MonthlyStampSheetData;
  earlierSheets: MonthlyStampSheetData[];
  thumbnailUrls: Record<string, string>;
  onOpen: (memory: JournalMemorySummary) => void;
  onSealToday: () => void;
  sealBusy: boolean;
  sealMessage?: string;
  limitReached?: boolean;
};

export function MonthlyStampSheet({
  sheet,
  earlierSheets,
  thumbnailUrls,
  onOpen,
  onSealToday,
  sealBusy,
  sealMessage,
  limitReached = false,
}: MonthlyStampSheetProps) {
  return (
    <section className="space-y-5" aria-labelledby="month-sheet-title">
      <div className="paper-surface bg-[var(--journal-paper)] px-3 py-4 shadow-[0_20px_50px_rgba(32,24,18,0.22)] sm:px-4">
        <div className="flex flex-col gap-4 border-b border-[var(--journal-stamp-border)] pb-5">
          <div>
            <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-paper-muted-text)]">
              Month Sheet
            </p>
            <h2
              id="month-sheet-title"
              className="mt-2 font-serif text-[2.25rem] leading-none text-[var(--journal-paper-text)]"
            >
              {sheet.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSealToday}
            disabled={sealBusy || limitReached}
            className="min-h-12 w-full bg-[var(--journal-paper-text)] px-5 py-3 font-sans text-sm font-semibold text-[var(--journal-paper)] shadow-[0_10px_22px_rgba(45,41,33,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
            aria-describedby={sealMessage ? "seal-today-message" : undefined}
          >
            {sealBusy ? "Opening…" : "Seal Today"}
          </button>
        </div>

        {sealMessage ? (
          <p
            id="seal-today-message"
            className="mt-3 font-sans text-xs leading-relaxed text-[var(--journal-paper-muted-text)]"
            role="status"
          >
            {sealMessage}
          </p>
        ) : null}

        {sheet.stamps.length > 0 ? (
          <ol
            className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5"
            aria-label={`${sheet.title} saved scraps`}
          >
            {sheet.stamps.map((memory) => (
              <StampTile
                key={memory.id}
                memory={memory}
                thumbnailUrl={thumbnailUrls[memory.id]}
                onOpen={() => onOpen(memory)}
              />
            ))}
          </ol>
        ) : (
          <div className="py-10 text-center">
            <p className="font-serif text-[1.45rem] leading-tight text-[var(--journal-paper-text)]">
              No scraps sealed for this month yet.
            </p>
            <p className="mx-auto mt-2 max-w-[28ch] font-sans text-sm leading-relaxed text-[var(--journal-paper-muted-text)]">
              Find one little piece of today.
            </p>
          </div>
        )}
      </div>

      {earlierSheets.length > 0 ? (
        <section
          aria-labelledby="earlier-sheets-title"
          className="paper-surface bg-[var(--journal-paper)] px-3 py-4 shadow-[0_12px_28px_rgba(32,24,18,0.14)] sm:px-4"
        >
          <h3
            id="earlier-sheets-title"
            className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-paper-muted-text)]"
          >
            Earlier sheets
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {earlierSheets.map((earlier) => (
              <span
                key={earlier.key}
                className="border border-[var(--journal-stamp-border)] px-3 py-2 font-sans text-xs text-[var(--journal-paper-muted-text)]"
              >
                {earlier.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
