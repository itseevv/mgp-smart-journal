import { timingSafeEqual } from "node:crypto";

import {
  remainingDeadlineMs,
  withAbortTimeout,
} from "./monthly-memory-sheet-runtime.ts";

export const MONTHLY_EXPORT_CLEANUP_DEADLINE_MS = 45_000;
export const MONTHLY_EXPORT_CLEANUP_BATCH_SIZE = 100;
export const MONTHLY_EXPORT_CLEANUP_MAX_BATCHES = 50;
export const MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY =
  "_system/monthly-export-artifacts";
export const MONTHLY_EXPORT_MAX_OUTSTANDING_ARTIFACTS_PER_CAPSULE = 8;

export type MonthlyExportArtifactCleanupRecord = {
  artifactId: string;
  capsuleId: string;
  storagePath: string;
  registryStoragePath: string;
};

export function monthlyExportArtifactIdentity(
  capsuleId: string,
  artifactId: string,
) {
  const canonicalCapsuleId = capsuleId.toLowerCase();
  const canonicalArtifactId = artifactId.toLowerCase();
  return {
    artifactId: canonicalArtifactId,
    capsuleId: canonicalCapsuleId,
    storagePath:
      `capsules/${canonicalCapsuleId}/exports/monthly/${canonicalArtifactId}.png`,
    registryStoragePath:
      `${MONTHLY_EXPORT_ARTIFACT_REGISTRY_DIRECTORY}/${canonicalCapsuleId}-${canonicalArtifactId}.json`,
  };
}

export function monthlyExportArtifactRecordMatchesIdentity(
  record: MonthlyExportArtifactCleanupRecord,
  capsuleId: string,
  artifactId: string,
) {
  const identity = monthlyExportArtifactIdentity(capsuleId, artifactId);
  return (
    record.artifactId === identity.artifactId &&
    record.capsuleId === identity.capsuleId &&
    record.storagePath === identity.storagePath &&
    record.registryStoragePath === identity.registryStoragePath
  );
}

type MonthlyExportCleanupDependencies = {
  secret: string | undefined;
  listExpired: (
    deadline: number,
    signal: AbortSignal,
  ) => Promise<MonthlyExportArtifactCleanupRecord[]>;
  removeArtifacts: (
    storagePaths: string[],
    deadline: number,
    signal: AbortSignal,
  ) => Promise<void>;
  deleteRecords: (
    records: MonthlyExportArtifactCleanupRecord[],
    deadline: number,
    signal: AbortSignal,
  ) => Promise<void>;
};

function authorizedCronRequest(request: Request, secret: string) {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function isValidArtifactRecord(record: MonthlyExportArtifactCleanupRecord) {
  return monthlyExportArtifactRecordMatchesIdentity(
    record,
    record.capsuleId,
    record.artifactId,
  );
}

export function createMonthlyExportCleanupHandler({
  secret,
  listExpired,
  removeArtifacts,
  deleteRecords,
}: MonthlyExportCleanupDependencies) {
  return async function monthlyExportCleanup(request: Request) {
    if (!secret || !authorizedCronRequest(request, secret)) {
      return Response.json(
        { ok: false, code: "AUTH_REQUIRED" },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }

    const deadline = Date.now() + MONTHLY_EXPORT_CLEANUP_DEADLINE_MS;
    try {
      let removed = 0;
      for (
        let batch = 0;
        batch < MONTHLY_EXPORT_CLEANUP_MAX_BATCHES;
        batch += 1
      ) {
        const records = await withAbortTimeout(
          (signal) => listExpired(deadline, signal),
          remainingDeadlineMs(deadline, 8_000),
          "Monthly export cleanup lookup timed out.",
          request.signal,
        );
        if (
          records.length > MONTHLY_EXPORT_CLEANUP_BATCH_SIZE ||
          records.some((record) => !isValidArtifactRecord(record))
        ) {
          throw new Error("Invalid monthly export cleanup record.");
        }
        if (!records.length) break;

        await withAbortTimeout(
          (signal) =>
            removeArtifacts(
              records.map((record) => record.storagePath),
              deadline,
              signal,
            ),
          remainingDeadlineMs(deadline, 20_000),
          "Monthly export artifact removal timed out.",
          request.signal,
        );
        await withAbortTimeout(
          (signal) =>
            deleteRecords(
              records,
              deadline,
              signal,
            ),
          remainingDeadlineMs(deadline, 8_000),
          "Monthly export cleanup finalization timed out.",
          request.signal,
        );
        removed += records.length;
        if (records.length < MONTHLY_EXPORT_CLEANUP_BATCH_SIZE) break;
      }
      return Response.json(
        { ok: true, removed },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return Response.json(
        { ok: false, code: "CLEANUP_FAILED" },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
  };
}
