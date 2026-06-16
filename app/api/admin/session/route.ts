import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createAdminSessionCookieValue,
  verifyAdminPasscode,
  verifyAdminSessionCookie,
} from "@/lib/admin/session";

function adminCookieOptions() {
  return {
    httpOnly: true,
    maxAge: adminSessionMaxAgeSeconds,
    path: "/",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const verification = verifyAdminSessionCookie(
    cookieStore.get(adminSessionCookieName)?.value,
    process.env.ADMIN_SESSION_SECRET,
  );

  return NextResponse.json({ authenticated: verification.ok });
}

export async function POST(request: Request) {
  let body: { passcode?: unknown };
  try {
    body = (await request.json()) as { passcode?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (
    !process.env.ADMIN_PASSCODE ||
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  ) {
    return NextResponse.json(
      { ok: false, code: "ADMIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (
    typeof body.passcode !== "string" ||
    !verifyAdminPasscode(body.passcode, process.env.ADMIN_PASSCODE)
  ) {
    return NextResponse.json(
      { ok: false, code: "ACCESS_DENIED" },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    adminSessionCookieName,
    createAdminSessionCookieValue(process.env.ADMIN_SESSION_SECRET),
    adminCookieOptions(),
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookieName, "", {
    ...adminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
