import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cleanupMigration = await readFile(
  new URL(
    "../supabase/migrations/202607270001_remove_prelaunch_duplicate_journal_fixture.sql",
    import.meta.url,
  ),
  "utf8",
);
const photoLimitCleanupMigration = await readFile(
  new URL(
    "../supabase/migrations/202607270002_remove_prelaunch_photo_limit_fixture.sql",
    import.meta.url,
  ),
  "utf8",
);
const lifecycleMigration = await readFile(
  new URL(
    "../supabase/migrations/202607280001_journal_volume_lifecycle.sql",
    import.meta.url,
  ),
  "utf8",
);
const databaseHarness = await readFile(
  new URL("../scripts/qa-archive-storage-db.mjs", import.meta.url),
  "utf8",
);

test("pre-launch fixture cleanup is narrowly scoped and clean databases remain a no-op", () => {
  assert.match(cleanupMigration, /target_capsule_id constant uuid := '70442906-d2c9-4a1a-a39b-ab37ffdf66dc'/);
  assert.match(cleanupMigration, /3f5ff491-429f-4e5a-b19a-5b4d31d4337a/);
  assert.match(cleanupMigration, /46ffd4a4-ac71-4c94-8cac-e0753d436dae/);
  assert.match(cleanupMigration, /if existing_target_count = 0 then\s+return;/);
  assert.match(cleanupMigration, /existing_target_count <> 2 or verified_fixture_count <> 2/);
  assert.match(cleanupMigration, /PRELAUNCH_JOURNAL_FIXTURE_MISMATCH/);
  assert.doesNotMatch(cleanupMigration, /Fuckin superwoman|2nd tryyyy/);
});

test("fixture media is queued before the two Memory rows are deleted", () => {
  const queueIndex = cleanupMigration.indexOf(
    "insert into public.media_cleanup_queue",
  );
  const deleteIndex = cleanupMigration.indexOf("delete from public.memories");
  assert.ok(queueIndex >= 0);
  assert.ok(deleteIndex > queueIndex);
  assert.match(cleanupMigration, /photo\.storage_path/);
  assert.match(cleanupMigration, /photo\.thumbnail_storage_path/);
  assert.match(cleanupMigration, /memo\.storage_path/);
  assert.match(cleanupMigration, /on conflict \(storage_path\) do nothing/);
  assert.match(cleanupMigration, /get diagnostics deleted_count = row_count/);
  assert.match(cleanupMigration, /if deleted_count <> 2 then/);
});

test("cleanup precedes lifecycle backfill and the executable harness covers it", () => {
  assert.ok(
    "202607270001_remove_prelaunch_duplicate_journal_fixture.sql" <
      "202607280001_journal_volume_lifecycle.sql",
  );
  assert.match(lifecycleMigration, /Backfill only missing Journal day identity/);
  assert.match(databaseHarness, /seedPrelaunchDuplicateFixture\(\)/);
  assert.match(databaseHarness, /assertPrelaunchDuplicateFixtureCleanup\(\)/);
  assert.match(databaseHarness, /summary\.remainingMemories !== 0/);
  assert.match(databaseHarness, /summary\.queuedPaths !== 4/);
});

test("photo-limit fixture cleanup is exact, verified, and remains a clean-database no-op", () => {
  assert.match(
    photoLimitCleanupMigration,
    /target_capsule_id constant uuid := 'ac5a42f8-1d4b-4279-ac77-a008f4c646cf'/,
  );
  assert.match(
    photoLimitCleanupMigration,
    /target_memory_id constant uuid := '1b27eccb-c980-4166-b9c2-034072419e75'/,
  );
  assert.match(photoLimitCleanupMigration, /if existing_target_count = 0 then\s+return;/);
  assert.match(photoLimitCleanupMigration, /capsule\.product_type = 'journal'/);
  assert.match(photoLimitCleanupMigration, /date '2026-06-16'/);
  assert.match(photoLimitCleanupMigration, /\) = 19/);
  assert.match(photoLimitCleanupMigration, /\) = 1/);
  assert.match(photoLimitCleanupMigration, /PRELAUNCH_PHOTO_LIMIT_FIXTURE_MISMATCH/);
});

test("photo-limit fixture media is queued before its Memory row is deleted", () => {
  const queueIndex = photoLimitCleanupMigration.indexOf(
    "insert into public.media_cleanup_queue",
  );
  const deleteIndex = photoLimitCleanupMigration.indexOf("delete from public.memories");
  assert.ok(queueIndex >= 0);
  assert.ok(deleteIndex > queueIndex);
  assert.match(photoLimitCleanupMigration, /photo\.storage_path/);
  assert.match(photoLimitCleanupMigration, /photo\.thumbnail_storage_path/);
  assert.match(photoLimitCleanupMigration, /memo\.storage_path/);
  assert.match(photoLimitCleanupMigration, /on conflict \(storage_path\) do nothing/);
  assert.match(photoLimitCleanupMigration, /if deleted_count <> 1 then/);
  assert.match(databaseHarness, /seedPrelaunchPhotoLimitFixture\(\)/);
  assert.match(databaseHarness, /assertPrelaunchPhotoLimitFixtureCleanup\(\)/);
});
