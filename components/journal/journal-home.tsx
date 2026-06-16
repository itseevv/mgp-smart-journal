"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MemoryCard } from "@/components/journal/memory-card";
import { memoryMediaConfig } from "@/data/memory-demo";
import { journalConfig, type JournalHomeData } from "@/data/journal";
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

  const addMemory = () => {
    if (navigationBusy || !journal || journal.photoCount >= journal.maxPhotos) {
      return;
    }
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

  return (
    <div>
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

      <article className="memory-entry" aria-labelledby="journal-title">
        <header className="border-b border-rule pb-5">
          <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-oxblood">
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
                className="w-full border-0 border-b border-rule bg-transparent pb-2 font-serif text-[2.6rem] leading-none tracking-[-0.05em] outline-none focus:border-oxblood"
                autoFocus
              />
              <div className="mt-3 flex gap-4 font-sans text-xs">
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={titleBusy}
                  className="font-semibold text-oxblood underline underline-offset-4 disabled:opacity-50"
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
                  className="text-ink-soft underline underline-offset-4 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {titleError ? (
                <p className="mt-2 font-sans text-xs text-oxblood" role="alert">
                  {titleError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex items-end justify-between gap-4">
              <h1
                id="journal-title"
                className="font-serif text-[2.8rem] leading-none tracking-[-0.055em]"
              >
                {journal.title}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setTitleError("");
                  setIsEditingTitle(true);
                }}
                className="shrink-0 font-sans text-[0.68rem] text-ink-soft underline underline-offset-4"
              >
                Rename
              </button>
            </div>
          )}
          <div className="mt-4 flex justify-between font-sans text-[0.68rem] text-ink-soft">
            <span>
              {journal.memories.length}{" "}
              {journal.memories.length === 1 ? "memory" : "memories"}
            </span>
            <span>
              {journal.photoCount} of {journal.maxPhotos} photos
            </span>
          </div>
        </header>

        {journal.cleanupPendingCount > 0 ? (
          <div className="mt-4 border border-oxblood/20 bg-paper-deep/25 p-3 font-sans text-xs text-ink-soft">
            <p>
              Private media cleanup is still pending for{" "}
              {journal.cleanupPendingCount}{" "}
              {journal.cleanupPendingCount === 1 ? "item" : "items"}.
            </p>
            <button
              type="button"
              onClick={() => void retryCleanup()}
              disabled={cleanupBusy}
              className="mt-2 font-semibold text-oxblood underline underline-offset-4 disabled:opacity-50"
            >
              {cleanupBusy ? "Retrying…" : "Retry cleanup"}
            </button>
            {cleanupError ? (
              <p className="mt-2 text-oxblood" role="alert">
                {cleanupError}
              </p>
            ) : null}
          </div>
        ) : null}

        {journal.memories.length > 0 ? (
          <ol className="mt-2" aria-label="Journal memories">
            {journal.memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                thumbnailUrl={thumbnailUrls[memory.id]}
                onOpen={() =>
                  router.push(`/c/${publicToken}/m/${memory.id}`)
                }
              />
            ))}
          </ol>
        ) : (
          <div className="py-12 text-center">
            <p className="font-serif text-xl">This journal is still quiet.</p>
            <p className="mx-auto mt-2 max-w-[28ch] font-sans text-xs leading-relaxed text-ink-soft">
              Add the first memory when there is a moment worth keeping.
            </p>
          </div>
        )}

        <footer className="pt-6">
          <button
            type="button"
            onClick={addMemory}
            disabled={isAtJournalLimit || navigationBusy}
            aria-describedby={
              isAtJournalLimit ? "journal-photo-limit" : undefined
            }
            className="w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-45"
          >
            {journal.memories.length === 0
              ? "Add your first memory"
              : "Add a memory"}
          </button>
          {isAtJournalLimit ? (
            <p
              id="journal-photo-limit"
              className="mt-2 text-center font-sans text-[0.68rem] text-ink-soft"
              role="status"
            >
              This journal has reached its 100-photo limit. Delete a photograph
              or memory to add another.
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
