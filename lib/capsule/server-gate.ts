import { getAdminSupabaseClient } from "@/lib/admin/supabase";
import type { CapsuleInitialGate } from "@/lib/capsule/gate-state";

type AdminSupabaseClient = ReturnType<typeof getAdminSupabaseClient>;

type CapsuleScanInput = {
  scanUrl?: string | null;
};

type CapsuleShellRow = {
  id: string;
  status: "unactivated" | "active";
  capsule_fulfillment:
    | { fulfillment_status?: string }
    | Array<{ fulfillment_status?: string }>
    | null;
};

function isDisabled(row: CapsuleShellRow) {
  const fulfillment = row.capsule_fulfillment;
  return Array.isArray(fulfillment)
    ? fulfillment.some((item) => item.fulfillment_status === "disabled")
    : fulfillment?.fulfillment_status === "disabled";
}

function normalizedScanUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

async function recordCapsuleLatestScan(
  supabase: AdminSupabaseClient,
  publicToken: string,
  value?: string | null,
) {
  const scanUrl = normalizedScanUrl(value);
  if (!scanUrl) return;

  try {
    const { error } = await supabase.rpc("record_capsule_latest_scan", {
      requested_token: publicToken,
      requested_scan_url: scanUrl,
    });
    if (error) {
      console.warn(
        "capsule latest scan update failed",
        error instanceof Error ? error.name : "unknown",
      );
    }
  } catch (error) {
    console.warn(
      "capsule latest scan update failed",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

export async function getCapsuleInitialGate(
  publicToken: string,
  scan?: CapsuleScanInput,
): Promise<CapsuleInitialGate> {
  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("capsules")
      .select("id,status,capsule_fulfillment(fulfillment_status)")
      .eq("public_token", publicToken)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { type: "notFound" };

    const row = data as CapsuleShellRow;
    await recordCapsuleLatestScan(supabase, publicToken, scan?.scanUrl);
    if (isDisabled(row)) return { type: "unavailable" };
    return row.status === "unactivated"
      ? { type: "unactivated" }
      : { type: "locked" };
  } catch {
    return {
      type: "error",
      message: "The capsule is temporarily unavailable. Please retry.",
    };
  }
}
