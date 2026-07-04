import { Upload } from "tus-js-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MemoryMediaConfig,
  MemoryPhoto,
  MemoryVoiceMemo,
  PersistentMemoryEntry,
} from "@/data/memory-demo";
import {
  journalConfig,
  type CapsuleProductType,
  type JournalHomeData,
  type JournalMemoryContext,
  type JournalMemorySummary,
} from "@/data/journal";
import { DAILY_MEMORY_STAMP_MAX_PHOTOS } from "@/data/journal-product";
import {
  createMediaPipelineMetrics,
  reportMediaPipelineMetrics,
  type MediaPipelineMetrics,
} from "@/lib/media/pipeline-metrics";
import {
  CAPSULE_OPEN_TIMEOUT_MS,
  CapsuleOpenError,
  mapCapsuleAccessInvokeError,
  withTimeout,
} from "@/lib/capsule/opening";
import { optimisePhotoForUpload } from "@/lib/media/photo-optimisation";
import { runUploadQueue } from "@/lib/media/upload-queue";
import { isPhotoCropMetadata } from "@/lib/scrap/crop-math";

const MEDIA_BUCKET = "memory-media";
const sessionMemoryCache = new Map<string, PersistentMemoryEntry>();

function memoryCacheKey(capsuleId: string, memoryId?: string) {
  return `${capsuleId}:${memoryId ?? "bookmark"}`;
}

function withoutResolvedUrls(
  memory: PersistentMemoryEntry,
): PersistentMemoryEntry {
  return {
    ...memory,
    photos: memory.photos.map((photo) => ({
      ...photo,
      objectUrl: undefined,
      thumbnailObjectUrl: undefined,
    })),
    voiceMemos: memory.voiceMemos.map((memo) => ({
      ...memo,
      objectUrl: undefined,
    })),
  };
}

export function getCachedPersistentMemory(
  capsuleId: string,
  memoryId?: string,
) {
  const memory = sessionMemoryCache.get(memoryCacheKey(capsuleId, memoryId));
  return memory ? withoutResolvedUrls(memory) : undefined;
}

function cachePersistentMemory(memory: PersistentMemoryEntry) {
  sessionMemoryCache.set(
    memoryCacheKey(memory.capsuleId, memory.id),
    withoutResolvedUrls(memory),
  );
  sessionMemoryCache.set(
    memoryCacheKey(memory.capsuleId),
    withoutResolvedUrls(memory),
  );
}

export function cacheAccessMemory(memory?: PersistentMemoryEntry | null) {
  if (memory) cachePersistentMemory(memory);
  return memory ?? undefined;
}

export function clearCapsuleSessionCache(capsuleId: string) {
  for (const key of sessionMemoryCache.keys()) {
    if (key.startsWith(`${capsuleId}:`)) sessionMemoryCache.delete(key);
  }
}

export type CapsuleGateState =
  | "notFound"
  | "unavailable"
  | "unactivated"
  | "locked"
  | "unlocked";
export type SaveStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "savingMetadata"
  | "cleaningUp"
  | "success"
  | "partialFailure"
  | "error";

export type SaveProgress = {
  status: SaveStatus;
  message: string;
  current?: number;
  total?: number;
  sourceBytes?: number;
  optimisedBytes?: number;
};

export type CapsuleInspection = {
  state: CapsuleGateState;
  capsuleId?: string;
  productType?: CapsuleProductType;
  memory?: PersistentMemoryEntry | null;
  memoryUnavailable?: boolean;
};

export class PendingMediaCleanupError extends Error {
  constructor(readonly paths: string[]) {
    super("Stored media cleanup is pending.");
  }
}

export class MediaSaveError extends Error {
  constructor(
    message: string,
    readonly draft: PersistentMemoryEntry,
    readonly failedItems: string[],
    readonly uploadedPaths: string[],
  ) {
    super(message);
  }
}

