import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAdminSessionCookieValue,
  verifyAdminPasscode,
  verifyAdminSessionCookie,
} from "../lib/admin/session.ts";
import {
  capsulePath,
  capsuleUrl,
  resolveAdminAppBaseUrl,
} from "../lib/admin/app-base-url.ts";
import { capsuleListCsv } from "../lib/admin/capsule-csv.ts";
import { createAdminRecoveryHandoff } from "../lib/admin/recovery-handoff.ts";

test("admin session cookies are signed and expire", () => {
  const secret = "test-secret-with-more-than-thirty-two-characters";
  const now = Date.parse("2026-06-15T12:00:00Z");
  const value = createAdminSessionCookieValue(secret, now);

  assert.equal(verifyAdminSessionCookie(value, secret, now).ok, true);
  assert.equal(verifyAdminSessionCookie(`${value}x`, secret, now).ok, false);
  assert.equal(
    verifyAdminSessionCookie(value, secret, now + 9 * 60 * 60 * 1000).ok,
    false,
  );
});

test("admin passcode comparison rejects incorrect values", () => {
  assert.equal(verifyAdminPasscode("correct", "correct"), true);
  assert.equal(verifyAdminPasscode("wrong", "correct"), false);
  assert.equal(verifyAdminPasscode("", "correct"), false);
});

test("admin session route sets httpOnly signed production-safe cookie", async () => {
  const route = await readFile(
    new URL("../app/api/admin/session/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /sameSite:\s*"strict"/);
  assert.match(route, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.match(route, /ADMIN_SESSION_SECRET/);
  assert.match(route, /ADMIN_PASSCODE/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_ADMIN/);
});

test("phase 7 migration keeps admin provisioning tables server-only", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202606150004_phase_7_capsule_provisioning.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const table of [
    "capsule_batches",
    "capsule_serial_counters",
    "capsule_fulfillment",
    "admin_action_audit",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on public\\.${table} from anon, authenticated`, "i"),
    );
  }

  assert.match(migration, /serial_number text not null unique/i);
  assert.match(migration, /public_token, product_type, status/i);
  assert.doesNotMatch(migration, /grant .*admin_.* to authenticated/i);

  const auditTable = migration.match(
    /create table public\.admin_action_audit \([\s\S]+?\n\);/i,
  )?.[0];
  assert.ok(auditTable);
  assert.doesNotMatch(
    auditTable,
    /recovery_passcode|owner_pin|pin_hash|recovery_code_hash/i,
  );
});

test("phase 7 admin RPCs are granted only to service_role", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202606150004_phase_7_capsule_provisioning.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const functionName of [
    "admin_generate_capsule_batch",
    "admin_list_capsules",
    "admin_get_capsule_detail",
    "admin_update_capsule_fulfillment",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]+from public`, "i"),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]+to service_role`, "i"),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]+to authenticated`, "i"),
    );
  }
});

