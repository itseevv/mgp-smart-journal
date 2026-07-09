import type {
  JournalTheme,
  JournalThemeStatus,
} from "@/data/journal-themes";
import { getAdminSupabaseClient } from "@/lib/admin/supabase";

export type AdminJournalTheme = JournalTheme & {
  description?: string | null;
  sortOrder: number;
  assignedCapsuleCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type JournalThemePayload = {
  themeId?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  status: JournalThemeStatus;
  sortOrder: number;
  textureStoragePath?: string | null;
  texturePublicUrl?: string | null;
  textureWidth?: number | null;
  textureHeight?: number | null;
  textureMimeType?: string | null;
  focusX: number;
  focusY: number;
  zoom: number;
  overlayColor?: string | null;
  overlayOpacity: number;
  fallbackBackgroundColor: string;
  textPrimary: string;
  textSecondary: string;
  paperSurface: string;
  paperSurfaceMuted: string;
  stampBorder: string;
  accentColor: string;
  logoVariant: string;
};

type AdminThemeListResult = {
  ok?: boolean;
  themes?: AdminJournalTheme[];
  code?: string;
};

type AdminThemeDetailResult = {
  ok?: boolean;
  theme?: AdminJournalTheme;
  code?: string;
};

const statuses = ["draft", "active", "archived"] as const;

export function parseJournalThemeStatus(value: string | null) {
  return statuses.includes(value as JournalThemeStatus)
    ? (value as JournalThemeStatus)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const next = text(value);
  return next ? next : null;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseJournalThemePayload(body: Record<string, unknown>) {
  const status = parseJournalThemeStatus(text(body.status)) ?? "draft";
  const payload: JournalThemePayload = {
    slug: text(body.slug).toLowerCase(),
    name: text(body.name),
    description: optionalText(body.description),
    status,
    sortOrder: Math.trunc(numberValue(body.sortOrder, 0)),
    textureStoragePath: optionalText(body.textureStoragePath),
    texturePublicUrl: optionalText(body.texturePublicUrl ?? body.textureUrl),
    textureWidth: optionalInteger(body.textureWidth),
    textureHeight: optionalInteger(body.textureHeight),
    textureMimeType: optionalText(body.textureMimeType),
    focusX: numberValue(body.focusX, 0.5),
    focusY: numberValue(body.focusY, 0.5),
    zoom: numberValue(body.zoom, 1),
    overlayColor: optionalText(body.overlayColor),
    overlayOpacity: numberValue(body.overlayOpacity, 0),
    fallbackBackgroundColor: text(body.fallbackBackgroundColor),
    textPrimary: text(body.textPrimary),
    textSecondary: text(body.textSecondary),
    paperSurface: text(body.paperSurface),
    paperSurfaceMuted: text(body.paperSurfaceMuted),
    stampBorder: text(body.stampBorder),
    accentColor: text(body.accentColor),
    logoVariant: text(body.logoVariant) || "light",
  };

  if (
    !payload.slug ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(payload.slug) ||
    payload.slug.length > 80 ||
    !payload.name ||
    payload.focusX < 0 ||
    payload.focusX > 1 ||
    payload.focusY < 0 ||
    payload.focusY > 1 ||
    payload.zoom < 1 ||
    payload.zoom > 3 ||
    payload.overlayOpacity < 0 ||
    payload.overlayOpacity > 1 ||
    !payload.fallbackBackgroundColor ||
    !payload.textPrimary ||
    !payload.textSecondary ||
    !payload.paperSurface ||
    !payload.paperSurfaceMuted ||
    !payload.stampBorder ||
    !payload.accentColor
  ) {
    return { ok: false as const, code: "INVALID_REQUEST" };
  }

  return { ok: true as const, payload };
}

export async function listAdminJournalThemes(input: {
  status?: JournalThemeStatus | null;
} = {}) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_journal_themes", {
    requested_status: input.status ?? null,
  });
  if (error) throw error;
  return data as AdminThemeListResult;
}

export async function getAdminJournalTheme(themeId: string) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.rpc("admin_get_journal_theme", {
    requested_theme_id: themeId,
  });
  if (error) throw error;
  return data as AdminThemeDetailResult;
}

export function journalThemePayloadFromTheme(
  theme: AdminJournalTheme,
): JournalThemePayload {
  return {
    themeId: theme.id ?? null,
    slug: theme.slug,
    name: theme.name,
    description: theme.description ?? null,
    status:
      theme.status === "draft" ||
      theme.status === "active" ||
      theme.status === "archived"
        ? theme.status
        : "draft",
    sortOrder: theme.sortOrder ?? 0,
    textureStoragePath: theme.textureStoragePath ?? null,
    texturePublicUrl: theme.texturePublicUrl ?? theme.textureUrl ?? null,
    textureWidth: theme.textureWidth ?? null,
    textureHeight: theme.textureHeight ?? null,
    textureMimeType: theme.textureMimeType ?? null,
    focusX: theme.focusX,
    focusY: theme.focusY,
    zoom: theme.zoom,
    overlayColor: theme.overlayColor ?? null,
    overlayOpacity: theme.overlayOpacity,
    fallbackBackgroundColor: theme.fallbackBackgroundColor,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    paperSurface: theme.paperSurface,
    paperSurfaceMuted: theme.paperSurfaceMuted,
    stampBorder: theme.stampBorder,
    accentColor: theme.accentColor,
    logoVariant: theme.logoVariant,
  };
}

export async function saveAdminJournalTheme(input: JournalThemePayload) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.rpc("admin_upsert_journal_theme", {
    requested_theme_id: input.themeId ?? null,
    requested_slug: input.slug,
    requested_name: input.name,
    requested_description: input.description ?? null,
    requested_status: input.status,
    requested_sort_order: input.sortOrder,
    requested_texture_storage_path: input.textureStoragePath ?? null,
    requested_texture_public_url: input.texturePublicUrl ?? null,
    requested_texture_width: input.textureWidth ?? null,
    requested_texture_height: input.textureHeight ?? null,
    requested_texture_mime_type: input.textureMimeType ?? null,
    requested_focus_x: input.focusX,
    requested_focus_y: input.focusY,
    requested_zoom: input.zoom,
    requested_overlay_color: input.overlayColor ?? null,
    requested_overlay_opacity: input.overlayOpacity,
    requested_fallback_background_color: input.fallbackBackgroundColor,
    requested_text_primary: input.textPrimary,
    requested_text_secondary: input.textSecondary,
    requested_paper_surface: input.paperSurface,
    requested_paper_surface_muted: input.paperSurfaceMuted,
    requested_stamp_border: input.stampBorder,
    requested_accent_color: input.accentColor,
    requested_logo_variant: input.logoVariant,
    requested_actor: "internal-admin",
  });
  if (error) throw error;
  return data as AdminThemeDetailResult;
}
