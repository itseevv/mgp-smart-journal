import { JOURNAL_YEAR_PHOTO_CAPACITY } from "./journal-product.ts";
import type { JournalTheme } from "./journal-themes.ts";
import type { PhotoCropMetadata } from "./memory-demo.ts";

export const journalConfig = {
  defaultTitle: "My Journal",
  maxTitleLength: 20,
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
  title: string;
  theme?: Partial<JournalTheme>;
  photoCount: number;
  maxPhotos: number;
  cleanupPendingCount: number;
  memories: JournalMemorySummary[];
};

export type JournalMemoryContext = {
  title: string;
  totalJournalPhotos: number;
  existingMemoryPhotos: number;
  effectivePhotoLimit: number;
  theme?: Partial<JournalTheme>;
  memories: JournalMemorySummary[];
};
