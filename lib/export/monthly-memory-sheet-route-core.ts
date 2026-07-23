import { normalizeLocalMonthKey } from "../../data/journal-stamps.ts";
import {
  MONTHLY_MEMORY_EDITION_MAX_STAMPS,
  MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES,
  monthlyMemoryEditionFilename,
} from "./monthly-memory-sheet-export.ts";
import {
  remainingDeadlineMs,
  withAbortTimeout,
} from "./monthly-memory-sheet-runtime.ts";

export const MONTHLY_EXPORT_MAX_REQUEST_BODY_BYTES = 8 * 1024;
export const MONTHLY_EXPORT_HANDLER_DEADLINE_MS = 52_000;
export const MONTHLY_EXPORT_MAX_STORED_PNG_BYTES = 20 * 1024 * 1024;
const MONTHLY_EXPORT_AUTH_TIMEOUT_MS = 8_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isGregorianLocalDateKey(value: string, monthKey: string) {
  if (!LOCAL_DATE_PATTERN.test(value) || value.slice(0, 7) !== monthKey) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return year >= 1 && Boolean(daysInMonth) && day >= 1 && day <= daysInMonth;
}

export type MonthlyExportSelectedStamp = {
  id: string;
  dateKey: string;
};

export type MonthlyExportSelection = {
  capsuleId: string;
  monthKey: string;
  timeZone: string;
  stamps: MonthlyExportSelectedStamp[];
};

export class MonthlyExportRouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    status: number,
    message = code,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MonthlyExportRouteError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function jsonError(error: MonthlyExportRouteError) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
  };
  if (error.retryAfterSeconds) {
    headers["Retry-After"] = String(Math.max(1, error.retryAfterSeconds));
  }
  return Response.json(
    { ok: false, code: error.code },
    { status: error.status, headers },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readBoundedJsonObject(
  request: Request,
  deadline: number,
  maxBytes = MONTHLY_EXPORT_MAX_REQUEST_BODY_BYTES,
) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maxBytes
  ) {
    throw new MonthlyExportRouteError("REQUEST_TOO_LARGE", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await withAbortTimeout(
        () => reader.read(),
        remainingDeadlineMs(deadline, MONTHLY_EXPORT_HANDLER_DEADLINE_MS),
        "Monthly export request body timed out.",
        request.signal,
      );
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new MonthlyExportRouteError("REQUEST_TOO_LARGE", 413);
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  try {
    const parsed = JSON.parse(
      Buffer.concat(chunks).toString("utf8"),
    ) as unknown;
    if (!isRecord(parsed)) {
      throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
    }
    return parsed;
  } catch (error) {
    if (error instanceof MonthlyExportRouteError) throw error;
    throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  }
}

export async function parseMonthlyExportSelection(
  request: Request,
  deadline = Date.now() + MONTHLY_EXPORT_HANDLER_DEADLINE_MS,
) {
  const body = await readBoundedJsonObject(request, deadline);
  const capsuleId =
    typeof body.capsuleId === "string"
      ? body.capsuleId.trim().toLowerCase()
      : "";
  const monthKey =
    typeof body.monthKey === "string"
      ? normalizeLocalMonthKey(body.monthKey)
      : undefined;
  const timeZone =
    typeof body.timeZone === "string" ? body.timeZone.trim() : "";
  if (
    !UUID_PATTERN.test(capsuleId) ||
    !monthKey ||
    !timeZone ||
    timeZone.length > 100 ||
    !Array.isArray(body.stamps)
  ) {
    throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(0));
  } catch {
    throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  }
  if (!body.stamps.length) {
    throw new MonthlyExportRouteError("NO_STAMPS", 422);
  }
  if (body.stamps.length > MONTHLY_MEMORY_EDITION_MAX_STAMPS) {
    throw new MonthlyExportRouteError("TOO_MANY_STAMPS", 422);
  }

  const seenIds = new Set<string>();
  const seenDateKeys = new Set<string>();
  const stamps = body.stamps.map((candidate) => {
    if (!isRecord(candidate)) {
      throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
    }
    const id =
      typeof candidate.id === "string"
        ? candidate.id.trim().toLowerCase()
        : "";
    const dateKey =
      typeof candidate.dateKey === "string" ? candidate.dateKey.trim() : "";
    if (
      !UUID_PATTERN.test(id) ||
      !isGregorianLocalDateKey(dateKey, monthKey) ||
      seenIds.has(id) ||
      seenDateKeys.has(dateKey)
    ) {
      throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
    }
    seenIds.add(id);
    seenDateKeys.add(dateKey);
    return { id, dateKey };
  });
  return {
    capsuleId,
    monthKey,
    timeZone,
    stamps,
  } satisfies MonthlyExportSelection;
}

