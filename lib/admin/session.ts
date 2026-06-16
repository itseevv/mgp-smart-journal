import { createHmac, timingSafeEqual } from "node:crypto";

export const adminSessionCookieName = "journal_chip_admin";
export const adminSessionMaxAgeSeconds = 8 * 60 * 60;

const cookieVersion = "v1";

export type AdminSessionVerification =
  | { ok: true; expiresAt: number }
  | { ok: false; code: "MISSING" | "MALFORMED" | "EXPIRED" | "INVALID" };

function signSessionPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAdminSessionCookieValue(
  secret: string,
  now = Date.now(),
) {
  const expiresAt = now + adminSessionMaxAgeSeconds * 1000;
  const payload = `${cookieVersion}.${expiresAt}`;
  return `${payload}.${signSessionPayload(payload, secret)}`;
}

export function verifyAdminSessionCookie(
  value: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): AdminSessionVerification {
  if (!value || !secret) return { ok: false, code: "MISSING" };

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== cookieVersion) {
    return { ok: false, code: "MALFORMED" };
  }

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt)) {
    return { ok: false, code: "MALFORMED" };
  }
  if (expiresAt <= now) return { ok: false, code: "EXPIRED" };

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = signSessionPayload(payload, secret);
  if (!safeEqual(parts[2], expected)) return { ok: false, code: "INVALID" };

  return { ok: true, expiresAt };
}

export function verifyAdminPasscode(
  submittedPasscode: string,
  configuredPasscode: string | undefined,
) {
  if (!configuredPasscode || !submittedPasscode) return false;
  return safeEqual(submittedPasscode, configuredPasscode);
}
