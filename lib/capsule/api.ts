import { Upload } from "tus-js-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MemoryMediaConfig,
  MemoryPhoto,
  MemoryVoiceMemo,
  PersistentMemoryEntry,
} from "@/data/memory-demo";
import {
  evictMissingMemoryCacheEntries,
  type CapsuleProductType,
  type JournalHomeData,
  type JournalMemoryContext,
  type JournalMemorySummary,
} from "@/data/journal";
import type { ArchiveQuotaSummary } from "@/data/archive-quota";
import type { JournalTheme } from "@/data/journal-themes";
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
  withCapsuleOpenRetry,
  withTimeout,
} from "@/lib/capsule/opening";
import { optimisePhotoForUpload } from "@/lib/media/photo-optimisation";
import { runUploadQueue } from "@/lib/media/upload-queue";
import { isPhotoCropMetadata } from "@/lib/scrap/crop-math";

const MEDIA_BUCKET = "memory-media";
const sessionMemoryCache = new Map<string, PersistentMemoryEntry>();
const ARCHIVE_STORAGE_LIMIT_MESSAGE =
  "Your Momento is full, so these new moments couldn’t be saved. Remove some media or expand your Archive, then try again.";

function mapArchiveQuota(
  value: Record<string, unknown> | null | undefined,
): ArchiveQuotaSummary {
  const status = value?.storageStatus;
  return {
    archiveId: String(value?.archiveId ?? ""),
    grantedBytes: Number(value?.grantedBytes ?? 0),
    usedBytes: Number(value?.usedBytes ?? 0),
    percentage: Number(value?.percentage ?? 0),
    storageStatus:
      status === "WARNING" || status === "FULL" ? status : "NORMAL",
    linkedChipCount: Number(value?.linkedChipCount ?? 0),
    storedOptimisedPhotoBytes: Number(value?.storedOptimisedPhotoBytes ?? 0),
    storedThumbnailBytes: Number(value?.storedThumbnailBytes ?? 0),
    storedVoiceNoteBytes: Number(value?.storedVoiceNoteBytes ?? 0),
  };
}

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
  accessExpiresAt?: string;
  journalTheme?: Partial<JournalTheme> | null;
  memory?: PersistentMemoryEntry | null;
  memoryUnavailable?: boolean;
};

export class PendingMediaCleanupError extends Error {
  constructor(readonly paths: string[]) {
    super("Stored media cleanup is pending.");
  }
}

export type PersistentMemoryCommitCode =
  | "ACCESS_DENIED"
  | "MEMORY_ID_CONFLICT"
  | "MEMORY_NOT_FOUND"
  | "MEMORY_ALREADY_EXISTS"
  | "EXPECTED_EXISTENCE_REQUIRED"
  | "MEDIA_ID_CONFLICT"
  | "MEDIA_PATH_CONFLICT"
  | "MEDIA_CLEANUP_RESERVED"
  | "MEDIA_CLEANUP_REQUIRED"
  | "MEDIA_RESERVATION_REQUIRED"
  | "MEDIA_RESERVATION_CONFLICT"
  | "INVALID_MEDIA_RESERVATION"
  | "BOOKMARK_MEMORY_LIMIT"
  | "JOURNAL_PHOTO_LIMIT"
  | "JOURNAL_VOICE_LIMIT"
  | "JOURNAL_STORAGE_LIMIT"
  | "FUTURE_LOCAL_DATE"
  | "INVALID_LOCAL_DATE"
  | "DUPLICATE_LOCAL_DATE"
  | "INVALID_MEMORY";

