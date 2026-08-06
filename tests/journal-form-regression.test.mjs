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
  assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, true);
  assert.equal(rules.maxPhotosPerEntry, 9);
  assert.equal(rules.voiceMemosEnabled, true);
  assert.equal(rules.copy.newTitle, "New Memory Stamp");
  assert.equal(rules.copy.editTitle, "Edit Memory Stamp");
  assert.equal(rules.copy.editAriaLabel, "Edit Memory Stamp");
  assert.equal(rules.copy.titleLabel, "One line to keep");
  assert.equal(rules.copy.titlePlaceholder, "What would you call today?");
  assert.equal(rules.copy.photoSectionTitle, "Moments");
  assert.equal(rules.copy.addEmptyPhotos, "Add moments");
  assert.equal(rules.copy.saveNew, "Seal this day");
  assert.equal(rules.copy.saveEdit, "Save changes");

  const journalCopy = JSON.stringify(rules.copy);
  assert.doesNotMatch(
    journalCopy,
    /"newTitle":"New memory"|New Daily Scrap|Edit stamp|Save stamp|Name this memory|Memory title|Photographs|Save memory|Voice memos|Record a voice memo|30 photos|0 of 30/i,
  );
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
  const voiceRecorderSource = readSource("components/memory/voice-recorder.tsx");
  const journalVoiceNotePlayerSource = readSource(
    "components/memory/journal-voice-note-player.tsx",
  );
  const dailyMemoryStampSource = readSource(
    "components/stamp/daily-memory-stamp.tsx",
  );
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
  assert.match(memoryFormSource, /journalMode=\{isJournalProduct\}/);
  assert.match(memoryFormSource, /onConfirmationChange/);
  assert.match(
    memoryFormSource,
    /if \(isJournalProduct && !isVoiceNoteConfirmed\) return;/,
  );
  assert.match(voiceRecorderSource, /A whisper from today/);
  assert.match(
    voiceRecorderSource,
    /Let today linger in your voice before it is sealed\./,
  );
  assert.match(voiceRecorderSource, /aria-expanded=\{journalOpen\}/);
  assert.match(voiceRecorderSource, /<small>Optional<\/small>/);
  assert.match(
    voiceRecorderSource,
    /<PlusIcon[\s\S]*journalOpen \? "rotate-45" : ""/,
  );
  assert.doesNotMatch(voiceRecorderSource, /journal-voice-note-disclosure__icon/);
  assert.match(voiceRecorderSource, /journal-voice-note-recording__times/);
  assert.doesNotMatch(voiceRecorderSource, /type="file"/);
  assert.match(journalVoiceNotePlayerSource, />\s*Remove\s*</);
  assert.match(journalVoiceNotePlayerSource, />\s*Save\s*</);
  assert.doesNotMatch(journalVoiceNotePlayerSource, /Record again/);
  assert.match(dailyMemoryStampSource, /journal-daily-voice-note/);
  assert.match(dailyMemoryStampSource, /resolveVoiceMemoUrl/);
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
  assert.match(
    journalPhotoPickerSource,
    /aria-label="Choose today’s Cover Scrap"/,
  );
  assert.match(journalPhotoPickerSource, />\s*Choose today’s Cover Scrap/);
  assert.doesNotMatch(journalPhotoPickerSource, /Choose today&apos;s scrap/);
  assert.match(journalPhotoPickerSource, /One photo is enough to seal the day\./);
  assert.match(journalPhotoPickerSource, /onConfirmCrop/);
  assert.match(journalPhotoPickerSource, /Adjust scrap/);
  assert.match(
    journalPhotoPickerSource,
    /journal-optional-section-label[\s\S]*<span>Add more moments<\/span>[\s\S]*<small>Optional<\/small>/,
  );
  assert.doesNotMatch(journalPhotoPickerSource, /Add more moments \(optional\)/);
  assert.match(
    journalPhotoPickerSource,
    /Add up to \{additionalCapacity\.remaining\} more/,
  );
  assert.match(scrapTableSource, /Find Your Cover Scrap/);
  assert.doesNotMatch(scrapTableSource, /Find today&apos;s scrap/);
  assert.match(scrapTableSource, /Move the photo under the finder\./);
  assert.match(scrapTableSource, /Use this scrap/);
  assert.match(scrapTableSource, /data-scrap-table-mode="immersive"/);
  assert.match(scrapTableSource, /data-finder-tool="editorial-finder"/);
  assert.match(scrapTableSource, /data-scrap-aperture="finder-window"/);
  assert.match(scrapTableSource, /JournalPrimaryCTA/);
  assert.match(scrapTableSource, /data-scrap-primary-action="use-this-scrap"/);
  assert.match(scrapTableSource, /data-punch-feedback="enabled"/);
  assert.match(scrapTableSource, /data-scrap-photo-natural="true"/);
  assert.doesNotMatch(scrapTableSource, />\s*Scrap Table\s*</);
  assert.doesNotMatch(scrapTableSource, /Crop image|Edit photo|Aspect ratio|Template|Collage|desktop/);
  assert.doesNotMatch(journalPhotoPickerSource, /Press and drag to reorder|1 moment added|0 of 9 moments/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-preview="editorial-photo"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
  assert.match(journalPhotoPickerSource, /stampFramePreview/);
  assert.match(stampFrameSource, /export type StampFrameVariant = "lg" \| "md" \| "sm"/);
  assert.match(stampFrameSource, /export const StampFrame/);
  assert.match(stampFrameSource, /export const StampFrameButton/);
  assert.match(stampFrameSource, /data-stamp-edge="perforated"/);
  assert.match(stampFrameSource, /data-stamp-frame=\{variant\}/);
  assert.doesNotMatch(memoryFormSource, /showJournalSealingFields/);
  assert.match(
    memoryFormSource,
    /disabled=\{\s*journalSaveDisabled \|\|\s*isPreparingPhotos \|\|\s*isRecording \|\|\s*isSaving\s*\}/,
  );
});

