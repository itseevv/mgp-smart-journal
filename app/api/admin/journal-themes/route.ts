import { NextResponse } from "next/server";

import {
  listAdminJournalThemes,
  parseJournalThemePayload,
  parseJournalThemeStatus,
  saveAdminJournalTheme,
} from "@/lib/admin/journal-themes";
import { requireAdminSession } from "@/lib/admin/capsules";

export async function GET(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const status = requestedStatus
    ? parseJournalThemeStatus(requestedStatus)
    : null;

  if (requestedStatus && !status) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const result = await listAdminJournalThemes({ status });
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "admin journal theme list failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

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
    const result = await saveAdminJournalTheme(parsed.payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error(
      "admin journal theme create failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
