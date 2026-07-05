"use client";

import { ChevronLeftIcon } from "@/components/memory/memory-icons";
import { StampGrid } from "@/components/stamp/stamp-grid";
import { defaultJournalTheme, journalThemeStyle } from "@/data/journal-themes";
import type { MemoryEntry } from "@/data/memory-demo";

type DailyMemoryStampProps = {
  memory: MemoryEntry;
  onEdit: () => void;
  onBackToMonthSheet?: () => void;
  resolvePhotoUrl?: (
    photo: MemoryEntry["photos"][number],
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
};

function formatDisplayDate(isoDate: string) {
  const value = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(value);
}

export function DailyMemoryStamp({
  memory,
  onEdit,
  onBackToMonthSheet,
  resolvePhotoUrl,
}: DailyMemoryStampProps) {
  const dateLabel = formatDisplayDate(memory.capturedAt);

  return (
    <article
      aria-labelledby="daily-memory-stamp-title"
      className="journal-leather-surface p-3 shadow-[0_22px_55px_rgba(18,11,10,0.28)] sm:p-4"
      data-journal-stamp-detail="true"
      style={journalThemeStyle(defaultJournalTheme)}
    >
      <div>
        {onBackToMonthSheet ? (
          <button
            type="button"
            onClick={onBackToMonthSheet}
            className="mb-4 inline-flex min-h-10 items-center gap-1.5 font-sans text-[0.68rem] font-semibold text-[var(--journal-muted)] underline decoration-[var(--journal-accent-metal)] underline-offset-4"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span>Back to month sheet</span>
          </button>
        ) : null}

        <header className="pb-4 text-[var(--journal-text)]">
          <div>
            <time
              dateTime={memory.capturedAt}
              className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-muted)]"
            >
              {dateLabel}
            </time>
            <h1
              id="daily-memory-stamp-title"
              className="mt-2 max-w-full font-serif text-[2.15rem] leading-none text-[var(--journal-text)]"
            >
              {memory.title}
            </h1>
          </div>
        </header>

        <section className="paper-surface bg-[var(--journal-paper)] p-2.5 shadow-[0_18px_45px_rgba(18,11,10,0.24)] sm:p-3">
          <StampGrid
            photos={memory.photos}
            resolvePhotoUrl={resolvePhotoUrl}
          />
        </section>

        <footer className="flex items-center justify-between gap-3 pt-4 font-sans text-[0.68rem] text-[var(--journal-muted)]">
          <span>Private by nature.</span>
          <button
            type="button"
            onClick={onEdit}
            className="font-semibold text-[var(--journal-text)] underline decoration-[var(--journal-accent-metal)] underline-offset-4"
          >
            Edit stamp
          </button>
        </footer>
      </div>
    </article>
  );
}
