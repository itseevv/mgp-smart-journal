"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PersistentMemoryFlow } from "@/components/capsule/persistent-memory-flow";
import type { PersistentMemoryEntry } from "@/data/memory-demo";
import type { JournalMemoryContext } from "@/data/journal";
import {
  findStampForLocalDateKey,
  toLocalDateKeyFromDate,
} from "@/data/journal-stamps";
import {
  localDateKeyFromValue,
  localMonthKeyFromDateKey,
} from "@/data/local-date";
import { loadJournalMemoryContext } from "@/lib/capsule/api";

type JournalMemoryPageProps = {
  client: SupabaseClient;
  capsuleId: string;
  publicToken: string;
  memoryId: string;
  initialMemory?: PersistentMemoryEntry;
  onLock: () => Promise<void>;
};

function monthKeyForJournalMemory(memory: PersistentMemoryEntry) {
  return localMonthKeyFromDateKey(
    localDateKeyFromValue(memory.localDate) ||
      localDateKeyFromValue(memory.capturedAt),
  );
}

export function JournalMemoryPage({
  client,
  capsuleId,
  publicToken,
  memoryId,
  initialMemory,
  onLock,
}: JournalMemoryPageProps) {
  const router = useRouter();
  const [context, setContext] = useState<JournalMemoryContext>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadJournalMemoryContext(client, capsuleId, memoryId)
      .then((next) => {
        if (active) setContext(next);
      })
      .catch(() => {
        if (active) setError("This stamp could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [capsuleId, client, memoryId]);

  const returnToJournal = (monthKey?: string) => {
    router.push(monthKey ? `/c/${publicToken}?month=${monthKey}` : `/c/${publicToken}`);
  };
  const returnHome = () => returnToJournal();
  const returnToMemoryMonth = (memory: PersistentMemoryEntry) =>
    returnToJournal(monthKeyForJournalMemory(memory));
  const openStamp = (id: string) => router.push(`/c/${publicToken}/m/${id}`);

  if (error) {
    return (
      <div className="memory-entry text-center font-sans text-sm text-ink-soft">
        <p>{error}</p>
        <button
          type="button"
          onClick={returnHome}
          className="mt-4 font-semibold text-oxblood underline underline-offset-4"
        >
          Back to journal
        </button>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="memory-entry font-sans text-sm text-ink-soft">
        Opening stamp…
      </div>
    );
  }

  const existingToday = !initialMemory
    ? findStampForLocalDateKey(
        context.memories,
        toLocalDateKeyFromDate(new Date()),
      )
    : undefined;

  if (existingToday && existingToday.id !== memoryId) {
    return (
      <div className="memory-entry text-center">
        <p className="font-serif text-xl">
          Today is already sealed in this journal.
        </p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-ink-soft">
          You can revisit today’s stamp instead of making another one.
        </p>
        <button
          type="button"
          onClick={() => openStamp(existingToday.id)}
          className="mt-5 font-sans text-xs font-semibold text-oxblood underline underline-offset-4"
        >
          Open today’s stamp
        </button>
      </div>
    );
  }

  if (!initialMemory && context.effectivePhotoLimit <= 0) {
    return (
      <div className="memory-entry text-center">
        <p className="font-serif text-xl">This journal needs a little space.</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-ink-soft">
          Delete a saved moment or stamp before sealing another day.
        </p>
        <button
          type="button"
          onClick={returnHome}
          className="mt-5 font-sans text-xs font-semibold text-oxblood underline underline-offset-4"
        >
          Back to journal
        </button>
      </div>
    );
  }

  return (
    <PersistentMemoryFlow
      client={client}
      capsuleId={capsuleId}
      publicToken={publicToken}
      memoryId={memoryId}
      initialMemory={initialMemory}
      maxPhotos={context.effectivePhotoLimit}
      productMode="journal"
      journalStamps={context.memories}
      onOpenJournalStamp={openStamp}
      onBackToJournalMonth={returnToMemoryMonth}
      onBack={returnHome}
      onCancelCreate={returnHome}
      onDeleted={returnHome}
      onLock={onLock}
    />
  );
}
