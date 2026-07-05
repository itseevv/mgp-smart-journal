import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  JOURNAL_VOICE_MEMOS_ENABLED,
} from "../data/journal-product.ts";
import { getMemoryFormProductRules } from "../data/memory-form-product.ts";
import { createEmptyMemory } from "../data/memory-demo.ts";

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("journal form product rules use Scrap the Day constraints and copy", () => {
  const rules = getMemoryFormProductRules("journal");

  assert.equal(DAILY_MEMORY_STAMP_MAX_PHOTOS, 9);
  assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, false);
  assert.equal(rules.maxPhotosPerEntry, 9);
  assert.equal(rules.voiceMemosEnabled, false);
  assert.equal(rules.copy.newTitle, "New Daily Scrap");
  assert.equal(rules.copy.titleLabel, "One line to keep");
  assert.equal(rules.copy.titlePlaceholder, "What would you call today?");
  assert.equal(rules.copy.photoSectionTitle, "Moments");
  assert.equal(rules.copy.addEmptyPhotos, "Add moments");
  assert.equal(rules.copy.saveNew, "Seal this day");

  const journalCopy = JSON.stringify(rules.copy);
  assert.doesNotMatch(journalCopy, /New memory|Name this memory|Memory title|Photographs|Save memory|Voice memos|Record a voice memo|30 photos|0 of 30/i);
});

test("journal drafts carry semantic local date metadata", () => {
  const draft = createEmptyMemory("2026-05-08T12:00:00.000Z");

  assert.equal(draft.localDate, "2026-05-08");
  assert.ok("localTimezone" in draft);
});

