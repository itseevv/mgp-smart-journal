import { NextResponse } from "next/server";

import {
  capsuleUrl,
  resolveAdminAppBaseUrlFromRequest,
} from "@/lib/admin/app-base-url";
import {
  isUuid,
  issueRecoveryCode,
  listAdminCapsules,
  parseFulfillmentStatus,
  parseProductType,
  requireAdminSession,
  type RecoveryHandoffItem,
} from "@/lib/admin/capsules";
import { listAdminJournalThemes } from "@/lib/admin/journal-themes";
import { getAdminSupabaseClient } from "@/lib/admin/supabase";

export async function GET(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const productType = parseProductType(url.searchParams.get("productType"));
  const fulfillmentStatus = parseFulfillmentStatus(
    url.searchParams.get("status"),
  );
  const batchId = url.searchParams.get("batchId");
  const search = url.searchParams.get("search");

  if (batchId && !isUuid(batchId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const urlConfig = (() => {
      try {
        const resolution = resolveAdminAppBaseUrlFromRequest(request);
        return {
          appBaseUrlConfigured: resolution.configured,
          appBaseUrlWarning: resolution.warning ?? null,
        };
      } catch (error) {
        return {
          appBaseUrlConfigured: false,
          appBaseUrlWarning:
            error instanceof Error
              ? error.message
              : "APP_BASE_URL is not configured.",
        };
      }
    })();
    const result = await listAdminCapsules({
      productType,
      fulfillmentStatus,
      batchId,
      search,
    });
    const themes = await listAdminJournalThemes({ status: "active" });
    return NextResponse.json({
      ...result,
      urlConfig,
      journalThemes: themes.themes ?? [],
    });
  } catch (error) {
    console.error(
      "admin capsule list failed",
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

  let body: {
    batchName?: unknown;
    productType?: unknown;
    quantity?: unknown;
    serialPrefix?: unknown;
    notes?: unknown;
    issueRecovery?: unknown;
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

  const batchName =
    typeof body.batchName === "string" ? body.batchName.trim() : "";
  const productType =
    body.productType === "journal" || body.productType === "bookmark"
      ? body.productType
      : null;
  const quantity =
    typeof body.quantity === "number" && Number.isInteger(body.quantity)
      ? body.quantity
      : 0;
  const serialPrefix =
    typeof body.serialPrefix === "string" && body.serialPrefix.trim()
      ? body.serialPrefix.trim()
      : null;
  const notes = typeof body.notes === "string" ? body.notes : null;
  const journalThemeId =
    typeof body.journalThemeId === "string" && body.journalThemeId
      ? body.journalThemeId
      : null;

  if (!batchName || !productType || quantity < 1 || quantity > 500) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }
  if (productType === "journal" && !journalThemeId) {
    return NextResponse.json(
      {
        ok: false,
        code: "JOURNAL_THEME_REQUIRED",
        message: "Choose a journal theme before generating journal capsules.",
      },
      { status: 400 },
    );
  }
  if (journalThemeId && !isUuid(journalThemeId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const appBaseUrl =
      body.issueRecovery === true
        ? resolveAdminAppBaseUrlFromRequest(request).baseUrl
        : null;
    const supabase = getAdminSupabaseClient();
    const generated = await supabase.rpc("admin_generate_capsule_batch", {
      requested_batch_name: batchName,
      requested_product_type: productType,
      requested_quantity: quantity,
      requested_serial_prefix: serialPrefix,
      requested_notes: notes,
      requested_actor: "internal-admin",
      requested_journal_theme_id:
        productType === "journal" ? journalThemeId : null,
    });
    if (generated.error) throw generated.error;
    if (!generated.data?.ok) {
      return NextResponse.json(generated.data, { status: 400 });
    }

    const handoff: RecoveryHandoffItem[] = [];
    const recoveryFailures: Array<{ capsuleId: string; serialNumber: string }> =
      [];
    if (body.issueRecovery === true) {
      for (const capsule of generated.data.capsules as Array<{
        id: string;
        publicToken: string;
        serialNumber: string;
      }>) {
        try {
          const recovery = await issueRecoveryCode(capsule.id);
          handoff.push({
            capsuleId: capsule.id,
            serialNumber: capsule.serialNumber,
            capsuleUrl: capsuleUrl(appBaseUrl!, capsule.publicToken),
            recoveryCode: recovery.recoveryCode!,
            codeVersion: recovery.codeVersion ?? 1,
          });
        } catch {
          recoveryFailures.push({
            capsuleId: capsule.id,
            serialNumber: capsule.serialNumber,
          });
        }
      }
    }

    return NextResponse.json({
      ...generated.data,
      recoveryHandoff: handoff,
      recoveryFailures,
      recoveryPartialFailure: recoveryFailures.length > 0,
    });
  } catch (error) {
    console.error(
      "admin batch generation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503 },
    );
  }
}
