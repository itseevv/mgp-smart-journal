import { NextResponse } from "next/server";

import { isUuid, requireAdminSession } from "@/lib/admin/capsules";
import {
  getAdminJournalTheme,
  parseJournalThemePayload,
  saveAdminJournalTheme,
} from "@/lib/admin/journal-themes";

export async function GET(
  _request: Request,
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

  try {
    const result = await getAdminJournalTheme(themeId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    console.error(
      "admin journal theme detail failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}

export async function PATCH(
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = parseJournalThemePayload(body);
  if (!parsed.ok) {
    return NextResponse.json(parsed, { status: 400 });
  }

  try {
    const result = await saveAdminJournalTheme({
      ...parsed.payload,
      themeId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error(
      "admin journal theme update failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
