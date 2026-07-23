import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAPSULE_OPEN_TIMEOUT_MS,
  CapsuleOpenError,
  isRetryableCapsuleOpenError,
  mapCapsuleAccessInvokeError,
  withCapsuleOpenRetry,
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
  assert.equal(isRetryableCapsuleOpenError(mapped), true);
});

test("capsule opening retries one transient inspect failure inside the original timeout budget", async () => {
  let calls = 0;
  const result = await withCapsuleOpenRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw mapCapsuleAccessInvokeError({
          name: "FunctionsHttpError",
          message: "Edge Function returned a non-2xx status code",
          context: { status: 503 },
        });
      }
      return { state: "locked" };
    },
    { timeoutMs: 1_000, maxAttempts: 2, retryDelayMs: 1 },
  );

  assert.deepEqual(result, { state: "locked" });
  assert.equal(calls, 2);
});

test("capsule opening does not retry deterministic client errors", async () => {
  let calls = 0;
  await assert.rejects(
    withCapsuleOpenRetry(
      async () => {
        calls += 1;
        throw mapCapsuleAccessInvokeError({
          name: "FunctionsHttpError",
          message: "Edge Function returned a non-2xx status code",
          context: { status: 400 },
        });
      },
      { timeoutMs: 1_000, maxAttempts: 2, retryDelayMs: 1 },
    ),
    (error) =>
      error instanceof CapsuleOpenError &&
      error.httpStatus === 400 &&
      !error.retryable,
  );
  assert.equal(calls, 1);
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
  assert.match(capsuleApi, /withCapsuleOpenRetry/);
  assert.match(capsuleApi, /maxAttempts:\s*action === "inspect" \? 2 : 1/);
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

  assert.match(route, /getCapsuleInitialGate\(publicToken\)/);
  assert.match(route, /initialGate=\{initialGate\}/);
  assert.match(memoryRoute, /getCapsuleInitialGate\(publicToken\)/);
  assert.match(memoryRoute, /initialGate=\{initialGate\}/);
  assert.match(capsulePage, /initialGate\?: CapsuleInitialGate/);
  assert.match(capsulePage, /useState<PageState>\(\(\) =>\s*pageStateFromInitialGate\(initialGate\)/);
  assert.match(capsulePage, /initialGate\.type === "locked"[\s\S]*return \{ type: "loading" \}/);
  assert.doesNotMatch(capsulePage, /getCachedCapsuleAccess\(publicToken\)/);
  assert.doesNotMatch(capsulePage, /initialGateAllowsCachedAccess/);
  assert.doesNotMatch(capsuleApi, /sessionCapsuleAccessCache/);
  assert.doesNotMatch(capsuleApi, /getCachedCapsuleAccess|cacheCapsuleAccess/);
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
