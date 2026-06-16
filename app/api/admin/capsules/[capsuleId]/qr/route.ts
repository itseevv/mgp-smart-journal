import QRCode from "qrcode";
import { NextResponse } from "next/server";

import {
  capsuleUrl,
  resolveAdminAppBaseUrlFromRequest,
} from "@/lib/admin/app-base-url";
import {
  getAdminCapsuleDetail,
  isUuid,
  requireAdminSession,
} from "@/lib/admin/capsules";

function qrFilename(serialNumber: string, extension: "svg" | "png") {
  return `${serialNumber.replace(/[^A-Z0-9-]/gi, "-")}-qr.${extension}`;
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

  const detail = await getAdminCapsuleDetail(capsuleId);
  if (!detail.ok || !detail.capsule) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const disposition = url.searchParams.get("preview") === "1" ? "inline" : "attachment";
  let appBaseUrl;
  try {
    appBaseUrl = resolveAdminAppBaseUrlFromRequest(request);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "APP_BASE_URL_REQUIRED",
        message:
          error instanceof Error
            ? error.message
            : "APP_BASE_URL is required before generating QR codes.",
      },
      { status: 503 },
    );
  }
  const encodedUrl = capsuleUrl(appBaseUrl.baseUrl, detail.capsule.publicToken);

  if (format === "png") {
    const png = await QRCode.toBuffer(encodedUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      type: "png",
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Disposition": `${disposition}; filename="${qrFilename(
          detail.capsule.serialNumber,
          "png",
        )}"`,
        "Content-Type": "image/png",
        ...(appBaseUrl.warning
          ? { "X-App-Base-Url-Warning": appBaseUrl.warning }
          : {}),
      },
    });
  }

  const svg = await QRCode.toString(encodedUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "svg",
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Disposition": `${disposition}; filename="${qrFilename(
        detail.capsule.serialNumber,
        "svg",
      )}"`,
      "Content-Type": "image/svg+xml; charset=utf-8",
      ...(appBaseUrl.warning
        ? { "X-App-Base-Url-Warning": appBaseUrl.warning }
        : {}),
    },
  });
}
