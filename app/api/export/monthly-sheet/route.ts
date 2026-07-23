import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  defaultJournalTheme,
  resolveJournalTheme,
  type JournalTheme,
} from "../../../../data/journal-themes.ts";
import { normalizeLocalMonthKey } from "../../../../data/journal-stamps.ts";
import { getAdminSupabaseClient } from "../../../../lib/admin/supabase.ts";
import {
  MONTHLY_MEMORY_EDITION_MAX_STAMPS,
  monthlyMemoryEditionFilename,
} from "../../../../lib/export/monthly-memory-sheet-export.ts";
import {
  renderServerMonthlyMemoryEditionPng,
  type ServerMonthlyMemoryEditionStamp,
} from "../../../../lib/export/monthly-memory-sheet-server.ts";
import { isPhotoCropMetadata } from "../../../../lib/scrap/crop-math.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEMORY_MEDIA_BUCKET = "memory-media";
const JOURNAL_THEME_ASSET_BUCKET = "journal-theme-assets";
const MAX_REQUEST_BODY_BYTES = 1_024;
const MAX_THUMBNAIL_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_DISPLAY_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_TEXTURE_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 90 * 1024 * 1024;
const MAX_THUMBNAIL_INPUT_PIXELS = 1_000_000;
const MAX_DISPLAY_INPUT_PIXELS = 20_000_000;
const MAX_PNG_RESPONSE_BYTES = 30 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DownloadBudget = {
  usedBytes: number;
  maxBytes: number;
};

type PhotoRow = {
  storage_path: string;
  thumbnail_storage_path: string | null;
  order_index: number;
  crop_metadata: unknown;
};

type MemoryRow = {
  id: string;
  title: string;
  occurred_at: string;
  created_at: string;
  local_date: string | null;
  photos: PhotoRow[] | null;
};

class MonthlyExportRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message = code) {
    super(message);
    this.name = "MonthlyExportRouteError";
    this.code = code;
    this.status = status;
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function requireAuthorizedCapsule(request: Request, capsuleId: string) {
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
  const userResult = await client.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    throw new MonthlyExportRouteError("AUTH_REQUIRED", 401);
  }
  const capsuleResult = await client
    .from("capsules")
    .select("id")
    .eq("id", capsuleId)
    .maybeSingle();
  if (capsuleResult.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  if (!capsuleResult.data) {
    throw new MonthlyExportRouteError("NOT_FOUND", 404);
  }
}

async function parseRequestBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_BYTES
  ) {
    throw new MonthlyExportRouteError("REQUEST_TOO_LARGE", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new MonthlyExportRouteError("REQUEST_TOO_LARGE", 413);
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      capsuleId?: unknown;
      monthKey?: unknown;
    };
  } catch {
    throw new MonthlyExportRouteError("INVALID_REQUEST", 400);
  }
}

async function downloadStorageBuffer(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  bucket: string,
  storagePath: string,
  maxBytes: number,
  budget: DownloadBudget,
) {
  const result = await admin.storage.from(bucket).download(storagePath);
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
  return Buffer.from(await result.data.arrayBuffer());
}

