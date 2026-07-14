import { NextResponse } from "next/server";

import {
  capsulePath,
  capsuleUrl,
  resolveAdminAppBaseUrlFromRequest,
} from "@/lib/admin/app-base-url";
import {
  getAdminCapsuleDetail,
  isUuid,
  requireAdminSession,
} from "@/lib/admin/capsules";
import { getAdminSupabaseClient } from "@/lib/admin/supabase";

function canonicalUrlForNfcComparison(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function addAdminCapsuleUrls(
  request: Request,
  detail: Awaited<ReturnType<typeof getAdminCapsuleDetail>>,
) {
  if (!detail.ok || !detail.capsule) return detail;
  const appBaseUrl = resolveAdminAppBaseUrlFromRequest(request);
  const expectedUrl = capsuleUrl(appBaseUrl.baseUrl, detail.capsule.publicToken);
  const latestScanUrlMatchesExpected = detail.capsule.latestScanUrl
    ? canonicalUrlForNfcComparison(detail.capsule.latestScanUrl) ===
      canonicalUrlForNfcComparison(expectedUrl)
    : null;

  return {
    ...detail,
    capsule: {
      ...detail.capsule,
      capsulePath: capsulePath(detail.capsule.publicToken),
      capsuleUrl: expectedUrl,
      latestScanUrlMatchesExpected,
      appBaseUrlConfigured: appBaseUrl.configured,
      appBaseUrlWarning: appBaseUrl.warning ?? null,
    },
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ capsuleId: string }> },
) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { capsuleId } = await context.params;
  if (!isUuid(capsuleId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const detail = await getAdminCapsuleDetail(capsuleId);
    if (!detail.ok || !detail.capsule) {
      return NextResponse.json(detail);
    }
    return NextResponse.json(addAdminCapsuleUrls(request, detail));
  } catch (error) {
    console.error(
      "admin capsule detail failed",
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
  context: { params: Promise<{ capsuleId: string }> },
) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { capsuleId } = await context.params;
  if (!isUuid(capsuleId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let body: {
    action?: unknown;
    reason?: unknown;
    confirmActivated?: unknown;
    journalThemeId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (typeof body.action !== "string") {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const supabase = getAdminSupabaseClient();
    if (body.action === "update_theme") {
      const journalThemeId =
        typeof body.journalThemeId === "string" ? body.journalThemeId : "";
      if (!isUuid(journalThemeId)) {
        return NextResponse.json(
          { ok: false, code: "INVALID_REQUEST" },
          { status: 400 },
        );
      }
      const { data, error } = await supabase.rpc(
        "admin_update_capsule_journal_theme",
        {
          requested_capsule_id: capsuleId,
          requested_journal_theme_id: journalThemeId,
          requested_actor: "internal-admin",
        },
      );
      if (error) throw error;
      return NextResponse.json(addAdminCapsuleUrls(request, data));
    }

    const { data, error } = await supabase.rpc(
      "admin_update_capsule_fulfillment",
      {
        requested_capsule_id: capsuleId,
        requested_action: body.action,
        requested_reason: typeof body.reason === "string" ? body.reason : null,
        requested_confirm_activated: body.confirmActivated === true,
        requested_actor: "internal-admin",
      },
    );
    if (error) throw error;
    return NextResponse.json(addAdminCapsuleUrls(request, data));
  } catch (error) {
    console.error(
      "admin fulfillment update failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
