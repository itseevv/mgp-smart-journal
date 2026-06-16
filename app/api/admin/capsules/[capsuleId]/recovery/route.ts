import { NextResponse } from "next/server";

import { resolveAdminAppBaseUrlFromRequest } from "@/lib/admin/app-base-url";
import {
  getAdminCapsuleDetail,
  isUuid,
  issueRecoveryCode,
  requireAdminSession,
} from "@/lib/admin/capsules";
import { createAdminRecoveryHandoff } from "@/lib/admin/recovery-handoff";

export async function POST(
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
    const result = await createAdminRecoveryHandoff({
      capsuleId,
      appBaseUrl: resolveAdminAppBaseUrlFromRequest(request).baseUrl,
      getDetail: getAdminCapsuleDetail,
      issueRecovery: issueRecoveryCode,
    });

    if (!result.ok && result.code === "NOT_FOUND") {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    if (!result.ok) throw new Error(result.code);

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "admin recovery issuance failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
