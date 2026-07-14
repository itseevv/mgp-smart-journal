import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAPSULE_OPEN_TIMEOUT_MS,
  CapsuleOpenError,
  mapCapsuleAccessInvokeError,
  withTimeout,
} from "../lib/capsule/opening.ts";

test("capsule opening timeout uses the documented range", () => {
  assert.equal(CAPSULE_OPEN_TIMEOUT_MS, 12_000);
});

test("capsule opening timeout rejects a stalled request", async () => {
  await assert.rejects(
    withTimeout(
      new Promise(() => {}),
      10,
      () => new CapsuleOpenError("INSPECT_TIMEOUT", "inspect", "Timed out"),
    ),
    (error) =>
      error instanceof CapsuleOpenError &&
      error.code === "INSPECT_TIMEOUT" &&
      error.stage === "inspect",
  );
});

test("capsule opening maps fetch failures to a retryable network or CORS message", () => {
  const mapped = mapCapsuleAccessInvokeError({
    name: "FunctionsFetchError",
    message: "Failed to send a request to the Edge Function",
  });

  assert.equal(mapped instanceof CapsuleOpenError, true);
  assert.equal(mapped.code, "NETWORK_OR_CORS");
  assert.match(mapped.message, /origin configuration|connection/i);
});

test("capsule access function allows configured origins instead of a single wildcard origin", async () => {
  const edgeFunction = await readFile(
    new URL("../supabase/functions/capsule-access/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(edgeFunction, /ALLOWED_ORIGINS/);
  assert.match(edgeFunction, /APP_BASE_URL/);
  assert.match(edgeFunction, /Access-Control-Allow-Methods/);
  assert.match(edgeFunction, /allowedOrigins\(\)\.has/);
  assert.doesNotMatch(edgeFunction, /Access-Control-Allow-Origin": Deno\.env\.get\("ALLOWED_ORIGIN"\) \?\? "\*"/);
});

test("capsule bootstrap times out both session lookup and access inspection", async () => {
  const capsuleApi = await readFile(
    new URL("../lib/capsule/api.ts", import.meta.url),
    "utf8",
  );

  assert.match(capsuleApi, /withTimeout\(\s*client\.auth\.getSession\(\)/);
  assert.match(capsuleApi, /withTimeout\(\s*client\.auth\.signInAnonymously\(\)/);
  assert.match(capsuleApi, /client\.functions\.invoke\("capsule-access"/);
  assert.match(capsuleApi, /INSPECT_TIMEOUT/);
});

test("customer capsule routes provide a server-side initial gate before hydration", async () => {
  const route = await readFile(
    new URL("../app/c/[publicToken]/page.tsx", import.meta.url),
    "utf8",
  );
  const memoryRoute = await readFile(
    new URL("../app/c/[publicToken]/m/[memoryId]/page.tsx", import.meta.url),
    "utf8",
  );
  const capsulePage = await readFile(
    new URL("../components/capsule/capsule-page.tsx", import.meta.url),
    "utf8",
  );
  const capsuleApi = await readFile(
    new URL("../lib/capsule/api.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getCapsuleInitialGate\(publicToken/);
  assert.match(route, /initialGate=\{initialGate\}/);
  assert.match(memoryRoute, /getCapsuleInitialGate\(publicToken/);
  assert.match(memoryRoute, /initialGate=\{initialGate\}/);
  assert.match(capsulePage, /initialGate\?: CapsuleInitialGate/);
  assert.match(capsulePage, /useState<PageState>\(\(\) =>\s*pageStateFromInitialGate\(initialGate\)/);
  assert.match(capsulePage, /initialGate\.type === "locked"[\s\S]*return \{ type: "loading" \}/);
  assert.match(capsulePage, /getCachedCapsuleAccess\(publicToken\)/);
  assert.match(
    capsulePage,
    /initialGateAllowsCachedAccess[\s\S]*initialGate\.type === "locked"/,
  );
  assert.match(capsulePage, /cacheCapsuleAccess\(publicToken, inspection\)/);
  assert.match(capsulePage, /clearCapsuleSessionCache\(state\.capsuleId, publicToken\)/);
  assert.match(capsuleApi, /sessionCapsuleAccessCache/);
  assert.match(capsuleApi, /export function getCachedCapsuleAccess/);
  assert.match(capsuleApi, /export function cacheCapsuleAccess/);
});

test("public capsule opens record the latest observed URL without claiming NFC proof", async () => {
  const route = await readFile(
    new URL("../app/c/[publicToken]/page.tsx", import.meta.url),
    "utf8",
  );
  const memoryRoute = await readFile(
    new URL("../app/c/[publicToken]/m/[memoryId]/page.tsx", import.meta.url),
    "utf8",
  );
  const serverGate = await readFile(
    new URL("../lib/capsule/server-gate.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202607090001_capsule_latest_scan_tracking.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /capsuleScanUrlFromHeaders/);
  assert.match(route, /getCapsuleInitialGate\(publicToken,\s*\{\s*scanUrl/);
  assert.match(memoryRoute, /capsuleScanUrlFromHeaders/);
  assert.match(memoryRoute, /getCapsuleInitialGate\(publicToken,\s*\{\s*scanUrl/);
  assert.match(serverGate, /recordCapsuleLatestScan/);
  assert.match(serverGate, /record_capsule_latest_scan/);
  assert.match(serverGate, /requested_scan_url/);
  assert.doesNotMatch(serverGate, /user.?agent|ip_address|x-forwarded-for|owner_pin_hash|recovery|storage_path|signed|media_path|audio|photo/i);
  assert.match(migration, /latest_scan_url text/);
  assert.match(migration, /latest_scan_at timestamptz/);
  assert.match(migration, /record_capsule_latest_scan/);
  assert.match(migration, /grant execute on function public\.record_capsule_latest_scan\(text, text\) to service_role/i);
  assert.doesNotMatch(migration, /user.?agent|ip_address|x-forwarded-for/i);
});

test("server-side capsule gate exposes only coarse public-opening state", async () => {
  const serverGate = await readFile(
    new URL("../lib/capsule/server-gate.ts", import.meta.url),
    "utf8",
  );

  assert.match(serverGate, /getAdminSupabaseClient/);
  assert.match(serverGate, /\.select\("id,status,capsule_fulfillment\(fulfillment_status\)"\)/);
  assert.doesNotMatch(serverGate, /owner_pin_hash|recovery|storage_path|signed|media_path|audio|photo/i);
});

test("next dev allows the configured APP_BASE_URL host for ngrok testing", async () => {
  const nextConfig = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(nextConfig, /allowedDevOrigins/);
  assert.match(nextConfig, /process\.env\.APP_BASE_URL/);
  assert.match(nextConfig, /new URL\(value\)\.host/);
});
