export const DAILY_MEMORY_STAMP_MAX_PHOTOS = 9;
export const DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS = 1;
export const DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS =
  DAILY_MEMORY_STAMP_MAX_PHOTOS - DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS;
export const JOURNAL_YEAR_DAYS = 365;
export const JOURNAL_YEAR_PHOTO_CAPACITY =
  JOURNAL_YEAR_DAYS * DAILY_MEMORY_STAMP_MAX_PHOTOS;
export const JOURNAL_VOICE_MEMOS_ENABLED = false;

export function dailyStampAdditionalMomentCapacity(
  currentPhotoCount: number,
  maxPhotosPerMemory: number,
) {
  const normalizedPhotoCount = Math.max(0, Math.trunc(currentPhotoCount));
  const normalizedPhotoLimit = Math.max(0, Math.trunc(maxPhotosPerMemory));
  const currentAdditionalMoments = Math.max(
    0,
    normalizedPhotoCount - DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS,
  );
  const stampRemaining = Math.max(
    0,
    DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS - currentAdditionalMoments,
  );
  const journalRemaining = Math.max(
    0,
    normalizedPhotoLimit - normalizedPhotoCount,
  );

  return {
    remaining: Math.min(stampRemaining, journalRemaining),
    limitedByJournalCapacity: journalRemaining < stampRemaining,
  };
}

export type StampFrameRatioMode = "square" | "cover";

export const STAMP_FRAME_RATIO_MODE = "square" satisfies StampFrameRatioMode;
export const DEFAULT_STAMP_FRAME_ASPECT_RATIO = 1;
