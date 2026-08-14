export const DAILY_MEMORY_STAMP_MAX_PHOTOS = 9;
export const DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS = 1;
export const DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS =
  DAILY_MEMORY_STAMP_MAX_PHOTOS - DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS;
export const JOURNAL_VOICE_MEMOS_ENABLED = true;
// 32 kbps keeps five minutes of Opus near 1.2 MB. The 6 MiB hard ceiling
// leaves conservative headroom for Safari audio/mp4/AAC and container overhead.
export const JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND = 32_000;
export const JOURNAL_VOICE_NOTE_MAX_BYTES = 6 * 1024 * 1024;

export function dailyStampAdditionalMomentCapacity(
  currentPhotoCount: number,
) {
  const normalizedPhotoCount = Math.max(0, Math.trunc(currentPhotoCount));
  const currentAdditionalMoments = Math.max(
    0,
    normalizedPhotoCount - DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS,
  );
  const stampRemaining = Math.max(
    0,
    DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS - currentAdditionalMoments,
  );
  return {
    remaining: stampRemaining,
  };
}

export type StampFrameRatioMode = "square" | "cover";

export const STAMP_FRAME_RATIO_MODE = "square" satisfies StampFrameRatioMode;
export const DEFAULT_STAMP_FRAME_ASPECT_RATIO = 1;
