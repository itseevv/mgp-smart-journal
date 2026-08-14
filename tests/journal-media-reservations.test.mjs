import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = readSource(
  "supabase/migrations/202608140001_archive_storage_admission_and_remove_lifecycle.sql",
);
const reserve = migration.slice(
  migration.indexOf("create or replace function public.reserve_journal_media_uploads"),
  migration.indexOf("create or replace function public.commit_memory_with_lifecycle"),
);
const commit = migration.slice(
  migration.indexOf("create or replace function public.commit_memory_with_lifecycle"),
  migration.indexOf("create or replace function public.update_journal_title"),
);

test("reservation admission serializes Archive quota and rejects before inserts", () => {
  assert.match(reserve, /from public\.capsules[\s\S]*for update/);
  assert.match(reserve, /from public\.archives archive[\s\S]*for update/);
  assert.match(reserve, /journal_archive_projected_bytes/);
  assert.match(reserve, /projected_bytes > granted_bytes/);
  assert.ok(
    reserve.indexOf("JOURNAL_STORAGE_LIMIT") <
      reserve.indexOf("insert into public.journal_media_upload_reservations"),
  );
  assert.match(reserve, /expire_journal_media_reservations/);
});

test("reservations identify each display, thumbnail, and Voice Note path", () => {
  assert.match(reserve, /requested_item->>'mediaId'/);
  assert.match(reserve, /requested_item->>'pathKind'/);
  assert.match(reserve, /expected_size_bytes/);
  assert.match(reserve, /photo_display/);
  assert.match(reserve, /photo_thumbnail/);
  assert.match(reserve, /voice/);
  assert.match(migration, /alter table public\.journal_media_upload_reservations[\s\S]*drop column if exists lifecycle_state/);
});

test("concurrent and replacement projections retain per-Stamp limits", () => {
  assert.match(migration, /reservation\.media_id = photo\.id/);
  assert.match(migration, /reservation\.path_kind = 'photo_display'/);
  assert.match(migration, /item->>'mediaId' = photo\.id::text/);
  assert.match(migration, /reservation\.memory_id <> requested_memory_id/);
  assert.match(reserve, /cardinality\(projected_photo_ids\) > 9/);
  assert.match(reserve, /cardinality\(projected_voice_ids\) > 1/);
  assert.match(commit, /jsonb_array_length\(requested_photos\) > 9/);
  assert.match(commit, /jsonb_array_length\(requested_voice_memos\) > 1/);
  assert.doesNotMatch(reserve, /FULL_REVIEW|COMPLETED|JOURNAL_DAY_LIMIT|JOURNAL_COMPLETED/);
  assert.doesNotMatch(commit, /FULL_REVIEW|COMPLETED|JOURNAL_DAY_LIMIT|JOURNAL_COMPLETED/);
});

test("same-date uniqueness and 366th distinct Stamp remain database rules", () => {
  assert.match(migration, /create unique index if not exists journal_memories_capsule_local_date_key/);
  assert.match(commit, /DUPLICATE_LOCAL_DATE/);
  assert.match(commit, /memory\.local_date = requested_local_date/);
  assert.doesNotMatch(commit, /365|memory_day_count/);
});

test("historical migration remains the audit fixture, not active behavior", () => {
  const legacy = readSource(
    "supabase/migrations/202607280001_journal_volume_lifecycle.sql",
  );
  assert.match(legacy, /create or replace function public\.complete_journal_volume/);
  assert.match(migration, /drop function if exists public\.complete_journal_volume\(uuid\)/);
});
