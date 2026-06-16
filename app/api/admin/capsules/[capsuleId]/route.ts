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
    const appBaseUrl = resolveAdminAppBaseUrlFromRequest(request);
    return NextResponse.json({
      ...detail,
      capsule: {
        ...detail.capsule,
        capsulePath: capsulePath(detail.capsule.publicToken),
        capsuleUrl: capsuleUrl(appBaseUrl.baseUrl, detail.capsule.publicToken),
        appBaseUrlConfigured: appBaseUrl.configured,
        appBaseUrlWarning: appBaseUrl.warning ?? null,
      },
    });
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
    return NextResponse.json(data);
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
