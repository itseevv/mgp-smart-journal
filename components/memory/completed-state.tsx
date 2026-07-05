"use client";

import type { MemoryEntry } from "@/data/memory-demo";
import { DailyMemoryStamp } from "@/components/stamp/daily-memory-stamp";
import { PhotoCollection } from "@/components/memory/photo-collection";
import { VoiceMemoCard } from "@/components/memory/voice-memo";
import { useState } from "react";

type CompletedStateProps = {
  memory: MemoryEntry;
  onEdit: () => void;
  onBackToMonthSheet?: () => void;
  resolveVoiceMemoUrl?: (
    memo: MemoryEntry["voiceMemos"][number],
    forceRefresh?: boolean,
  ) => Promise<string>;
  resolvePhotoUrl?: (
    photo: MemoryEntry["photos"][number],
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
  journalMode?: boolean;
};

function formatCapturedAt(isoDate: string) {
  const value = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(value);
}

export function CompletedState({
  memory,
  onEdit,
  onBackToMonthSheet,
  resolveVoiceMemoUrl,
  resolvePhotoUrl,
  journalMode = false,
}: CompletedStateProps) {
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

  if (journalMode) {
    return (
      <DailyMemoryStamp
        memory={memory}
        onEdit={onEdit}
        onBackToMonthSheet={onBackToMonthSheet}
        resolvePhotoUrl={resolvePhotoUrl}
      />
    );
  }

  return (
    <article aria-labelledby="completed-memory-title" className="memory-entry">
      <header>
        <time
          dateTime={memory.capturedAt}
          className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft"
        >
          {formatCapturedAt(memory.capturedAt)}
        </time>
        <h1
          id="completed-memory-title"
          className="mt-3 max-w-[12ch] font-serif text-[3.25rem] leading-[0.96] tracking-[-0.055em] text-ink sm:text-[3.75rem]"
        >
          {memory.title}
        </h1>
      </header>

      <section aria-label="Memory photographs" className="mt-7">
        <PhotoCollection
          photos={memory.photos}
          resolvePhotoUrl={resolvePhotoUrl}
        />
      </section>

      {memory.voiceMemos.length > 0 ? (
        <section
          aria-labelledby="completed-voice-memos-title"
          className="mt-6"
        >
          <h2
            id="completed-voice-memos-title"
            className="mb-3 font-sans text-sm font-semibold"
          >
            {memory.voiceMemos.length === 1 ? "Voice memo" : "Voice memos"}
          </h2>
          <div className="space-y-3">
            {memory.voiceMemos.map((voiceMemo) => (
              <VoiceMemoCard
                key={voiceMemo.id}
                voiceMemo={voiceMemo}
                activeId={activeMemoId}
                onActiveChange={setActiveMemoId}
                resolveUrl={resolveVoiceMemoUrl}
              />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="mt-7 border-t border-rule pt-5 text-center">
        <button
          type="button"
          onClick={onEdit}
          className="font-sans text-xs font-semibold text-oxblood underline decoration-oxblood/35 underline-offset-4"
        >
          Edit memory
        </button>
      </footer>
    </article>
  );
}