export async function ensureAnonymousSession(
  client: SupabaseClient,
  timeoutMs = CAPSULE_OPEN_TIMEOUT_MS,
) {
  const { data } = await withTimeout(
    client.auth.getSession(),
    timeoutMs,
    () =>
      new CapsuleOpenError(
        "AUTH_TIMEOUT",
        "auth",
        "Opening this capsule took too long while checking the private device session. Please retry.",
      ),
  );
  if (data.session) return data.session;
  const result = await withTimeout(
    client.auth.signInAnonymously(),
    timeoutMs,
    () =>
      new CapsuleOpenError(
        "AUTH_TIMEOUT",
        "auth",
        "Opening this capsule took too long while establishing a private device session. Please retry.",
      ),
  );
  if (result.error || !result.data.session) {
    throw new CapsuleOpenError(
      "AUTH_FAILED",
      "auth",
      "A private device session could not be established. Please check your connection and retry.",
    );
  }
  return result.data.session;
}

export async function callCapsuleAccess(
  client: SupabaseClient,
  action: "inspect" | "activate" | "unlock" | "lock",
  publicToken: string,
  pin?: string,
  memoryId?: string,
  timeoutMs = CAPSULE_OPEN_TIMEOUT_MS,
) {
  let result;
  try {
    result = await withTimeout(
      client.functions.invoke("capsule-access", {
        body: { action, publicToken, pin, memoryId },
      }),
      timeoutMs,
      () =>
        new CapsuleOpenError(
          "INSPECT_TIMEOUT",
          "inspect",
          "Opening this capsule took too long. Please retry.",
        ),
    );
  } catch (error) {
    if (error instanceof CapsuleOpenError) throw error;
    throw mapCapsuleAccessInvokeError(error);
  }
  const { data, error } = result;
  if (error) throw mapCapsuleAccessInvokeError(error);
  return data as CapsuleInspection & {
    ok?: boolean;
    code?: "ACCESS_DENIED" | "TEMPORARILY_LOCKED" | "INVALID_REQUEST" | "UNAVAILABLE";
    retryAfterSeconds?: number;
  };
}

export type RecoveryAccessResult = {
  ok?: boolean;
  code?:
    | "ACCESS_DENIED"
    | "TEMPORARILY_LOCKED"
    | "INVALID_REQUEST"
    | "RECOVERY_NOT_ENABLED"
    | "REPLACEMENT_UNAVAILABLE"
    | "UNAVAILABLE";
  status?: "completed";
  duplicate?: boolean;
  recoveryEnabled?: boolean;
  replacementAvailable?: boolean;
  recoveryCode?: string;
  capsuleId?: string;
  codeVersion?: number;
};

async function callRecoveryAccess(
  client: SupabaseClient,
  body: Record<string, unknown>,
) {
  const { data, error } = await client.functions.invoke("capsule-access", {
    body,
  });
  if (error) throw new Error("The recovery service is temporarily unavailable.");
  return data as RecoveryAccessResult;
}

export function inspectRecoveryAccess(
  client: SupabaseClient,
  publicToken: string,
) {
  return callRecoveryAccess(client, {
    action: "recovery-inspect",
    publicToken,
  });
}

export function verifyRecoveryCode(
  client: SupabaseClient,
  publicToken: string,
  recoveryCode: string,
) {
  return callRecoveryAccess(client, {
    action: "recovery-verify",
    publicToken,
    recoveryCode,
  });
}

export function resetOwnerPinWithRecovery(
  client: SupabaseClient,
  input: {
    publicToken: string;
    operationId: string;
    recoveryCode: string;
    pin: string;
    pinConfirmation: string;
  },
) {
  return callRecoveryAccess(client, {
    action: "recovery-reset",
    ...input,
  });
}

export function replaceLostRecoveryCode(
  client: SupabaseClient,
  publicToken: string,
  operationId: string,
) {
  return callRecoveryAccess(client, {
    action: "recovery-replace",
    publicToken,
    operationId,
  });
}

function extensionFor(mimeType: string) {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
  };
  return known[mimeType.split(";")[0]] ?? "bin";
}

function parsePhotoCropMetadata(value: unknown) {
  return isPhotoCropMetadata(value) ? value : undefined;
}

