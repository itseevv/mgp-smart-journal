import type { ArchiveQuotaSummary } from "./archive-quota.ts";
import type { JournalTheme } from "./journal-themes.ts";
import type { PhotoCropMetadata } from "./memory-demo.ts";

export const journalConfig = {
  defaultTitle: "My Journal",
  maxTitleLength: 20,
} as const;

export type CapsuleProductType = "bookmark" | "journal";

export type PersistentMemoryRefreshReason =
  | "initial"
  | "background"
  | "postMutation";

export function createRefreshRequestOrder() {
  let generation = 0;
  let validationRetryOrigin: Exclude<
    PersistentMemoryRefreshReason,
    "background"
  > = "initial";

  return {
    begin(reason: PersistentMemoryRefreshReason) {
      if (reason !== "background") generation += 1;
      return generation;
    },
    isCurrent(capturedGeneration: number) {
      return capturedGeneration === generation;
    },
    rememberValidationError(
      origin: Exclude<PersistentMemoryRefreshReason, "background">,
    ) {
      validationRetryOrigin = origin;
    },
    retryReason() {
      return validationRetryOrigin;
    },
  };
}

export function evictMissingMemoryCacheEntries<T extends { id: string }>(
  cache: Map<string, T>,
  exactKey: string,
  defaultKey: string,
  missingMemoryId: string,
) {
  cache.delete(exactKey);
  if (cache.get(defaultKey)?.id === missingMemoryId) {
    cache.delete(defaultKey);
  }
}

export function measureRecordingElapsed(
  startedAtMilliseconds: number,
  nowMilliseconds: number,
  limitSeconds: number,
) {
  const actualSeconds = Math.max(
    0,
    (nowMilliseconds - startedAtMilliseconds) / 1000,
  );
  return {
    actualSeconds,
    displaySeconds: Math.min(
      Math.max(0, limitSeconds),
      Math.floor(actualSeconds),
    ),
    shouldStop: actualSeconds >= limitSeconds,
  };
}

export function containedDialogFocusIndex(
  key: string,
  shiftKey: boolean,
  currentIndex: number,
  itemCount: number,
) {
  if (key !== "Tab") return undefined;
  if (itemCount <= 0) return -1;
  if (currentIndex < 0) return shiftKey ? itemCount - 1 : 0;
  return shiftKey
    ? (currentIndex - 1 + itemCount) % itemCount
    : (currentIndex + 1) % itemCount;
}

export type JournalMemorySummary = {
  id: string;
  title: string;
  capturedAt: string;
  createdAt: string;
  localDate?: string;
  localTimezone?: string | null;
  photoCount: number;
  voiceMemoCount: number;
  firstPhotoStoragePath?: string;
  firstPhotoWidth?: number;
  firstPhotoHeight?: number;
  firstThumbnailStoragePath?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  coverCropMetadata?: PhotoCropMetadata;
};

export type JournalHomeData = {
  capsuleId: string;
  archiveQuota: ArchiveQuotaSummary;
  title: string;
  theme?: Partial<JournalTheme>;
  photoCount: number;
  cleanupPendingCount: number;
  memories: JournalMemorySummary[];
};

export type JournalMemoryContext = {
  title: string;
  maxPhotosPerEntry: number;
  theme?: Partial<JournalTheme>;
  memories: JournalMemorySummary[];
};
