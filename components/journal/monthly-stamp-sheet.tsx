"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "@/components/memory/memory-icons";
import { TextLinkButton } from "@/components/journal/editorial-primitives";
import {
  JournalShellIconButton,
  JournalStageOverlay,
} from "@/components/journal/journal-visual-primitives";
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
  onExport: () => void;
  exportBusy?: boolean;
};

function emptyStateCopy(status: MonthlyStampArchive["selectedMonthStatus"]) {
  if (status === "past") {
    return {
      title: "No sealed days here.",
      body: "Choose a date to keep one.",
    };
  }
  if (status === "future") {
    return {
      title: "This sheet is waiting.",
      body: "Come back when the month arrives.",
    };
  }
  return {
    title: "No stamps yet.",
    body: "Find one little piece of today.",
  };
}

export function MonthlyStampSheet({
  archive,
  thumbnailUrls,
  onOpen,
  onSelectMonth,
  onExport,
  exportBusy = false,
}: MonthlyStampSheetProps) {
  const { selectedSheet: sheet } = archive;
  const selectedTitle = monthTitle(archive.selectedMonthKey);
  const previousTitle = monthTitle(archive.previousMonthKey);
  const nextTitle = monthTitle(archive.nextMonthKey);
  const emptyCopy = emptyStateCopy(archive.selectedMonthStatus);

  return (
    <JournalStageOverlay
      variant="month-sheet"
      className="month-sheet-tactile-insert month-sheet-stable-stage"
      aria-labelledby="month-sheet-title"
      data-month-sheet={archive.selectedMonthKey}
      data-month-sheet-mobile-width="wide-overlay"
      data-month-sheet-stage="stable-editorial"
      data-month-sheet-surface="direction-b-tactile-insert"
      data-month-sheet-label="none"
      data-phase-7r3-direction="direction-b"
    >
      <div
        className="month-sheet-approved-content flex flex-col p-2"
        data-month-sheet-content="approved-playground-inner"
      >
        <div className="month-sheet-header-row flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="month-sheet-title"
              className="month-sheet-title--home-variant-c break-words font-serif text-[var(--journal-home-month-title)]"
              data-month-sheet-title-hierarchy="home-variant-c"
            >
              {selectedTitle}
            </h2>
            <div className="month-sheet-return-row mt-2 min-h-4">
              {archive.selectedMonthStatus !== "current" ? (
                <TextLinkButton
                  type="button"
                  onClick={() => onSelectMonth(archive.currentMonthKey)}
                  className="month-sheet-return-link block self-start text-left font-sans text-xs font-medium"
                >
                  Back to this month
                </TextLinkButton>
              ) : (
                <span
                  aria-hidden="true"
                  className="invisible block font-sans text-xs font-medium"
                >
                  Back to this month
                </span>
              )}
            </div>
          </div>
          <div
            className="month-sheet-nav-controls flex shrink-0 items-center gap-1"
            aria-label="Month navigation and export"
          >
            <JournalShellIconButton
              type="button"
              onClick={() => onSelectMonth(archive.previousMonthKey)}
              aria-label={`View ${previousTitle}`}
              title={`View ${previousTitle}`}
              className="month-sheet-nav-button"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </JournalShellIconButton>
            <JournalShellIconButton
              type="button"
              onClick={() => onSelectMonth(archive.nextMonthKey)}
              disabled={!archive.canNavigateNext}
              aria-label={`View ${nextTitle}`}
              title={`View ${nextTitle}`}
              className="month-sheet-nav-button disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </JournalShellIconButton>
            <span
              className="month-sheet-export-divider"
              aria-hidden="true"
            />
            <JournalShellIconButton
              type="button"
              onClick={onExport}
              disabled={exportBusy || sheet.stamps.length === 0}
              aria-label={`Preview ${selectedTitle} Memory Edition`}
              title={`Preview ${selectedTitle} Memory Edition`}
              className="month-sheet-nav-button month-sheet-export-button disabled:cursor-not-allowed disabled:opacity-35"
              data-monthly-stamp-export-action="true"
            >
              <DownloadIcon className="h-4 w-4" />
            </JournalShellIconButton>
          </div>
        </div>

        {sheet.stamps.length > 0 ? (
          <MonthSheetGrid
            stamps={sheet.stamps}
            thumbnailUrls={thumbnailUrls}
            onOpen={onOpen}
          />
        ) : (
          <div
            className="month-sheet-empty-state py-12 text-center"
            data-month-sheet-empty-state="brand-toned"
          >
            <p className="month-sheet-empty-title font-serif text-[1.25rem] leading-tight">
              {emptyCopy.title}
            </p>
            <p className="month-sheet-empty-body mx-auto mt-2 max-w-[24ch] font-sans text-[0.78rem] leading-relaxed">
              {emptyCopy.body}
            </p>
          </div>
        )}
      </div>
    </JournalStageOverlay>
  );
}
