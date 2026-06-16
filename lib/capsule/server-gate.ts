import { getAdminSupabaseClient } from "@/lib/admin/supabase";
import type { CapsuleInitialGate } from "@/lib/capsule/gate-state";

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

export async function getCapsuleInitialGate(
  publicToken: string,
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
