"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { ChevronLeftIcon } from "@/components/memory/memory-icons";
import { JournalVoiceNotePlayer } from "@/components/memory/journal-voice-note-player";
import {
  JournalPrimaryCTA,
  JournalShellIconButton,
  JournalStageOverlay,
} from "@/components/journal/journal-visual-primitives";
import { JournalIdentityHeader } from "@/components/journal/journal-identity-header";
import { DailyStampEmojiText } from "@/components/stamp/daily-stamp-emoji-text";
import { StampGrid } from "@/components/stamp/stamp-grid";
import { journalConfig } from "@/data/journal";
import {
  defaultJournalTheme,
  journalThemeStyle,
  type JournalTheme,
} from "@/data/journal-themes";
import type { MemoryEntry } from "@/data/memory-demo";

const detailSurfaceClassName =
  "daily-detail-shell-surface journal-leather-surface flex min-h-[calc(100dvh-2rem)] flex-col px-3 py-3";

const DailyStampExportComposer = dynamic(
  () =>
    import("@/components/export/daily-stamp-export-composer").then(
      (module) => module.DailyStampExportComposer,
    ),
  { ssr: false },
);

type DailyMemoryStampProps = {
  memory: MemoryEntry;
  onEdit: () => void;
  onBackToMonthSheet?: () => void;
  journalTitle?: string;
  onLock?: () => void;
  resolvePhotoUrl?: (
    photo: MemoryEntry["photos"][number],
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
  resolveVoiceMemoUrl?: (
    memo: MemoryEntry["voiceMemos"][number],
    forceRefresh?: boolean,
  ) => Promise<string>;
  theme?: JournalTheme;
};

function formatDisplayDate(isoDate: string) {
  const value = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(value);
}

function EditStampIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="m5 19 3.2-.7L18.1 8.4a2.1 2.1 0 0 0-3-3L5.2 15.3 5 19Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m13.7 6.8 3.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function DailyMemoryStamp({
  memory,
  onEdit,
  onBackToMonthSheet,
  journalTitle = journalConfig.defaultTitle,
  onLock = () => undefined,
  resolvePhotoUrl,
  resolveVoiceMemoUrl,
  theme = defaultJournalTheme,
}: DailyMemoryStampProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const dateLabel = formatDisplayDate(memory.capturedAt);
  const voiceNote = memory.voiceMemos[0];
  const backControl = onBackToMonthSheet ? (
    <JournalShellIconButton
      type="button"
      onClick={onBackToMonthSheet}
      aria-label="Back to month sheet"
      className="month-sheet-nav-button daily-detail-shell-back-button"
      data-daily-detail-back-placement="shell-icon"
    >
      <ChevronLeftIcon className="h-4 w-4" />
    </JournalShellIconButton>
  ) : undefined;

  return (
    <article
      aria-labelledby="daily-memory-stamp-title"
      className={detailSurfaceClassName}
      data-journal-detail-background="themed-leather"
      data-journal-stamp-detail="true"
      data-daily-detail-shell="journal-identity"
      data-phase-7r4-detail="daily-detail-production"
      style={journalThemeStyle(theme)}
    >
      <JournalIdentityHeader
        title={journalTitle}
        typography="home-variant-c"
        leftControl={backControl}
        showSettings={false}
        onLock={onLock}
      />

      <JournalStageOverlay
        variant="daily-detail"
        className={`daily-detail-content-surface min-h-0 flex-1 p-2.5 ${
          voiceNote ? "overflow-y-auto" : "overflow-hidden"
        }`}
        data-daily-detail-surface="sheer-overlay"
        data-daily-detail-mobile-width="approved-playground"
        data-daily-detail-spacing="approved-playground-baseline"
      >
        <header className="daily-detail-artifact-header grid grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2">
          <div className="min-w-0">
            <time
              dateTime={memory.capturedAt}
              className="daily-detail-date font-sans text-[0.62rem] font-semibold uppercase"
            >
              {dateLabel}
            </time>
            <h1
              id="daily-memory-stamp-title"
              className="daily-detail-title mt-2 max-w-full font-serif text-[1.48rem] leading-none"
            >
              <DailyStampEmojiText value={memory.title} />
            </h1>
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit Memory Stamp"
            className="daily-detail-edit-button flex h-9 w-9 items-center justify-center rounded-full"
            data-daily-detail-edit-placement="overlay-icon"
          >
            <EditStampIcon className="h-3.5 w-3.5" />
          </button>
        </header>

        <section
          className="daily-detail-photo-surface mt-3"
          aria-label="Daily photographs"
          data-daily-detail-photo-surface="photo-first"
        >
          <StampGrid
            photos={memory.photos}
            resolvePhotoUrl={resolvePhotoUrl}
          />
        </section>

        {voiceNote ? (
          <section
            className="journal-daily-voice-note"
            aria-labelledby="journal-daily-voice-note-title"
          >
            <h2 id="journal-daily-voice-note-title">
              A whisper from today
            </h2>
            <JournalVoiceNotePlayer
              voiceMemo={voiceNote}
              activeId={activeMemoId}
              onActiveChange={setActiveMemoId}
              resolveUrl={resolveVoiceMemoUrl}
            />
          </section>
        ) : null}
      </JournalStageOverlay>

      <footer
        className="daily-detail-bottom-action mt-3 shrink-0"
        data-daily-detail-actions="bottom-shell-primary"
      >
        <JournalPrimaryCTA
          type="button"
          onClick={() => setExportOpen(true)}
          className="daily-detail-save-share-button journal-primary-bottom-cta"
          aria-haspopup="dialog"
          data-daily-stamp-export-action="true"
          data-daily-detail-bottom-cta="save-share"
        >
          Keep or Share
        </JournalPrimaryCTA>
      </footer>

      {exportOpen ? (
        <DailyStampExportComposer
          open={exportOpen}
          memory={memory}
          onClose={() => setExportOpen(false)}
          resolvePhotoUrl={resolvePhotoUrl}
          theme={theme}
          journalTitle={journalTitle}
        />
      ) : null}
    </article>
  );
}
