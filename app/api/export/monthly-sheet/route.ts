import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import {
  defaultJournalTheme,
  resolveJournalTheme,
  type JournalTheme,
} from "../../../../data/journal-themes.ts";
import { getAdminSupabaseClient } from "../../../../lib/admin/supabase.ts";
import { createMonthlyExportDataLoader } from "../../../../lib/export/monthly-memory-sheet-data.ts";
import {
  MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY,
  MONTHLY_EXPORT_MAX_OUTSTANDING_ARTIFACTS_PER_CAPSULE,
  monthlyExportArtifactIdentity,
} from "../../../../lib/export/monthly-memory-sheet-cleanup.ts";
import {
  createMonthlyExportPostHandler,
  MonthlyExportRouteError,
  readBoundedJsonObject,
  type MonthlyExportSelection,
} from "../../../../lib/export/monthly-memory-sheet-route-core.ts";
import {
  createConcurrencyLimiter,
  remainingDeadlineMs,
  withAbortTimeout,
  withTimeout,
} from "../../../../lib/export/monthly-memory-sheet-runtime.ts";
import {
  prepareServerMonthlyCoverPhoto,
  renderServerMonthlyMemoryEditionPng,
} from "../../../../lib/export/monthly-memory-sheet-server.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEMORY_MEDIA_BUCKET = "memory-media";
const JOURNAL_THEME_ASSET_BUCKET = "journal-theme-assets";
const MAX_THUMBNAIL_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_DISPLAY_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_TEXTURE_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_COVER_SOURCE_BYTES = 70 * 1024 * 1024;
const MAX_THUMBNAIL_INPUT_PIXELS = 1_000_000;
const MAX_DISPLAY_INPUT_PIXELS = 20_000_000;
const COVER_CONCURRENCY = 8;
const DECODE_CONCURRENCY = 2;
const DATABASE_TIMEOUT_MS = 5_000;
const STORAGE_TIMEOUT_MS = 2_500;
const ARTIFACT_STORAGE_TIMEOUT_MS = 10_000;
const DECODE_TIMEOUT_MS = 1_500;
const RENDER_RESERVE_MS = 36_000;
const EXPORT_ADMISSION_TTL_MS = 70_000;
const EXPORT_ADMISSION_CLAIM_TTL_MS = 10_000;
const EXPORT_ADMISSION_COOLDOWN_MS = 15_000;
const EXPORT_ADMISSION_MAX_BYTES = 4_096;
const EXPORT_SIGNED_URL_SECONDS = 120;
const EXPORT_CLEANUP_BODY_BYTES = 1_024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DownloadBudget = {
  usedBytes: number;
  maxBytes: number;
};

type PhotoRow = {
  memory_id: string;
  storage_path: string;
  thumbnail_storage_path: string | null;
  order_index: number;
  crop_metadata: unknown;
};

type MemoryRow = {
  id: string;
  local_date: string | null;
  occurred_at: string;
};

type ExportAdmissionState = "claiming" | "active" | "cooldown";

type ListedExportAdmission = {
  token: string;
  state: ExportAdmissionState;
  storagePath: string;
  storageCreatedAt: number;
};

type AdmissionStorageMutations = {
  uploadJson: (
    storagePath: string,
    deadline: number,
    signal: AbortSignal,
    timeoutMessage: string,
  ) => Promise<void>;
  remove: (
    storagePaths: string[],
    deadline: number,
    signal: AbortSignal,
    timeoutMessage: string,
  ) => Promise<void>;
};

function storageServiceConfiguration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  return { supabaseUrl, serviceKey };
}

