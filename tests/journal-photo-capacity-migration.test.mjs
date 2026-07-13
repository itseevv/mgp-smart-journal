import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSource = readFileSync(
  new URL(
    "../supabase/migrations/202607130001_journal_year_photo_capacity.sql",
    import.meta.url,
  ),
  "utf8",
);

test("journal capacity migration aligns reads and writes to one year", () => {
  assert.match(
    migrationSource,
    /create or replace function public\.journal_photo_capacity\(\)/,
  );
  assert.match(migrationSource, /select 3285;/);
  assert.match(
    migrationSource,
    /other_photo_count \+ jsonb_array_length\(requested_photos\)\s*>\s*public\.journal_photo_capacity\(\)/,
  );
  assert.match(
    migrationSource,
    /'maxPhotos', public\.journal_photo_capacity\(\)/,
  );
  assert.match(
    migrationSource,
    /target_capsule\.product_type = 'journal'[\s\S]*jsonb_array_length\(requested_photos\) > 9/,
  );
  assert.match(migrationSource, /existing_photo_count integer/);
  assert.match(
    migrationSource,
    /jsonb_array_length\(requested_photos\) > existing_photo_count/,
  );
  assert.doesNotMatch(migrationSource, /'maxPhotos', 100/);
});