function mapPersistentMemory(row: Record<string, unknown>) {
  const photoRows = (row.photos as Array<Record<string, unknown>>).sort(
    (a, b) => Number(a.order_index) - Number(b.order_index),
  );
  const voiceRows = (row.voice_memos as Array<Record<string, unknown>>).sort(
    (a, b) => Number(a.order_index) - Number(b.order_index),
  );
  const photos: MemoryPhoto[] = photoRows.map((photo) => ({
    id: String(photo.id),
    name: `Photograph ${Number(photo.order_index) + 1}`,
    objectUrl: undefined,
    storagePath: String(photo.storage_path),
    sizeBytes: Number(photo.size_bytes),
    mimeType: String(photo.mime_type),
    width: photo.width == null ? undefined : Number(photo.width),
    height: photo.height == null ? undefined : Number(photo.height),
    thumbnailStoragePath: photo.thumbnail_storage_path
      ? String(photo.thumbnail_storage_path)
      : undefined,
    thumbnailSizeBytes: photo.thumbnail_size_bytes == null
      ? undefined
      : Number(photo.thumbnail_size_bytes),
    thumbnailMimeType: photo.thumbnail_mime_type == null
      ? undefined
      : String(photo.thumbnail_mime_type),
    thumbnailWidth: photo.thumbnail_width == null
      ? undefined
      : Number(photo.thumbnail_width),
    thumbnailHeight: photo.thumbnail_height == null
      ? undefined
      : Number(photo.thumbnail_height),
    isLegacyThumbnail: !photo.thumbnail_storage_path,
    cropMetadata: parsePhotoCropMetadata(photo.crop_metadata),
    status: "persisted",
  }));
  const voiceMemos: MemoryVoiceMemo[] = voiceRows.map((memo) => ({
    id: String(memo.id),
    title: String(memo.title),
    durationSeconds: Number(memo.duration_seconds),
    storagePath: String(memo.storage_path),
    mimeType: String(memo.mime_type),
    sizeBytes: Number(memo.size_bytes),
    createdAt: String(memo.created_at),
    order: Number(memo.order_index),
    status: "persisted",
  }));
  return {
    id: String(row.id),
    capsuleId: String(row.capsule_id),
    title: String(row.title),
    capturedAt: String(row.occurred_at),
    localDate: row.local_date == null ? undefined : String(row.local_date),
    localTimezone:
      row.local_timezone == null ? null : String(row.local_timezone),
    photos,
    voiceMemos,
  };
}

export async function loadPersistentMemory(
  client: SupabaseClient,
  capsuleId: string,
  memoryId?: string,
): Promise<PersistentMemoryEntry | undefined> {
  let query = client
    .from("memories")
    .select(
      "id,capsule_id,title,occurred_at,local_date,local_timezone,photos(*),voice_memos(*)",
    )
    .eq("capsule_id", capsuleId);
  query = memoryId
    ? query.eq("id", memoryId)
    : query.order("created_at", { ascending: true }).limit(1);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return undefined;
  const memory = mapPersistentMemory(result.data as Record<string, unknown>);
  cachePersistentMemory(memory);
  return memory;
}

export async function loadJournalHome(
  client: SupabaseClient,
  capsuleId: string,
): Promise<JournalHomeData> {
  const result = await client.rpc("get_journal_home", {
    requested_capsule_id: capsuleId,
  });
  if (result.error) throw result.error;
  const data = result.data as {
    ok?: boolean;
    capsuleId?: string;
    title?: string;
    photoCount?: number;
    maxPhotos?: number;
    cleanupPendingCount?: number;
    memories?: JournalMemorySummary[];
  };
  if (!data.ok || !data.capsuleId) {
    throw new Error("The journal could not be loaded.");
  }
  return {
    capsuleId: data.capsuleId,
    title: data.title ?? "My Journal",
    photoCount: Number(data.photoCount ?? 0),
    maxPhotos: Number(data.maxPhotos ?? journalConfig.maxPhotos),
    cleanupPendingCount: Number(data.cleanupPendingCount ?? 0),
    memories: data.memories ?? [],
  };
}

export async function loadJournalMemoryContext(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
): Promise<JournalMemoryContext> {
  const home = await loadJournalHome(client, capsuleId);
  const existingMemoryPhotos =
    home.memories.find((memory) => memory.id === memoryId)?.photoCount ?? 0;
  return {
    totalJournalPhotos: home.photoCount,
    existingMemoryPhotos,
    effectivePhotoLimit: Math.max(
      0,
      Math.min(
        DAILY_MEMORY_STAMP_MAX_PHOTOS,
        home.maxPhotos - home.photoCount + existingMemoryPhotos,
      ),
    ),
    memories: home.memories,
  };
}

