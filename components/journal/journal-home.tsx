"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BottomRitualAction } from "@/components/journal/bottom-ritual-action";
import { JournalIdentityHeader } from "@/components/journal/journal-identity-header";
import { MonthlyStampSheet } from "@/components/journal/monthly-stamp-sheet";
import { useMonthQueryState } from "@/components/journal/use-month-query-state";
import { memoryMediaConfig } from "@/data/memory-demo";
import type { JournalHomeData } from "@/data/journal";
import {
  findStampForLocalDate,
  monthlyStampArchive,
} from "@/data/journal-stamps";
import { journalThemeStyle, resolveJournalTheme } from "@/data/journal-themes";
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
  initialMonth?: string;
  onLock: () => Promise<void>;
};

function coverStoragePath(memory: JournalHomeData["memories"][number]) {
  return memory.firstThumbnailStoragePath ?? memory.firstPhotoStoragePath;
}

export function JournalHome({
  client,
  capsuleId,
  publicToken,
  initialMonth,
  onLock,
}: JournalHomeProps) {
  const router = useRouter();
  const [requestedMonth, selectMonth] = useMonthQueryState(initialMonth);
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
      const paths = next.memories.flatMap((memory) => {
        const path = coverStoragePath(memory);
        return path ? [path] : [];
      });
      try {
        const resolved =
          paths.length > 0 ? await urlCache.resolveMany(paths) : [];
        const urls: Record<string, string> = {};
        let resolvedIndex = 0;
        next.memories.forEach((memory) => {
          if (!coverStoragePath(memory)) return;
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
      setNavigationBusy(true);
      router.push(`/c/${publicToken}/m/${existingToday.id}`);
      return;
    }

    if (journal.photoCount >= journal.maxPhotos) {
      return;
    }

    setNavigationBusy(true);
    const memoryId = crypto.randomUUID();
    router.push(`/c/${publicToken}/m/${memoryId}`);
  };

  const sealAnotherDay = () => {
    if (navigationBusy || !journal || journal.photoCount >= journal.maxPhotos) {
      return;
    }

    setNavigationBusy(true);
    const memoryId = crypto.randomUUID();
    router.push(`/c/${publicToken}/m/${memoryId}?create=backfill`);
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

  const existingToday = findStampForLocalDate(journal.memories, new Date());
  const isAtJournalLimit = journal.photoCount >= journal.maxPhotos;
  const sealDisabled = isAtJournalLimit && !existingToday;
  const archive = monthlyStampArchive(journal.memories, requestedMonth);
  const theme = resolveJournalTheme(journal.theme);
  const lock = () => {
    urlCache.clear();
    void onLock();
  };

  return (
    <div style={journalThemeStyle(theme)}>
      <article
        className="journal-home-surface journal-home-surface--mobile-density journal-leather-surface px-3 py-2 sm:px-4"
        aria-labelledby="journal-title"
      >
        <JournalIdentityHeader
          title={journal.title}
          typography="home-variant-c"
          titleDraft={titleDraft}
          isEditingTitle={isEditingTitle}
          titleBusy={titleBusy}
          titleError={titleError}
          onTitleDraftChange={setTitleDraft}
          onSaveTitle={() => void saveTitle()}
          onCancelTitle={() => {
            setTitleDraft(journal.title);
            setIsEditingTitle(false);
          }}
          onBeginRename={() => {
            setTitleError("");
            setIsEditingTitle(true);
          }}
          onLock={lock}
        />

        {journal.cleanupPendingCount > 0 ? (
          <div className="mb-4 bg-[var(--journal-paper)] p-3 font-sans text-xs text-[var(--journal-paper-muted-text)]">
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
          archive={archive}
          thumbnailUrls={thumbnailUrls}
          onOpen={(memory) => router.push(`/c/${publicToken}/m/${memory.id}`)}
          onSelectMonth={selectMonth}
        />

        <BottomRitualAction
          busy={navigationBusy}
          todaySealed={Boolean(existingToday)}
          todayActionDisabled={sealDisabled}
          backfillDisabled={isAtJournalLimit}
          onTodayAction={sealToday}
          onBackfillAction={sealAnotherDay}
        />
      </article>
    </div>
  );
}
