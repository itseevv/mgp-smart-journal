import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202607140001_capsule_access_inactivity_lease.sql",
  import.meta.url,
);

test("capsule access leases are server controlled and expire after 30 days", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /add column access_expires_at timestamptz/i);
  assert.match(
    migration,
    /capsule_access_lease_duration\(\)[\s\S]+interval '30 days'/i,
  );
  assert.match(
    migration,
    /access_expires_at[\s\S]+default[\s\S]+capsule_access_lease_duration\(\)/i,
  );
  assert.match(
    migration,
    /create or replace function public\.has_capsule_role[\s\S]+access_expires_at > now\(\)/i,
  );
  assert.doesNotMatch(migration, /requested_(expiry|expires|threshold|lease)/i);
});

test("unlock, activation, inspection, and activity refresh the same server lease", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create or replace function public\.touch_capsule_access/i);
  assert.match(
    migration,
    /touch_capsule_access[\s\S]+access_expires_at = now\(\) \+ public\.capsule_access_lease_duration\(\)/i,
  );
  assert.match(
    migration,
    /inspect_capsule_access[\s\S]+delete from public\.capsule_access[\s\S]+access_expires_at <= now\(\)/i,
  );
  assert.match(
    migration,
    /activate_capsule_owner[\s\S]+on conflict \(capsule_id, auth_user_id\) do update[\s\S]+access_expires_at = excluded\.access_expires_at/i,
  );
  assert.match(
    migration,
    /unlock_capsule_owner[\s\S]+on conflict \(capsule_id, auth_user_id\) do update[\s\S]+access_expires_at = excluded\.access_expires_at/i,
  );
  assert.match(migration, /next_attempts >= 5/i);
  assert.match(migration, /interval '15 minutes'/i);
});

test("expired and new-device access stay locked at the database boundary", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /where capsule_id = target\.id[\s\S]+auth_user_id = requested_user[\s\S]+access_expires_at > now\(\)/i,
  );
  assert.match(
    migration,
    /when has_access then 'unlocked'[\s\S]+else 'locked'/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.touch_capsule_access\(text, uuid\) from public/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.touch_capsule_access\(text, uuid\) to service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.touch_capsule_access\(text, uuid\) to (anon|authenticated)/i,
  );
});

test("manual lock and recovery keep their existing server-side behavior", async () => {
  const originalAccessMigration = await readFile(
    new URL(
      "../supabase/migrations/202606110001_phase_3a_persistent_capsule.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const recoveryMigration = await readFile(
    new URL(
      "../supabase/migrations/202606150002_phase_6_recovery_passcodes.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const leaseMigration = await readFile(migrationUrl, "utf8");

  assert.match(
    originalAccessMigration,
    /lock_capsule_owner[\s\S]+delete from public\.capsule_access[\s\S]+auth_user_id = requested_user/i,
  );
  assert.match(
    recoveryMigration,
    /reset_capsule_owner_with_recovery[\s\S]+delete from public\.capsule_access[\s\S]+insert into public\.capsule_access\(capsule_id, auth_user_id, role\)/i,
  );
  assert.match(
    leaseMigration,
    /alter column access_expires_at[\s\S]+set default/i,
  );
});

test("the authenticated edge action exposes touch without accepting lease policy", async () => {
  const edgeFunction = await readFile(
    new URL("../supabase/functions/capsule-access/index.ts", import.meta.url),
    "utf8",
  );
  const capsuleApi = await readFile(
    new URL("../lib/capsule/api.ts", import.meta.url),
    "utf8",
  );

  assert.match(edgeFunction, /"inspect",[\s\S]+"touch",/);
  assert.match(edgeFunction, /touch:\s*"touch_capsule_access"/);
  assert.match(edgeFunction, /requested_user:\s*userId/);
  assert.doesNotMatch(edgeFunction, /input\.(accessExpiresAt|threshold|leaseDuration)/);
  assert.match(
    capsuleApi,
    /action:\s*"inspect" \| "touch" \| "activate" \| "unlock" \| "lock"/,
  );
  assert.doesNotMatch(capsuleApi, /body:\s*\{[^}]+(accessExpiresAt|threshold|leaseDuration)/);
});

test("authoritative inspection and resume checks cannot flash cached Journal content", async () => {
  const capsulePage = await readFile(
    new URL("../components/capsule/capsule-page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(capsulePage, /getCachedCapsuleAccess/);
  assert.doesNotMatch(capsulePage, /initialGateAllowsCachedAccess/);
  assert.doesNotMatch(capsulePage, /cacheCapsuleAccess/);
  assert.match(capsulePage, /inspection\.state === "locked"[\s\S]+clearCapsuleSessionCache/);
  assert.match(capsulePage, /CAPSULE_ACTIVITY_THROTTLE_MS\s*=\s*5 \* 60 \* 1000/);
  assert.match(capsulePage, /visibilitychange/);
  assert.match(capsulePage, /window\.addEventListener\("focus"/);
  assert.match(capsulePage, /window\.addEventListener\("pointerdown"/);
  assert.match(capsulePage, /window\.addEventListener\("keydown"/);
  assert.match(capsulePage, /leaseChecking[\s\S]+state\.type === "loading"/);
  assert.match(capsulePage, /callCapsuleAccess\([\s\S]+"touch"/);
});

test("copied root and memory URLs carry no access credential", async () => {
  const route = await readFile(
    new URL("../app/c/[publicToken]/page.tsx", import.meta.url),
    "utf8",
  );
  const memoryRoute = await readFile(
    new URL("../app/c/[publicToken]/m/[memoryId]/page.tsx", import.meta.url),
    "utf8",
  );

  for (const source of [route, memoryRoute]) {
    assert.match(source, /getCapsuleInitialGate/);
    assert.match(source, /initialGate=\{initialGate\}/);
    assert.doesNotMatch(source, /ownerPin|sessionToken|accessCredential/);
  }
});
