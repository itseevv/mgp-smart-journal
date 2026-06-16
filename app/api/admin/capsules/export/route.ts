import { NextResponse } from "next/server";

import { resolveAdminAppBaseUrlFromRequest } from "@/lib/admin/app-base-url";
import {
  capsuleListCsv,
  isUuid,
  listAdminCapsules,
  parseFulfillmentStatus,
  parseProductType,
  requireAdminSession,
} from "@/lib/admin/capsules";

export async function GET(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId");
  if (batchId && !isUuid(batchId)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const result = await listAdminCapsules({
    productType: parseProductType(url.searchParams.get("productType")),
    fulfillmentStatus: parseFulfillmentStatus(url.searchParams.get("status")),
    batchId,
    search: url.searchParams.get("search"),
  });

  try {
    const appBaseUrl = resolveAdminAppBaseUrlFromRequest(request);
    const csv = capsuleListCsv(result.capsules ?? [], appBaseUrl.baseUrl);
    return new NextResponse(csv, {
      headers: {
        "Content-Disposition": 'attachment; filename="capsule-fulfillment.csv"',
        "Content-Type": "text/csv; charset=utf-8",
        ...(appBaseUrl.warning
          ? { "X-App-Base-Url-Warning": appBaseUrl.warning }
          : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "APP_BASE_URL_REQUIRED",
        message:
          error instanceof Error
            ? error.message
            : "APP_BASE_URL is required before exporting fulfilment URLs.",
      },
      { status: 503 },
    );
  }
}