export async function updateJournalTitle(
  client: SupabaseClient,
  capsuleId: string,
  title: string,
) {
  const result = await client.rpc("update_journal_title", {
    requested_capsule_id: capsuleId,
    requested_title: title,
  });
  if (result.error || !(result.data as { ok?: boolean })?.ok) {
    throw new Error("The journal title could not be saved.");
  }
  return String((result.data as { title: string }).title);
}

export async function deleteJournalMemory(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
) {
  const result = await client.rpc("delete_journal_memory", {
    requested_capsule_id: capsuleId,
    requested_memory_id: memoryId,
  });
  if (result.error || !(result.data as { ok?: boolean })?.ok) {
    throw new Error("The memory could not be deleted.");
  }
  sessionMemoryCache.delete(memoryCacheKey(capsuleId, memoryId));
  return result.data as {
    ok: true;
    deleted: boolean;
    cleanupPendingCount?: number;
  };
}

export async function processMediaCleanup(
  client: SupabaseClient,
  publicToken: string,
  paths?: string[],
) {
  const { data, error } = await client.functions.invoke("capsule-access", {
    body: { action: "cleanup", publicToken, cleanupPaths: paths },
  });
  if (error) throw new Error("Stored media cleanup could not be completed.");
  return data as { ok: boolean; remaining?: number };
}

function directStorageEndpoint() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("Supabase browser environment is not configured.");
  const hostname = new URL(projectUrl).hostname;
  const projectId = hostname.split(".")[0];
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

async function resumableUpload(
  client: SupabaseClient,
  path: string,
  file: Blob,
  mimeType: string,
) {
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("The private upload session has expired.");

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: directStorageEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: MEDIA_BUCKET,
        objectName: path,
        contentType: mimeType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onSuccess: () => resolve(),
    });
    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }, reject);
  });
}

async function uploadFile(
  client: SupabaseClient,
  path: string,
  file: Blob,
  mimeType: string,
  config: MemoryMediaConfig,
) {
  if (file.size > config.standardUploadMaxBytes) {
    await resumableUpload(client, path, file, mimeType);
    return "tus" as const;
  }
  const result = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: mimeType,
    cacheControl: "3600",
    upsert: true,
  });
  if (result.error) throw result.error;
  return "standard" as const;
}

function cloneDraft(draft: PersistentMemoryEntry): PersistentMemoryEntry {
  return {
    ...draft,
    photos: draft.photos.map((photo) => ({ ...photo })),
    voiceMemos: draft.voiceMemos.map((memo) => ({ ...memo })),
  };
}

async function prepareDraftPhotos(
  draft: PersistentMemoryEntry,
  config: MemoryMediaConfig,
  metrics: MediaPipelineMetrics,
  onProgress: (progress: SaveProgress) => void,
  onDraftChange: (draft: PersistentMemoryEntry) => void,
) {
  const next = cloneDraft(draft);
  const pending = next.photos.filter(
    (photo) => photo.file && !photo.preparedFile && !photo.storagePath,
  );
  metrics.sourceBytes =
    pending.reduce((total, photo) => total + (photo.file?.size ?? 0), 0) +
    next.voiceMemos
      .filter((memo) => memo.blob && !memo.storagePath)
      .reduce((total, memo) => total + (memo.blob?.size ?? 0), 0);
  const startedAt = performance.now();
  const failedItems: string[] = [];

  for (let index = 0; index < pending.length; index += 1) {
    const photo = pending[index];
    photo.status = "preparing";
    photo.error = undefined;
    onDraftChange(cloneDraft(next));
    onProgress({
      status: "preparing",
      message: `Preparing ${index + 1} of ${pending.length} images`,
      current: index + 1,
      total: pending.length,
      sourceBytes: metrics.sourceBytes,
    });
    try {
      const prepared = await optimisePhotoForUpload(photo.file!, config);
      photo.preparedFile = prepared.display.file;
      photo.preparedThumbnailFile = prepared.thumbnail.file;
      photo.mimeType = prepared.display.mimeType;
      photo.sizeBytes = prepared.display.size;
      photo.originalSizeBytes = prepared.originalSize;
      photo.width = prepared.display.width;
      photo.height = prepared.display.height;
      photo.thumbnailMimeType = prepared.thumbnail.mimeType;
      photo.thumbnailSizeBytes = prepared.thumbnail.size;
      photo.thumbnailWidth = prepared.thumbnail.width;
      photo.thumbnailHeight = prepared.thumbnail.height;
      photo.isLegacyThumbnail = false;
      photo.status = "new";
    } catch (error) {
      photo.status = "failed";
      photo.error =
        error instanceof Error
          ? error.message
          : "This photograph could not be prepared.";
      failedItems.push(photo.name);
    }
    onDraftChange(cloneDraft(next));
  }

  metrics.preparationDurationMs = Math.round(performance.now() - startedAt);
  metrics.optimisedBytes =
    next.photos.reduce(
      (total, photo) =>
        total +
        (photo.preparedFile?.size ?? 0) +
        (photo.preparedThumbnailFile?.size ?? 0),
      0,
    ) +
    next.voiceMemos
      .filter((memo) => memo.blob && !memo.storagePath)
      .reduce((total, memo) => total + (memo.blob?.size ?? 0), 0);
  return { draft: next, failedItems };
}

