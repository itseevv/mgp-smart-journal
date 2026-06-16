export const journalConfig = {
  defaultTitle: "My Journal",
  maxTitleLength: 100,
  maxPhotos: 100,
} as const;

export type CapsuleProductType = "bookmark" | "journal";

export type JournalMemorySummary = {
  id: string;
  title: string;
  capturedAt: string;
  createdAt: string;
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
};
