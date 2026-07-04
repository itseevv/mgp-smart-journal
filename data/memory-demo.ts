import {
  localDateKeyFromValue,
  resolvedLocalTimezone,
} from "./local-date.ts";

export type MemoryMediaConfig = {
  maxPhotosPerMemory: number;
  maxPhotoFileSizeBytes: number;
  maxTotalVoiceDurationSeconds: number;
  maxDisplayPhotoEdgePixels: number;
  displayPhotoQuality: number;
  maxThumbnailPhotoEdgePixels: number;
  thumbnailPhotoQuality: number;
  standardUploadMaxBytes: number;
  uploadConcurrency: number;
  privateUrlLifetimeSeconds: number;
  privateUrlRefreshBufferSeconds: number;
};

export const memoryMediaConfig: MemoryMediaConfig = {
  maxPhotosPerMemory: 30,
  maxPhotoFileSizeBytes: 25 * 1024 * 1024,
  maxTotalVoiceDurationSeconds: 300,
  maxDisplayPhotoEdgePixels: 2000,
  displayPhotoQuality: 0.82,
  maxThumbnailPhotoEdgePixels: 480,
  thumbnailPhotoQuality: 0.72,
  standardUploadMaxBytes: 6 * 1024 * 1024,
  uploadConcurrency: 3,
  privateUrlLifetimeSeconds: 600,
  privateUrlRefreshBufferSeconds: 60,
};

export type MediaDraftStatus =
  | "persisted"
  | "new"
  | "preparing"
  | "uploading"
  | "uploaded"
  | "replacement"
  | "markedForDeletion"
  | "failed";

export type PhotoCropMetadata = {
  kind: "cover-scrap";
  aspectRatio: 1;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  createdAt: string;
};

export type MemoryPhoto = {
  id: string;
  name: string;
  objectUrl?: string;
  sizeBytes: number;
  mimeType: string;
  file?: File;
  preparedFile?: File;
  preparedThumbnailFile?: File;
  storagePath?: string;
  thumbnailObjectUrl?: string;
  thumbnailStoragePath?: string;
  thumbnailSizeBytes?: number;
  thumbnailMimeType?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  isLegacyThumbnail?: boolean;
  cropMetadata?: PhotoCropMetadata;
  width?: number;
  height?: number;
  originalSizeBytes?: number;
  status?: MediaDraftStatus;
  error?: string;
};

export type MemoryVoiceMemo = {
  id: string;
  title: string;
  durationSeconds: number;
  blob?: Blob;
  objectUrl?: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  previousStoragePath?: string;
  createdAt: string;
  order: number;
  status?: MediaDraftStatus;
  error?: string;
};

export type MemoryDraft = {
  capturedAt: string;
  localDate?: string;
  localTimezone?: string | null;
  title: string;
  photos: MemoryPhoto[];
  voiceMemos: MemoryVoiceMemo[];
};

export type MemoryEntry = MemoryDraft;

export type PersistentMemoryEntry = MemoryEntry & {
  id: string;
  capsuleId: string;
};

export function createEmptyMemory(capturedAt: string): MemoryDraft {
  return {
    capturedAt,
    localDate: localDateKeyFromValue(capturedAt),
    localTimezone: resolvedLocalTimezone(),
    title: "",
    photos: [],
    voiceMemos: [],
  };
}

export function fallbackVoiceMemoTitle(order: number) {
  return `Voice memo ${order + 1}`;
}

export function totalVoiceDuration(voiceMemos: MemoryVoiceMemo[]) {
  return voiceMemos.reduce(
    (total, voiceMemo) => total + voiceMemo.durationSeconds,
    0,
  );
}
