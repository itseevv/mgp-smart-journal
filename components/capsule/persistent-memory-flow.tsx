"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CompletedState } from "@/components/memory/completed-state";
import { MemoryForm } from "@/components/memory/memory-form";
import type { JournalMemorySummary } from "@/data/journal";
import {
  journalThemeStyle,
  type JournalTheme,
} from "@/data/journal-themes";
import {
  findDuplicateStampForLocalDate,
  localDateKey,
} from "@/data/journal-stamps";
import {
  getMemoryFormProductRules,
  type MemoryFormProductMode,
} from "@/data/memory-form-product";
import {
  createEmptyMemory,
  memoryMediaConfig,
  type MemoryDraft,
  type MemoryPhoto,
  type MemoryVoiceMemo,
  type PersistentMemoryEntry,
} from "@/data/memory-demo";
import {
  deleteJournalMemory,
  getCachedPersistentMemory,
  loadPersistentMemory,
  MediaSaveError,
  PendingMediaCleanupError,
  processMediaCleanup,
  savePersistentMemory,
  type SaveProgress,
  type SaveStatus,
} from "@/lib/capsule/api";
import { PrivateMediaUrlCache } from "@/lib/media/private-url-cache";

type PersistentMemoryFlowProps = {
  client: SupabaseClient;
  capsuleId: string;
  publicToken: string;
  memoryId?: string;
  createIntent?: "today" | "backfill";
  initialMemory?: PersistentMemoryEntry;
  maxPhotos?: number;
  productMode?: MemoryFormProductMode;
  journalStamps?: JournalMemorySummary[];
  journalTitle?: string;
  theme?: JournalTheme;
  onOpenJournalStamp?: (memoryId: string) => void;
  onBackToJournalMonth?: (memory: PersistentMemoryEntry) => void;
  onBack?: () => void;
  onCancelCreate?: () => void;
  onDeleted?: () => void;
  onLock: () => Promise<void>;
};

function copyDraft(memory: PersistentMemoryEntry): MemoryDraft {
  return {
    capturedAt: memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    title: memory.title,
    photos: memory.photos.map((photo) => ({ ...photo })),
    voiceMemos: memory.voiceMemos.map((memo) => ({ ...memo })),
  };
}

function withoutPersistenceFields(memory: PersistentMemoryEntry): MemoryDraft {
  return {
    capturedAt: memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    title: memory.title,
    photos: memory.photos,
    voiceMemos: memory.voiceMemos,
  };
}

function createDraftForIntent(createIntent?: "today" | "backfill") {
  const draft = createEmptyMemory(new Date().toISOString());
  return createIntent === "backfill" ? { ...draft, localDate: "" } : draft;
}

