import { NextResponse } from "next/server";

import {
  JOURNAL_THEME_ASSET_BUCKET,
  journalThemeTextureStoragePath,
  validateJournalThemeTextureUpload,
} from "@/lib/admin/journal-theme-assets";
import { isUuid, requireAdminSession } from "@/lib/admin/capsules";
import {
  getAdminJournalTheme,
  journalThemePayloadFromTheme,
  saveAdminJournalTheme,
} from "@/lib/admin/journal-themes";
import { getAdminSupabaseClient } from "@/lib/admin/supabase";

export async function POST(
  request: Request,
  context: { params: Promise<{ themeId: string }> },
) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { themeId } = await context.params;
  if (!isUuid(themeId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const file = formData.get("texture");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, code: "TEXTURE_REQUIRED" },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateJournalThemeTextureUpload({
    contentType: file.type,
    sizeBytes: file.size,
    bytes,
  });
  if (!validation.ok) {
    return NextResponse.json(validation, { status: 400 });
  }

  try {
    const existing = await getAdminJournalTheme(themeId);
    if (!existing.ok || !existing.theme) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const storagePath = journalThemeTextureStoragePath(
      themeId,
      validation.mimeType,
    );
    const supabase = getAdminSupabaseClient();
    const upload = await supabase.storage
      .from(JOURNAL_THEME_ASSET_BUCKET)
      .upload(storagePath, bytes, {
        cacheControl: "31536000",
        contentType: validation.mimeType,
        upsert: true,
      });

    if (upload.error) throw upload.error;

    const publicUrl = supabase.storage
      .from(JOURNAL_THEME_ASSET_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    try {
      const saved = await saveAdminJournalTheme({
        ...journalThemePayloadFromTheme(existing.theme),
        themeId,
        textureStoragePath: storagePath,
        texturePublicUrl: publicUrl,
        textureWidth: validation.width,
        textureHeight: validation.height,
        textureMimeType: validation.mimeType,
      });
      return NextResponse.json({
        ...saved,
        texture: {
          storagePath,
          publicUrl,
          width: validation.width,
          height: validation.height,
          mimeType: validation.mimeType,
          warnings: validation.warnings,
        },
      }, { status: saved.ok ? 200 : 400 });
    } catch (error) {
      await supabase.storage
        .from(JOURNAL_THEME_ASSET_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error(
      "admin journal theme texture upload failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