type PendingUpload =
  | { kind: "photo"; index: number; label: string }
  | { kind: "voice"; index: number; label: string };

async function uploadDraftMedia(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
  draft: PersistentMemoryEntry,
  config: MemoryMediaConfig,
  metrics: MediaPipelineMetrics,
  onProgress: (progress: SaveProgress) => void,
  onDraftChange: (draft: PersistentMemoryEntry) => void,
) {
  const next = cloneDraft(draft);
  const pending: PendingUpload[] = [
    ...next.photos.flatMap((photo, index) =>
      photo.preparedFile &&
      photo.preparedThumbnailFile &&
      (!photo.storagePath || !photo.thumbnailStoragePath)
        ? [{ kind: "photo" as const, index, label: photo.name }]
        : [],
    ),
    ...next.voiceMemos.flatMap((memo, index) =>
      memo.blob && !memo.storagePath
        ? [{ kind: "voice" as const, index, label: memo.title }]
        : [],
    ),
  ];
  metrics.skippedFiles = next.photos.length + next.voiceMemos.length - pending.length;
  let completed = 0;
  const totalFiles = pending.reduce(
    (total, item) => total + (item.kind === "photo" ? 2 : 1),
    0,
  );
  const uploadedPaths: string[] = [];
  const startedAt = performance.now();

  const result = await runUploadQueue(
    pending,
    config.uploadConcurrency,
    async (item) => {
      const itemStartedAt = performance.now();
      let sizeBytes = 0;
      let method: "standard" | "tus" = "standard";
      try {
        if (item.kind === "photo") {
          const photo = next.photos[item.index];
          const file = photo.preparedFile!;
          const thumbnailFile = photo.preparedThumbnailFile!;
          const path = `capsules/${capsuleId}/memories/${memoryId}/photos/${photo.id}/display.${extensionFor(photo.mimeType)}`;
          const thumbnailPath = `capsules/${capsuleId}/memories/${memoryId}/photos/${photo.id}/thumb.${extensionFor(photo.thumbnailMimeType!)}`;
          photo.status = "uploading";
          onDraftChange(cloneDraft(next));
          sizeBytes = file.size + thumbnailFile.size;
          const displayMethod = await uploadFile(
            client,
            path,
            file,
            photo.mimeType,
            config,
          );
          uploadedPaths.push(path);
          completed += 1;
          onProgress({
            status: "uploading",
            message: `Saved ${completed} of ${totalFiles} media items`,
            current: completed,
            total: totalFiles,
            sourceBytes: metrics.sourceBytes,
            optimisedBytes: metrics.optimisedBytes,
          });
          try {
            const thumbnailMethod = await uploadFile(
              client,
              thumbnailPath,
              thumbnailFile,
              photo.thumbnailMimeType!,
              config,
            );
            method =
              displayMethod === "tus" || thumbnailMethod === "tus"
                ? "tus"
                : "standard";
          } catch (error) {
            await client.storage.from(MEDIA_BUCKET).remove([path]);
            const pathIndex = uploadedPaths.indexOf(path);
            if (pathIndex >= 0) uploadedPaths.splice(pathIndex, 1);
            throw error;
          }
          uploadedPaths.push(thumbnailPath);
          photo.storagePath = path;
          photo.thumbnailStoragePath = thumbnailPath;
          photo.status = "uploaded";
          photo.error = undefined;
          completed += 1;
        } else {
          const memo = next.voiceMemos[item.index];
          const blob = memo.blob!;
          const revisionId = crypto.randomUUID();
          const path = `capsules/${capsuleId}/memories/${memoryId}/voice/${memo.id}/${revisionId}.${extensionFor(memo.mimeType)}`;
          memo.status = "uploading";
          onDraftChange(cloneDraft(next));
          sizeBytes = blob.size;
          method = await uploadFile(client, path, blob, memo.mimeType, config);
          memo.storagePath = path;
          memo.sizeBytes = blob.size;
          memo.status = "uploaded";
          memo.error = undefined;
          uploadedPaths.push(path);
          completed += 1;
        }
        metrics.uploadedFiles += item.kind === "photo" ? 2 : 1;
        onDraftChange(cloneDraft(next));
        onProgress({
          status: "uploading",
          message: `Saved ${completed} of ${totalFiles} media items`,
          current: completed,
          total: totalFiles,
          sourceBytes: metrics.sourceBytes,
          optimisedBytes: metrics.optimisedBytes,
        });
        metrics.individualUploads.push({
          kind: item.kind,
          durationMs: Math.round(performance.now() - itemStartedAt),
          sizeBytes,
          method,
          succeeded: true,
        });
      } catch (error) {
        const media =
          item.kind === "photo"
            ? next.photos[item.index]
            : next.voiceMemos[item.index];
        media.status = "failed";
        media.error = "Save failed. Retry to continue from this item.";
        onDraftChange(cloneDraft(next));
        metrics.failedFiles += 1;
        metrics.individualUploads.push({
          kind: item.kind,
          durationMs: Math.round(performance.now() - itemStartedAt),
          sizeBytes,
          method,
          succeeded: false,
        });
        throw error;
      }
    },
  );

  metrics.uploadDurationMs = Math.round(performance.now() - startedAt);
  metrics.maximumActiveUploadCount = result.maximumActiveCount;
  return {
    draft: next,
    failedItems: result.failed.map(({ item }) => item.label),
    uploadedPaths,
  };
}