export function PersistentMemoryFlow({
  client,
  capsuleId,
  publicToken,
  memoryId,
  createIntent,
  initialMemory,
  maxPhotos = memoryMediaConfig.maxPhotosPerMemory,
  productMode = "memory",
  journalStamps = [],
  journalTitle,
  theme,
  onOpenJournalStamp,
  onBackToJournalMonth,
  onBack,
  onCancelCreate,
  onDeleted,
  onLock,
}: PersistentMemoryFlowProps) {
  const cachedMemory = useMemo(
    () =>
      initialMemory ??
      getCachedPersistentMemory(capsuleId, memoryId),
    [capsuleId, initialMemory, memoryId],
  );
  const productRules = useMemo(
    () => getMemoryFormProductRules(productMode),
    [productMode],
  );
  const isJournalMode = productMode === "journal";
  const effectiveConfig = useMemo(
    () => ({
      ...memoryMediaConfig,
      maxPhotosPerMemory: Math.max(
        cachedMemory?.photos.length ?? 0,
        Math.min(productRules.maxPhotosPerEntry, maxPhotos),
      ),
    }),
    [cachedMemory?.photos.length, maxPhotos, productRules.maxPhotosPerEntry],
  );
  const localUrls = useRef(new Set<string>());
  const pendingCleanupPaths = useRef<string[]>([]);
  const uncommittedUploadPaths = useRef(new Set<string>());
  const urlCache = useMemo(
    () =>
      new PrivateMediaUrlCache(
        client,
        memoryMediaConfig.privateUrlLifetimeSeconds,
        memoryMediaConfig.privateUrlRefreshBufferSeconds,
      ),
    [client],
  );
  const [saved, setSaved] = useState<PersistentMemoryEntry | undefined>(
    cachedMemory,
  );
  const [draft, setDraft] = useState<MemoryDraft>(() =>
    cachedMemory
      ? copyDraft(cachedMemory)
      : createDraftForIntent(createIntent),
  );
  const [mode, setMode] = useState<"loading" | "create" | "view" | "edit">(
    cachedMemory ? "view" : "loading",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveProgress, setSaveProgress] = useState<SaveProgress>();
  const [formBusy, setFormBusy] = useState(false);
  const [deleteState, setDeleteState] = useState<
    "idle" | "confirming" | "deleting" | "error"
  >("idle");

  const refresh = async () => {
    const memory = await loadPersistentMemory(client, capsuleId, memoryId);
    setSaved(memory);
    if (memory) {
      setDraft(copyDraft(memory));
      setMode("view");
    } else {
      setDraft(createDraftForIntent(createIntent));
      setMode("create");
    }
  };

  useEffect(() => {
    const initialLoad = cachedMemory
      ? undefined
      : window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(
      () => void refresh(),
      (memoryMediaConfig.privateUrlLifetimeSeconds -
        memoryMediaConfig.privateUrlRefreshBufferSeconds) *
        1000,
    );
    const urls = localUrls.current;
    return () => {
      window.clearInterval(refreshTimer);
      if (initialLoad !== undefined) window.clearTimeout(initialLoad);
      urls.forEach(URL.revokeObjectURL);
      urlCache.clear();
    };
    // Capsule/client identity does not change while this flow is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerObjectUrl = (url: string) => localUrls.current.add(url);
  const revokeLocal = (url: string) => {
    if (!localUrls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  };
  const removePhoto = (photo: MemoryPhoto) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((candidate) => candidate.id !== photo.id),
    }));
    const belongsToSavedMemory = saved?.photos.some(
      (candidate) => candidate.storagePath === photo.storagePath,
    );
    if (photo.storagePath && !belongsToSavedMemory) {
      pendingCleanupPaths.current.push(photo.storagePath);
      uncommittedUploadPaths.current.delete(photo.storagePath);
    }
    if (photo.file && photo.objectUrl) revokeLocal(photo.objectUrl);
  };
  const changeVoiceMemos = (voiceMemos: MemoryVoiceMemo[]) => {
    const nextUrls = new Set(
      voiceMemos.flatMap((memo) => (memo.objectUrl ? [memo.objectUrl] : [])),
    );
    const nextStoragePaths = new Set(
      voiceMemos.flatMap((memo) => (memo.storagePath ? [memo.storagePath] : [])),
    );
    draft.voiceMemos.forEach((memo) => {
      if (memo.blob && memo.objectUrl && !nextUrls.has(memo.objectUrl)) {
        revokeLocal(memo.objectUrl);
      }
      const belongsToSavedMemory = saved?.voiceMemos.some(
        (candidate) => candidate.storagePath === memo.storagePath,
      );
      if (
        memo.storagePath &&
        !nextStoragePaths.has(memo.storagePath) &&
        !belongsToSavedMemory
      ) {
        pendingCleanupPaths.current.push(memo.storagePath);
        uncommittedUploadPaths.current.delete(memo.storagePath);
      }
    });
    setDraft((current) => ({ ...current, voiceMemos }));
  };
  const save = async () => {
    if (
      saveStatus === "preparing" ||
      saveStatus === "uploading" ||
      saveStatus === "savingMetadata" ||
      saveStatus === "cleaningUp"
    ) {
      return;
    }
    const stableMemoryId = memoryId ?? saved?.id ?? crypto.randomUUID();
    const draftLocalDate = draft.localDate ?? localDateKey(draft.capturedAt);
    const duplicateStamp =
      isJournalMode && draftLocalDate
        ? findDuplicateStampForLocalDate(
            journalStamps,
            draftLocalDate,
            stableMemoryId,
          )
        : undefined;
    if (duplicateStamp) {
      setSaveStatus("error");
      setSaveMessage("That day is already sealed in this journal.");
      onOpenJournalStamp?.(duplicateStamp.id);
      return;
    }
    try {
      await savePersistentMemory(client, capsuleId, stableMemoryId, {
        id: stableMemoryId,
        capsuleId,
        ...draft,
      }, effectiveConfig, {
        onProgress: (progress) => {
          setSaveStatus(progress.status);
          setSaveMessage(progress.message);
          setSaveProgress(progress);
        },
        onDraftChange: (nextDraft) =>
          setDraft(withoutPersistenceFields(nextDraft)),
      }, pendingCleanupPaths.current);
      pendingCleanupPaths.current = [];
      uncommittedUploadPaths.current.clear();
      localUrls.current.forEach(URL.revokeObjectURL);
      localUrls.current.clear();
      await refresh();
      await processMediaCleanup(client, publicToken).catch(() => undefined);
    } catch (error) {
      if (error instanceof PendingMediaCleanupError) {
        pendingCleanupPaths.current = error.paths;
      } else if (error instanceof MediaSaveError) {
        setDraft(withoutPersistenceFields(error.draft));
        error.uploadedPaths.forEach((path) =>
          uncommittedUploadPaths.current.add(path),
        );
      }
      // The repository reports a calm, retryable status and the draft stays mounted.
    }
  };
  const cancel = async () => {
    if (!saved) {
      onCancelCreate?.();
      return;
    }
    const unfinishedPaths = [
      ...new Set([
        ...pendingCleanupPaths.current,
        ...uncommittedUploadPaths.current,
      ]),
    ];
    if (unfinishedPaths.length > 0) {
      setSaveStatus("cleaningUp");
      setSaveMessage("Removing unfinished media…");
      const cleanup = await processMediaCleanup(
        client,
        publicToken,
        unfinishedPaths,
      ).catch(() => ({ ok: false }));
      if (!cleanup.ok) {
        setSaveStatus("partialFailure");
        setSaveMessage(
          "Unfinished media could not be cleaned up yet. Retry Cancel.",
        );
        return;
      }
      pendingCleanupPaths.current = [];
      uncommittedUploadPaths.current.clear();
    }
    localUrls.current.forEach(URL.revokeObjectURL);
    localUrls.current.clear();
    setDraft(copyDraft(saved));
    setSaveStatus("idle");
    setSaveMessage("");
    setSaveProgress(undefined);
    setMode("view");
  };

  const deleteMemory = async () => {
    if (!saved || !isJournalMode || deleteState === "deleting") return;
    setDeleteState("deleting");
    try {
      await deleteJournalMemory(client, capsuleId, saved.id);
      await processMediaCleanup(client, publicToken).catch(() => undefined);
      onDeleted?.();
    } catch {
      setDeleteState("error");
    }
  };

  const beginEditing = async () => {
    if (!saved) return;
    setFormBusy(true);
    try {
      const thumbnailPaths = saved.photos.map(
        (photo) => photo.thumbnailStoragePath ?? photo.storagePath,
      );
      if (thumbnailPaths.some((path) => !path)) {
        throw new Error("A photograph is missing its private storage path.");
      }
      const thumbnailUrls = await urlCache.resolveMany(
        thumbnailPaths as string[],
      );
      const coverDisplayUrl = saved.photos[0]?.storagePath
        ? await urlCache.resolve(saved.photos[0].storagePath)
        : undefined;
      setDraft({
        ...copyDraft(saved),
        photos: saved.photos.map((photo, index) => ({
          ...photo,
          objectUrl: index === 0 ? coverDisplayUrl : photo.objectUrl,
          thumbnailObjectUrl: thumbnailUrls[index],
        })),
      });
      setMode("edit");
    } finally {
      setFormBusy(false);
    }
  };

  if (mode === "loading") {
    return <div className="memory-entry font-sans text-sm text-ink-soft">Loading memory…</div>;
  }

  const formMemoryId = memoryId ?? saved?.id;

  return (
    <div
      className={
        isJournalMode
          ? "journal-leather-surface journal-memory-flow-surface min-h-[calc(100dvh-2rem)]"
          : undefined
      }
      data-journal-memory-flow={isJournalMode ? "themed-leather" : undefined}
      style={isJournalMode && theme ? journalThemeStyle(theme) : undefined}
    >
      {!isJournalMode ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              urlCache.clear();
              void onLock();
            }}
            disabled={formBusy}
            className="font-sans text-[0.68rem] font-semibold text-paper/80 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock journal
          </button>
        </div>
      ) : null}
      {mode === "view" && saved ? (
        <CompletedState
          memory={saved}
          journalMode={isJournalMode}
          journalTitle={journalTitle}
          onLock={() => {
            urlCache.clear();
            void onLock();
          }}
          theme={theme}
          resolvePhotoUrl={(photo, variant, forceRefresh) => {
            const path =
              variant === "thumbnail"
                ? photo.thumbnailStoragePath ?? photo.storagePath
                : photo.storagePath;
            if (!path) throw new Error("This photograph is not available.");
            return urlCache.resolve(path, forceRefresh);
          }}
          resolveVoiceMemoUrl={async (memo, forceRefresh) => {
            if (memo.objectUrl) return memo.objectUrl;
            if (!memo.storagePath) {
              throw new Error("This voice memo is not available.");
            }
            return urlCache.resolve(memo.storagePath, forceRefresh);
          }}
          onEdit={() => void beginEditing()}
          onBackToMonthSheet={
            isJournalMode
              ? () => {
                  if (onBackToJournalMonth) {
                    onBackToJournalMonth(saved);
                    return;
                  }
                  onBack?.();
                }
              : undefined
          }
        />
      ) : (
        <MemoryForm
          config={effectiveConfig}
          draft={draft}
          isEditing={mode === "edit"}
          productMode={productMode}
          currentMemoryId={formMemoryId}
          journalStamps={journalStamps}
          onOpenJournalStamp={onOpenJournalStamp}
          onDraftChange={setDraft}
          onRemovePhoto={removePhoto}
          onVoiceMemosChange={changeVoiceMemos}
          onSave={() => void save()}
          onCancel={() => void cancel()}
          showCancel={mode === "edit" || isJournalMode}
          registerObjectUrl={registerObjectUrl}
          saveStatus={saveStatus}
          saveMessage={saveMessage}
          saveProgress={saveProgress}
          onBusyChange={setFormBusy}
          theme={theme}
          resolveVoiceMemoUrl={async (memo, forceRefresh) => {
            if (memo.objectUrl) return memo.objectUrl;
            if (!memo.storagePath) {
              throw new Error("This voice memo is not available.");
            }
            return urlCache.resolve(memo.storagePath, forceRefresh);
          }}
        />
      )}
      {isJournalMode && mode === "view" && saved ? (
        <div className="mt-4 text-center">
          {deleteState === "confirming" ? (
            <div
              className="memory-entry border-oxblood/20 font-sans"
              role="alertdialog"
              aria-labelledby="delete-memory-title"
              aria-describedby="delete-memory-description"
            >
              <h2 id="delete-memory-title" className="text-sm font-semibold">
                Delete this stamp?
              </h2>
              <p
                id="delete-memory-description"
                className="mt-2 text-xs leading-relaxed text-ink-soft"
              >
                Its saved moments will also be removed. This cannot be undone.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteState("idle")}
                  className="flex-1 rounded-sm border border-rule px-4 py-3 text-xs font-semibold"
                >
                  Keep stamp
                </button>
                <button
                  type="button"
                  onClick={() => void deleteMemory()}
                  className="flex-1 rounded-sm bg-oxblood px-4 py-3 text-xs font-semibold text-paper"
                >
                  Delete stamp
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDeleteState("confirming")}
                disabled={deleteState === "deleting"}
                className="font-sans text-[0.68rem] text-paper/65 underline underline-offset-4 disabled:opacity-40"
              >
                {deleteState === "deleting" ? "Deleting…" : "Delete stamp"}
              </button>
              {deleteState === "error" ? (
                <p className="mt-2 font-sans text-xs text-paper" role="alert">
                  The stamp could not be deleted. Please retry.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