export class MediaSaveError extends Error {
  constructor(
    message: string,
    readonly draft: PersistentMemoryEntry,
    readonly failedItems: string[],
    readonly uploadedPaths: string[],
    readonly code?: PersistentMemoryCommitCode,
  ) {
    super(message);
    this.name = "MediaSaveError";
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
  action: "inspect" | "touch" | "activate" | "unlock" | "lock",
  publicToken: string,
  pin?: string,
  memoryId?: string,
  timeoutMs = CAPSULE_OPEN_TIMEOUT_MS,
) {
  return withCapsuleOpenRetry(
    async (remainingMs) => {
      let result;
      try {
        result = await withTimeout(
          client.functions.invoke("capsule-access", {
            body: { action, publicToken, pin, memoryId },
          }),
          remainingMs,
          () =>
            new CapsuleOpenError(
              "INSPECT_TIMEOUT",
              "inspect",
              "Opening this capsule took too long. Please retry.",
              { retryable: true },
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
    },
    {
      timeoutMs,
      maxAttempts: action === "inspect" ? 2 : 1,
    },
  );
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

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function optionalFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function mapJournalMemorySummary(
  memory: Record<string, unknown>,
): JournalMemorySummary {
  return {
    id: String(memory.id),
    title: String(memory.title ?? ""),
    capturedAt: String(memory.capturedAt ?? ""),
    createdAt: String(memory.createdAt ?? memory.capturedAt ?? ""),
    localDate: optionalString(memory.localDate),
    localTimezone:
      memory.localTimezone == null ? null : String(memory.localTimezone),
    photoCount: Number(memory.photoCount ?? 0),
    voiceMemoCount: Number(memory.voiceMemoCount ?? 0),
    firstPhotoStoragePath: optionalString(memory.firstPhotoStoragePath),
    firstPhotoWidth: optionalNumber(memory.firstPhotoWidth),
    firstPhotoHeight: optionalNumber(memory.firstPhotoHeight),
    firstThumbnailStoragePath: optionalString(memory.firstThumbnailStoragePath),
    thumbnailWidth: optionalNumber(memory.thumbnailWidth),
    thumbnailHeight: optionalNumber(memory.thumbnailHeight),
    coverCropMetadata: parsePhotoCropMetadata(memory.coverCropMetadata),
  };
}

function mapJournalTheme(theme: unknown): Partial<JournalTheme> | undefined {
  if (!theme || typeof theme !== "object") return undefined;
  const value = theme as Record<string, unknown>;
  return {
    id: optionalString(value.id),
    slug: optionalString(value.slug) ?? "",
    name: optionalString(value.name) ?? "",
    status: optionalString(value.status),
    textureUrl: optionalString(value.textureUrl),
    texturePublicUrl: optionalString(value.texturePublicUrl),
    textureStoragePath: optionalString(value.textureStoragePath),
    textureWidth: optionalNumber(value.textureWidth),
    textureHeight: optionalNumber(value.textureHeight),
    textureMimeType: optionalString(value.textureMimeType),
    focusX: optionalFiniteNumber(value.focusX),
    focusY: optionalFiniteNumber(value.focusY),
    zoom: optionalFiniteNumber(value.zoom),
    overlayColor: optionalString(value.overlayColor),
    overlayOpacity: optionalFiniteNumber(value.overlayOpacity),
    fallbackBackgroundColor: optionalString(value.fallbackBackgroundColor) ?? "",
    textPrimary: optionalString(value.textPrimary) ?? "",
    textSecondary: optionalString(value.textSecondary) ?? "",
    paperSurface: optionalString(value.paperSurface) ?? "",
    paperSurfaceMuted: optionalString(value.paperSurfaceMuted) ?? "",
    stampBorder: optionalString(value.stampBorder) ?? "",
    accentColor: optionalString(value.accentColor) ?? "",
    logoVariant: optionalString(value.logoVariant) ?? "",
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
  if (!result.data) {
    if (memoryId) {
      evictMissingMemoryCacheEntries(
        sessionMemoryCache,
        memoryCacheKey(capsuleId, memoryId),
        memoryCacheKey(capsuleId),
        memoryId,
      );
    }
    return undefined;
  }
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
    cleanupPendingCount?: number;
    archiveQuota?: Record<string, unknown> | null;
    journalTheme?: Record<string, unknown> | null;
    memories?: Record<string, unknown>[];
  };
  if (!data.ok || !data.capsuleId) {
    throw new Error("The journal could not be loaded.");
  }
  return {
    capsuleId: data.capsuleId,
    archiveQuota: mapArchiveQuota(data.archiveQuota),
    title: data.title ?? "My Journal",
    theme: mapJournalTheme(data.journalTheme),
    photoCount: Number(data.photoCount ?? 0),
    cleanupPendingCount: Number(data.cleanupPendingCount ?? 0),
    memories: Array.isArray(data.memories)
      ? data.memories.map(mapJournalMemorySummary)
      : [],
  };
}

export async function loadJournalMemoryContext(
  client: SupabaseClient,
  capsuleId: string,
): Promise<JournalMemoryContext> {
  const home = await loadJournalHome(client, capsuleId);
  return {
    title: home.title,
    maxPhotosPerEntry: DAILY_MEMORY_STAMP_MAX_PHOTOS,
    theme: home.theme,
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
  const data = result.data as { ok?: boolean; code?: "ACCESS_DENIED" | "NOT_A_JOURNAL" };
  if (result.error || !data?.ok) {
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
  immutablePath: boolean,
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
        "x-upsert": immutablePath ? "false" : "true",
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
    if (immutablePath) {
      upload.start();
      return;
    }
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
  immutablePath: boolean,
) {
  if (file.size > config.standardUploadMaxBytes) {
    await resumableUpload(client, path, file, mimeType, immutablePath);
    return "tus" as const;
  }
  const result = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: mimeType,
    cacheControl: "3600",
    upsert: !immutablePath,
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

export function withoutCleanedUploadPaths(
  draft: PersistentMemoryEntry,
  cleanedPaths: Iterable<string>,
) {
  const cleaned = new Set(cleanedPaths);
  return {
    ...draft,
    photos: draft.photos.map((photo) => {
      if (
        !cleaned.has(photo.storagePath ?? "") &&
        !cleaned.has(photo.thumbnailStoragePath ?? "")
      ) return { ...photo };
      return {
        ...photo,
        storagePath: undefined,
        thumbnailStoragePath: undefined,
        status: "new" as const,
        error: undefined,
      };
    }),
    voiceMemos: draft.voiceMemos.map((memo) =>
      cleaned.has(memo.storagePath ?? "")
        ? {
          ...memo,
          storagePath: undefined,
          status: memo.previousStoragePath
            ? "replacement" as const
            : "new" as const,
          error: undefined,
        }
        : { ...memo }
    ),
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

type JournalReservationPathKind =
  | "photo_display"
  | "photo_thumbnail"
  | "voice";

type JournalReservationRequest = {
  mediaId: string;
  pathKind: JournalReservationPathKind;
  expectedSizeBytes: number;
  expectedMimeType: string;
};

type JournalReservationGrant = JournalReservationRequest & {
  reservationId: string;
  storagePath: string;
  expiresAt: string;
};

function reservationKey(mediaId: string, pathKind: JournalReservationPathKind) {
  return `${mediaId}:${pathKind}`;
}

function expectedReservedStoragePath(
  capsuleId: string,
  memoryId: string,
  grant: Pick<
    JournalReservationGrant,
    "reservationId" | "mediaId" | "pathKind" | "expectedMimeType"
  >,
) {
  const extension = extensionFor(grant.expectedMimeType);
  if (grant.pathKind === "voice") {
    return `capsules/${capsuleId}/memories/${memoryId}/voice/${grant.mediaId}/${grant.reservationId}.${extension}`;
  }
  const variant = grant.pathKind === "photo_display" ? "display" : "thumb";
  return `capsules/${capsuleId}/memories/${memoryId}/photos/${grant.mediaId}/${grant.reservationId}-${variant}.${extension}`;
}

async function reserveJournalMediaUploads(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
  expectedMemoryExists: boolean,
  draft: PersistentMemoryEntry,
  requests: JournalReservationRequest[],
) {
  const result = await client.rpc("reserve_journal_media_uploads", {
    requested_capsule_id: capsuleId,
    requested_memory_id: memoryId,
    requested_expected_exists: expectedMemoryExists,
    requested_final_photo_ids: draft.photos.map((photo) => photo.id),
    requested_final_voice_ids: draft.voiceMemos.map((memo) => memo.id),
    requested_items: requests,
  });
  const data = result.data as {
    ok?: boolean;
    code?: PersistentMemoryCommitCode | "NOT_A_JOURNAL";
    reservations?: unknown;
  } | null;
  if (result.error || !data?.ok || !Array.isArray(data.reservations)) {
    throw new MediaSaveError(
      "Journal media reservation failed.",
      draft,
      [],
      [],
      data?.code === "NOT_A_JOURNAL" ? "INVALID_MEDIA_RESERVATION" : data?.code,
    );
  }

  const requestedByKey = new Map(
    requests.map((request) => [
      reservationKey(request.mediaId, request.pathKind),
      request,
    ]),
  );
  const grantedByKey = new Map<string, JournalReservationGrant>();
  for (const candidate of data.reservations) {
    if (!candidate || typeof candidate !== "object") {
      throw new MediaSaveError(
        "Journal media reservation response was invalid.",
        draft,
        [],
        [],
        "INVALID_MEDIA_RESERVATION",
      );
    }
    const grant = candidate as Partial<JournalReservationGrant>;
    const key =
      typeof grant.mediaId === "string" &&
        typeof grant.pathKind === "string"
        ? reservationKey(
          grant.mediaId,
          grant.pathKind as JournalReservationPathKind,
        )
        : "";
    const request = requestedByKey.get(key);
    if (
      !request ||
      grantedByKey.has(key) ||
      typeof grant.reservationId !== "string" ||
      typeof grant.storagePath !== "string" ||
      typeof grant.expiresAt !== "string" ||
      grant.expectedSizeBytes !== request.expectedSizeBytes ||
      grant.expectedMimeType !== request.expectedMimeType ||
      grant.storagePath !== expectedReservedStoragePath(
        capsuleId,
        memoryId,
        grant as JournalReservationGrant,
      ) ||
      !Number.isFinite(Date.parse(grant.expiresAt)) ||
      Date.parse(grant.expiresAt) <= Date.now()
    ) {
      throw new MediaSaveError(
        "Journal media reservation response was invalid.",
        draft,
        [],
        [],
        "INVALID_MEDIA_RESERVATION",
      );
    }
    grantedByKey.set(key, grant as JournalReservationGrant);
  }
  if (grantedByKey.size !== requestedByKey.size) {
    throw new MediaSaveError(
      "Journal media reservation response was incomplete.",
      draft,
      [],
      [],
      "INVALID_MEDIA_RESERVATION",
    );
  }
  return grantedByKey;
}

async function uploadDraftMedia(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
  expectedMemoryExists: boolean,
  journalMode: boolean,
  draft: PersistentMemoryEntry,
  config: MemoryMediaConfig,
  metrics: MediaPipelineMetrics,
  onProgress: (progress: SaveProgress) => void,
  onDraftChange: (draft: PersistentMemoryEntry) => void,
  cleanupBeforeReservationRetry?: () => Promise<boolean>,
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
  const reservationRequests = pending.flatMap<JournalReservationRequest>(
    (item): JournalReservationRequest[] => {
      if (item.kind === "photo") {
        const photo = next.photos[item.index];
        return [
          {
            mediaId: photo.id,
            pathKind: "photo_display" as const,
            expectedSizeBytes: photo.preparedFile!.size,
            expectedMimeType: photo.mimeType,
          },
          {
            mediaId: photo.id,
            pathKind: "photo_thumbnail" as const,
            expectedSizeBytes: photo.preparedThumbnailFile!.size,
            expectedMimeType: photo.thumbnailMimeType!,
          },
        ];
      }
      const memo = next.voiceMemos[item.index];
      return [{
        mediaId: memo.id,
        pathKind: "voice" as const,
        expectedSizeBytes: memo.blob!.size,
        expectedMimeType: memo.mimeType,
      }];
    },
  );
  const requestJournalReservations = () => reserveJournalMediaUploads(
    client,
    capsuleId,
    memoryId,
    expectedMemoryExists,
    next,
    reservationRequests,
  );
  let journalReservations = new Map<string, JournalReservationGrant>();
  if (journalMode && reservationRequests.length > 0) {
    try {
      journalReservations = await requestJournalReservations();
    } catch (error) {
      if (
        !(error instanceof MediaSaveError) ||
        error.code !== "MEDIA_CLEANUP_REQUIRED" ||
        !cleanupBeforeReservationRetry
      ) {
        throw error;
      }
      onProgress({
        status: "cleaningUp",
        message: "Finishing required media cleanup…",
      });
      if (!await cleanupBeforeReservationRetry()) throw error;
      journalReservations = await requestJournalReservations();
    }
  }
  const journalReservedPaths = [...journalReservations.values()].map(
    (reservation) => reservation.storagePath,
  );
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
          const path = journalMode
            ? journalReservations.get(
              reservationKey(photo.id, "photo_display"),
            )!.storagePath
            : `capsules/${capsuleId}/memories/${memoryId}/photos/${photo.id}/display.${extensionFor(photo.mimeType)}`;
          const thumbnailPath = journalMode
            ? journalReservations.get(
              reservationKey(photo.id, "photo_thumbnail"),
            )!.storagePath
            : `capsules/${capsuleId}/memories/${memoryId}/photos/${photo.id}/thumb.${extensionFor(photo.thumbnailMimeType!)}`;
          photo.status = "uploading";
          onDraftChange(cloneDraft(next));
          sizeBytes = file.size + thumbnailFile.size;
          const displayMethod = await uploadFile(
            client,
            path,
            file,
            photo.mimeType,
            config,
            journalMode,
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
          const thumbnailMethod = await uploadFile(
            client,
            thumbnailPath,
            thumbnailFile,
            photo.thumbnailMimeType!,
            config,
            journalMode,
          );
          method =
            displayMethod === "tus" || thumbnailMethod === "tus"
              ? "tus"
              : "standard";
          uploadedPaths.push(thumbnailPath);
          photo.storagePath = path;
          photo.thumbnailStoragePath = thumbnailPath;
          photo.status = "uploaded";
          photo.error = undefined;
          completed += 1;
        } else {
          const memo = next.voiceMemos[item.index];
          const blob = memo.blob!;
          const path = journalMode
            ? journalReservations.get(
              reservationKey(memo.id, "voice"),
            )!.storagePath
            : `capsules/${capsuleId}/memories/${memoryId}/voice/${memo.id}/${crypto.randomUUID()}.${extensionFor(memo.mimeType)}`;
          memo.status = "uploading";
          onDraftChange(cloneDraft(next));
          sizeBytes = blob.size;
          method = await uploadFile(
            client,
            path,
            blob,
            memo.mimeType,
            config,
            journalMode,
          );
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
    uploadedPaths:
      journalMode && result.failed.length > 0
        ? journalReservedPaths
        : uploadedPaths,
  };
}

export async function savePersistentMemory(
  client: SupabaseClient,
  capsuleId: string,
  memoryId: string,
  expectedMemoryExists: boolean,
  journalMode: boolean,
  draft: PersistentMemoryEntry,
  config: MemoryMediaConfig,
  callbacks: {
    onProgress: (progress: SaveProgress) => void;
    onDraftChange: (draft: PersistentMemoryEntry) => void;
    cleanupPaths: (paths: string[]) => Promise<boolean>;
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
      const cleaned = await callbacks.cleanupPaths(pendingCleanupPaths);
      if (!cleaned) {
        callbacks.onProgress({
          status: "partialFailure",
          message: "Old media cleanup still needs another attempt.",
        });
        throw new PendingMediaCleanupError(pendingCleanupPaths);
      }
      workingDraft = withoutCleanedUploadPaths(
        workingDraft,
        pendingCleanupPaths,
      );
      callbacks.onDraftChange(cloneDraft(workingDraft));
    }

    const oversizedVoiceMemo = workingDraft.voiceMemos.find(
      (memo) =>
        memo.blob && memo.blob.size > config.maxVoiceMemoFileSizeBytes,
    );
    if (oversizedVoiceMemo) {
      oversizedVoiceMemo.status = "failed";
      oversizedVoiceMemo.error = `Voice Notes must be ${Math.floor(config.maxVoiceMemoFileSizeBytes / (1024 * 1024))} MiB or smaller.`;
      callbacks.onDraftChange(cloneDraft(workingDraft));
      callbacks.onProgress({
        status: "error",
        message: oversizedVoiceMemo.error,
      });
      throw new MediaSaveError(
        "Voice Note file-size validation failed.",
        workingDraft,
        [oversizedVoiceMemo.title],
        [],
      );
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
      expectedMemoryExists,
      journalMode,
      workingDraft,
      config,
      metrics,
      callbacks.onProgress,
      callbacks.onDraftChange,
      journalMode ? () => callbacks.cleanupPaths([]) : undefined,
    ).catch((error) => {
      if (error instanceof MediaSaveError) {
        callbacks.onProgress({
          status: "error",
          message:
            error.code === "JOURNAL_STORAGE_LIMIT"
              ? ARCHIVE_STORAGE_LIMIT_MESSAGE
              : "Secure media admission could not be completed. Retry the save.",
        });
      }
      throw error;
    });
    workingDraft = uploaded.draft;
    if (uploaded.failedItems.length > 0) {
      let cleanupPendingPaths = uploaded.uploadedPaths;
      if (cleanupPendingPaths.length > 0) {
        callbacks.onProgress({
          status: "cleaningUp",
          message: "Removing unfinished media…",
        });
        if (await callbacks.cleanupPaths(cleanupPendingPaths)) {
          workingDraft = withoutCleanedUploadPaths(
            workingDraft,
            cleanupPendingPaths,
          );
          callbacks.onDraftChange(cloneDraft(workingDraft));
          cleanupPendingPaths = [];
        }
      }
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
        cleanupPendingPaths,
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
      requested_expected_exists: expectedMemoryExists,
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
      code?: PersistentMemoryCommitCode;
      cleanupPendingCount?: number;
      existingMemoryId?: string;
    } | null;
    if (result.error || !commitResult?.ok) {
      const message =
        commitResult?.code === "DUPLICATE_LOCAL_DATE" ||
        result.error?.code === "23505"
          ? "That day is already sealed in this journal."
          : commitResult?.code === "JOURNAL_STORAGE_LIMIT"
            ? ARCHIVE_STORAGE_LIMIT_MESSAGE
          : commitResult?.code === "FUTURE_LOCAL_DATE"
            ? "Choose today or an earlier local date."
          : commitResult?.code === "INVALID_LOCAL_DATE"
            ? "Choose a valid local date before sealing this day."
          : commitResult?.code === "BOOKMARK_MEMORY_LIMIT"
            ? "A bookmark capsule can contain only one memory."
          : commitResult?.code === "MEMORY_ID_CONFLICT"
              ? "This memory belongs to a different capsule."
            : commitResult?.code === "MEMORY_NOT_FOUND"
              ? "This Memory Day was deleted while it was open. Go back to the journal before making another change."
            : commitResult?.code === "MEMORY_ALREADY_EXISTS"
              ? "This Memory Day already exists. Refresh the journal before retrying."
              : commitResult?.code === "MEDIA_ID_CONFLICT"
                ? "One or more media items belong to a different memory."
              : "The memory could not be committed. Your saved draft is ready to retry.";
      if (uploaded.uploadedPaths.length > 0) {
        const cleanupPaths = [...uploaded.uploadedPaths];
        callbacks.onProgress({
          status: "cleaningUp",
          message: "Removing uncommitted media…",
        });
        if (await callbacks.cleanupPaths(cleanupPaths)) {
          workingDraft = withoutCleanedUploadPaths(
            workingDraft,
            cleanupPaths,
          );
          callbacks.onDraftChange(cloneDraft(workingDraft));
          uploaded.uploadedPaths.splice(0);
        }
      }
      callbacks.onProgress({ status: "error", message });
      throw new MediaSaveError(
        "Metadata commit failed.",
        workingDraft,
        [],
        uploaded.uploadedPaths,
        commitResult?.code,
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
