import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the launch forward migration removes whole-Journal photo admission", () => {
  const historical = readSource(
    "supabase/migrations/202607130001_journal_year_photo_capacity.sql",
  );
  const launch = readSource(
    "supabase/migrations/202608140001_archive_storage_admission_and_remove_lifecycle.sql",
  );
  assert.match(historical, /select 3285;/);
  assert.match(historical, /journal_photo_capacity/);
  assert.match(launch, /JOURNAL_STORAGE_LIMIT/);
  assert.match(launch, /jsonb_array_length\(requested_photos\) > 9/);
  assert.doesNotMatch(launch, /JOURNAL_YEAR_PHOTO_CAPACITY|other_photo_count|journal_photo_capacity\(\)/);
});