async function squareCoverPhoto(
  input: Buffer,
  cropMetadata: unknown,
  maxInputPixels: number,
) {
  const normalized = await sharp(input, {
    failOn: "error",
    limitInputPixels: maxInputPixels,
  })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const sourceWidth = normalized.info.width;
  const sourceHeight = normalized.info.height;
  let image = sharp(normalized.data, {
    failOn: "error",
    limitInputPixels: maxInputPixels,
  });

  if (
    sourceWidth &&
    sourceHeight &&
    isPhotoCropMetadata(cropMetadata)
  ) {
    const left = Math.min(
      sourceWidth - 1,
      Math.floor(clamp(cropMetadata.x, 0, 1) * sourceWidth),
    );
    const top = Math.min(
      sourceHeight - 1,
      Math.floor(clamp(cropMetadata.y, 0, 1) * sourceHeight),
    );
    const right = Math.min(
      sourceWidth,
      Math.max(
        left + 1,
        Math.ceil(
          clamp(cropMetadata.x + cropMetadata.width, 0, 1) * sourceWidth,
        ),
      ),
    );
    const bottom = Math.min(
      sourceHeight,
      Math.max(
        top + 1,
        Math.ceil(
          clamp(cropMetadata.y + cropMetadata.height, 0, 1) * sourceHeight,
        ),
      ),
    );
    image = image.extract({
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    });
  }

  return image
    .resize(292, 292, {
      fit: isPhotoCropMetadata(cropMetadata) ? "fill" : "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

async function prepareCoverPhoto({
  admin,
  photo,
  budget,
}: {
  admin: ReturnType<typeof getAdminSupabaseClient>;
  photo: PhotoRow;
  budget: DownloadBudget;
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
      );
      return await squareCoverPhoto(
        input,
        photo.crop_metadata,
        source.maxInputPixels,
      );
    } catch {
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

function semanticMonthKey(memory: MemoryRow) {
  const localDate = memory.local_date?.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(localDate ?? "")) {
    return localDate?.slice(0, 7);
  }
  const fallback = new Date(memory.occurred_at);
  if (Number.isNaN(fallback.getTime())) return "";
  return `${fallback.getUTCFullYear()}-${String(
    fallback.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function semanticDateKey(memory: MemoryRow) {
  const localDate = memory.local_date?.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(localDate ?? "")) return localDate ?? "";
  const fallback = new Date(memory.occurred_at);
  return Number.isNaN(fallback.getTime())
    ? ""
    : fallback.toISOString().slice(0, 10);
}

async function loadExportData(capsuleId: string, monthKey: string) {
  const admin = getAdminSupabaseClient();
  const budget: DownloadBudget = {
    usedBytes: 0,
    maxBytes: MAX_TOTAL_SOURCE_BYTES,
  };
  const capsuleResult = await admin
    .from("capsules")
    .select("id,title,journal_theme_id")
    .eq("id", capsuleId)
    .maybeSingle();
  if (capsuleResult.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  if (!capsuleResult.data) {
    throw new MonthlyExportRouteError("NOT_FOUND", 404);
  }

  const memoryResult = await admin
    .from("memories")
    .select(
      "id,title,occurred_at,created_at,local_date,photos(storage_path,thumbnail_storage_path,order_index,crop_metadata)",
    )
    .eq("capsule_id", capsuleId);
  if (memoryResult.error) {
    throw new MonthlyExportRouteError("UNAVAILABLE", 503);
  }
  const selectedMemories = [
    ...((memoryResult.data ?? []) as MemoryRow[]),
  ]
    .filter((memory) => semanticMonthKey(memory) === monthKey)
    .sort((left, right) => {
      const dateOrder = semanticDateKey(left).localeCompare(
        semanticDateKey(right),
      );
      if (dateOrder) return dateOrder;
      const createdOrder = left.created_at.localeCompare(right.created_at);
      return createdOrder || left.id.localeCompare(right.id);
    });
  if (!selectedMemories.length) {
    throw new MonthlyExportRouteError("NO_STAMPS", 422);
  }
  if (selectedMemories.length > MONTHLY_MEMORY_EDITION_MAX_STAMPS) {
    throw new MonthlyExportRouteError("TOO_MANY_STAMPS", 422);
  }

  let theme = defaultJournalTheme;
  if (capsuleResult.data.journal_theme_id) {
    const themeResult = await admin
      .from("journal_themes")
      .select(
        "id,slug,name,status,texture_storage_path,texture_public_url,texture_width,texture_height,texture_mime_type,focus_x,focus_y,zoom,overlay_color,overlay_opacity,fallback_background_color,text_primary,text_secondary,paper_surface,paper_surface_muted,stamp_border,accent_color,logo_variant",
      )
      .eq("id", capsuleResult.data.journal_theme_id)
      .maybeSingle();
    if (themeResult.error) {
      throw new MonthlyExportRouteError("UNAVAILABLE", 503);
    }
    theme = mapTheme(themeResult.data as Record<string, unknown> | null);
  }

  const stamps: ServerMonthlyMemoryEditionStamp[] = [];
  for (const memory of selectedMemories) {
    const coverPhoto = [...(memory.photos ?? [])].sort(
      (left, right) => left.order_index - right.order_index,
    )[0];
    const input = coverPhoto
      ? await prepareCoverPhoto({ admin, photo: coverPhoto, budget })
      : undefined;
    const dateKey = semanticDateKey(memory);
    stamps.push({
      dayLabel: String(Number.parseInt(dateKey.slice(-2), 10) || ""),
      input,
    });
  }

  let texture: Buffer | undefined;
  if (theme.textureStoragePath) {
    try {
      texture = await downloadStorageBuffer(
        admin,
        JOURNAL_THEME_ASSET_BUCKET,
        theme.textureStoragePath,
        MAX_TEXTURE_SOURCE_BYTES,
        budget,
      );
    } catch {
      texture = undefined;
    }
  }
  let logo: Buffer | undefined;
  try {
    logo = await readFile(
      path.join(process.cwd(), "public/brand/mgp-full-logo-transparent.png"),
    );
  } catch {
    logo = undefined;
  }

  return {
    journalTitle: String(capsuleResult.data.title ?? "My Journal"),
    monthKey,
    theme,
    stamps,
    texture,
    logo,
  };
}

function jsonError(code: string, status: number) {
  return Response.json(
    { ok: false, code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  let body: { capsuleId?: unknown; monthKey?: unknown };
  try {
    body = await parseRequestBody(request);
  } catch (error) {
    const routeError =
      error instanceof MonthlyExportRouteError
        ? error
        : new MonthlyExportRouteError("INVALID_REQUEST", 400);
    return jsonError(routeError.code, routeError.status);
  }

  const capsuleId =
    typeof body.capsuleId === "string" ? body.capsuleId : "";
  const monthKey =
    typeof body.monthKey === "string"
      ? normalizeLocalMonthKey(body.monthKey)
      : "";
  if (!UUID_PATTERN.test(capsuleId) || !monthKey) {
    return jsonError("INVALID_REQUEST", 400);
  }

  try {
    await requireAuthorizedCapsule(request, capsuleId);
    const png = await renderServerMonthlyMemoryEditionPng(
      await loadExportData(capsuleId, monthKey),
    );
    if (png.byteLength > MAX_PNG_RESPONSE_BYTES) {
      throw new MonthlyExportRouteError("EXPORT_TOO_LARGE", 503);
    }
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Content-Disposition": `attachment; filename="${monthlyMemoryEditionFilename(monthKey)}"`,
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
    return jsonError(routeError.code, routeError.status);
  }
}
