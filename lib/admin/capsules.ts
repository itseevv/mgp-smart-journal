import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  verifyAdminSessionCookie,
} from "@/lib/admin/session";
import { getAdminSupabaseClient } from "@/lib/admin/supabase";
import type { AdminJournalTheme } from "@/lib/admin/journal-themes";
import type { ArchiveQuotaSummary } from "@/data/archive-quota";

export { capsuleListCsv, csvEscape, handoffCsv } from "@/lib/admin/capsule-csv";

export type AdminProductType = "journal" | "bookmark";
export type AdminFulfillmentStatus =
  | "generated"
  | "written"
  | "tested"
  | "packed"
  | "shipped"
  | "disabled";

export type AdminBatchSummary = {
  id: string;
  batchName: string;
  productType: AdminProductType;
  quantity: number;
  status: "generated";
  createdAt: string;
};

export type AdminCapsuleSummary = {
  id: string;
  batchId: string;
  batchName: string;
  serialNumber: string;
  productType: AdminProductType;
  publicToken: string;
  activationStatus: "unactivated" | "active";
  fulfillmentStatus: AdminFulfillmentStatus;
  nfcWriteStatus: "pending" | "written" | "tested";
  qrStatus: "generated";
  recoveryStatus: "not_issued" | "issued";
  createdAt: string;
  activatedAt?: string | null;
  memoryCount: number;
  photoCount: number;
  voiceMemoCount: number;
  journalTheme?: AdminJournalTheme | null;
};

export type AdminCapsuleDetail = AdminCapsuleSummary & {
  disabledAt?: string | null;
  disabledReason?: string | null;
  writtenAt?: string | null;
  testedAt?: string | null;
  recoveryIssuedAt?: string | null;
  recoveryRotatedAt?: string | null;
  recoveryCodeVersion?: number | null;
  storageEstimateBytes: number;
  archiveQuota: ArchiveQuotaSummary | null;
  archiveId?: string | null;
  archiveOwnerAuthUserId?: string | null;
  archiveGrantHistory?: Array<{
    id: string;
    grantKind: "starter" | "expansion" | "adjustment";
    grantedBytes: number;
    createdAt: string;
  }>;
};

export type RecoveryHandoffItem = {
  capsuleId: string;
  serialNumber: string;
  capsuleUrl: string;
  recoveryCode: string;
  codeVersion: number;
};

type AdminListResult = {
  ok?: boolean;
  batches?: AdminBatchSummary[];
  capsules?: AdminCapsuleSummary[];
  code?: string;
};

type AdminDetailResult = {
  ok?: boolean;
  capsule?: AdminCapsuleDetail;
  code?: string;
};

export async function requireAdminSession() {
  const cookieStore = await cookies();
  const verification = verifyAdminSessionCookie(
    cookieStore.get(adminSessionCookieName)?.value,
    process.env.ADMIN_SESSION_SECRET,
  );

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, code: "ACCESS_DENIED" },
      { status: 401 },
    );
  }

  return null;
}

export function parseProductType(value: string | null) {
  return value === "journal" || value === "bookmark" ? value : null;
}

export function parseFulfillmentStatus(value: string | null) {
  return [
    "generated",
    "written",
    "tested",
    "packed",
    "shipped",
    "disabled",
  ].includes(value ?? "")
    ? (value as AdminFulfillmentStatus)
    : null;
}

export function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

export async function listAdminCapsules(input: {
  productType?: AdminProductType | null;
  batchId?: string | null;
  fulfillmentStatus?: AdminFulfillmentStatus | null;
  search?: string | null;
}) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.rpc("admin_list_capsules", {
    requested_product_type: input.productType ?? null,
    requested_batch_id: input.batchId ?? null,
    requested_fulfillment_status: input.fulfillmentStatus ?? null,
    requested_search: input.search ?? null,
  });
  if (error) throw error;
  return data as AdminListResult;
}

export async function getAdminCapsuleDetail(capsuleId: string) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.rpc("admin_get_capsule_detail", {
    requested_capsule_id: capsuleId,
  });
  if (error) throw error;
  return data as AdminDetailResult;
}

export async function issueRecoveryCode(capsuleId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Recovery issuance environment is not configured.");
  }

  const response = await fetch(`${url}/functions/v1/capsule-access`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "issue-recovery-code",
      capsuleId,
    }),
  });
  const result = (await response.json()) as {
    ok?: boolean;
    recoveryCode?: string;
    capsuleId?: string;
    codeVersion?: number;
    code?: string;
  };
  if (!response.ok || !result.ok || !result.recoveryCode) {
    throw new Error(`Recovery issuance failed: ${result.code ?? response.status}`);
  }
  return result;
}
