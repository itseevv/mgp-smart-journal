import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  generateRecoveryCode,
  recoveryCodeHash,
} from "../supabase/functions/_shared/recovery.ts";
import {
  isCompleteRecoveryCode,
  normalizeRecoveryCode,
} from "../lib/recovery/config.ts";

test("generates complete codes from the unambiguous alphabet", () => {
  const codes = new Set(
    Array.from({ length: 100 }, () => generateRecoveryCode()),
  );
  assert.equal(codes.size, 100);
  for (const code of codes) assert.equal(isCompleteRecoveryCode(code), true);
});

test("hashes normalized codes with the documented versioned HMAC context", async () => {
  const pepper = "test-only-pepper";
  const formatted = "M7KP-4QXN-92HF-W8TR";
  const expected = createHmac("sha256", pepper)
    .update(`recovery:v1:${normalizeRecoveryCode(formatted)}`)
    .digest("hex");

  assert.equal(await recoveryCodeHash(formatted.toLowerCase(), pepper), expected);
  assert.equal(await recoveryCodeHash("M7KP 4QXN 92HF W8TR", pepper), expected);
});

test("migration grants recovery RPCs only to service_role", async () => {
  const phase6Migration = await readFile(
    new URL(
      "../supabase/migrations/202606150002_phase_6_recovery_passcodes.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const preflightMigration = await readFile(
    new URL(
      "../supabase/migrations/202606150003_recovery_preflight_verify.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const migration = `${phase6Migration}\n${preflightMigration}`;

  assert.match(migration, /grant execute[\s\S]+to service_role;/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.(inspect_capsule_recovery|issue_capsule_recovery_code|verify_capsule_recovery_code|reset_capsule_owner_with_recovery|replace_lost_recovery_code)[\s\S]+to authenticated;/i,
  );
  assert.match(
    migration,
    /owner_recovery_hash is[\s\S]+Deprecated and unused/i,
  );
});

test("browser payload cannot provide the recovery auth user ID", async () => {
  const edgeFunction = await readFile(
    new URL(
      "../supabase/functions/capsule-access/index.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(edgeFunction, /authUserId\??:/);
  assert.match(edgeFunction, /requested_user: userId/);
  assert.match(edgeFunction, /const userId = claims\.userId/);
});