test("final journal titles use platform-native emoji without changing export emoji assets", () => {
  const emojiTextSource = readSource(
    "components/stamp/daily-stamp-emoji-text.tsx",
  );

  assert.match(emojiTextSource, /dailyStampTextParts/);
  assert.match(emojiTextSource, /Apple Color Emoji/);
  assert.match(emojiTextSource, /Segoe UI Emoji/);
  assert.match(emojiTextSource, /Noto Color Emoji/);
  assert.match(emojiTextSource, /data-native-emoji="true"/);
  assert.match(emojiTextSource, /\{part\.text\}/);
  assert.doesNotMatch(
    emojiTextSource,
    /dailyStampEmojiAssetUrl|backgroundImage|\/api\/export\/daily-stamp/,
  );
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
  assert.match(monthlyStampSheetSource, /No stamps yet\./);
  assert.doesNotMatch(monthlyStampSheetSource, /No scraps yet\./);
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
  assert.match(stampGridSource, /gridColumns\(visiblePhotos\.length\)/);
  assert.match(stampGridSource, /data-stamp-grid-columns=\{columns\}/);
  assert.match(stampGridSource, /data-stamp-row-sizes/);
  assert.match(stampGridSource, /data-stamp-frame-ratio/);
  assert.match(stampGridSource, /data-stamp-cover-crop/);
  assert.match(stampGridSource, /CroppedPrivateStampImage/);
  assert.match(
    stampGridSource,
    /<CroppedPrivateStampImage[\s\S]*?variant="display"/,
  );
  assert.match(stampGridSource, /PrivatePhoto/);
  assert.match(stampGridSource, /<PrivatePhoto[\s\S]*?variant="thumbnail"/);
  assert.match(stampGridSource, /PhotoViewer/);
  assert.match(croppedStampImageSource, /cropMetadataToImageStyle/);
  assert.match(croppedStampImageSource, /centerSquareCropMetadata/);
  assert.match(croppedStampImageSource, /PrivatePhoto/);
  assert.match(croppedStampImageSource, /data-stamp-cropped-image/);
  assert.match(croppedStampImageSource, /object-cover/);
  assert.doesNotMatch(stampGridSource, /StampFiller|data-stamp-filler-count|object-contain/);
  assert.match(journalPhotoPickerSource, /object-cover/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-preview="editorial-photo"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-crop/);
  assert.doesNotMatch(journalPhotoPickerSource, /aspect-\[4\/5\]|object-contain|preserveAspectRatio/);
  assert.match(sortableGridSource, /stampFramePreview/);
  assert.match(sortableGridSource, /object-cover/);
  assert.match(sortableGridSource, /data-photo-preview-frame="borderless-editorial"/);
  assert.match(sortableGridSource, /data-photo-preview-fit/);
  assert.match(sortableGridSource, /data-photo-preview-fit="editorial-square"/);
  assert.match(stampFrameSource, /stampFrameClassName/);
  assert.match(stampFrameSource, /stamp-frame--lg/);
  assert.match(stampFrameSource, /stamp-frame--md/);
  assert.match(stampFrameSource, /stamp-frame--sm/);
  assert.match(globalCssSource, /\.stamp-frame::before/);
  assert.match(
    globalCssSource,
    /\[data-journal-theme="blush"\] \.daily-detail-content-surface/,
  );
  assert.match(
    globalCssSource,
    /\[data-journal-theme="blush"\] \.journal-daily-voice-note \.journal-voice-note-card/,
  );
  assert.doesNotMatch(
    globalCssSource,
    /\[data-journal-theme="blush"\] \.journal-daily-voice-note \.journal-voice-note-waveform/,
  );
  assert.doesNotMatch(
    globalCssSource,
    /\[data-journal-theme="blush"\] \.journal-daily-voice-note \.journal-voice-note-card__duration/,
  );
  assert.match(globalCssSource, /--stamp-rim-width/);
  assert.match(globalCssSource, /--stamp-rim-color/);
  assert.match(globalCssSource, /--stamp-inner-contrast/);
  assert.match(
    globalCssSource,
    /@media \(min-width: 640px\)[\s\S]*\.journal-create-edit-form\s*\{\s*flex-shrink: 0;/,
  );
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

test("journal settings menu uses a compact, theme-aware action surface", () => {
  const globalCssSource = readSource("app/globals.css");
  const headerSource = readSource(
    "components/journal/journal-identity-header.tsx",
  );

  assert.match(headerSource, /data-journal-settings-menu-treatment="compact-theme-aware"/);
  assert.match(headerSource, /data-journal-settings-menu-item="rename"/);
  assert.match(headerSource, /data-journal-settings-menu-item="lock"/);
  assert.match(headerSource, /aria-controls=\{settingsMenuId\}/);
  assert.match(headerSource, /aria-labelledby=\{settingsTriggerId\}/);
  assert.match(headerSource, /settingsMenuRef/);
  assert.match(headerSource, /settingsRootRef/);
  assert.match(headerSource, /event\.key !== "Escape"/);
  assert.match(headerSource, /event\.key !== "ArrowDown"/);
  assert.match(headerSource, /event\.key !== "ArrowUp"/);
  assert.match(headerSource, /event\.key !== "Home"/);
  assert.match(headerSource, /event\.key !== "End"/);
  assert.match(globalCssSource, /\.journal-identity-header__settings-menu\s*\{/);
  assert.match(globalCssSource, /var\(--journal-paper\) 96%/);
  assert.match(globalCssSource, /max-width: calc\(100vw - 1\.5rem\)/);
  assert.match(globalCssSource, /\.journal-identity-header__settings-menu-item--lock:only-child/);
  assert.match(globalCssSource, /\.journal-identity-header__settings-menu-item:focus-visible/);
});