test("admin API routes require signed admin session checks", async () => {
  const routeFiles = [
    "../app/api/admin/capsules/route.ts",
    "../app/api/admin/capsules/export/route.ts",
    "../app/api/admin/capsules/[capsuleId]/route.ts",
    "../app/api/admin/capsules/[capsuleId]/recovery/route.ts",
    "../app/api/admin/capsules/[capsuleId]/qr/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const route = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(route, /requireAdminSession/);
    assert.doesNotMatch(route, /ADMIN_PASSCODE/);
    assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("general admin CSV export contains no recovery passcodes or private media fields", async () => {
  const helpers = await readFile(
    new URL("../lib/admin/capsule-csv.ts", import.meta.url),
    "utf8",
  );
  const csvFunction = helpers.match(
    /export function capsuleListCsv[\s\S]+?^}/m,
  )?.[0];

  assert.ok(csvFunction);
  assert.doesNotMatch(
    csvFunction,
    /recoveryCode|recovery_passcode|storagePath|signedUrl|owner_pin|hash/i,
  );
});

test("capsule URLs are built from server-side APP_BASE_URL", () => {
  assert.equal(capsulePath("token-123"), "/c/token-123");
  assert.equal(
    capsuleUrl("https://journal-chip-staging.vercel.app/", "token-123"),
    "https://journal-chip-staging.vercel.app/c/token-123",
  );

  assert.deepEqual(
    resolveAdminAppBaseUrl({
      appBaseUrl: "https://example.com/",
      requestOrigin: "http://localhost:3000",
      nodeEnv: "production",
    }),
    {
      baseUrl: "https://example.com",
      configured: true,
    },
  );
});

test("missing APP_BASE_URL warns in development and fails safely in production", () => {
  const development = resolveAdminAppBaseUrl({
    appBaseUrl: undefined,
    requestOrigin: "http://localhost:3000",
    nodeEnv: "development",
  });

  assert.equal(development.baseUrl, "http://localhost:3000");
  assert.equal(development.configured, false);
  assert.match(development.warning, /APP_BASE_URL/);

  assert.throws(
    () =>
      resolveAdminAppBaseUrl({
        appBaseUrl: undefined,
        requestOrigin: "https://yourbrand.com",
        nodeEnv: "production",
      }),
    /APP_BASE_URL/,
  );
});

test("CSV export includes public token, capsule path, and APP_BASE_URL capsule URL", () => {
  const csv = capsuleListCsv(
    [
      {
        id: "capsule-id",
        batchId: "batch-id",
        batchName: "June Batch",
        serialNumber: "JNL-2026-0001",
        productType: "journal",
        publicToken: "public-token",
        activationStatus: "unactivated",
        fulfillmentStatus: "generated",
        nfcWriteStatus: "pending",
        qrStatus: "generated",
        recoveryStatus: "not_issued",
        createdAt: "2026-06-16T10:00:00Z",
        memoryCount: 0,
        photoCount: 0,
        voiceMemoCount: 0,
      },
    ],
    "https://yourbrand.com",
  );

  assert.match(csv.split("\n")[0], /public_token,capsule_path,capsule_url/);
  assert.match(csv, /public-token,\/c\/public-token,https:\/\/yourbrand\.com\/c\/public-token/);
  assert.doesNotMatch(csv, /localhost/);
});

test("admin QR and export routes use APP_BASE_URL instead of request origin", async () => {
  const qrRoute = await readFile(
    new URL("../app/api/admin/capsules/[capsuleId]/qr/route.ts", import.meta.url),
    "utf8",
  );
  const exportRoute = await readFile(
    new URL("../app/api/admin/capsules/export/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(qrRoute, /resolveAdminAppBaseUrl/);
  assert.match(exportRoute, /resolveAdminAppBaseUrl/);
  assert.doesNotMatch(qrRoute, /capsuleUrl\(url\.origin/);
  assert.doesNotMatch(exportRoute, /capsuleListCsv\(result\.capsules \?\? \[\], url\.origin\)/);
});

test("admin detail distinguishes capsule path from full NFC and QR URL", async () => {
  const detailRoute = await readFile(
    new URL("../app/api/admin/capsules/[capsuleId]/route.ts", import.meta.url),
    "utf8",
  );
  const detailPage = await readFile(
    new URL("../components/admin/admin-capsule-detail-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detailRoute, /capsulePath/);
  assert.match(detailRoute, /capsuleUrl/);
  assert.match(detailPage, /t\("capsulePath"\)/);
  assert.match(detailPage, /t\("expectedNfcUrl"\)/);
  assert.match(detailPage, /t\("copyUrl"\)/);
  assert.match(detailPage, /t\("openPublicUrl"\)/);
});

test("disabled capsules return neutral public state and recovery actions are blocked", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202606150004_phase_7_capsule_provisioning.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const edgeFunction = await readFile(
    new URL(
      "../supabase/functions/capsule-access/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const capsulePage = await readFile(
    new URL("../components/capsule/capsule-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(migration, /is_capsule_fulfillment_disabled/);
  assert.match(migration, /'state', 'unavailable'/);
  assert.match(edgeFunction, /isCapsuleDisabled/);
  assert.match(edgeFunction, /input\.action === "recovery-reset"[\s\S]+isCapsuleDisabled/);
  assert.match(capsulePage, /This memory capsule is unavailable/);
  assert.doesNotMatch(capsulePage, /disabledReason|fulfillment_status/);
});

test("admin recovery handoff does not rotate when capsule detail lookup fails", async () => {
  let issueCalled = false;
  const result = await createAdminRecoveryHandoff({
    capsuleId: "70442906-d2c9-4a1a-a39b-ab37ffdf66dc",
    appBaseUrl: "http://localhost:3000",
    getDetail: async () => ({ ok: false, code: "NOT_FOUND" }),
    issueRecovery: async () => {
      issueCalled = true;
      return { recoveryCode: "SHOULD-NOT-EXIST" };
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result, { ok: false, code: "NOT_FOUND" });
  assert.equal(issueCalled, false);
  assert.doesNotMatch(JSON.stringify(result), /SHOULD-NOT-EXIST/);
});