test("journal route passes the journal product mode through to the form flow", () => {
  const journalPageSource = readSource("components/journal/journal-memory-page.tsx");
  const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const photoPickerSource = readSource("components/memory/photo-picker.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const memoryDemoRouteSource = readSource("app/memory/demo/page.tsx");
  const journalDemoPageSource = readSource("app/journal/demo/page.tsx");
  const capsulePageSource = readSource("components/capsule/capsule-page.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const stampFrameSource = readSource("components/stamp/stamp-frame.tsx");
  const journalStampsSource = readSource("data/journal-stamps.ts");
  const apiSource = readSource("lib/capsule/api.ts");
  const phase3MigrationSource = readSource(
    "supabase/migrations/202607040001_scrap_day_phase_3_local_date.sql",
  );

  assert.match(journalPageSource, /productMode="journal"/);
  assert.match(journalPageSource, /existingToday/);
  assert.match(journalPageSource, /Today is already sealed in this journal/);
  assert.match(journalPageSource, /Open today’s stamp/);
  assert.match(persistentFlowSource, /productMode === "journal"/);
  assert.match(persistentFlowSource, /journalStamps/);
  assert.match(persistentFlowSource, /findDuplicateStampForLocalDate/);
  assert.match(persistentFlowSource, /productRules\.maxPhotosPerEntry/);
  assert.match(persistentFlowSource, /productMode=\{productMode\}/);
  assert.match(memoryFormSource, /voiceMemosEnabled/);
  assert.match(memoryFormSource, /That day is already sealed in this journal/);
  assert.match(memoryFormSource, /Open that stamp instead/);
  assert.match(memoryFormSource, /duplicateStamp/);
  assert.match(journalStampsSource, /toLocalDateKeyFromDate/);
  assert.match(journalStampsSource, /findDuplicateStampForLocalDate/);
  assert.match(apiSource, /requested_local_date: workingDraft\.localDate/);
  assert.match(apiSource, /requested_local_timezone: workingDraft\.localTimezone/);
  assert.match(apiSource, /DUPLICATE_LOCAL_DATE/);
  assert.match(phase3MigrationSource, /add column if not exists local_date date/);
  assert.match(phase3MigrationSource, /add column if not exists local_timezone text/);
  assert.match(phase3MigrationSource, /memories_capsule_local_date_unique/);
  assert.match(phase3MigrationSource, /DUPLICATE_LOCAL_DATE/);
  assert.match(photoPickerSource, /maxPhotosPerEntry/);
  assert.match(journalDemoSource, /productMode="journal"/);
  assert.match(journalDemoSource, /maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS/);
  assert.match(journalDemoSource, /initialScreen\?: "home" \| "create" \| "crop" \| "sealed" \| "detail"/);
  assert.match(journalDemoSource, /scenario\?: "duplicate-today" \| "backfill-may"/);
  assert.match(journalDemoSource, /createBackfillDemoStamp/);
  assert.match(journalDemoSource, /journalStamps=\{summaries\}/);
  assert.match(journalDemoPageSource, /scenario === "duplicate-today"/);
  assert.match(journalDemoPageSource, /scenario === "backfill-may"/);
  assert.match(memoryDemoRouteSource, /redirect\("\/journal\/demo"\)/);
  assert.match(journalDemoPageSource, /JournalMobileShell/);
  assert.match(journalDemoPageSource, /screen === "crop"/);
  assert.match(journalDemoPageSource, /screen === "sealed"/);
  assert.match(capsulePageSource, /JournalMobileShell/);
  assert.match(journalPhotoPickerSource, /Cover Scrap/);
  assert.match(journalPhotoPickerSource, /Choose today&apos;s scrap/);
  assert.match(journalPhotoPickerSource, /One photo is enough to seal the day\./);
  assert.match(journalPhotoPickerSource, /onConfirmCrop/);
  assert.match(journalPhotoPickerSource, /Adjust scrap/);
  assert.match(journalPhotoPickerSource, /Add more moments \(optional\)/);
  assert.match(journalPhotoPickerSource, /Up to 8 more moments\./);
  assert.match(scrapTableSource, /Find today&apos;s scrap/);
  assert.match(scrapTableSource, /Move the photo under the finder\./);
  assert.match(scrapTableSource, /Use this scrap/);
  assert.match(scrapTableSource, /data-scrap-table-mode="immersive"/);
  assert.match(scrapTableSource, /data-finder-tool="physical-frame"/);
  assert.match(scrapTableSource, /data-scrap-aperture="stamp-window"/);
  assert.match(scrapTableSource, /StampFrame/);
  assert.match(scrapTableSource, /variant="lg"/);
  assert.match(scrapTableSource, /data-punch-feedback="enabled"/);
  assert.match(scrapTableSource, /data-scrap-photo-natural="true"/);
  assert.doesNotMatch(scrapTableSource, />\s*Scrap Table\s*</);
  assert.doesNotMatch(scrapTableSource, /Crop image|Edit photo|Aspect ratio|Template|Collage|desktop/);
  assert.doesNotMatch(journalPhotoPickerSource, /Press and drag to reorder|1 moment added|0 of 9 moments/);
  assert.match(journalPhotoPickerSource, /StampFrame/);
  assert.match(journalPhotoPickerSource, /variant="md"/);
  assert.match(journalPhotoPickerSource, /stampFramePreview/);
  assert.match(stampFrameSource, /export type StampFrameVariant = "lg" \| "md" \| "sm"/);
  assert.match(stampFrameSource, /export const StampFrame/);
  assert.match(stampFrameSource, /export const StampFrameButton/);
  assert.match(stampFrameSource, /data-stamp-edge="perforated"/);
  assert.match(stampFrameSource, /data-stamp-frame=\{variant\}/);
  assert.doesNotMatch(memoryFormSource, /showJournalSealingFields/);
  assert.match(memoryFormSource, /disabled=\{journalSaveDisabled \|\| isRecording \|\| isSaving\}/);
});

test("journal mobile surfaces remove placeholder branding", () => {
  const mobileShellSource = readSource("components/journal/journal-mobile-shell.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const stampTileSource = readSource("components/journal/stamp-tile.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const croppedStampImageSource = readSource("components/stamp/cropped-stamp-image.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const sortableGridSource = readSource("components/memory/sortable-photo-grid.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const stampFrameSource = readSource("components/stamp/stamp-frame.tsx");
  const globalCssSource = readSource("app/globals.css");

  assert.match(mobileShellSource, /data-journal-mobile-shell="true"/);
  assert.match(journalDemoSource, /initialScreen\?: "home" \| "create" \| "crop" \| "sealed" \| "detail"/);
  assert.match(stampDetailSource, /data-journal-stamp-detail="true"/);
  assert.match(stampDetailSource, /Back to month sheet/);
  assert.match(stampDetailSource, /onBackToMonthSheet/);
  assert.match(journalDemoSource, /onBackToMonthSheet/);
  assert.match(journalDemoSource, /createArchiveMonthStamps\("2026-08"/);
  assert.match(journalDemoSource, /Array\.from\(\{ length: 31 \}/);
  assert.match(monthlyStampSheetSource, /MonthSheetGrid/);
  assert.doesNotMatch(monthlyStampSheetSource, /journal-sheets-title/);
  assert.doesNotMatch(monthlyStampSheetSource, /archive\.stampedSheets/);
  assert.doesNotMatch(monthlyStampSheetSource, />\s*Sheets\s*</);
  assert.match(monthSheetGridSource, /MONTH_SHEET_COLUMNS/);
  assert.match(monthSheetGridSource, /MONTH_SHEET_ROWS/);
  assert.match(monthSheetGridSource, /MONTH_SHEET_CAPACITY/);
  assert.match(monthSheetGridSource, /data-month-sheet-grid="true"/);
  assert.match(monthSheetGridSource, /grid-cols-4/);
  assert.match(monthSheetGridSource, /variant\?: "app" \| "export"/);
  assert.match(stampTileSource, /data-month-sheet-day/);
  assert.match(stampTileSource, /data-month-sheet-position/);
  assert.match(stampTileSource, /CroppedStampImage/);
  assert.match(stampTileSource, /data-month-sheet-cover-crop/);
  assert.match(stampTileSource, /coverCropMetadata/);
  assert.doesNotMatch(stampTileSource, /<time|memoryLocalDateKey\(memory\)\}/);
  assert.doesNotMatch(stampDetailSource, />\s*SD\s*</);
  assert.match(stampGridSource, /getStampLayout/);
  assert.match(stampGridSource, /data-stamp-layout/);
  assert.match(stampGridSource, /buildStampFrameRows/);
  assert.match(stampGridSource, /data-stamp-row-sizes/);
  assert.match(stampGridSource, /data-stamp-frame-ratio/);
  assert.match(stampGridSource, /data-stamp-cover-crop/);
  assert.match(stampGridSource, /StampFrameButton/);
  assert.match(stampGridSource, /variant="sm"/);
  assert.match(stampGridSource, /CroppedPrivateStampImage/);
  assert.match(stampGridSource, /PhotoViewer/);
  assert.match(croppedStampImageSource, /cropMetadataToImageStyle/);
  assert.match(croppedStampImageSource, /centerSquareCropMetadata/);
  assert.match(croppedStampImageSource, /PrivatePhoto/);
  assert.match(croppedStampImageSource, /data-stamp-cropped-image/);
  assert.match(croppedStampImageSource, /object-cover/);
  assert.doesNotMatch(stampGridSource, /StampFiller|data-stamp-filler-count|object-contain/);
  assert.match(journalPhotoPickerSource, /object-cover/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-preview="stamp-frame"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-crop/);
  assert.doesNotMatch(journalPhotoPickerSource, /aspect-\[4\/5\]|object-contain|preserveAspectRatio/);
  assert.match(sortableGridSource, /stampFramePreview/);
  assert.match(sortableGridSource, /object-cover/);
  assert.match(sortableGridSource, /StampFrame/);
  assert.match(sortableGridSource, /data-photo-preview-fit/);
  assert.match(sortableGridSource, /variant="sm"/);
  assert.match(stampFrameSource, /stampFrameClassName/);
  assert.match(stampFrameSource, /stamp-frame--lg/);
  assert.match(stampFrameSource, /stamp-frame--md/);
  assert.match(stampFrameSource, /stamp-frame--sm/);
  assert.match(globalCssSource, /\.stamp-frame::before/);
  assert.match(globalCssSource, /--stamp-rim-width/);
  assert.match(globalCssSource, /--stamp-rim-color/);
  assert.match(globalCssSource, /--stamp-inner-contrast/);
  assert.match(globalCssSource, /--stamp-cutout-shadow/);
  assert.match(globalCssSource, /\.stamp-frame--lg\s*\{[\s\S]*--stamp-rim-width: 10px/);
  assert.match(globalCssSource, /\.stamp-frame--md\s*\{[\s\S]*--stamp-rim-width: 7px/);
  assert.match(globalCssSource, /\.stamp-frame--sm\s*\{[\s\S]*--stamp-rim-width: 4px/);
  assert.match(globalCssSource, /\.stamp-frame--sm\s*\{[\s\S]*--stamp-edge-opacity: 0\.92/);
  assert.match(photoViewerSource, /object-contain/);
  assert.doesNotMatch(photoViewerSource, /object-cover/);
});

test("journal cover crop metadata persists through app and database layers", () => {
  const memoryDemoSource = readSource("data/memory-demo.ts");
  const apiSource = readSource("lib/capsule/api.ts");
  const migrationSource = readSource(
    "supabase/migrations/202607030001_scrap_day_phase_2_cover_crop.sql",
  );
  const phase42MigrationSource = readSource(
    "supabase/migrations/202607050001_scrap_day_phase_4_2_month_sheet_cover_crop.sql",
  );

  assert.match(memoryDemoSource, /export type PhotoCropMetadata/);
  assert.match(memoryDemoSource, /cropMetadata\?: PhotoCropMetadata/);
  assert.match(apiSource, /cropMetadata: parsePhotoCropMetadata/);
  assert.match(apiSource, /cropMetadata: photo\.cropMetadata \?\? null/);
  assert.match(apiSource, /coverCropMetadata: parsePhotoCropMetadata/);
  assert.match(migrationSource, /add column if not exists crop_metadata jsonb/);
  assert.match(migrationSource, /crop_metadata = item\.crop_metadata/);
  assert.match(migrationSource, /value->'cropMetadata' crop_metadata/);
  assert.match(migrationSource, /item->'cropMetadata'/);
  assert.match(phase42MigrationSource, /'coverCropMetadata', first_photo\.crop_metadata/);
  assert.match(phase42MigrationSource, /'firstPhotoStoragePath', first_photo\.storage_path/);
});
