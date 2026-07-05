"use client";

import { MonthSheetGrid } from "@/components/journal/month-sheet-grid";
import {
  monthTitle,
  type MonthlyStampArchive,
} from "@/data/journal-stamps";
import type { JournalMemorySummary } from "@/data/journal";

type MonthlyStampSheetProps = {
  archive: MonthlyStampArchive;
  thumbnailUrls: Record<string, string>;
  onOpen: (memory: JournalMemorySummary) => void;
  onSelectMonth: (monthKey: string) => void;
  onSealToday: () => void;
  sealBusy: boolean;
  sealMessage?: string;
  limitReached?: boolean;
};

function stampCountLabel(count: number) {
  if (count <= 0) return "";
  return `${count} ${count === 1 ? "day" : "days"} sealed`;
}

function emptyStateCopy(status: MonthlyStampArchive["selectedMonthStatus"]) {
  if (status === "past") {
    return {
      title: "This month is still blank.",
      body: "You can still seal a day from this month by choosing its date.",
    };
  }
  if (status === "future") {
    return {
      title: "This sheet is waiting.",
      body: "Come back to this sheet when the month arrives.",
    };
  }
  return {
    title: "No scraps sealed for this month yet.",
    body: "Find one little piece of today.",
  };
}

export function MonthlyStampSheet({
  archive,
  thumbnailUrls,
  onOpen,
  onSelectMonth,
  onSealToday,
  sealBusy,
  sealMessage,
  limitReached = false,
}: MonthlyStampSheetProps) {
  const { selectedSheet: sheet } = archive;
  const selectedTitle = monthTitle(archive.selectedMonthKey, {
    uppercase: true,
  });
  const previousTitle = monthTitle(archive.previousMonthKey);
  const nextTitle = monthTitle(archive.nextMonthKey);
  const countLabel = stampCountLabel(sheet.stamps.length);
  const emptyCopy = emptyStateCopy(archive.selectedMonthStatus);

  return (
    <section
      className="paper-surface bg-[var(--journal-paper)] px-3 py-4 shadow-[0_20px_50px_rgba(32,24,18,0.22)] sm:px-4"
      aria-labelledby="month-sheet-title"
      data-month-sheet={archive.selectedMonthKey}
    >
      <div className="border-b border-[var(--journal-stamp-border)] pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-paper-muted-text)]">
              Month Sheet
            </p>
            <h2
              id="month-sheet-title"
              className="mt-2 break-words font-serif text-[2rem] leading-none text-[var(--journal-paper-text)] sm:text-[2.25rem]"
            >
              {selectedTitle}
            </h2>
            {countLabel ? (
              <p className="mt-2 font-sans text-xs text-[var(--journal-paper-muted-text)]">
                {countLabel}
              </p>
            ) : null}
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            aria-label="Month navigation"
          >
            <button
              type="button"
              onClick={() => onSelectMonth(archive.previousMonthKey)}
              className="grid size-11 place-items-center border border-[var(--journal-stamp-border)] bg-[var(--journal-paper-muted)] font-sans text-lg font-semibold text-[var(--journal-paper-text)]"
              aria-label={`View ${previousTitle}`}
              title={`View ${previousTitle}`}
            >
              <span aria-hidden="true">&lt;</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectMonth(archive.nextMonthKey)}
              disabled={!archive.canNavigateNext}
              className="grid size-11 place-items-center border border-[var(--journal-stamp-border)] bg-[var(--journal-paper-muted)] font-sans text-lg font-semibold text-[var(--journal-paper-text)] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`View ${nextTitle}`}
              title={`View ${nextTitle}`}
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={onSealToday}
            disabled={sealBusy || limitReached}
            className="min-h-12 w-full bg-[var(--journal-paper-text)] px-5 py-3 font-sans text-sm font-semibold text-[var(--journal-paper)] shadow-[0_10px_22px_rgba(45,41,33,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
            aria-describedby={sealMessage ? "seal-today-message" : undefined}
          >
            {sealBusy ? "Opening…" : "Seal Today"}
          </button>
          {archive.selectedMonthStatus !== "current" ? (
            <button
              type="button"
              onClick={() => onSelectMonth(archive.currentMonthKey)}
              className="self-start font-sans text-xs font-semibold text-[var(--journal-paper-muted-text)] underline underline-offset-4"
            >
              Back to this month
            </button>
          ) : null}
        </div>
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
        <MonthSheetGrid
          stamps={sheet.stamps}
          thumbnailUrls={thumbnailUrls}
          onOpen={onOpen}
        />
      ) : (
        <div className="py-10 text-center">
          <p className="font-serif text-[1.45rem] leading-tight text-[var(--journal-paper-text)]">
            {emptyCopy.title}
          </p>
          <p className="mx-auto mt-2 max-w-[28ch] font-sans text-sm leading-relaxed text-[var(--journal-paper-muted-text)]">
            {emptyCopy.body}
          </p>
        </div>
      )}
    </section>
  );
}