export type MonthlyExportAdmissionLease = {
  release: () => Promise<void>;
};

export type MonthlyExportStoredArtifact = {
  artifactId: string;
  url: string;
  expiresAt: string;
};

type MonthlyExportHandlerDependencies = {
  authorize: (
    request: Request,
    capsuleId: string,
    deadline: number,
    signal: AbortSignal,
  ) => Promise<MonthlyExportAdmissionLease | void>;
  render: (
    selection: MonthlyExportSelection,
    deadline: number,
    signal: AbortSignal,
  ) => Promise<Buffer>;
  storeOversized?: (
    selection: MonthlyExportSelection,
    png: Buffer,
    deadline: number,
    signal: AbortSignal,
  ) => Promise<MonthlyExportStoredArtifact>;
};

export function createMonthlyExportPostHandler({
  authorize,
  render,
  storeOversized,
}: MonthlyExportHandlerDependencies) {
  return async function monthlyExportPost(request: Request) {
    const deadline = Date.now() + MONTHLY_EXPORT_HANDLER_DEADLINE_MS;
    let selection: MonthlyExportSelection;
    try {
      selection = await parseMonthlyExportSelection(request, deadline);
    } catch (error) {
      const routeError =
        error instanceof MonthlyExportRouteError
          ? error
          : new MonthlyExportRouteError("INVALID_REQUEST", 400);
      return jsonError(routeError);
    }

    let admission: MonthlyExportAdmissionLease | void = undefined;
    try {
      admission = await withAbortTimeout(
        (signal) =>
          authorize(request, selection.capsuleId, deadline, signal),
        remainingDeadlineMs(deadline, MONTHLY_EXPORT_AUTH_TIMEOUT_MS),
        "Monthly export authorization timed out.",
        request.signal,
      );
      const png = await withAbortTimeout(
        (signal) => render(selection, deadline, signal),
        remainingDeadlineMs(deadline, MONTHLY_EXPORT_HANDLER_DEADLINE_MS),
        "Monthly export rendering timed out.",
        request.signal,
      );
      if (png.byteLength > MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES) {
        if (
          !storeOversized ||
          png.byteLength > MONTHLY_EXPORT_MAX_STORED_PNG_BYTES
        ) {
          throw new MonthlyExportRouteError("EXPORT_TOO_LARGE", 503);
        }
        const stored = await withAbortTimeout(
          (signal) => storeOversized(selection, png, deadline, signal),
          remainingDeadlineMs(deadline, MONTHLY_EXPORT_HANDLER_DEADLINE_MS),
          "Monthly export artifact delivery timed out.",
          request.signal,
        );
        return Response.json(
          {
            ok: true,
            delivery: "signed-url",
            artifactId: stored.artifactId,
            url: stored.url,
            expiresAt: stored.expiresAt,
            filename: monthlyMemoryEditionFilename(selection.monthKey),
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "image/png",
          "Content-Length": String(png.byteLength),
          "Content-Disposition": `attachment; filename="${monthlyMemoryEditionFilename(selection.monthKey)}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const routeError =
        error instanceof MonthlyExportRouteError
          ? error
          : new MonthlyExportRouteError("EXPORT_FAILED", 503);
      if (routeError.status >= 500) {
        console.error(
          "Monthly sheet server export failed.",
          routeError.code,
          error instanceof Error ? error.name : "unknown",
        );
      }
      return jsonError(routeError);
    } finally {
      if (admission) {
        try {
          await admission.release();
        } catch {
          // A failed release expires through the admission lease TTL.
        }
      }
    }
  };
}
