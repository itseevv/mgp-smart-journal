import {
  createMonthlyExportCleanupHandler,
  MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY,
  MONTHLY_EXPORT_CLEANUP_BATCH_SIZE,
  monthlyExportArtifactIdentity,
} from "../../../../lib/export/monthly-memory-sheet-cleanup.ts";
import {
  remainingDeadlineMs,
  withAbortTimeout,
} from "../../../../lib/export/monthly-memory-sheet-runtime.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEMORY_MEDIA_BUCKET = "memory-media";
const ARTIFACT_REGISTRY_RETENTION_MS = 3 * 60 * 1_000;
const LIST_TIMEOUT_MS = 8_000;
const STORAGE_TIMEOUT_MS = 20_000;
const REGISTRY_NAME_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/iu;

async function removeStoragePaths(
  storagePaths: string[],
  deadline: number,
  signal: AbortSignal,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Monthly export cleanup storage is unavailable.");
  }
  const response = await withAbortTimeout(
    (removeSignal) =>
      fetch(
        `${supabaseUrl}/storage/v1/object/${MEMORY_MEDIA_BUCKET}`,
        {
          method: "DELETE",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes: storagePaths }),
          cache: "no-store",
          signal: removeSignal,
        },
      ),
    remainingDeadlineMs(deadline, STORAGE_TIMEOUT_MS),
    "Monthly export cleanup storage removal timed out.",
    signal,
  );
  if (!response.ok) {
    throw new Error("Monthly export cleanup storage removal failed.");
  }
}

export const GET = createMonthlyExportCleanupHandler({
  secret: process.env.CRON_SECRET,
  listExpired: async (deadline, signal) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Monthly export cleanup storage is unavailable.");
    }
    const response = await withAbortTimeout(
      (listSignal) =>
        fetch(
          `${supabaseUrl}/storage/v1/object/list/${MEMORY_MEDIA_BUCKET}`,
          {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prefix: MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY,
              limit: MONTHLY_EXPORT_CLEANUP_BATCH_SIZE,
              offset: 0,
              sortBy: { column: "created_at", order: "asc" },
            }),
            cache: "no-store",
            signal: listSignal,
          },
        ),
      remainingDeadlineMs(deadline, LIST_TIMEOUT_MS),
      "Monthly export cleanup lookup timed out.",
      signal,
    );
    if (!response.ok) throw new Error("Monthly export cleanup lookup failed.");
    const listed = (await response.json()) as unknown;
    if (!Array.isArray(listed)) {
      throw new Error("Monthly export cleanup lookup was malformed.");
    }
    const expiresBefore = Date.now() - ARTIFACT_REGISTRY_RETENTION_MS;
    return listed.flatMap((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        return [];
      }
      const candidate = record as Record<string, unknown>;
      const name = typeof candidate.name === "string" ? candidate.name : "";
      const createdAt =
        typeof candidate.created_at === "string"
          ? Date.parse(candidate.created_at)
          : Number.NaN;
      const match = name.match(REGISTRY_NAME_PATTERN);
      if (!match || !Number.isFinite(createdAt) || createdAt > expiresBefore) {
        return [];
      }
      return [monthlyExportArtifactIdentity(match[1], match[2])];
    });
  },
  removeArtifacts: async (storagePaths, deadline, signal) => {
    await removeStoragePaths(storagePaths, deadline, signal);
  },
  deleteRecords: async (records, deadline, signal) => {
    await removeStoragePaths(
      records.map((record) => record.registryStoragePath),
      deadline,
      signal,
    );
  },
});
