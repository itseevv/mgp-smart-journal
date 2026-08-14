import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const historical = readSource(
  "supabase/migrations/202607280001_journal_volume_lifecycle.sql",
);
const migration = readSource(
  "supabase/migrations/202608140001_archive_storage_admission_and_remove_lifecycle.sql",
);
const edge = readSource("supabase/functions/capsule-access/index.ts");
const api = readSource("lib/capsule/api.ts");

function body(source, name, nextMarker) {
  const start = source.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `${name} must have a stable trailing marker`);
  return source.slice(start, end);
}

test("cleanup queue remains durable and finalized as a tombstone", () => {
  assert.match(historical, /status in \('pending', 'processing', 'failed', 'deleted'\)/);
  assert.match(historical, /add column claim_token uuid/);
  assert.match(historical, /add column deleted_at timestamptz/);
  const finalize = body(
    historical,
    "finalize_media_cleanup",
    "revoke all on function public.finalize_media_cleanup",
  );
  assert.match(finalize, /auth\.role\(\) <> 'service_role'/);
  assert.match(finalize, /status = 'deleted'/);
  assert.match(finalize, /deleted_at = now\(\)/);
  assert.match(finalize, /status = 'failed'/);
  assert.doesNotMatch(finalize, /delete from public\.media_cleanup_queue/);
});

test("cleanup claim RPC locks the capsule and checks every media reference", () => {
  const claim = body(
    historical,
    "claim_media_cleanup",
    "revoke all on function public.claim_media_cleanup",
  );
  assert.match(claim, /from public\.capsules[\s\S]*for update/);
  assert.match(claim, /photo\.storage_path = path/);
  assert.match(claim, /photo\.thumbnail_storage_path = path/);
  assert.match(claim, /memo\.storage_path = path/);
  assert.match(claim, /for update skip locked/);
  assert.match(claim, /REFERENCED_MEDIA/);
  assert.match(claim, /CLAIM_LEASE_EXPIRED/);
});

test("active commit preserves cleanup rejection and Storage metadata verification", () => {
  const commit = body(
    migration,
    "commit_memory_with_lifecycle",
    "create or replace function public.update_journal_title",
  );
  assert.match(commit, /left join storage\.objects object/);
  assert.match(commit, /object\.id is null/);
  assert.match(commit, /object\.metadata->>'size'/);
  assert.match(commit, /MEDIA_RESERVATION_REQUIRED/);
  assert.match(commit, /media_cleanup_queue/);
  assert.match(commit, /insert into public\.media_cleanup_queue/);
  assert.doesNotMatch(commit, /JOURNAL_COMPLETED|FULL_REVIEW|COMPLETED/);
});

test("Edge removes only claimed paths and always finalizes the claim", () => {
  const start = edge.indexOf("async function processCleanup(");
  const end = edge.indexOf("async function isCapsuleDisabled", start);
  const cleanup = edge.slice(start, end);
  assert.match(cleanup, /cleanupRpc\("claim_media_cleanup"/);
  assert.match(cleanup, /claimData\.claimed/);
  assert.match(cleanup, /\.remove\(claimedPaths\)/);
  assert.match(cleanup, /cleanupRpc\("finalize_media_cleanup"/);
  assert.ok(cleanup.indexOf(".remove(claimedPaths)") < cleanup.indexOf('cleanupRpc("finalize_media_cleanup"'));
  assert.doesNotMatch(cleanup, /\.from\("photos"\)|\.from\("voice_memos"\)|\.delete\(\)/);
});

test("delete queues only capsule-scoped paths and clears persisted media", () => {
  const deleteMemory = body(
    migration,
    "delete_journal_memory",
    "create or replace function public.get_journal_home",
  );
  assert.match(deleteMemory, /from public\.capsules[\s\S]*for update/);
  assert.match(deleteMemory, /memory\.capsule_id <> requested_capsule_id/);
  assert.match(deleteMemory, /select coalesce\(array_agg\(distinct path\)/);
  assert.match(deleteMemory, /insert into public\.media_cleanup_queue/);
  assert.match(deleteMemory, /delete from public\.memories/);
  assert.match(deleteMemory, /reservation\.capsule_id = requested_capsule_id/);
});

test("same-draft retry keeps the client from deleting server-owned media", () => {
  assert.match(api, /upsert: !immutablePath/);
  assert.match(api, /journalMode,[\s\S]*uploadFile\([\s\S]*journalMode/);
  const write = body(
    migration,
    "can_write_capsule_media_object",
    "revoke all on function public.can_write_capsule_media_object",
  );
  assert.match(write, /media_cleanup_queue/);
  assert.match(write, /capsule\.product_type = 'bookmark'/);
});