export async function savePersistentMemory(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
  draft: PersistentMemoryEntry,
  config: MemoryMediaConfig,
  callbacks: {
    onProgress: (progress: SaveProgress) => void;
    onDraftChange: (draft: PersistentMemoryEntry) => void;
  },
  pendingCleanupPaths: string[] = [],
) {
  const metrics = createMediaPipelineMetrics();
  let workingDraft = cloneDraft(draft);
  try {
    if (pendingCleanupPaths.length > 0) {
      callbacks.onProgress({
        status: "cleaningUp",
        message: "Finishing cleanup from the previous save…",
      });
      const pendingRemoval = await client.storage
        .from(MEDIA_BUCKET)
        .remove(pendingCleanupPaths);
      if (pendingRemoval.error) {
        callbacks.onProgress({
          status: "partialFailure",
          message: "Old media cleanup still needs another attempt.",
        });
        throw new PendingMediaCleanupError(pendingCleanupPaths);
      }
    }

    const preparation = await prepareDraftPhotos(
      workingDraft,
      config,
      metrics,
      callbacks.onProgress,
      callbacks.onDraftChange,
    );
    workingDraft = preparation.draft;
    if (preparation.failedItems.length > 0) {
      callbacks.onProgress({
        status: "error",
        message: `${preparation.failedItems.length} ${
          preparation.failedItems.length === 1 ? "image needs" : "images need"
        } attention before saving.`,
        sourceBytes: metrics.sourceBytes,
        optimisedBytes: metrics.optimisedBytes,
      });
      throw new MediaSaveError(
        "Photo preparation failed.",
        workingDraft,
        preparation.failedItems,
        [],
      );
    }

    callbacks.onProgress({
      status: "uploading",
      message: "Saving media",
      current: 0,
      total: 0,
      sourceBytes: metrics.sourceBytes,
      optimisedBytes: metrics.optimisedBytes,
    });
    const uploaded = await uploadDraftMedia(
      client,
      capsuleId,
      memoryId,
      workingDraft,
      config,
      metrics,
      callbacks.onProgress,
      callbacks.onDraftChange,
    );
    workingDraft = uploaded.draft;
    if (uploaded.failedItems.length > 0) {
      callbacks.onProgress({
        status: "error",
        message: `${uploaded.failedItems.length} ${
          uploaded.failedItems.length === 1
            ? "media item failed"
            : "media items failed"
        }. Saved items are preserved; retry the failed items.`,
        sourceBytes: metrics.sourceBytes,
        optimisedBytes: metrics.optimisedBytes,
      });
      throw new MediaSaveError(
        "Media upload failed.",
        workingDraft,
        uploaded.failedItems,
        uploaded.uploadedPaths,
      );
    }

    callbacks.onProgress({
      status: "savingMetadata",
      message: "Saving stamp details",
      sourceBytes: metrics.sourceBytes,
      optimisedBytes: metrics.optimisedBytes,
    });
    const metadataStartedAt = performance.now();
    const commitParameters = {
      requested_capsule_id: capsuleId,
      requested_memory_id: memoryId,
      requested_title: workingDraft.title,
      requested_occurred_at: workingDraft.capturedAt,
      requested_local_date: workingDraft.localDate ?? null,
      requested_local_timezone: workingDraft.localTimezone ?? null,
      requested_photos: workingDraft.photos.map((photo, orderIndex) => ({
        id: photo.id,
        storagePath: photo.storagePath,
        orderIndex,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        width: photo.width ?? null,
        height: photo.height ?? null,
        thumbnailStoragePath: photo.thumbnailStoragePath ?? null,
        thumbnailMimeType: photo.thumbnailMimeType ?? null,
        thumbnailSizeBytes: photo.thumbnailSizeBytes ?? null,
        thumbnailWidth: photo.thumbnailWidth ?? null,
        thumbnailHeight: photo.thumbnailHeight ?? null,
        cropMetadata: photo.cropMetadata ?? null,
      })),
      requested_voice_memos: workingDraft.voiceMemos.map((memo, orderIndex) => ({
        id: memo.id,
        title: memo.title,
        storagePath: memo.storagePath,
        orderIndex,
        durationSeconds: memo.durationSeconds,
        mimeType: memo.mimeType,
        sizeBytes: memo.sizeBytes,
        createdAt: memo.createdAt,
      })),
    };
    let result = await client.rpc("commit_memory", commitParameters);
    if (result.error?.code === "PGRST202") {
      result = await client.rpc("commit_single_memory", commitParameters);
    }
    metrics.metadataSaveDurationMs = Math.round(
      performance.now() - metadataStartedAt,
    );
    const commitResult = result.data as {
      ok?: boolean;
      code?:
        | "ACCESS_DENIED"
        | "MEMORY_ID_CONFLICT"
        | "MEDIA_ID_CONFLICT"
        | "BOOKMARK_MEMORY_LIMIT"
        | "JOURNAL_PHOTO_LIMIT"
        | "DUPLICATE_LOCAL_DATE"
        | "INVALID_MEMORY";
      cleanupPendingCount?: number;
      existingMemoryId?: string;
    } | null;
    if (result.error || !commitResult?.ok) {
      const message =
        commitResult?.code === "DUPLICATE_LOCAL_DATE" ||
        result.error?.code === "23505"
          ? "That day is already sealed in this journal."
          : commitResult?.code === "JOURNAL_PHOTO_LIMIT"
          ? "This journal needs a little space before another day can be sealed."
          : commitResult?.code === "BOOKMARK_MEMORY_LIMIT"
            ? "A bookmark capsule can contain only one memory."
            : commitResult?.code === "MEMORY_ID_CONFLICT"
              ? "This memory belongs to a different capsule."
              : commitResult?.code === "MEDIA_ID_CONFLICT"
                ? "One or more media items belong to a different memory."
              : "The memory could not be committed. Your saved draft is ready to retry.";
      callbacks.onProgress({
        status: "error",
        message,
      });
      throw new MediaSaveError(
        "Metadata commit failed.",
        workingDraft,
        [],
        uploaded.uploadedPaths,
      );
    }

    if ((commitResult.cleanupPendingCount ?? 0) > 0) {
      callbacks.onProgress({
        status: "cleaningUp",
        message: "Queued old media for private cleanup",
      });
    }
    callbacks.onProgress({
      status: "success",
      message: "Complete",
      sourceBytes: metrics.sourceBytes,
      optimisedBytes: metrics.optimisedBytes,
    });
  } finally {
    reportMediaPipelineMetrics(metrics);
  }
}
