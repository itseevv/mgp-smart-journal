import { JOURNAL_YEAR_PHOTO_CAPACITY } from "./journal-product";

export const journalConfig = {
  defaultTitle: "My Journal",
  maxTitleLength: 100,
  maxPhotos: JOURNAL_YEAR_PHOTO_CAPACITY,
} as const;

export type CapsuleProductType = "bookmark" | "journal";

export type JournalMemorySummary = {
  id: string;
  title: string;
  capturedAt: string;
  createdAt: string;
  localDate?: string;
  localTimezone?: string | null;
  photoCount: number;
  voiceMemoCount: number;
  firstThumbnailStoragePath?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
};

export type JournalHomeData = {
  capsuleId: string;
  title: string;
  photoCount: number;
  maxPhotos: number;
  cleanupPendingCount: number;
  memories: JournalMemorySummary[];
};

export type JournalMemoryContext = {
  totalJournalPhotos: number;
  existingMemoryPhotos: number;
  effectivePhotoLimit: number;
  memories: JournalMemorySummary[];
};
