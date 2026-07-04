"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MonthlyStampSheet } from "@/components/journal/monthly-stamp-sheet";
import { memoryMediaConfig } from "@/data/memory-demo";
import { journalConfig, type JournalHomeData } from "@/data/journal";
import {
  activeMonthlyStampSheet,
  findStampForLocalDate,
  groupStampsByMonth,
} from "@/data/journal-stamps";
import { defaultJournalTheme, journalThemeStyle } from "@/data/journal-themes";
import {
  loadJournalHome,
  processMediaCleanup,
  updateJournalTitle,
} from "@/lib/capsule/api";
import { PrivateMediaUrlCache } from "@/lib/media/private-url-cache";

type JournalHomeProps = {
  client: SupabaseClient;
  capsuleId: string;
  publicToken: string;
  onLock: () => Promise<void>;
};

export function JournalHome({
  client,
  capsuleId,
  publicToken,
  onLock,
}: JournalHomeProps) {
  const router = useRouter();
  const urlCache = useMemo(
    () =>
      new PrivateMediaUrlCache(
        client,
        memoryMediaConfig.privateUrlLifetimeSeconds,
        memoryMediaConfig.privateUrlRefreshBufferSeconds,
      ),
    [client],
  );
  const [journal, setJournal] = useState<JournalHomeData>();
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [sealMessage, setSealMessage] = useState("");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await loadJournalHome(client, capsuleId);
      setJournal(next);
      setTitleDraft(next.title);
      setStatus("ready");
      const paths = next.memories.flatMap((memory) =>
        memory.firstThumbnailStoragePath
          ? [memory.firstThumbnailStoragePath]
          : [],
      );
      try {
        const resolved =
          paths.length > 0 ? await urlCache.resolveMany(paths) : [];
        const urls: Record<string, string> = {};
        let resolvedIndex = 0;
        next.memories.forEach((memory) => {
          if (!memory.firstThumbnailStoragePath) return;
          urls[memory.id] = resolved[resolvedIndex];
          resolvedIndex += 1;
        });
        setThumbnailUrls(urls);
      } catch {
        setThumbnailUrls({});
      }
    } catch {
      setStatus("error");
    }
  }, [capsuleId, client, urlCache]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      urlCache.clear();
    };
  }, [refresh, urlCache]);

  const sealToday = () => {
    if (navigationBusy || !journal) {
      return;
    }

    const existingToday = findStampForLocalDate(journal.memories, new Date());
    if (existingToday) {
      setSealMessage("Today is already sealed. You can revisit today's stamp.");
      setNavigationBusy(true);
      router.push(`/c/${publicToken}/m/${existingToday.id}`);
      return;
    }

    if (journal.photoCount >= journal.maxPhotos) {
      setSealMessage(
        "This journal needs a little space before another day can be sealed.",
      );
      return;
    }

    setSealMessage("");
    setNavigationBusy(true);
    const memoryId = crypto.randomUUID();
    router.push(`/c/${publicToken}/m/${memoryId}`);
  };

  const saveTitle = async () => {
    if (!journal || titleBusy) return;
    setTitleBusy(true);
    setTitleError("");
    try {
      const title = await updateJournalTitle(client, capsuleId, titleDraft);
      setJournal({ ...journal, title });
      setTitleDraft(title);
      setIsEditingTitle(false);
    } catch {
      setTitleError("The journal title could not be saved. Please retry.");
    } finally {
      setTitleBusy(false);
    }
  };

  const retryCleanup = async () => {
    if (cleanupBusy) return;
    setCleanupBusy(true);
    setCleanupError("");
    try {
      const cleanup = await processMediaCleanup(client, publicToken);
      if (!cleanup.ok) {
        setCleanupError("Private media cleanup could not be completed yet.");
      }
      await refresh();
    } catch {
      setCleanupError("Private media cleanup could not be completed yet.");
    } finally {
      setCleanupBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="memory-entry font-sans text-sm text-ink-soft">
        Opening journal…
      </div>
    );
  }

  if (status === "error" || !journal) {
    return (
      <div className="memory-entry text-center font-sans text-sm text-ink-soft">
        <p>The journal could not be opened.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 font-semibold text-oxblood underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  const isAtJournalLimit = journal.photoCount >= journal.maxPhotos;
  const activeSheet = activeMonthlyStampSheet(journal.memories);
  const earlierSheets = groupStampsByMonth(journal.memories)
    .filter((sheet) => sheet.key !== activeSheet.key)
    .reverse();

  return (
    <div style={journalThemeStyle(defaultJournalTheme)}>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            urlCache.clear();
            void onLock();
          }}
          className="font-sans text-[0.68rem] font-semibold text-paper/80 underline underline-offset-4"
        >
          Lock journal
        </button>
      </div>

      <article className="journal-leather-surface p-3 shadow-[0_22px_55px_rgba(18,11,10,0.28)] sm:p-4" aria-labelledby="journal-title">
        <header className="pb-5 text-[var(--journal-text)]">
          <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-muted)]">
            Journal
          </p>
          {isEditingTitle ? (
            <div className="mt-3">
              <label htmlFor="journal-title-input" className="sr-only">
                Journal title
              </label>
              <input
                id="journal-title-input"
                value={titleDraft}
                maxLength={journalConfig.maxTitleLength}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="w-full border-0 border-b border-[var(--journal-muted)] bg-transparent pb-2 font-serif text-[2.25rem] leading-none text-[var(--journal-text)] outline-none placeholder:text-[var(--journal-muted)] focus:border-[var(--journal-accent-metal)]"
                autoFocus
              />
              <div className="mt-3 flex gap-4 font-sans text-xs">
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={titleBusy}
                  className="font-semibold text-[var(--journal-text)] underline underline-offset-4 disabled:opacity-50"
                >
                  {titleBusy ? "Saving…" : "Save title"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(journal.title);
                    setIsEditingTitle(false);
                  }}
                  disabled={titleBusy}
                  className="text-[var(--journal-muted)] underline underline-offset-4 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {titleError ? (
                <p className="mt-2 font-sans text-xs text-[var(--journal-text)]" role="alert">
                  {titleError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <h1
                id="journal-title"
                className="font-serif text-[2.35rem] leading-none text-[var(--journal-text)]"
              >
                {journal.title}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setTitleError("");
                  setIsEditingTitle(true);
                }}
                className="shrink-0 font-sans text-[0.68rem] text-[var(--journal-muted)] underline underline-offset-4"
              >
                Rename
              </button>
            </div>
          )}
        </header>

        {journal.cleanupPendingCount > 0 ? (
          <div className="mb-5 border border-[var(--journal-stamp-border)] bg-[var(--journal-paper)] p-3 font-sans text-xs text-[var(--journal-paper-muted-text)]">
            <p>
              Private media cleanup is still pending for{" "}
              {journal.cleanupPendingCount}{" "}
              {journal.cleanupPendingCount === 1 ? "item" : "items"}.
            </p>
            <button
              type="button"
              onClick={() => void retryCleanup()}
              disabled={cleanupBusy}
              className="mt-2 font-semibold text-[var(--journal-paper-text)] underline underline-offset-4 disabled:opacity-50"
            >
              {cleanupBusy ? "Retrying…" : "Retry cleanup"}
            </button>
            {cleanupError ? (
              <p className="mt-2 text-[var(--journal-paper-text)]" role="alert">
                {cleanupError}
              </p>
            ) : null}
          </div>
        ) : null}

        <MonthlyStampSheet
          sheet={activeSheet}
          earlierSheets={earlierSheets}
          thumbnailUrls={thumbnailUrls}
          onOpen={(memory) => router.push(`/c/${publicToken}/m/${memory.id}`)}
          onSealToday={sealToday}
          sealBusy={navigationBusy}
          sealMessage={sealMessage}
          limitReached={isAtJournalLimit}
        />
      </article>
    </div>
  );
}