function storageObjectUrl(supabaseUrl: string, storagePath: string) {
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/${MEMORY_MEDIA_BUCKET}/${encodedPath}`;
}

function storageServiceHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Cache-Control": "no-store",
  };
}

async function uploadPrivateJsonMarker(
  storagePath: string,
  deadline: number,
  signal: AbortSignal,
  timeoutMessage: string,
) {
  const { supabaseUrl, serviceKey } = storageServiceConfiguration();
  const response = await withAbortTimeout(
    (uploadSignal) =>
      fetch(storageObjectUrl(supabaseUrl, storagePath), {
        method: "POST",
        headers: {
          ...storageServiceHeaders(serviceKey),
          "Content-Type": "application/json",
          "x-upsert": "false",
        },
        body: "{}",
        cache: "no-store",
        signal: uploadSignal,
      }),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    timeoutMessage,
    signal,
  );
  if (!response.ok) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
}

async function removePrivateStoragePaths(
  storagePaths: string[],
  deadline: number,
  signal: AbortSignal,
  timeoutMessage: string,
) {
  if (!storagePaths.length) return;
  const { supabaseUrl, serviceKey } = storageServiceConfiguration();
  const response = await withAbortTimeout(
    (removeSignal) =>
      fetch(
        `${supabaseUrl}/storage/v1/object/${MEMORY_MEDIA_BUCKET}`,
        {
          method: "DELETE",
          headers: {
            ...storageServiceHeaders(serviceKey),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes: storagePaths }),
          cache: "no-store",
          signal: removeSignal,
        },
      ),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    timeoutMessage,
    signal,
  );
  if (!response.ok) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
}

const productionAdmissionStorageMutations: AdmissionStorageMutations = {
  uploadJson: uploadPrivateJsonMarker,
  remove: removePrivateStoragePaths,
};

export async function assertMonthlyArtifactCapacity(
  capsuleId: string,
  deadline: number,
  signal: AbortSignal,
) {
  const canonicalCapsuleId = capsuleId.toLowerCase();
  const { supabaseUrl, serviceKey } = storageServiceConfiguration();
  const response = await withAbortTimeout(
    (listSignal) =>
      fetch(
        `${supabaseUrl}/storage/v1/object/list/${MEMORY_MEDIA_BUCKET}`,
        {
          method: "POST",
          headers: {
            ...storageServiceHeaders(serviceKey),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefix: MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY,
            limit: MONTHLY_EXPORT_MAX_OUTSTANDING_ARTIFACTS_PER_CAPSULE + 1,
            offset: 0,
            search: `${canonicalCapsuleId}-`,
            sortBy: { column: "created_at", order: "asc" },
          }),
          cache: "no-store",
          signal: listSignal,
        },
      ),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export artifact capacity lookup timed out.",
    signal,
  );
  if (!response.ok) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const listed = (await response.json()) as unknown;
  if (!Array.isArray(listed)) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const prefix = `${canonicalCapsuleId}-`;
  const outstanding = listed.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as { name?: unknown }).name === "string" &&
      (item as { name: string }).name.startsWith(prefix) &&
      (item as { name: string }).name.endsWith(".json"),
  ).length;
  if (outstanding >= MONTHLY_EXPORT_MAX_OUTSTANDING_ARTIFACTS_PER_CAPSULE) {
    throw new MonthlyExportRouteError(
      "EXPORT_LIMIT",
      429,
      "Please clean up an earlier monthly export before trying again.",
      3_600,
    );
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function authorizeCapsuleAccess(
  request: Request,
  capsuleId: string,
  deadline: number,
  signal: AbortSignal,
) {
  const canonicalCapsuleId = capsuleId.toLowerCase();
  const token = bearerToken(request);
  if (!token) throw new MonthlyExportRouteError("AUTH_REQUIRED", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new MonthlyExportRouteError("UNAVAILABLE", 503);

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const userResult = await withTimeout(
    client.auth.getUser(token),
    remainingDeadlineMs(deadline, DATABASE_TIMEOUT_MS),
    "Monthly export user lookup timed out.",
  );
  if (userResult.error || !userResult.data.user) {
    throw new MonthlyExportRouteError("AUTH_REQUIRED", 401);
  }
  const capsuleResult = await withAbortTimeout(
    (signal) =>
      client
        .from("capsules")
        .select("id")
        .eq("id", canonicalCapsuleId)
        .abortSignal(signal)
        .maybeSingle(),
    remainingDeadlineMs(deadline, DATABASE_TIMEOUT_MS),
    "Monthly export capsule authorization timed out.",
    signal,
  );
  if (capsuleResult.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  if (!capsuleResult.data) {
    throw new MonthlyExportRouteError("NOT_FOUND", 404);
  }

  const admin = getAdminSupabaseClient();
  const disabledResult = await withAbortTimeout(
    (querySignal) =>
      admin
        .rpc("is_capsule_fulfillment_disabled", {
          requested_capsule_id: canonicalCapsuleId,
        })
        .abortSignal(querySignal),
    remainingDeadlineMs(deadline, DATABASE_TIMEOUT_MS),
    "Monthly export fulfillment authorization timed out.",
    signal,
  );
  if (disabledResult.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  if (disabledResult.data === true) {
    throw new MonthlyExportRouteError("NOT_FOUND", 404);
  }
  return admin;
}

async function requireAuthorizedCapsule(
  request: Request,
  capsuleId: string,
  deadline: number,
  signal: AbortSignal,
) {
  const admin = await authorizeCapsuleAccess(
    request,
    capsuleId,
    deadline,
    signal,
  );
  await assertMonthlyArtifactCapacity(capsuleId, deadline, signal);
  return claimMonthlyExportAdmission(admin, capsuleId, deadline, signal);
}

function admissionDirectory(
  capsuleId: string,
  state: ExportAdmissionState,
) {
  return `_system/monthly-export-admission/${capsuleId}/${state}`;
}

function admissionLifetime(state: ExportAdmissionState) {
  return state === "active"
    ? EXPORT_ADMISSION_TTL_MS
    : state === "claiming"
      ? EXPORT_ADMISSION_CLAIM_TTL_MS
      : EXPORT_ADMISSION_COOLDOWN_MS;
}

function admissionRetryAfter(entry: ListedExportAdmission, now: number) {
  const remaining =
    admissionLifetime(entry.state) -
    Math.max(0, now - entry.storageCreatedAt);
  return remaining > 0 ? Math.max(1, Math.ceil(remaining / 1_000)) : 0;
}

function admissionOrder(
  left: ListedExportAdmission,
  right: ListedExportAdmission,
) {
  return (
    left.storageCreatedAt - right.storageCreatedAt ||
    left.storagePath.localeCompare(right.storagePath)
  );
}

async function listAdmissionState(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  capsuleId: string,
  state: ExportAdmissionState,
  deadline: number,
  signal: AbortSignal,
) {
  const directory = admissionDirectory(capsuleId, state);
  const listed = await withAbortTimeout(
    (listSignal) =>
      admin.storage.from(MEMORY_MEDIA_BUCKET).list(directory, {
        limit: 100,
        sortBy: { column: "created_at", order: "asc" },
      }, {
        signal: listSignal,
      }),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export admission listing timed out.",
    signal,
  );
  if (listed.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  return (listed.data ?? []).map((item) => {
    const storageCreatedAt = Date.parse(
      String(item.created_at ?? item.updated_at ?? ""),
    );
    return {
      token: item.name.replace(/\.json$/u, ""),
      state,
      storagePath: `${directory}/${item.name}`,
      storageCreatedAt: Number.isFinite(storageCreatedAt)
        ? storageCreatedAt
        : 0,
    } satisfies ListedExportAdmission;
  });
}

export async function claimMonthlyExportAdmission(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  capsuleId: string,
  deadline: number,
  signal: AbortSignal,
  mutations: AdmissionStorageMutations =
    productionAdmissionStorageMutations,
) {
  const canonicalCapsuleId = capsuleId.toLowerCase();
  const token = randomUUID();
  const claimingPath =
    `${admissionDirectory(canonicalCapsuleId, "claiming")}/${token}.json`;
  const activePath =
    `${admissionDirectory(canonicalCapsuleId, "active")}/${token}.json`;
  const cooldownPath =
    `${admissionDirectory(canonicalCapsuleId, "cooldown")}/${token}.json`;
  if (Buffer.byteLength("{}") > EXPORT_ADMISSION_MAX_BYTES) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  try {
    await mutations.uploadJson(
      claimingPath,
      deadline,
      signal,
      "Monthly export admission claim timed out.",
    );
  } catch {
    await mutations
      .remove(
        [claimingPath],
        Date.now() + STORAGE_TIMEOUT_MS,
        new AbortController().signal,
        "Monthly export admission claim reconciliation timed out.",
      )
      .catch(() => undefined);
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }

  const removeOwn = async (paths = [claimingPath, activePath]) => {
    await mutations
      .remove(
        paths,
        Date.now() + STORAGE_TIMEOUT_MS,
        new AbortController().signal,
        "Monthly export admission cleanup timed out.",
      )
      .catch(() => undefined);
  };
  const [active, cooldown, claiming] = await Promise.all([
    listAdmissionState(admin, canonicalCapsuleId, "active", deadline, signal),
    listAdmissionState(admin, canonicalCapsuleId, "cooldown", deadline, signal),
    listAdmissionState(admin, canonicalCapsuleId, "claiming", deadline, signal),
  ]);
  const now = Date.now();
  const records = [...active, ...cooldown, ...claiming];
  const live = records.filter((entry) => admissionRetryAfter(entry, now) > 0);
  const expiredPaths = records
    .filter((entry) => admissionRetryAfter(entry, now) === 0)
    .map((entry) => entry.storagePath);
  if (expiredPaths.length) {
    await mutations
      .remove(
        expiredPaths,
        deadline,
        signal,
        "Monthly export expired admission cleanup timed out.",
      )
      .catch(() => undefined);
  }

  const blocking = live
    .filter((entry) => entry.state === "active")
    .sort(admissionOrder)[0] ??
    live
      .filter((entry) => entry.state === "cooldown")
      .sort(admissionOrder)[0];
  const claimingLeader = live
    .filter((entry) => entry.state === "claiming")
    .sort(admissionOrder)[0];
  const winner = blocking ?? claimingLeader;
  if (!winner || winner.token !== token) {
    await removeOwn();
    throw new MonthlyExportRouteError(
      "EXPORT_BUSY",
      429,
      "A monthly export is already in progress.",
      winner ? admissionRetryAfter(winner, now) : 1,
    );
  }

  try {
    await mutations.uploadJson(
      activePath,
      deadline,
      signal,
      "Monthly export admission promotion timed out.",
    );
  } catch {
    await removeOwn();
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }

  const verified = (
    await listAdmissionState(admin, capsuleId, "active", deadline, signal)
  )
    .filter((entry) => admissionRetryAfter(entry, Date.now()) > 0)
    .sort(admissionOrder)[0];
  if (!verified || verified.token !== token) {
    await removeOwn();
    throw new MonthlyExportRouteError("EXPORT_BUSY", 429, "busy", 1);
  }
  await removeOwn([claimingPath]);

  return {
    release: async () => {
      try {
        await mutations.uploadJson(
          cooldownPath,
          Date.now() + STORAGE_TIMEOUT_MS,
          new AbortController().signal,
          "Monthly export admission release timed out.",
        );
      } finally {
        await removeOwn([activePath]);
      }
    },
  };
}

async function downloadStorageBuffer(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  bucket: string,
  storagePath: string,
  maxBytes: number,
  budget: DownloadBudget,
  deadline: number,
  signal?: AbortSignal,
) {
  const result = await withAbortTimeout(
    (signal) =>
      admin.storage
        .from(bucket)
        .download(storagePath, {}, { signal }),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export storage download timed out.",
    signal,
  );
  if (result.error || !result.data) {
    throw new MonthlyExportRouteError("MEDIA_UNAVAILABLE", 503);
  }
  if (result.data.size > maxBytes) {
    throw new MonthlyExportRouteError("MEDIA_TOO_LARGE", 422);
  }
  if (budget.usedBytes + result.data.size > budget.maxBytes) {
    throw new MonthlyExportRouteError("MEDIA_BUDGET_EXCEEDED", 422);
  }
  budget.usedBytes += result.data.size;
  return Buffer.from(
    await withTimeout(
      result.data.arrayBuffer(),
      remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
      "Monthly export storage read timed out.",
    ),
  );
}

export async function prepareCoverPhoto({
  admin,
  photo,
  budget,
  deadline,
  signal,
  runDecode,
}: {
  admin: ReturnType<typeof getAdminSupabaseClient>;
  photo: PhotoRow;
  budget: DownloadBudget;
  deadline: number;
  signal?: AbortSignal;
  runDecode: <T>(operation: () => Promise<T>, signal?: AbortSignal) => Promise<T>;
}) {
  const sources = [
    photo.thumbnail_storage_path
      ? {
          path: photo.thumbnail_storage_path,
          maxBytes: MAX_THUMBNAIL_SOURCE_BYTES,
          maxInputPixels: MAX_THUMBNAIL_INPUT_PIXELS,
        }
      : undefined,
    {
      path: photo.storage_path,
      maxBytes: MAX_DISPLAY_SOURCE_BYTES,
      maxInputPixels: MAX_DISPLAY_INPUT_PIXELS,
    },
  ].filter(
    (
      source,
    ): source is {
      path: string;
      maxBytes: number;
      maxInputPixels: number;
    } => Boolean(source),
  );

  for (const source of sources) {
    try {
      const input = await downloadStorageBuffer(
        admin,
        MEMORY_MEDIA_BUCKET,
        source.path,
        source.maxBytes,
        budget,
        deadline,
        signal,
      );
      if (remainingDeadlineMs(deadline, DECODE_TIMEOUT_MS) <= 0) {
        throw new Error("Monthly export cover decoding timed out.");
      }
      return await withAbortTimeout(
        (decodeSignal) =>
          runDecode(
            () =>
              prepareServerMonthlyCoverPhoto(
                input,
                photo.crop_metadata,
                source.maxInputPixels,
                decodeSignal,
              ),
            decodeSignal,
          ),
        remainingDeadlineMs(deadline, DECODE_TIMEOUT_MS),
        "Monthly export cover decoding timed out.",
        signal,
      );
    } catch {
      signal?.throwIfAborted();
      // Each unavailable cover falls back to the active theme fill; the other
      // sealed days remain present in the complete artifact.
    }
  }
  return undefined;
}

function mapTheme(row: Record<string, unknown> | null): JournalTheme {
  if (!row) return defaultJournalTheme;
  return resolveJournalTheme({
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
    textureStoragePath:
      typeof row.texture_storage_path === "string"
        ? row.texture_storage_path
        : undefined,
    texturePublicUrl:
      typeof row.texture_public_url === "string"
        ? row.texture_public_url
        : undefined,
    textureWidth: Number(row.texture_width) || undefined,
    textureHeight: Number(row.texture_height) || undefined,
    textureMimeType:
      typeof row.texture_mime_type === "string"
        ? row.texture_mime_type
        : undefined,
    focusX: Number(row.focus_x),
    focusY: Number(row.focus_y),
    zoom: Number(row.zoom),
    overlayColor:
      typeof row.overlay_color === "string" ? row.overlay_color : undefined,
    overlayOpacity: Number(row.overlay_opacity),
    fallbackBackgroundColor: String(row.fallback_background_color ?? ""),
    textPrimary: String(row.text_primary ?? ""),
    textSecondary: String(row.text_secondary ?? ""),
    paperSurface: String(row.paper_surface ?? ""),
    paperSurfaceMuted: String(row.paper_surface_muted ?? ""),
    stampBorder: String(row.stamp_border ?? ""),
    accentColor: String(row.accent_color ?? ""),
    logoVariant: String(row.logo_variant ?? ""),
  });
}

export function journalThemeTextureStoragePath(theme: JournalTheme) {
  if (theme.textureStoragePath) return theme.textureStoragePath;
  if (!theme.texturePublicUrl) return undefined;
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return undefined;
  try {
    const publicUrl = new URL(theme.texturePublicUrl);
    const supabaseUrl = new URL(configuredUrl);
    const prefix = `/storage/v1/object/public/${JOURNAL_THEME_ASSET_BUCKET}/`;
    if (
      publicUrl.origin !== supabaseUrl.origin ||
      !publicUrl.pathname.startsWith(prefix)
    ) {
      return undefined;
    }
    const storagePath = decodeURIComponent(publicUrl.pathname.slice(prefix.length));
    const segments = storagePath.split("/");
    if (
      !storagePath ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return undefined;
    }
    return storagePath;
  } catch {
    return undefined;
  }
}

async function loadExportData(
  selection: MonthlyExportSelection,
  deadline: number,
  signal: AbortSignal,
) {
  const admin = getAdminSupabaseClient();
  const perCoverBudgetBytes = Math.floor(
    MAX_COVER_SOURCE_BYTES / selection.stamps.length,
  );
  const coverBudgets = selection.stamps.map<DownloadBudget>(() => ({
    usedBytes: 0,
    maxBytes: perCoverBudgetBytes,
  }));
  const textureBudget: DownloadBudget = {
    usedBytes: 0,
    maxBytes: MAX_TEXTURE_SOURCE_BYTES,
  };
  const runDecode = createConcurrencyLimiter(DECODE_CONCURRENCY);
  const loader = createMonthlyExportDataLoader<PhotoRow>({
    coverConcurrency: COVER_CONCURRENCY,
    renderReserveMs: RENDER_RESERVE_MS,
    loadCapsule: async (capsuleId, queryDeadline, parentSignal) => {
      const result = await withAbortTimeout(
        (querySignal) =>
          admin
            .from("capsules")
            .select("id,title,journal_theme_id")
            .eq("id", capsuleId)
            .abortSignal(querySignal)
            .maybeSingle(),
        remainingDeadlineMs(queryDeadline, DATABASE_TIMEOUT_MS),
        "Monthly export capsule query timed out.",
        parentSignal,
      );
      if (result.error) {
        throw new MonthlyExportRouteError("UNAVAILABLE", 503);
      }
      return result.data
        ? {
            journalTitle: String(result.data.title ?? "My Journal"),
            themeId:
              typeof result.data.journal_theme_id === "string"
                ? result.data.journal_theme_id
                : null,
          }
        : null;
    },
    loadMemories: async (
      capsuleId,
      selectedIds,
      queryDeadline,
      parentSignal,
    ) => {
      const result = await withAbortTimeout(
        (querySignal) =>
          admin
            .from("memories")
            .select("id,local_date,occurred_at")
            .eq("capsule_id", capsuleId)
            .in("id", selectedIds)
            .limit(selectedIds.length)
            .abortSignal(querySignal),
        remainingDeadlineMs(queryDeadline, DATABASE_TIMEOUT_MS),
        "Monthly export stamp query timed out.",
        parentSignal,
      );
      if (result.error) {
        throw new MonthlyExportRouteError("UNAVAILABLE", 503);
      }
      return ((result.data ?? []) as MemoryRow[]).map((memory) => ({
        id: memory.id,
        localDate: memory.local_date,
        occurredAt: memory.occurred_at,
      }));
    },
    loadFirstCovers: async (selectedIds, queryDeadline, parentSignal) => {
      const result = await withAbortTimeout(
        (querySignal) =>
          admin
            .from("photos")
            .select(
              "memory_id,storage_path,thumbnail_storage_path,order_index,crop_metadata",
            )
            .in("memory_id", selectedIds)
            .eq("order_index", 0)
            .order("memory_id", { ascending: true })
            .limit(selectedIds.length)
            .abortSignal(querySignal),
        remainingDeadlineMs(queryDeadline, DATABASE_TIMEOUT_MS),
        "Monthly export cover query timed out.",
        parentSignal,
      );
      if (result.error) {
        throw new MonthlyExportRouteError("UNAVAILABLE", 503);
      }
      return new Map(
        ((result.data ?? []) as PhotoRow[]).map((photo) => [
          photo.memory_id,
          photo,
        ]),
      );
    },
    loadTheme: async (themeId, queryDeadline, parentSignal) => {
      const result = await withAbortTimeout(
        (querySignal) =>
          admin
            .from("journal_themes")
            .select(
              "id,slug,name,status,texture_storage_path,texture_public_url,texture_width,texture_height,texture_mime_type,focus_x,focus_y,zoom,overlay_color,overlay_opacity,fallback_background_color,text_primary,text_secondary,paper_surface,paper_surface_muted,stamp_border,accent_color,logo_variant",
            )
            .eq("id", themeId)
            .abortSignal(querySignal)
            .maybeSingle(),
        remainingDeadlineMs(queryDeadline, DATABASE_TIMEOUT_MS),
        "Monthly export theme query timed out.",
        parentSignal,
      );
      if (result.error) {
        throw new MonthlyExportRouteError("UNAVAILABLE", 503);
      }
      return mapTheme(result.data as Record<string, unknown> | null);
    },
    prepareCover: (photo, index, mediaDeadline, parentSignal) =>
      prepareCoverPhoto({
        admin,
        photo,
        budget: coverBudgets[index],
        deadline: mediaDeadline,
        signal: parentSignal,
        runDecode,
      }),
    loadTexture: async (theme, mediaDeadline, parentSignal) => {
      const textureStoragePath = journalThemeTextureStoragePath(theme);
      if (!textureStoragePath) return undefined;
      return downloadStorageBuffer(
        admin,
        JOURNAL_THEME_ASSET_BUCKET,
        textureStoragePath,
        MAX_TEXTURE_SOURCE_BYTES,
        textureBudget,
        mediaDeadline,
        parentSignal,
      );
    },
    loadLogo: async (parentSignal) => {
      parentSignal?.throwIfAborted();
      return readFile(
        path.join(process.cwd(), "public/brand/mgp-full-logo-transparent.png"),
        { signal: parentSignal },
      );
    },
  });
  return loader(selection, deadline, signal);
}

async function storeOversizedExport(
  selection: MonthlyExportSelection,
  png: Buffer,
  deadline: number,
  signal: AbortSignal,
) {
  const admin = getAdminSupabaseClient();
  const artifactId = randomUUID();
  const { storagePath, registryStoragePath } = monthlyExportArtifactIdentity(
    selection.capsuleId,
    artifactId,
  );
  const storage = admin.storage.from(MEMORY_MEDIA_BUCKET);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  // Register first so an upload that commits after a timeout is still
  // discoverable by the expiry cron. Failure paths intentionally keep this
  // marker; deleting it could orphan a late-committing private artifact.
  const encodedRegistryPath = registryStoragePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const registryResult = await withAbortTimeout(
    (registrySignal) =>
      fetch(
        `${supabaseUrl}/storage/v1/object/${MEMORY_MEDIA_BUCKET}/${encodedRegistryPath}`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
            "x-upsert": "false",
          },
          body: JSON.stringify({
            artifactId,
            capsuleId: selection.capsuleId,
          }),
          cache: "no-store",
          signal: registrySignal,
        },
      ),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export artifact registration timed out.",
    signal,
  );
  if (!registryResult.ok) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const encodedStoragePath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const uploadResult = await withAbortTimeout(
    (uploadSignal) =>
      fetch(
        `${supabaseUrl}/storage/v1/object/${MEMORY_MEDIA_BUCKET}/${encodedStoragePath}`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Cache-Control": "no-store",
            "Content-Type": "image/png",
            "x-upsert": "false",
          },
          body: new Blob([new Uint8Array(png)], { type: "image/png" }),
          cache: "no-store",
          signal: uploadSignal,
        },
      ),
    remainingDeadlineMs(deadline, ARTIFACT_STORAGE_TIMEOUT_MS),
    "Monthly export artifact upload timed out.",
    signal,
  );
  if (!uploadResult.ok) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const signedResult = await withAbortTimeout(
    () => storage.createSignedUrl(storagePath, EXPORT_SIGNED_URL_SECONDS),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export artifact delivery timed out.",
    signal,
  );
  if (signedResult.error || !signedResult.data?.signedUrl) {
    await storage.remove([storagePath]).catch(() => undefined);
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const expiresAt = new Date(
    Date.now() + EXPORT_SIGNED_URL_SECONDS * 1_000,
  ).toISOString();
  return {
    artifactId,
    url: signedResult.data.signedUrl,
    expiresAt,
  };
}

export async function DELETE(request: Request) {
  const deadline = Date.now() + DATABASE_TIMEOUT_MS;
  try {
    const candidate = await readBoundedJsonObject(
      request,
      deadline,
      EXPORT_CLEANUP_BODY_BYTES,
    );
    const capsuleId =
      typeof candidate.capsuleId === "string"
        ? candidate.capsuleId.toLowerCase()
        : "";
    const artifactId =
      typeof candidate.artifactId === "string"
        ? candidate.artifactId.toLowerCase()
        : "";
    if (!UUID_PATTERN.test(capsuleId) || !UUID_PATTERN.test(artifactId)) {
      throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
    }
    await authorizeCapsuleAccess(
      request,
      capsuleId,
      deadline,
      request.signal,
    );
    const artifactIdentity = monthlyExportArtifactIdentity(
      capsuleId,
      artifactId,
    );
    await removePrivateStoragePaths(
      [
        artifactIdentity.storagePath,
        artifactIdentity.registryStoragePath,
      ],
      deadline,
      request.signal,
      "Monthly export cleanup timed out.",
    );
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const routeError =
      error instanceof MonthlyExportRouteError
        ? error
        : new MonthlyExportRouteError("INVALID_REQUEST", 400);
    return Response.json(
      { ok: false, code: routeError.code },
      {
        status: routeError.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}

export const POST = createMonthlyExportPostHandler({
  authorize: requireAuthorizedCapsule,
  render: async (selection, deadline, signal) =>
    renderServerMonthlyMemoryEditionPng(
      await loadExportData(selection, deadline, signal),
      { signal },
    ),
  storeOversized: storeOversizedExport,
});
