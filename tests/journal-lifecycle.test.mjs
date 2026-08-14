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

function projectedBytes({ persisted, activeReservations, retained, proposed }) {
  return persisted
    .filter((media) => !media.replaced)
    .reduce((total, media) => total + media.bytes, 0)
    + activeReservations.reduce((total, reservation) => total + reservation.bytes, 0)
    + retained.reduce((total, media) => total + media.bytes, 0)
    + proposed.reduce((total, media) => total + media.bytes, 0);
}

function stampAdmission(photoCount, voiceNoteCount) {
  return photoCount <= 9 && voiceNoteCount <= 1;
}

test("semantic fallback: Archive admission counts persisted, active intents, and final media", () => {
  const base = {
      persisted: [
      { memoryId: "old", bytes: 600 },
      { memoryId: "replace", pathKind: "photo_display", bytes: 300, replaced: true },
      { memoryId: "replace", pathKind: "photo_thumbnail", bytes: 40 },
    ],
    activeReservations: [],
    replaced: "replace",
    retained: [{ memoryId: "replace", bytes: 200 }],
    proposed: [{ memoryId: "replace", bytes: 100 }],
  };
  assert.equal(projectedBytes(base), 940);
  assert.equal(projectedBytes({ ...base, proposed: [{ memoryId: "replace", bytes: 101 }] }) > 1_000, false);
  assert.equal(projectedBytes({ ...base, proposed: [{ memoryId: "replace", bytes: 201 }] }) > 1_000, true);
  assert.equal(
    projectedBytes({
      ...base,
      activeReservations: [{ memoryId: "other", mediaId: "other-photo", pathKind: "photo_display", bytes: 150 }],
      proposed: [{ memoryId: "replace", bytes: 100 }],
    }),
    1_090,
  );
  assert.equal(
    projectedBytes({ ...base, retained: [{ memoryId: "replace", bytes: 300 }], proposed: [] }),
    940,
  );
});

test("semantic fallback: quota rejection occurs before reservation rows are inserted", () => {
  assert.match(migration, /for update/);
  assert.match(migration, /journal_archive_projected_bytes/);
  assert.match(reserve, /projected_bytes > granted_bytes/);
  assert.match(reserve, /code', 'JOURNAL_STORAGE_LIMIT'/);
  assert.ok(reserve.indexOf("JOURNAL_STORAGE_LIMIT") < reserve.indexOf("insert into public.journal_media_upload_reservations"));
  assert.match(migration, /status = 'reserved'[\s\S]*expires_at > now\(\)/);
  assert.match(migration, /not exists \([\s\S]*journal_media_upload_reservations reservation/);
});

test("semantic fallback: replacements exclude replaced media and concurrent reservations are included", () => {
  assert.match(migration, /memory\.id <> requested_memory_id/);
  assert.match(migration, /reservation\.media_id = photo\.id/);
  assert.match(migration, /reservation\.path_kind = 'photo_display'/);
  assert.match(migration, /item->>'mediaId' = photo\.id::text/);
  assert.match(migration, /reservation\.memory_id <> requested_memory_id/);
  assert.match(migration, /requested_final_photo_ids/);
  assert.match(migration, /requested_final_voice_ids/);
  assert.match(migration, /requested_items/);
  assert.match(migration, /reservation\.expected_size_bytes/);
});

test("semantic fallback: 366th distinct date is allowed while same-date remains unique", () => {
  assert.match(migration, /create unique index if not exists journal_memories_capsule_local_date_key/);
  assert.match(commit, /memory\.local_date = requested_local_date/);
  assert.match(commit, /DUPLICATE_LOCAL_DATE/);
  assert.doesNotMatch(commit, /365|memory_day_count|JOURNAL_DAY_LIMIT/);
});

test("semantic fallback: per-Stamp nine-photo and one-Voice-Note rules remain", () => {
  assert.equal(stampAdmission(9, 1), true);
  assert.equal(stampAdmission(10, 1), false);
  assert.equal(stampAdmission(9, 2), false);
  assert.match(reserve, /cardinality\(projected_photo_ids\) > 9/);
  assert.match(reserve, /JOURNAL_PHOTO_LIMIT/);
  assert.match(reserve, /cardinality\(projected_voice_ids\) > 1/);
  assert.match(reserve, /JOURNAL_VOICE_LIMIT/);
  assert.match(commit, /jsonb_array_length\(requested_photos\) > 9/);
  assert.match(commit, /jsonb_array_length\(requested_voice_memos\) > 1/);
});

test("semantic fallback: retired lifecycle and completion paths are not active", () => {
  assert.match(migration, /update public\.journal_volume_lifecycle[\s\S]*set state = 'ACTIVE'/);
  assert.match(migration, /drop function if exists public\.complete_journal_volume\(uuid\)/);
  assert.match(migration, /drop table if exists public\.journal_volume_lifecycle/);
  assert.match(migration, /drop type if exists public\.journal_volume_lifecycle_state/);
  assert.doesNotMatch(reserve, /FULL_REVIEW|COMPLETED|JOURNAL_DAY_LIMIT/);
  assert.doesNotMatch(commit, /FULL_REVIEW|COMPLETED|JOURNAL_DAY_LIMIT/);
  const api = readSource("lib/capsule/api.ts");
  const product = readSource("data/journal-product.ts");
  const data = readSource("data/journal.ts");
  assert.match(api, /archiveQuota: mapArchiveQuota\(data\.archiveQuota\)/);
  assert.doesNotMatch(api, /complete_journal_volume|JOURNAL_DAY_LIMIT|JOURNAL_COMPLETED|FULL_REVIEW|COMPLETED/);
  assert.doesNotMatch(product, /JOURNAL_YEAR_DAYS|JOURNAL_YEAR_PHOTO_CAPACITY|JOURNAL_VOLUME_VOICE_NOTE_MAX_BYTES/);
  assert.doesNotMatch(data, /JournalLifecycle|FULL_REVIEW|COMPLETED|completedAt|memoryDayCount/);
});

test("202607280001 remains the immutable historical migration", () => {
  const legacy = readSource(
    "supabase/migrations/202607280001_journal_volume_lifecycle.sql",
  );
  assert.match(legacy, /create or replace function public\.reserve_journal_media_uploads/);
  assert.match(legacy, /create or replace function public\.complete_journal_volume/);
});
