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

function cssRuleBody(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

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
  const sortableGridSource = readSource("components/memory/sortable-photo-grid.tsx");
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
  assert.match(journalPhotoPickerSource, /dailyStampAdditionalMomentCapacity/);
  assert.match(journalPhotoPickerSource, /Add up to \{additionalCapacity\.remaining\}/);
  assert.match(journalPhotoPickerSource, /createPortal/);
  assert.match(journalPhotoPickerSource, /document\.body/);
  assert.match(journalPhotoPickerSource, /data-scrap-finder-portal="body-overlay"/);
  assert.doesNotMatch(journalPhotoPickerSource, /return\s*\(\s*<ScrapTable/);
  assert.match(scrapTableSource, /Find today&apos;s scrap/);
  assert.match(scrapTableSource, /Move the photo under the finder\./);
  assert.match(scrapTableSource, /Use this scrap/);
  assert.match(scrapTableSource, /data-scrap-table-mode="immersive"/);
  assert.match(scrapTableSource, /data-scrap-table-presentation="dedicated-screen"/);
  assert.match(scrapTableSource, /scrap-table-overlay/);
  assert.match(scrapTableSource, /scrap-table-screen/);
  assert.match(scrapTableSource, /data-scrap-table-screen="mobile-standalone"/);
  assert.match(scrapTableSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(scrapTableSource, /data-finder-tool="editorial-finder"/);
  assert.match(scrapTableSource, /data-scrap-aperture="finder-window"/);
  assert.match(scrapTableSource, /scrap-finder-surface/);
  assert.match(scrapTableSource, /journalThemeStyle\(theme\)/);
  assert.match(scrapTableSource, /theme\?: JournalTheme/);
  assert.match(scrapTableSource, /data-punch-feedback="enabled"/);
  assert.match(scrapTableSource, /data-scrap-photo-natural="true"/);
  assert.doesNotMatch(scrapTableSource, /StampFrame/);
  assert.doesNotMatch(scrapTableSource, /variant="lg"/);
  assert.doesNotMatch(scrapTableSource, /physical-frame|stamp-window/);
  assert.doesNotMatch(scrapTableSource, /#b9cdd1|#8ca9af|#d3e0e2|#16201f|#d8c28d/);
  assert.doesNotMatch(scrapTableSource, /photoSizeLabel/);
  assert.doesNotMatch(scrapTableSource, />\s*Scrap Table\s*</);
  assert.doesNotMatch(scrapTableSource, /Crop image|Edit photo|Aspect ratio|Template|Collage|desktop/);
  assert.match(memoryFormSource, /theme\?: JournalTheme/);
  assert.match(memoryFormSource, /theme=\{theme\}/);
  assert.match(memoryFormSource, /journal-create-edit-form/);
  assert.match(memoryFormSource, /data-journal-create-edit-form=\{[\s\S]*"translucent-form-overlay"/);
  assert.match(memoryFormSource, /data-journal-create-edit-actions="in-flow-form-footer"/);
  assert.match(memoryFormSource, /data-journal-date-value="paper-text"/);
  assert.match(memoryFormSource, /text-\[var\(--journal-paper-text\)\]/);
  assert.match(memoryFormSource, /text-\[var\(--journal-paper-muted-text\)\]/);
  assert.match(journalPhotoPickerSource, /theme\?: JournalTheme/);
  assert.match(journalPhotoPickerSource, /theme=\{theme\}/);
  assert.doesNotMatch(journalPhotoPickerSource, /Press and drag to reorder|1 moment added|0 of 9 moments/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-preview="editorial-photo"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
  assert.match(journalPhotoPickerSource, /journal-cover-photo-preview/);
  assert.doesNotMatch(journalPhotoPickerSource, /editorial-photo-frame/);
  assert.doesNotMatch(journalPhotoPickerSource, /StampFrame/);
  assert.doesNotMatch(journalPhotoPickerSource, /variant="md"/);
  assert.match(journalPhotoPickerSource, /stampFramePreview/);
  assert.match(sortableGridSource, /journal-moment-photo-preview/);
  assert.match(sortableGridSource, /data-photo-preview-frame="borderless-editorial"/);
  assert.doesNotMatch(sortableGridSource, /editorial-photo-frame/);
  assert.doesNotMatch(sortableGridSource, /StampFrame/);
  assert.doesNotMatch(sortableGridSource, /variant="sm"/);
  assert.match(stampFrameSource, /export type StampFrameVariant = "lg" \| "md" \| "sm"/);
  assert.match(stampFrameSource, /export const StampFrame/);
  assert.match(stampFrameSource, /export const StampFrameButton/);
  assert.match(stampFrameSource, /data-stamp-edge="perforated"/);
  assert.match(stampFrameSource, /data-stamp-frame=\{variant\}/);
  assert.doesNotMatch(memoryFormSource, /showJournalSealingFields/);
  assert.match(memoryFormSource, /const \[isPreparingPhotos, setIsPreparingPhotos\]/);
  assert.match(memoryFormSource, /onPreparingChange=\{setIsPreparingPhotos\}/);
  assert.match(memoryFormSource, /journalSaveDisabled \|\|[\s\S]*isPreparingPhotos/);
  assert.match(journalPhotoPickerSource, /onPreparingChange\?\.\(true\)/);
  assert.match(journalPhotoPickerSource, /onPreparingChange\?\.\(false\)/);
});

test("journal mobile surfaces remove placeholder branding", () => {
  const mobileShellSource = readSource("components/journal/journal-mobile-shell.tsx");
  const journalIdentityHeaderSource = readSource("components/journal/journal-identity-header.tsx");
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalDemoPageSource = readSource("app/journal/demo/page.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthTileSource = readSource("components/journal/month-tile.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const croppedStampImageSource = readSource("components/stamp/cropped-stamp-image.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const sortableGridSource = readSource("components/memory/sortable-photo-grid.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const stampFrameSource = readSource("components/stamp/stamp-frame.tsx");
  const globalCssSource = readSource("app/globals.css");

  assert.match(mobileShellSource, /data-journal-mobile-shell="true"/);
  assert.match(mobileShellSource, /journal-mobile-shell__content/);
  assert.match(globalCssSource, /\.journal-mobile-shell\s*\{[\s\S]*overflow-y: auto/);
  assert.match(globalCssSource, /\.journal-mobile-shell\s*\{[\s\S]*scrollbar-gutter: stable/);
  assert.match(globalCssSource, /\.journal-mobile-shell__content\s*\{/);
  assert.match(globalCssSource, /\.journal-memory-flow-surface\s*\{[\s\S]*overflow: visible/);
  assert.match(globalCssSource, /\.journal-create-edit-form\s*\{[\s\S]*overflow: hidden/);
  assert.match(globalCssSource, /\.journal-create-edit-form\s+form\s*\{[\s\S]*padding-bottom: calc/);
  assert.match(globalCssSource, /\.scrap-table-overlay\s*\{/);
  assert.match(globalCssSource, /\.scrap-table-screen\s*\{[\s\S]*width: min\(100%, 30rem\)/);
  assert.match(globalCssSource, /@media \(min-width: 640px\) \{[\s\S]*\.scrap-table-screen\s*\{[\s\S]*53\.333rem/);
  assert.match(journalIdentityHeaderSource, /data-journal-settings-trigger="true"/);
  assert.match(journalIdentityHeaderSource, /data-journal-settings-menu="true"/);
  assert.match(journalIdentityHeaderSource, /aria-label="Journal settings"/);
  assert.doesNotMatch(journalIdentityHeaderSource, /uppercase tracking-\[[^\n]+>\s*Journal\s*</);
  assert.doesNotMatch(journalIdentityHeaderSource, /mt-1\.5 flex gap-3[\s\S]*Rename[\s\S]*Lock/);
  assert.match(journalHomeSource, /JournalIdentityHeader/);
  assert.match(journalDemoSource, /initialScreen\?: "home" \| "create" \| "crop" \| "sealed" \| "detail"/);
  assert.match(stampDetailSource, /data-journal-stamp-detail="true"/);
  assert.match(stampDetailSource, /data-phase-7r4-detail="daily-detail-production"/);
  assert.match(stampDetailSource, /journal-leather-surface/);
  assert.match(stampDetailSource, /journalThemeStyle\(theme\)/);
  assert.match(stampDetailSource, /Back to month sheet/);
  assert.match(stampDetailSource, /onBackToMonthSheet/);
  assert.match(stampDetailSource, /data-daily-detail-surface="sheer-overlay"/);
  assert.match(stampDetailSource, /daily-detail-date/);
  assert.match(stampDetailSource, /daily-detail-title/);
  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.doesNotMatch(stampDetailSource, /Saved in this journal\./);
  assert.doesNotMatch(stampDetailSource, /PaperPanel/);
  assert.doesNotMatch(stampDetailSource, /Private by nature/);
  assert.match(persistentFlowSource, /journal-leather-surface/);
  assert.match(persistentFlowSource, /journal-memory-flow-surface/);
  assert.match(persistentFlowSource, /data-journal-memory-flow=\{isJournalMode \? "themed-leather" : undefined\}/);
  assert.match(journalDemoPageSource, /className="journal-themed-background"/);
  assert.match(journalDemoPageSource, /journalThemeStyle\(defaultJournalTheme\)/);
  assert.match(journalDemoSource, /onBackToMonthSheet/);
  assert.match(journalDemoSource, /JournalIdentityHeader/);
  assert.match(journalDemoSource, /theme=\{defaultJournalTheme\}/);
  assert.match(journalDemoSource, /createArchiveMonthStamps\("2026-08"/);
  assert.match(journalDemoSource, /Array\.from\(\{ length: 31 \}/);
  assert.match(monthlyStampSheetSource, /MonthSheetGrid/);
  assert.match(monthlyStampSheetSource, /JournalStageOverlay/);
  assert.doesNotMatch(monthlyStampSheetSource, /PaperPanel/);
  assert.doesNotMatch(monthlyStampSheetSource, /journal-sheets-title/);
  assert.doesNotMatch(monthlyStampSheetSource, /archive\.stampedSheets/);
  assert.doesNotMatch(monthlyStampSheetSource, />\s*Sheets\s*</);
  assert.doesNotMatch(monthlyStampSheetSource, /days sealed/);
  assert.doesNotMatch(monthlyStampSheetSource, /Seal Today/);
  assert.match(monthSheetGridSource, /MONTH_SHEET_COLUMNS/);
  assert.match(monthSheetGridSource, /MONTH_SHEET_ROWS/);
  assert.match(monthSheetGridSource, /MONTH_SHEET_CAPACITY/);
  assert.match(monthSheetGridSource, /data-month-sheet-grid="true"/);
  assert.match(monthSheetGridSource, /data-month-sheet-app-columns/);
  assert.match(monthSheetGridSource, /grid-cols-3/);
  assert.match(monthSheetGridSource, /grid-cols-4/);
  assert.match(monthSheetGridSource, /MonthTile/);
  assert.doesNotMatch(monthSheetGridSource, /StampTile/);
  assert.doesNotMatch(monthSheetGridSource, /Array\.from\(\{ length: MONTH_SHEET_CAPACITY \}/);
  assert.match(monthSheetGridSource, /variant\?: "app" \| "export"/);
  assert.match(monthTileSource, /data-month-sheet-day/);
  assert.match(monthTileSource, /data-month-sheet-position/);
  assert.match(monthTileSource, /data-month-sheet-date-placement="photo"/);
  assert.match(monthTileSource, /data-month-sheet-date-marker="photo-text"/);
  assert.doesNotMatch(monthTileSource, /data-month-sheet-date-caption/);
  assert.match(monthTileSource, /CroppedStampImage/);
  assert.match(monthTileSource, /data-month-sheet-cover-crop/);
  assert.match(monthTileSource, /coverCropMetadata/);
  assert.match(monthTileSource, /month-sheet-photo-tile/);
  assert.match(monthTileSource, /data-month-sheet-photo-treatment="clean-cover-scrap"/);
  assert.match(monthTileSource, /data-month-sheet-photo-fallback="theme-fill"/);
  assert.doesNotMatch(monthTileSource, /border-|ring-|outline-|shadow-/);
  assert.doesNotMatch(monthTileSource, /editorial-photo-frame/);
  assert.doesNotMatch(monthTileSource, /StampFrame/);
  assert.doesNotMatch(monthTileSource, /data-stamp-edge/);
  assert.match(bottomRitualActionSource, /data-journal-home-bottom-cta="seal-the-day"/);
  assert.match(bottomRitualActionSource, /data-seal-today-treatment="bottom-sticky"/);
  assert.doesNotMatch(stampDetailSource, />\s*SD\s*</);
  assert.match(stampGridSource, /getStampLayout/);
  assert.match(stampGridSource, /data-stamp-layout/);
  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
  assert.match(stampGridSource, /data-stamp-app-grid="daily-detail-photo-grid"/);
  assert.match(stampGridSource, /data-stamp-grid-columns/);
  assert.match(stampGridSource, /gridColumns/);
  assert.match(stampGridSource, /grid-cols-1/);
  assert.match(stampGridSource, /grid-cols-2/);
  assert.match(stampGridSource, /grid-cols-3/);
  assert.match(stampGridSource, /data-stamp-frame-ratio/);
  assert.match(stampGridSource, /data-daily-detail-photo-ratio/);
  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.match(stampGridSource, /data-daily-detail-photo-fit="cover"/);
  assert.match(stampGridSource, /data-stamp-cover-crop/);
  assert.match(stampGridSource, /CroppedPrivateStampImage/);
  assert.match(stampGridSource, /PhotoViewer/);
  assert.equal(
    (stampGridSource.match(/variant="thumbnail"/g) ?? []).length,
    2,
    "detail tiles should use memory-safe thumbnails while the viewer and export resolve display images",
  );
  assert.doesNotMatch(stampGridSource, /buildStampFrameRows/);
  assert.doesNotMatch(stampGridSource, /StampFrameButton/);
  assert.doesNotMatch(stampGridSource, /variant="sm"/);
  assert.doesNotMatch(stampGridSource, /data-stamp-edge/);
  assert.doesNotMatch(stampGridSource, /editorial-photo-frame/);
  assert.doesNotMatch(stampGridSource, /data-stamp-photo-frame/);
  assert.doesNotMatch(stampGridSource, /data-stamp-frame-fit/);
  assert.doesNotMatch(stampGridSource, /border-|ring-|outline-|shadow-/);
  assert.match(croppedStampImageSource, /cropMetadataToImageStyle/);
  assert.match(croppedStampImageSource, /centerSquareCropMetadata/);
  assert.match(croppedStampImageSource, /PrivatePhoto/);
  assert.match(croppedStampImageSource, /data-stamp-cropped-image/);
  assert.match(croppedStampImageSource, /object-cover/);
  assert.doesNotMatch(stampGridSource, /StampFiller|data-stamp-filler-count|object-contain/);
  assert.match(journalPhotoPickerSource, /object-cover/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-preview="editorial-photo"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
  assert.match(journalPhotoPickerSource, /data-journal-cover-crop/);
  assert.match(journalPhotoPickerSource, /journal-cover-photo-preview/);
  assert.doesNotMatch(journalPhotoPickerSource, /editorial-photo-frame/);
  assert.doesNotMatch(journalPhotoPickerSource, /data-journal-cover-preview="stamp-frame"/);
  assert.doesNotMatch(journalPhotoPickerSource, /StampFrame/);
  assert.doesNotMatch(journalPhotoPickerSource, /aspect-\[4\/5\]|object-contain|preserveAspectRatio/);
  assert.match(sortableGridSource, /stampFramePreview/);
  assert.match(sortableGridSource, /object-cover/);
  assert.match(sortableGridSource, /journal-moment-photo-preview/);
  assert.match(sortableGridSource, /data-photo-preview-fit="editorial-square"/);
  assert.match(sortableGridSource, /data-photo-preview-frame="borderless-editorial"/);
  assert.doesNotMatch(sortableGridSource, /editorial-photo-frame/);
  assert.doesNotMatch(sortableGridSource, /StampFrame/);
  assert.doesNotMatch(sortableGridSource, /variant="sm"/);
  assert.match(globalCssSource, /\.editorial-paper-panel\s*\{/);
  assert.match(globalCssSource, /--journal-soft-shadow/);
  assert.match(globalCssSource, /backdrop-filter: blur\(1px\)/);
  assert.match(globalCssSource, /\.daily-detail-content-surface\s*\{/);
  assert.match(globalCssSource, /\.daily-detail-photo-tile\s*\{/);
  assert.match(globalCssSource, /\.daily-detail-photo-tile:focus-visible\s*\{/);
  const dailyDetailSurfaceCss = cssRuleBody(globalCssSource, ".daily-detail-content-surface");
  assert.match(dailyDetailSurfaceCss, /background-color: var\(--journal-home-overlay\)/);
  assert.match(dailyDetailSurfaceCss, /background-image: var\(--journal-home-overlay-gradient\)/);
  assert.match(dailyDetailSurfaceCss, /border: 0/);
  assert.match(dailyDetailSurfaceCss, /box-shadow: none/);
  const dailyDetailTileCss = cssRuleBody(globalCssSource, ".daily-detail-photo-tile");
  assert.match(dailyDetailTileCss, /border: 0/);
  assert.match(dailyDetailTileCss, /box-shadow: none/);
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
  assert.match(photoViewerSource, /createPortal/);
  assert.match(photoViewerSource, /document\.body/);
  assert.match(photoViewerSource, /data-photo-viewer-overlay="fullscreen-viewport"/);
  assert.match(photoViewerSource, /data-photo-viewer-portal="document-body"/);
  assert.match(photoViewerSource, /data-photo-viewer-image="original-display"/);
  assert.match(photoViewerSource, /data-photo-viewer-caption="simple-label"/);
  assert.doesNotMatch(photoViewerSource, /object-cover/);
});

test("phase 7R.3 locks the selected Month Sheet production contract", () => {
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const selectionSource = readSource(
    "SCRAP_DAY_PHASE_7R_2_DIRECTION_SELECTION.md",
  );
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_3_MONTH_SHEET_PRODUCTION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const monthTileSource = readSource("components/journal/month-tile.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const journalIdentityHeaderSource = readSource(
    "components/journal/journal-identity-header.tsx",
  );
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalDemoPageSource = readSource("app/journal/demo/page.tsx");
  const capsulePageSource = readSource("components/capsule/capsule-page.tsx");
  const journalStampsSource = readSource("data/journal-stamps.ts");

  assert.match(explorationSource, /## Product Owner Selection/);
  assert.match(explorationSource, /bottom sticky CTA version/);
  assert.match(explorationSource, /Header logo was considered and rejected/);
  assert.match(explorationSource, /quiet serif identity/);
  assert.match(selectionSource, /Selected direction: Direction B — Tactile Journal Insert/);
  assert.match(selectionSource, /Production Implementation Scope/);
  assert.match(implementationSource, /Selected Month Sheet Visual Direction In Production/);
  assert.match(implementationSource, /Bottom sticky "Seal Today" CTA/);
  assert.match(implementationSource, /Daily Memory Stamp Detail/);
  assert.match(implementationSource, /Phase 7\.2 Daily Export Redesign/);

  assert.match(monthlyStampSheetSource, /data-month-sheet-surface="direction-b-tactile-insert"/);
  assert.match(monthlyStampSheetSource, /data-phase-7r3-direction="direction-b"/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-label="none"/);
  assert.match(monthlyStampSheetSource, /month-sheet-tactile-insert/);
  assert.match(monthlyStampSheetSource, /MonthSheetGrid/);
  assert.doesNotMatch(monthlyStampSheetSource, />\s*Month Sheet\s*</);
  assert.doesNotMatch(monthlyStampSheetSource, /days sealed/);
  assert.doesNotMatch(monthlyStampSheetSource, /Today is already sealed\. You can revisit/);

  assert.match(monthSheetGridSource, /grid-cols-3/);
  assert.match(monthSheetGridSource, /APP_MONTH_SHEET_COLUMNS = 3/);
  assert.match(monthSheetGridSource, /data-month-sheet-app-columns/);
  assert.match(monthSheetGridSource, /data-month-sheet-renders="sealed-days-only"/);
  assert.doesNotMatch(monthSheetGridSource, /Array\.from\(\{ length: MONTH_SHEET_CAPACITY \}/);
  assert.doesNotMatch(monthSheetGridSource, /placeholder|future slot/i);
  assert.doesNotMatch(monthSheetGridSource, /filter|firstPhotoStoragePath|thumbnailUrls\[.*includes|placeholder/i);

  assert.match(monthTileSource, /month-sheet-photo-tile/);
  assert.match(monthTileSource, /data-month-sheet-date-placement="photo"/);
  assert.match(monthTileSource, /data-month-sheet-date-marker="photo-text"/);
  assert.match(monthTileSource, /CroppedStampImage/);
  assert.match(monthTileSource, /Number\.parseInt/);
  assert.doesNotMatch(monthTileSource, /data-month-sheet-date-caption/);
  assert.doesNotMatch(monthTileSource, /border-|ring-|outline-|shadow-/);
  assert.doesNotMatch(monthTileSource, /StampFrame|StampFrameButton|data-stamp-edge/);
  assert.doesNotMatch(monthTileSource, /editorial-photo-frame/);

  const monthSheetPhotoTileCss = cssRuleBody(globalCssSource, ".month-sheet-photo-tile");
  assert.match(monthSheetPhotoTileCss, /background:/);
  assert.match(monthSheetPhotoTileCss, /border:\s*0/);
  assert.doesNotMatch(monthSheetPhotoTileCss, /outline\s*:/);
  assert.match(monthSheetPhotoTileCss, /box-shadow:\s*none/);
  const monthSheetInsertCss = cssRuleBody(globalCssSource, ".month-sheet-tactile-insert");
  assert.match(monthSheetInsertCss, /background-color: var\(--journal-home-overlay\)/);
  assert.match(monthSheetInsertCss, /border: 0/);
  assert.match(monthSheetInsertCss, /box-shadow: none/);
  assert.match(globalCssSource, /\.month-sheet-tactile-insert\s*\{/);
  assert.match(globalCssSource, /--mgp-deep-burgundy: #421819/);
  assert.match(globalCssSource, /\.journal-bottom-ritual-action\s*\{/);
  assert.match(globalCssSource, /min-height: 4\.25rem/);
  assert.match(globalCssSource, /padding-bottom: calc\(4\.5rem/);
  assert.match(globalCssSource, /\.month-sheet-nav-button\s*\{/);

  assert.doesNotMatch(journalIdentityHeaderSource, /data-seal-today-treatment="header-pill"/);
  assert.doesNotMatch(journalIdentityHeaderSource, /journal-seal-today-pill|onSealToday/);
  assert.match(journalIdentityHeaderSource, /data-journal-header-row=\{rowMode\}/);
  assert.match(journalIdentityHeaderSource, /: "identity-settings";/);
  assert.match(journalIdentityHeaderSource, /data-journal-title-align="centerline"/);
  assert.match(journalIdentityHeaderSource, /journal-identity-header__settings-button/);
  assert.match(journalIdentityHeaderSource, /text-\[var\(--journal-home-title\)\]/);
  assert.match(journalIdentityHeaderSource, /data-journal-settings-menu="true"/);
  assert.match(journalIdentityHeaderSource, /data-journal-settings-trigger="true"/);
  assert.doesNotMatch(journalIdentityHeaderSource, /uppercase tracking-\[[^\n]+>\s*Journal\s*</);
  assert.doesNotMatch(journalIdentityHeaderSource, /mt-1\.5 flex gap-3[\s\S]*Rename[\s\S]*Lock/);

  assert.match(bottomRitualActionSource, /data-journal-home-bottom-cta="seal-the-day"/);
  assert.match(bottomRitualActionSource, /data-seal-today-treatment="bottom-sticky"/);
  assert.match(bottomRitualActionSource, /data-seal-today-label="Seal the Day"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-treatment="bottom-sticky-tray"/);
  assert.doesNotMatch(bottomRitualActionSource, /message|role="status"|seal-today-bottom-message/);
  assert.match(journalHomeSource, /<BottomRitualAction/);
  assert.match(journalHomeSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(journalHomeSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalHomeSource, /onBackfillAction=\{sealAnotherDay\}/);
  assert.doesNotMatch(journalHomeSource, /Today is sealed\./);
  assert.doesNotMatch(journalHomeSource, /setSealMessage|sealMessage/);
  assert.match(journalDemoSource, /<BottomRitualAction/);
  assert.match(journalDemoSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(journalDemoSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalDemoSource, /onBackfillAction=\{sealAnotherDay\}/);

  assert.match(journalHomeSource, /findStampForLocalDate\(journal\.memories, new Date\(\)\)/);
  assert.match(journalHomeSource, /router\.push\(`\/c\/\$\{publicToken\}\/m\/\$\{existingToday\.id\}`\)/);
  assert.match(journalStampsSource, /sortStampsBySemanticDay/);
  assert.match(journalStampsSource, /firstKey\.localeCompare\(secondKey\)/);
  assert.match(journalStampsSource, /monthSheetStampPositions/);

  assert.match(capsulePageSource, /<JournalMobileShell/);
  assert.match(capsulePageSource, /className="journal-themed-background"/);
  assert.match(capsulePageSource, /journalThemeStyle\(theme\)/);
  assert.match(journalDemoPageSource, /<JournalMobileShell/);
  assert.match(journalDemoPageSource, /className="journal-themed-background"/);
  assert.match(journalDemoPageSource, /journalThemeStyle\(defaultJournalTheme\)/);
  assert.match(journalDemoSource, /MonthlyStampSheet/);
  assert.match(journalDemoSource, /initialScreen = "home"/);
  assert.doesNotMatch(journalDemoSource, /Today is sealed\./);
  assert.doesNotMatch(journalDemoSource, /Today is already sealed\. You can revisit/);
});

test("phase 7R.4 locks the Daily Detail production contract", () => {
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_4_DAILY_DETAIL_PRODUCTION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthTileSource = readSource("components/journal/month-tile.tsx");

  assert.match(explorationSource, /Phase 7R\.4 applies selected Month Sheet visual system to Daily Detail/);
  assert.match(explorationSource, /Daily Detail should inherit brand-guided typography, lightweight overlay, borderless photo-first grid/);
  assert.match(explorationSource, /Export remains deferred/);
  assert.match(implementationSource, /Daily Detail Visual System In Production/);
  assert.match(implementationSource, /Phase 7R\.5 Apply visual system to Create\/Edit and dedicated Scrap Finder/);
  assert.match(implementationSource, /Phase 7\.2 Daily Export Redesign/);
  assert.match(implementationSource, /Runtime copy registry beyond `SCRAP_DAY_COPY_DECK\.md`/);

  assert.match(stampDetailSource, /data-phase-7r4-detail="daily-detail-production"/);
  assert.match(stampDetailSource, /data-journal-detail-background="themed-leather"/);
  assert.match(stampDetailSource, /data-daily-detail-surface="sheer-overlay"/);
  assert.match(stampDetailSource, /daily-detail-date/);
  assert.match(stampDetailSource, /daily-detail-title/);
  assert.match(stampDetailSource, /data-daily-detail-photo-surface="photo-first"/);
  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.match(stampDetailSource, /DailyStampExportComposer/);
  assert.match(stampDetailSource, /data-daily-stamp-export-action="true"/);
  assert.match(stampDetailSource, /data-daily-detail-bottom-cta="save-share"/);
  assert.match(stampDetailSource, /data-daily-detail-edit-placement="overlay-icon"/);
  assert.match(stampDetailSource, /onEdit/);
  assert.match(stampDetailSource, /onBackToMonthSheet/);
  assert.doesNotMatch(stampDetailSource, /Saved in this journal\./);
  assert.doesNotMatch(stampDetailSource, /PaperPanel/);
  assert.doesNotMatch(stampDetailSource, /Private by nature|vault|upload|collage|smart/i);

  assert.match(stampGridSource, /if \(photoCount <= 1\) return 1/);
  assert.match(stampGridSource, /if \(photoCount <= 4\) return 2/);
  assert.match(stampGridSource, /return 3/);
  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.match(stampGridSource, /data-daily-detail-photo-fit="cover"/);
  assert.match(stampGridSource, /data-daily-detail-photo-ratio/);
  assert.match(stampGridSource, /data-stamp-cover-crop/);
  assert.match(stampGridSource, /CroppedPrivateStampImage/);
  assert.match(stampGridSource, /PrivatePhoto/);
  assert.match(stampGridSource, /PhotoViewer/);
  assert.doesNotMatch(stampGridSource, /editorial-photo-frame/);
  assert.doesNotMatch(stampGridSource, /data-stamp-photo-frame/);
  assert.doesNotMatch(stampGridSource, /data-stamp-edge/);
  assert.doesNotMatch(stampGridSource, /data-stamp-frame-fit/);
  assert.doesNotMatch(stampGridSource, /border-|ring-|outline-|shadow-/);

  const dailyDetailTitleCss = cssRuleBody(globalCssSource, ".daily-detail-title");
  assert.match(dailyDetailTitleCss, /color: var\(--journal-home-month-title\)/);
  assert.match(dailyDetailTitleCss, /font-family: var\(--mgp-display-font\)/);
  assert.match(dailyDetailTitleCss, /letter-spacing: 0/);
  const dailyDetailDateCss = cssRuleBody(globalCssSource, ".daily-detail-date");
  assert.match(dailyDetailDateCss, /color: var\(--journal-home-title\)/);
  const dailyDetailGridCss = cssRuleBody(globalCssSource, ".daily-detail-photo-grid");
  assert.match(dailyDetailGridCss, /background: transparent/);
  assert.match(dailyDetailGridCss, /border: 0/);
  assert.match(dailyDetailGridCss, /box-shadow: none/);
  const dailyDetailTileCss = cssRuleBody(globalCssSource, ".daily-detail-photo-tile");
  assert.match(dailyDetailTileCss, /border: 0/);
  assert.match(dailyDetailTileCss, /box-shadow: none/);

  assert.match(monthlyStampSheetSource, /data-phase-7r3-direction="direction-b"/);
  assert.match(monthlyStampSheetSource, /month-sheet-tactile-insert/);
  assert.match(monthTileSource, /month-sheet-photo-tile/);
  assert.doesNotMatch(monthTileSource, /editorial-photo-frame/);
  assert.doesNotMatch(monthTileSource, /StampFrame|StampFrameButton|data-stamp-edge/);
});

test("phase 7R.5A locks Create/Edit and fullscreen viewer acceptance fixes", () => {
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5A_CREATE_EDIT_VIEWER_FIX.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const sortableGridSource = readSource("components/memory/sortable-photo-grid.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");

  assert.match(explorationSource, /Create\/Edit should use a form-specific translucent overlay, not the old heavy cream card/);
  assert.match(explorationSource, /Fullscreen photo viewer should remain immersive and not constrained inside the journal shell/);
  assert.match(explorationSource, /Sticky bottom CTA is accepted for Month Sheet only, not Create\/Edit/);
  assert.match(implementationSource, /Create\/Edit \+ Photo Viewer Acceptance Fix/);
  assert.match(implementationSource, /Save\/Cancel layout fix/);
  assert.match(implementationSource, /Photo viewer fullscreen fix/);
  assert.match(implementationSource, /Phase 7R\.5B Dedicated Scrap Finder visual refinement/);
  assert.match(implementationSource, /Runtime copy registry beyond `SCRAP_DAY_COPY_DECK\.md`/);

  assert.match(memoryFormSource, /data-journal-create-edit-form=\{[\s\S]*"translucent-form-overlay"/);
  assert.match(memoryFormSource, /data-journal-create-edit-actions="in-flow-form-footer"/);
  assert.match(memoryFormSource, /journal-create-edit-save-button/);
  assert.match(memoryFormSource, /journal-create-edit-cancel-button/);
  assert.match(memoryFormSource, /ChevronLeftIcon/);
  assert.match(memoryFormSource, /isJournalProduct && onCancel/);
  assert.doesNotMatch(memoryFormSource, /isJournalProduct && isEditing && onCancel/);
  assert.match(memoryFormSource, /aria-label="Back without saving"/);
  assert.match(memoryFormSource, /data-journal-form-action="back"/);
  assert.match(memoryFormSource, /onClick=\{onCancel\}/);
  assert.match(memoryFormSource, /journal-create-edit-back-button/);
  assert.match(memoryFormSource, /data-journal-date-value="paper-text"/);
  assert.match(memoryFormSource, /text-\[var\(--journal-paper-text\)\]/);
  assert.ok(
    memoryFormSource.indexOf("<JournalPhotoPicker") <
      memoryFormSource.indexOf('data-journal-create-edit-actions="in-flow-form-footer"'),
    "journal action footer should render after the photo picker",
  );
  assert.doesNotMatch(memoryFormSource, /memory-entry journal-create-edit-form/);
  assert.doesNotMatch(memoryFormSource, /sticky|bottom-\[|fixed|z-20|shadow-\[0_-14px/);

  const createEditFormCss = cssRuleBody(globalCssSource, ".journal-create-edit-form");
  assert.match(createEditFormCss, /var\(--journal-form-overlay-gradient\)/);
  assert.match(createEditFormCss, /var\(--journal-form-overlay\)/);
  assert.doesNotMatch(createEditFormCss, /--mgp-warm-ivory|--mgp-vintage-blush/);
  assert.match(createEditFormCss, /backdrop-filter: blur\(2px\)/);
  assert.match(createEditFormCss, /border: 0/);
  assert.match(createEditFormCss, /border-radius: 0\.5rem/);
  assert.match(createEditFormCss, /box-shadow: none/);
  assert.match(createEditFormCss, /overflow: hidden/);
  const createEditBackButtonCss = cssRuleBody(
    globalCssSource,
    ".journal-create-edit-back-button",
  );
  assert.match(createEditBackButtonCss, /height: 2\.75rem/);
  assert.match(createEditBackButtonCss, /min-width: 2\.75rem/);
  assert.match(createEditBackButtonCss, /width: 2\.75rem/);
  assert.match(createEditBackButtonCss, /border-radius: 999px/);
  const createEditActionsCss = cssRuleBody(globalCssSource, ".journal-create-edit-actions");
  assert.match(createEditActionsCss, /padding-bottom: calc\(0\.75rem/);
  assert.doesNotMatch(createEditActionsCss, /position|sticky|fixed|z-index/);
  const coverPreviewCss = cssRuleBody(globalCssSource, ".journal-cover-photo-preview");
  assert.match(coverPreviewCss, /border: 0/);
  assert.match(coverPreviewCss, /box-shadow: none/);
  const momentPreviewCss = cssRuleBody(globalCssSource, ".journal-moment-photo-preview");
  assert.match(momentPreviewCss, /border: 0/);
  assert.match(momentPreviewCss, /box-shadow: none/);

  assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
  assert.match(journalPhotoPickerSource, /journal-cover-photo-preview/);
  assert.match(journalPhotoPickerSource, /Adjust scrap/);
  assert.match(journalPhotoPickerSource, /Add more moments \(optional\)/);
  assert.doesNotMatch(journalPhotoPickerSource, /editorial-photo-frame/);
  assert.doesNotMatch(journalPhotoPickerSource, /StampFrame|data-stamp-edge|variant="md"/);
  assert.match(sortableGridSource, /journal-moment-photo-preview/);
  assert.match(sortableGridSource, /data-photo-preview-frame="borderless-editorial"/);
  assert.doesNotMatch(sortableGridSource, /editorial-photo-frame/);
  assert.doesNotMatch(sortableGridSource, /StampFrame|data-stamp-edge|variant="sm"/);

  assert.match(photoViewerSource, /createPortal/);
  assert.match(photoViewerSource, /document\.body/);
  assert.match(photoViewerSource, /data-photo-viewer-overlay="fullscreen-viewport"/);
  assert.match(photoViewerSource, /data-photo-viewer-portal="document-body"/);
  assert.match(photoViewerSource, /data-photo-viewer-image="original-display"/);
  assert.match(photoViewerSource, /object-contain/);
  assert.match(photoViewerSource, /Photograph \{index \+ 1\}/);
  assert.doesNotMatch(photoViewerSource, />\s*\{photo\.name\}\s*</);
  const photoViewerCss = cssRuleBody(globalCssSource, ".photo-viewer-fullscreen");
  assert.match(photoViewerCss, /height: 100dvh/);
  assert.match(photoViewerCss, /width: 100vw/);
  assert.match(photoViewerCss, /z-index: 9999/);
  assert.match(photoViewerCss, /max-width: none/);

  assert.match(monthlyStampSheetSource, /data-phase-7r3-direction="direction-b"/);
  assert.match(stampDetailSource, /data-phase-7r4-detail="daily-detail-production"/);
  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.doesNotMatch(stampGridSource, /editorial-photo-frame|data-stamp-edge/);
});

test("phase 7R.5B locks dedicated Scrap Finder visual refinement", () => {
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5B_SCRAP_FINDER_VISUAL_REFINEMENT.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const journalThemeSource = readSource("data/journal-themes.ts");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");

  assert.match(explorationSource, /Scrap Finder uses the accepted visual system/);
  assert.match(explorationSource, /dedicated ritual step, not an inline cropper/);
  assert.match(explorationSource, /selected leather theme background/);
  assert.match(explorationSource, /avoids blue plastic, postage edges, and technical image dimensions/);
  assert.match(explorationSource, /Create\/Edit overlay must remain theme-aware across leather colors/);
  assert.match(implementationSource, /Dedicated Scrap Finder Visual Refinement/);
  assert.match(implementationSource, /Create\/Edit overlay preflight/);
  assert.match(implementationSource, /selected journal leather theme background/);
  assert.match(implementationSource, /Crop math and metadata were not changed/);
  assert.match(implementationSource, /Phase 7\.2 Daily Export Redesign/);

  assert.match(journalThemeSource, /--journal-form-overlay/);
  assert.match(journalThemeSource, /--journal-form-overlay-gradient/);
  assert.match(journalThemeSource, /--journal-finder-surface/);
  assert.match(journalThemeSource, /--journal-finder-window/);
  assert.match(journalThemeSource, /--journal-finder-edge/);
  assert.match(journalThemeSource, /--journal-finder-primary-bg/);
  assert.match(journalThemeSource, /theme\.paperSurface/);
  assert.match(journalThemeSource, /theme\.journalBackground/);
  assert.match(journalThemeSource, /theme\.accentMetal/);
  assert.match(journalThemeSource, /usesDarkText/);

  const createEditFormCss = cssRuleBody(globalCssSource, ".journal-create-edit-form");
  assert.match(createEditFormCss, /var\(--journal-form-overlay-gradient\)/);
  assert.match(createEditFormCss, /var\(--journal-form-overlay\)/);
  assert.doesNotMatch(createEditFormCss, /--mgp-warm-ivory|--mgp-vintage-blush/);

  assert.match(scrapTableSource, /data-scrap-table-presentation="dedicated-screen"/);
  assert.match(scrapTableSource, /data-scrap-table-screen="mobile-standalone"/);
  assert.match(scrapTableSource, /data-scrap-finder-background="themed-leather"/);
  assert.match(scrapTableSource, /journalThemeStyle\(theme\)/);
  assert.match(scrapTableSource, /data-scrap-mobile-shell="true"/);
  assert.match(scrapTableSource, /data-scrap-layout="dedicated-mobile"/);
  assert.match(scrapTableSource, /data-scrap-photo-stage="true"/);
  assert.match(scrapTableSource, /Find today&apos;s scrap/);
  assert.match(scrapTableSource, /Move the photo under the finder\./);
  assert.match(scrapTableSource, /scrap-finder-title/);
  assert.match(scrapTableSource, /scrap-finder-helper/);
  assert.match(scrapTableSource, /aria-label="Close"/);
  assert.match(scrapTableSource, /data-scrap-action="close"/);
  assert.match(scrapTableSource, /data-finder-tool="editorial-finder"/);
  assert.match(scrapTableSource, /data-scrap-finder-plate="true"/);
  assert.match(scrapTableSource, /data-scrap-aperture="finder-window"/);
  assert.match(scrapTableSource, /data-scrap-frame="square"/);
  assert.match(scrapTableSource, /onPointerDown=\{startDrag\}/);
  assert.match(scrapTableSource, /onPointerMove=\{moveDrag\}/);
  assert.match(scrapTableSource, /value=\{view\.zoom\}/);
  assert.match(scrapTableSource, /setClampedView/);
  assert.match(scrapTableSource, /computeCoverCropMetadata/);
  assert.match(scrapTableSource, /Use this scrap/);
  assert.match(scrapTableSource, /Choose another/);
  assert.match(scrapTableSource, /Reset/);
  assert.match(scrapTableSource, /Cancel/);
  assert.match(scrapTableSource, /data-scrap-primary-action="use-this-scrap"/);
  assert.match(scrapTableSource, /data-scrap-secondary-action="choose-another"/);
  assert.match(scrapTableSource, /data-scrap-secondary-action="reset"/);
  assert.match(scrapTableSource, /data-scrap-secondary-action="cancel"/);
  assert.doesNotMatch(scrapTableSource, /StampFrame|data-stamp-edge|physical-frame|stamp-window|variant="lg"/);
  assert.doesNotMatch(scrapTableSource, /photoSizeLabel|image dimensions|pixels|Aspect ratio|Crop image|Upload|vault|smart|Collage/i);
  assert.doesNotMatch(scrapTableSource, /#b9cdd1|#8ca9af|#d3e0e2|#16201f|#d8c28d/);
  assert.doesNotMatch(scrapTableSource, /journal-create-edit-form|One line to keep|Seal this day/);

  const finderSurfaceCss = cssRuleBody(globalCssSource, ".scrap-finder-surface");
  assert.match(finderSurfaceCss, /var\(--journal-finder-surface/);
  assert.match(finderSurfaceCss, /backdrop-filter: blur\(1\.5px\)/);
  assert.match(finderSurfaceCss, /border: 0/);
  assert.doesNotMatch(finderSurfaceCss, /0 26px 70px|--journal-paper,\s*var\(--paper\)/);
  const finderWindowCss = cssRuleBody(globalCssSource, ".scrap-finder-window");
  assert.match(finderWindowCss, /var\(--journal-finder-window/);
  assert.match(finderWindowCss, /box-shadow: none/);
  assert.doesNotMatch(finderWindowCss, /var\(--journal-finder-edge|inset 0 0 0 1px|--journal-stamp-border/);
  const finderPrimaryCss = cssRuleBody(globalCssSource, ".scrap-finder-primary-button");
  assert.match(scrapTableSource, /journal-primary-bottom-cta/);
  assert.match(finderPrimaryCss, /var\(--journal-home-cta-bg/);
  assert.match(finderPrimaryCss, /var\(--journal-home-cta-text/);
  assert.match(finderPrimaryCss, /var\(--journal-home-cta-shadow/);
  const finderZoomCss = cssRuleBody(globalCssSource, ".scrap-finder-zoom-slider");
  assert.match(finderZoomCss, /accent-color: var\(--journal-finder-edge/);
  assert.match(globalCssSource, /\.scrap-finder-close-button,\s*\n\.scrap-finder-secondary-button/);
  assert.match(globalCssSource, /\.scrap-finder-boundary\s*\{[\s\S]*border: 0/);

  assert.match(journalPhotoPickerSource, /createPortal/);
  assert.match(journalPhotoPickerSource, /document\.body/);
  assert.match(journalPhotoPickerSource, /data-scrap-finder-portal="body-overlay"/);
  assert.doesNotMatch(journalPhotoPickerSource, /return\s*\(\s*<ScrapTable/);
  assert.match(memoryFormSource, /data-journal-create-edit-actions="in-flow-form-footer"/);
  assert.match(photoViewerSource, /data-photo-viewer-overlay="fullscreen-viewport"/);
  assert.match(monthlyStampSheetSource, /data-phase-7r3-direction="direction-b"/);
  assert.match(stampDetailSource, /data-phase-7r4-detail="daily-detail-production"/);
  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
});

test("phase 7R.5C locks borderless customer-facing photo surfaces", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5C_BORDERLESS_PHOTO_SURFACES.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const monthTileSource = readSource("components/journal/month-tile.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const sortableGridSource = readSource("components/memory/sortable-photo-grid.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");

  assert.match(implementationSource, /Borderless Photo Surface Cleanup/);
  assert.match(implementationSource, /root causes/i);
  assert.match(implementationSource, /Month Sheet cover-scrap tiles/);
  assert.match(implementationSource, /Daily Memory Stamp detail/);
  assert.match(implementationSource, /Create\/Edit page/);
  assert.match(implementationSource, /Fullscreen photo viewer/);
  assert.match(implementationSource, /Crop math, ordering logic, exports, database, auth, and layout direction were intentionally not changed/);

  assert.match(monthTileSource, /month-sheet-photo-button/);
  assert.match(monthTileSource, /data-month-sheet-photo-border="none"/);
  assert.doesNotMatch(monthTileSource, /border-|ring-|outline-|shadow-/);
  const monthSheetPhotoTileCss = cssRuleBody(globalCssSource, ".month-sheet-photo-tile");
  assert.match(monthSheetPhotoTileCss, /border: 0/);
  assert.match(monthSheetPhotoTileCss, /box-shadow: none/);
  assert.doesNotMatch(monthSheetPhotoTileCss, /outline\s*:/);

  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.match(stampGridSource, /data-daily-detail-photo-fit="cover"/);
  assert.doesNotMatch(stampGridSource, /border-|ring-|outline-|shadow-/);
  const dailyDetailTileCss = cssRuleBody(globalCssSource, ".daily-detail-photo-tile");
  assert.match(dailyDetailTileCss, /border: 0/);
  assert.match(dailyDetailTileCss, /box-shadow: none/);
  assert.match(dailyDetailTileCss, /outline: none/);
  const dailyDetailFocusCss = cssRuleBody(globalCssSource, ".daily-detail-photo-tile:focus-visible");
  assert.match(dailyDetailFocusCss, /outline: none/);
  assert.match(globalCssSource, /\.daily-detail-photo-tile:focus-visible img,[\s\S]*filter: brightness\(0\.88\) saturate\(0\.96\)/);

  assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
  assert.doesNotMatch(journalPhotoPickerSource, /editorial-photo-frame|StampFrame|data-stamp-edge/);
  const coverPreviewCss = cssRuleBody(globalCssSource, ".journal-cover-photo-preview");
  assert.match(coverPreviewCss, /border: 0/);
  assert.match(coverPreviewCss, /box-shadow: none/);
  assert.match(sortableGridSource, /journal-photo-sort-handle/);
  assert.match(sortableGridSource, /data-photo-preview-frame="borderless-editorial"/);
  assert.doesNotMatch(sortableGridSource, /journal-photo-sort-handle[^`]*focus-visible:ring|journal-photo-sort-handle[^`]*ring-offset/);
  assert.doesNotMatch(sortableGridSource, /journal-moment-photo-preview[^`]*rounded|editorial-photo-frame/);
  const momentPreviewCss = cssRuleBody(globalCssSource, ".journal-moment-photo-preview");
  assert.match(momentPreviewCss, /border: 0/);
  assert.match(momentPreviewCss, /box-shadow: none/);

  assert.match(photoViewerSource, /data-photo-viewer-image="original-display"/);
  assert.match(photoViewerSource, /className="pointer-events-none object-contain"/);
  assert.doesNotMatch(photoViewerSource, /object-contain p-4|sm:p-8/);
  const photoViewerCss = cssRuleBody(globalCssSource, ".photo-viewer-fullscreen");
  assert.match(photoViewerCss, /height: 100dvh/);
  assert.match(photoViewerCss, /width: 100vw/);

  const editorialPhotoFrameCss = cssRuleBody(globalCssSource, ".editorial-photo-frame");
  assert.match(editorialPhotoFrameCss, /box-shadow: none/);
  assert.doesNotMatch(editorialPhotoFrameCss, /inset 0 0 0 1px|border/);

  assert.match(scrapTableSource, /data-scrap-aperture="finder-window"/);
  const finderSurfaceCss = cssRuleBody(globalCssSource, ".scrap-finder-surface");
  assert.match(finderSurfaceCss, /border: 0/);
  assert.match(finderSurfaceCss, /box-shadow: none/);
  const finderWindowCss = cssRuleBody(globalCssSource, ".scrap-finder-window");
  assert.match(finderWindowCss, /box-shadow: none/);
  assert.doesNotMatch(finderWindowCss, /inset 0 0 0 1px/);
  const finderMaskCss = cssRuleBody(globalCssSource, ".scrap-finder-window-mask");
  assert.match(finderMaskCss, /box-shadow: none/);
  const finderBoundaryCss = cssRuleBody(globalCssSource, ".scrap-finder-boundary");
  assert.match(finderBoundaryCss, /border: 0/);
});

test("phase 7R.PG.2 keeps Scrap Finder tactile press exploration playground-only", () => {
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_PLAYGROUND_SCRAP_FINDER_TACTILE_EXPLORATION.md",
  );
  const productionScrapFinderSource = readSource("components/scrap/scrap-table.tsx");

  assert.match(explorationSource, /design-playground-only exploration/);
  assert.match(explorationSource, /Base current accepted finder/);
  assert.match(explorationSource, /Subtle bottom press detail/);
  assert.match(explorationSource, /Even lighter whisper lip/);
  assert.match(explorationSource, /must not include the tactile press detail/);

  assert.match(playgroundSource, /data-playground-track="scrap-finder-tactile-only"/);
  assert.match(playgroundSource, /data-playground-scrap-finder="true"/);
  assert.match(playgroundSource, /data-playground-finder-variant=\{variant\.id\}/);
  assert.match(playgroundSource, /data-playground-finder-recommendation=\{variant\.role\}/);
  assert.match(playgroundSource, /data-playground-finder-primary=\{[\s\S]*"subtle-bottom-press"/);
  assert.match(playgroundSource, /base-current/);
  assert.match(playgroundSource, /bottom-press/);
  assert.match(playgroundSource, /whisper-lip/);
  assert.match(playgroundSource, /role: "reference"/);
  assert.match(playgroundSource, /role: "recommended"/);
  assert.match(playgroundSource, /role: "comparison"/);
  assert.match(playgroundSource, /data-playground-finder-press-detail=\{variant\.id\}/);
  assert.match(playgroundSource, /pointerEvents: "none"/);
  assert.match(playgroundSource, /wine/);
  assert.match(playgroundSource, /ivory/);

  assert.doesNotMatch(productionScrapFinderSource, /bottom-press|whisper-lip|data-playground-finder-press-detail|data-playground-finder-primary|tactilePressStyle/);
});

test("phase 7R.5D locks Month Sheet stable stage and Scrap Finder playground refinement", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5D_MONTH_STAGE_AND_SCRAP_FINDER_PLAYGROUND.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const playgroundDocSource = readSource(
    "SCRAP_DAY_PHASE_7R_PLAYGROUND_SCRAP_FINDER_TACTILE_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const journalThemeSource = readSource("data/journal-themes.ts");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const monthTileSource = readSource("components/journal/month-tile.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalStampsSource = readSource("data/journal-stamps.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );
  const productionScrapFinderSource = readSource("components/scrap/scrap-table.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");

  assert.match(implementationSource, /Month Sheet Stable Stage \+ Scrap Finder Playground Refinement/);
  assert.match(implementationSource, /Stage A only/);
  assert.match(implementationSource, /Phase 7R\.5D\.1 Month Sheet Link Polish/);
  assert.match(implementationSource, /tactile press detail was not shipped to production/i);
  assert.match(implementationSource, /Next gated step: Phase 7R Preview Refresh/);
  assert.match(explorationSource, /Phase 7R\.5D: Month Sheet Stable Stage \+ Scrap Finder Playground Refinement/);
  assert.match(explorationSource, /stable editorial stage/i);
  assert.match(explorationSource, /Subtle bottom press detail is the preferred playground candidate/);
  assert.match(playgroundDocSource, /Subtle bottom press detail is the recommended playground candidate/);
  assert.match(playgroundDocSource, /may become decorative clutter/);
  assert.match(playgroundDocSource, /may imply interaction/);
  assert.match(playgroundDocSource, /may be invisible on some themes/);
  assert.match(playgroundDocSource, /may feel too hardware-like if too strong/);
  assert.match(playgroundDocSource, /do not ship to production yet/);

  assert.match(monthlyStampSheetSource, /month-sheet-stable-stage/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-stage="stable-editorial"/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-surface="direction-b-tactile-insert"/);
  assert.match(monthlyStampSheetSource, /Back to this month/);
  assert.match(monthlyStampSheetSource, /month-sheet-header-row flex items-start justify-between gap-3/);
  assert.match(monthlyStampSheetSource, /month-sheet-nav-controls flex shrink-0 items-center gap-1/);
  assert.match(monthlyStampSheetSource, /month-sheet-return-row mt-2 min-h-4/);
  assert.match(monthlyStampSheetSource, /className="month-sheet-return-link block self-start text-left font-sans text-xs font-medium"/);
  assert.match(monthlyStampSheetSource, /className="invisible block font-sans text-xs font-medium"/);
  assert.doesNotMatch(monthlyStampSheetSource, /month-sheet-return-link[^"]*font-semibold/);
  assert.match(journalThemeSource, /"--journal-month-stage-min-height": "clamp\(23\.5rem, 56dvh, 33\.5rem\)"/);
  assert.match(journalThemeSource, /"--journal-month-return-link": monthReturnLink/);
  assert.match(journalThemeSource, /"--journal-month-return-link-decoration": monthReturnLinkDecoration/);
  const monthStageCss = cssRuleBody(globalCssSource, ".month-sheet-stable-stage");
  assert.match(monthStageCss, /min-height: var\(--journal-month-stage-min-height, clamp\(23\.5rem, 56dvh, 33\.5rem\)\)/);
  assert.doesNotMatch(monthStageCss, /(^|\n)\s*height:/);
  assert.doesNotMatch(monthStageCss, /overflow/);
  const monthNavControlsCss = cssRuleBody(globalCssSource, ".month-sheet-nav-controls");
  assert.match(monthNavControlsCss, /margin-top: calc/);
  assert.match(monthNavControlsCss, /--month-sheet-nav-control-size: 2\.5rem/);
  assert.match(monthNavControlsCss, /var\(--month-sheet-nav-control-size\)/);
  assert.match(
    globalCssSource,
    /\.journal-stage-overlay--month-sheet\s+\.editorial-icon-button\.journal-shell-icon-button\.month-sheet-nav-button\s*\{[\s\S]*height: var\(--month-sheet-nav-control-size, 2\.5rem\)/,
  );
  const monthApprovedContentCss = cssRuleBody(
    globalCssSource,
    ".month-sheet-approved-content",
  );
  assert.match(monthApprovedContentCss, /padding-top: 0\.75rem/);
  const monthReturnLinkCss = cssRuleBody(globalCssSource, ".editorial-text-link.month-sheet-return-link");
  assert.match(monthReturnLinkCss, /color: var\(--journal-month-return-link, var\(--journal-paper-muted-text\)\)/);
  assert.match(monthReturnLinkCss, /opacity: 0\.78/);
  assert.match(monthReturnLinkCss, /--journal-month-return-link-decoration/);
  const monthReturnLinkHoverCss = cssRuleBody(globalCssSource, ".editorial-text-link.month-sheet-return-link:hover");
  assert.match(monthReturnLinkHoverCss, /opacity: 0\.92/);

  assert.match(monthSheetGridSource, /positions\.map/);
  assert.match(monthSheetGridSource, /data-month-sheet-renders="sealed-days-only"/);
  assert.match(monthSheetGridSource, /APP_MONTH_SHEET_COLUMNS = 3/);
  assert.match(monthSheetGridSource, /grid-cols-3/);
  assert.match(monthSheetGridSource, /thumbnailUrls\[memory\.id\]/);
  assert.doesNotMatch(monthSheetGridSource, /Array\.from\(\{ length: MONTH_SHEET_CAPACITY \}/);
  assert.doesNotMatch(monthSheetGridSource, /placeholder|empty slot|filler slot/i);
  assert.match(journalStampsSource, /sortStampsBySemanticDay/);
  assert.match(journalStampsSource, /firstKey\.localeCompare\(secondKey\)/);
  assert.match(monthTileSource, /data-month-sheet-date-marker="photo-text"/);
  assert.match(monthTileSource, /data-month-sheet-date-placement="photo"/);
  assert.match(monthTileSource, /CroppedStampImage/);
  assert.doesNotMatch(monthTileSource, /data-month-sheet-date-caption/);
  assert.doesNotMatch(monthlyStampSheetSource, />\s*MONTH SHEET\s*</i);
  assert.match(globalCssSource, /padding-bottom: calc\(4\.5rem/);
  assert.match(bottomRitualActionSource, /data-journal-home-bottom-cta="seal-the-day"/);
  assert.match(journalHomeSource, /<BottomRitualAction/);
  assert.match(journalDemoSource, /<BottomRitualAction/);

  assert.match(playgroundSource, /finderThemeIds = \["wine", "ivory"\]/);
  assert.match(playgroundSource, /role: "recommended"/);
  assert.match(playgroundSource, /Preferred playground candidate/);
  assert.match(playgroundSource, /data-playground-finder-primary=\{[\s\S]*"subtle-bottom-press"/);
  assert.match(playgroundSource, /data-playground-finder-recommendation=\{variant\.role\}/);
  assert.match(playgroundSource, /data-playground-finder-press-detail=\{variant\.id\}/);
  assert.match(playgroundSource, /pointerEvents: "none"/);

  assert.doesNotMatch(productionScrapFinderSource, /bottom-press|whisper-lip|data-playground-finder-press-detail|data-playground-finder-primary|tactilePressStyle|Preferred playground candidate/);
  assert.doesNotMatch(stampDetailSource, /month-sheet-stable-stage|data-month-sheet-stage|--journal-month-stage-min-height/);
  assert.doesNotMatch(memoryFormSource, /month-sheet-stable-stage|data-month-sheet-stage|--journal-month-stage-min-height/);
});

test("phase 7R.5E locks mobile Month Sheet density and Scrap Finder zoom safe-zone", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5E_MOBILE_USABILITY_FIX.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const monthTileSource = readSource("components/journal/month-tile.tsx");
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(implementationSource, /Mobile Usability Acceptance Fix/);
  assert.match(implementationSource, /Month Sheet mobile width/i);
  assert.match(implementationSource, /Scrap Finder zoom control safe-zone/i);
  assert.match(implementationSource, /Phase 7R\.6A Copy Inventory Snapshot/);

  assert.match(journalHomeSource, /journal-home-surface--mobile-density/);
  assert.match(journalDemoSource, /journal-home-surface--mobile-density/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-content="approved-playground-inner"/);
  assert.match(monthlyStampSheetSource, /month-sheet-approved-content flex flex-col p-2/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-mobile-width="wide-overlay"/);
  assert.match(monthlyStampSheetSource, /month-sheet-stable-stage/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-stage="stable-editorial"/);
  assert.doesNotMatch(monthlyStampSheetSource, /month-sheet-mobile-density/);
  assert.doesNotMatch(monthlyStampSheetSource, />\s*MONTH SHEET\s*</i);

  const homeDensityCss = cssRuleBody(globalCssSource, ".journal-home-surface--mobile-density");
  assert.match(homeDensityCss, /padding-inline: 0\.75rem/);
  const monthDensityCss = cssRuleBody(globalCssSource, ".month-sheet-mobile-density");
  assert.match(monthDensityCss, /margin-inline: 0/);
  assert.match(monthDensityCss, /padding-inline: 0/);
  assert.match(
    globalCssSource,
    /@media \(min-width: 640px\)[\s\S]*\.month-sheet-mobile-density\s*\{[\s\S]*margin-inline: 0;[\s\S]*padding-inline: 0;/,
  );

  assert.match(monthSheetGridSource, /APP_MONTH_SHEET_COLUMNS = 3/);
  assert.match(monthSheetGridSource, /grid-cols-3/);
  assert.match(monthSheetGridSource, /app: "grid-cols-3 gap-1"/);
  assert.match(monthSheetGridSource, /variant === "app" \? "mt-2" : "mt-3"/);
  assert.match(monthSheetGridSource, /data-month-sheet-renders="sealed-days-only"/);
  assert.doesNotMatch(monthSheetGridSource, /Array\.from\(\{ length: MONTH_SHEET_CAPACITY \}/);
  assert.doesNotMatch(monthSheetGridSource, /placeholder|empty slot|filler slot/i);
  assert.match(monthTileSource, /data-month-sheet-date-marker="photo-text"/);
  assert.match(monthTileSource, /data-month-sheet-date-placement="photo"/);
  assert.match(monthTileSource, /data-month-sheet-photo-border="none"/);
  assert.doesNotMatch(monthTileSource, /data-month-sheet-date-caption/);
  const monthSheetPhotoTileCss = cssRuleBody(globalCssSource, ".month-sheet-photo-tile");
  assert.match(monthSheetPhotoTileCss, /border: 0/);
  assert.match(monthSheetPhotoTileCss, /box-shadow: none/);
  assert.match(globalCssSource, /padding-bottom: calc\(4\.5rem/);
  assert.match(bottomRitualActionSource, /data-journal-home-bottom-cta="seal-the-day"/);

  assert.match(scrapTableSource, /scrap-finder-zoom-safe-zone/);
  assert.match(scrapTableSource, /data-scrap-zoom-safe-zone="centered"/);
  assert.match(scrapTableSource, /data-scrap-zoom-control="safe-range"/);
  assert.match(scrapTableSource, /className="scrap-finder-zoom-slider"/);
  assert.doesNotMatch(scrapTableSource, /className="scrap-finder-zoom-slider w-full"/);
  assert.match(scrapTableSource, /value=\{view\.zoom\}/);
  assert.match(scrapTableSource, /setClampedView/);
  assert.match(scrapTableSource, /computeCoverCropMetadata/);
  assert.match(scrapTableSource, /onConfirmCrop\(cropMetadata\)/);
  assert.doesNotMatch(scrapTableSource, /photoSizeLabel|image dimensions|pixels|Aspect ratio|Crop image|Upload|vault|smart|StampFrame|data-stamp-edge/i);

  const zoomSafeZoneCss = cssRuleBody(globalCssSource, ".scrap-finder-zoom-safe-zone");
  assert.match(zoomSafeZoneCss, /width: min\(74%, 19rem\)/);
  assert.match(zoomSafeZoneCss, /max-width: calc\(100% - 6rem\)/);
  assert.match(zoomSafeZoneCss, /min-width: min\(13\.5rem, calc\(100% - 6rem\)\)/);
  const finderZoomCss = cssRuleBody(globalCssSource, ".scrap-finder-zoom-slider");
  assert.match(finderZoomCss, /accent-color: var\(--journal-finder-edge/);
  assert.match(finderZoomCss, /width: 100%/);

  assert.doesNotMatch(stampDetailSource, /scrap-finder-zoom-safe-zone/);
  assert.doesNotMatch(memoryFormSource, /scrap-finder-zoom-safe-zone|position:\s*sticky/);
  assert.doesNotMatch(exportRendererSource, /scrap-finder-zoom-safe-zone|month-sheet-mobile-density/);
});

test("phase 7R.5F locks final mobile refinement and backfill playground boundaries", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5F_FINAL_MOBILE_REFINEMENT.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(implementationSource, /Final Mobile Visual Refinement \+ Backfill CTA Playground/);
  assert.match(implementationSource, /Daily Detail overlay width parity/);
  assert.match(implementationSource, /Scrap Finder zoom vertical grouping/);
  assert.match(implementationSource, /Empty state brand-color styling/);
  assert.match(implementationSource, /What was intentionally not shipped to production/);
  assert.match(explorationSource, /Final Mobile Refinement \+ Backfill CTA Playground/);
  assert.match(explorationSource, /bottom CTA \/ backfill action models/);
  assert.match(explorationSource, /Copy will be finalized later through Phase 7R\.6A Copy Inventory/);

  assert.doesNotMatch(stampDetailSource, /journal-home-surface--mobile-density/);
  assert.doesNotMatch(stampDetailSource, /month-sheet-mobile-density/);
  assert.match(stampDetailSource, /data-daily-detail-mobile-width="approved-playground"/);
  assert.match(stampDetailSource, /data-daily-detail-surface="sheer-overlay"/);
  assert.doesNotMatch(stampDetailSource, /month-sheet-stable-stage|data-month-sheet-stage|--journal-month-stage-min-height/);
  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.doesNotMatch(stampGridSource, /editorial-photo-frame|data-stamp-edge|border-|ring-|outline-|shadow-/);

  assert.match(scrapTableSource, /data-scrap-photo-stage="true"/);
  assert.match(scrapTableSource, /data-scrap-zoom-group="finder-photo"/);
  assert.match(scrapTableSource, /data-scrap-controls="action-row"/);
  assert.ok(
    scrapTableSource.indexOf('data-scrap-photo-stage="true"') <
      scrapTableSource.indexOf('data-scrap-zoom-group="finder-photo"'),
    "zoom control should render inside the finder/photo stage",
  );
  assert.ok(
    scrapTableSource.indexOf('data-scrap-zoom-group="finder-photo"') <
      scrapTableSource.indexOf('data-scrap-controls="action-row"'),
    "zoom control should render above the action buttons",
  );
  assert.match(scrapTableSource, /data-scrap-zoom-safe-zone="centered"/);
  assert.match(scrapTableSource, /data-scrap-zoom-control="safe-range"/);
  assert.match(scrapTableSource, /value=\{view\.zoom\}/);
  assert.match(scrapTableSource, /setClampedView/);
  assert.doesNotMatch(scrapTableSource, /photoSizeLabel|image dimensions|pixels|blue plastic|StampFrame|data-stamp-edge/i);

  assert.match(monthlyStampSheetSource, /data-month-sheet-empty-state="brand-toned"/);
  assert.match(monthlyStampSheetSource, /month-sheet-empty-title/);
  assert.match(monthlyStampSheetSource, /month-sheet-empty-body/);
  assert.match(monthlyStampSheetSource, /No sealed days here\./);
  assert.match(monthlyStampSheetSource, /Choose a date to keep one\./);
  const emptyTitleCss = cssRuleBody(globalCssSource, ".month-sheet-empty-title");
  assert.match(emptyTitleCss, /color: var\(--journal-home-month-title\)/);
  assert.match(emptyTitleCss, /font-family: var\(--mgp-display-font\)/);
  const emptyBodyCss = cssRuleBody(globalCssSource, ".month-sheet-empty-body");
  assert.match(emptyBodyCss, /color: var\(--journal-month-return-link, var\(--journal-paper-muted-text\)\)/);

  assert.match(playgroundSource, /data-playground-track="homepage-hierarchy-exploration"/);
  assert.match(playgroundSource, /Current accepted production reference/);
  assert.match(playgroundSource, /balanced-journal-identity/);
  assert.match(playgroundSource, /stronger-journal-identity/);
  assert.match(playgroundSource, /dark-brown/);
  assert.match(playgroundSource, /data-playground-track="bottom-cta-backfill-exploration"/);
  assert.match(playgroundSource, /current-reference/);
  assert.match(playgroundSource, /seal-the-day-tray/);
  assert.match(playgroundSource, /seal-the-day-light-secondary/);
  assert.match(playgroundSource, /data-playground-cta-default-label="Seal the Day"/);
  assert.match(playgroundSource, /Seal Another Day/);
  assert.match(playgroundSource, /data-playground-empty-state="quiet-waiting"/);
  assert.match(playgroundSource, /data-playground-month-state=\{empty \? "empty" : "filled"\}/);

  assert.match(journalHomeSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(journalDemoSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-default-label="Seal the Day"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-option="seal-another-day"/);
  assert.doesNotMatch(journalHomeSource, /seal-the-day-tray|seal-the-day-light-secondary|balanced-journal-identity|stronger-journal-identity/);
  assert.doesNotMatch(journalDemoSource, /seal-the-day-tray|seal-the-day-light-secondary|balanced-journal-identity|stronger-journal-identity/);
  assert.doesNotMatch(bottomRitualActionSource, /seal-the-day-light-secondary/);
  assert.doesNotMatch(memoryFormSource, /Seal Another Day|Seal the Day|seal-the-day-tray|seal-the-day-light-secondary/);
  assert.doesNotMatch(exportRendererSource, /Seal Another Day|Seal the Day|seal-the-day-tray|seal-the-day-light-secondary|month-sheet-mobile-density/);
});

test("phase 7R.5G locks Daily Detail shell header and CTA tray playground boundaries", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5G_JOURNAL_SHELL_AND_CTA_PLAYGROUND.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalMemoryPageSource = readSource("components/journal/journal-memory-page.tsx");
  const journalIdentityHeaderSource = readSource("components/journal/journal-identity-header.tsx");
  const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
  const completedStateSource = readSource("components/memory/completed-state.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const exportComposerSource = readSource("components/export/daily-stamp-export-composer.tsx");
  const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
  const apiSource = readSource("lib/capsule/api.ts");
  const dataJournalSource = readSource("data/journal.ts");
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );

  assert.match(implementationSource, /Journal Shell Consistency \+ CTA Action Tray Playground/);
  assert.match(implementationSource, /Daily Detail shell header consistency/);
  assert.match(implementationSource, /Surfaces intentionally excluded from shell header/);
  assert.match(implementationSource, /Save\/Share modal clarification/);
  assert.match(implementationSource, /Future export artifact clarification/);
  assert.match(explorationSource, /Journal identity shell header belongs to browsing\/artifact\/archive surfaces/);
  assert.match(explorationSource, /Save\/Share modal is a utility\/action surface/);
  assert.match(explorationSource, /balanced journal-name\/month-title hierarchy/);
  assert.match(explorationSource, /Seal the Day/);
  assert.match(explorationSource, /CTA tray is not yet production-approved/);

  assert.match(journalHomeSource, /<JournalIdentityHeader/);
  assert.match(journalIdentityHeaderSource, /data-journal-identity-header="true"/);
  assert.match(journalIdentityHeaderSource, /const canRename/);
  assert.match(journalIdentityHeaderSource, /onBeginRename\?/);
  assert.match(journalIdentityHeaderSource, /\{canRename \? \(/);
  assert.match(journalMemoryPageSource, /journalTitle=\{context\.title\}/);
  assert.match(dataJournalSource, /title: string;[\s\S]*totalJournalPhotos/);
  assert.match(apiSource, /title: home\.title/);

  assert.match(stampDetailSource, /JournalIdentityHeader/);
  assert.match(stampDetailSource, /data-daily-detail-shell="journal-identity"/);
  assert.match(stampDetailSource, /journalTitle = journalConfig\.defaultTitle/);
  assert.match(stampDetailSource, /onLock = \(\) => undefined/);
  assert.match(stampDetailSource, /px-3 py-3/);
  assert.doesNotMatch(stampDetailSource, /px-3 py-2 sm:px-4/);
  assert.doesNotMatch(stampDetailSource, /journal-home-surface--mobile-density/);
  assert.doesNotMatch(stampDetailSource, /month-sheet-mobile-density/);
  assert.match(stampDetailSource, /data-daily-detail-mobile-width="approved-playground"/);
  assert.ok(
    stampDetailSource.indexOf("<JournalIdentityHeader") <
      stampDetailSource.indexOf('data-daily-detail-surface="sheer-overlay"'),
    "Daily Detail identity header should render before the translucent overlay",
  );
  assert.match(completedStateSource, /journalTitle\?: string/);
  assert.match(completedStateSource, /onLock\?: \(\) => void/);
  assert.match(persistentFlowSource, /journalTitle\?: string/);
  assert.match(persistentFlowSource, /journalTitle=\{journalTitle\}/);
  assert.match(persistentFlowSource, /onLock=\{\(\) => \{/);
  assert.doesNotMatch(persistentFlowSource, />\s*Back to journal\s*</);
  assert.match(persistentFlowSource, /\{!isJournalMode \? \([\s\S]*Lock journal/);

  assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
  assert.match(stampGridSource, /data-daily-detail-photo-tile="borderless-square"/);
  assert.match(stampDetailSource, /DailyStampExportComposer/);
  assert.match(stampDetailSource, /data-daily-stamp-export-action="true"/);
  assert.match(stampDetailSource, /Edit stamp/);
  assert.match(photoViewerSource, /data-photo-viewer-overlay="fullscreen-viewport"/);

  assert.doesNotMatch(memoryFormSource, /JournalIdentityHeader|data-journal-identity-header/);
  assert.doesNotMatch(journalPhotoPickerSource, /JournalIdentityHeader|data-journal-identity-header/);
  assert.doesNotMatch(scrapTableSource, /JournalIdentityHeader|data-journal-identity-header|journal-title/);
  assert.doesNotMatch(exportComposerSource, /JournalIdentityHeader|data-journal-identity-header|journal-title/);
  assert.doesNotMatch(photoViewerSource, /JournalIdentityHeader|data-journal-identity-header|journal-title/);
  assert.doesNotMatch(exportRendererSource, /JournalIdentityHeader|data-journal-identity-header/);

  assert.match(playgroundSource, /balanced-journal-identity/);
  assert.match(playgroundSource, /stronger-journal-identity/);
  assert.match(playgroundSource, /data-playground-header-alignment="centerline"/);
  assert.match(playgroundSource, /seal-the-day-tray/);
  assert.match(playgroundSource, /seal-the-day-light-secondary/);
  assert.match(playgroundSource, /data-playground-cta-tray="contextual-menu"/);
  assert.match(playgroundSource, /data-playground-backfill-option=\{/);
  assert.match(playgroundSource, /Seal the Day/);
  assert.doesNotMatch(journalHomeSource, /seal-the-day-tray|seal-the-day-light-secondary|balanced-journal-identity|stronger-journal-identity/);
  assert.doesNotMatch(journalDemoSource, /seal-the-day-tray|seal-the-day-light-secondary|balanced-journal-identity|stronger-journal-identity/);
});

test("phase 7R.5H locks Home typography, Seal the Day tray, and Detail playground boundaries", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5H_HOME_CTA_AND_DETAIL_PLAYGROUND.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const appMemoryRouteSource = readSource("app/c/[publicToken]/m/[memoryId]/page.tsx");
  const capsulePageSource = readSource("components/capsule/capsule-page.tsx");
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalMemoryPageSource = readSource("components/journal/journal-memory-page.tsx");
  const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
  const journalIdentityHeaderSource = readSource("components/journal/journal-identity-header.tsx");
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );

  assert.match(implementationSource, /Home CTA And Detail Playground/);
  assert.match(implementationSource, /Production Typography Hierarchy Implementation/);
  assert.match(implementationSource, /Production Seal The Day CTA Tray Implementation/);
  assert.match(implementationSource, /Behavior Semantics/);
  assert.match(implementationSource, /Playground Daily Detail Variants/);
  assert.match(explorationSource, /Variant C typography hierarchy was selected for production/);
  assert.match(explorationSource, /bottom CTA default label changed to `Seal the Day`/);
  assert.match(explorationSource, /Seal Another Day as the backfill entry point/);
  assert.match(explorationSource, /Daily Detail content-only overlay is now being explored in playground only/);
  assert.match(explorationSource, /Copy will be finalized later in Phase 7R\.6A Copy Inventory/);

  assert.match(journalIdentityHeaderSource, /typography\?: "quiet" \| "home-variant-c"/);
  assert.match(journalIdentityHeaderSource, /data-journal-identity-typography=\{typography\}/);
  assert.match(globalCssSource, /\.journal-identity-header--home-variant-c \.journal-identity-header__title\s*\{/);
  const variantHeaderCss = cssRuleBody(
    globalCssSource,
    ".journal-identity-header--home-variant-c .journal-identity-header__title",
  );
  assert.match(variantHeaderCss, /--journal-shell-title-size: 1\.52rem/);
  assert.match(variantHeaderCss, /--journal-shell-title-line-height: 1\.12/);
  assert.match(variantHeaderCss, /--journal-shell-title-weight: 600/);
  assert.match(journalHomeSource, /typography="home-variant-c"/);
  assert.match(journalDemoSource, /typography="home-variant-c"/);
  assert.match(stampDetailSource, /typography="home-variant-c"/);

  assert.match(monthlyStampSheetSource, /data-month-sheet-title-hierarchy="home-variant-c"/);
  assert.match(monthlyStampSheetSource, /month-sheet-title--home-variant-c/);
  assert.doesNotMatch(monthlyStampSheetSource, /text-\[1\.48rem\]|sm:text-\[1\.58rem\]/);
  assert.doesNotMatch(monthlyStampSheetSource, /text-\[1\.85rem\]/);

  assert.match(bottomRitualActionSource, /Seal the Day/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-default-label="Seal the Day"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-tray-state=\{trayOpen \? "open" : "closed"\}/);
  assert.match(bottomRitualActionSource, /\{trayOpen \? \(/);
  assert.match(bottomRitualActionSource, /role="menu"/);
  assert.match(bottomRitualActionSource, /todaySealed \? "Today's Stamp" : "Seal Today"/);
  assert.match(bottomRitualActionSource, /Seal Another Day/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("pointerdown"/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("keydown"/);
  assert.match(bottomRitualActionSource, /event\.key === "Escape"/);
  assert.match(bottomRitualActionSource, /setTrayOpen\(\(current\) => !current\)/);
  assert.match(globalCssSource, /\.journal-bottom-ritual-action__tray\s*\{/);
  assert.match(globalCssSource, /\.journal-bottom-ritual-action__tray-option\s*\{/);
  assert.match(globalCssSource, /padding-bottom: calc\(4\.5rem/);

  assert.match(journalHomeSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(journalHomeSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalHomeSource, /onBackfillAction=\{sealAnotherDay\}/);
  assert.match(journalHomeSource, /router\.push\(`\/c\/\$\{publicToken\}\/m\/\$\{memoryId\}\?create=today`\)/);
  assert.match(journalHomeSource, /router\.push\(`\/c\/\$\{publicToken\}\/m\/\$\{memoryId\}\?create=backfill`\)/);
  assert.match(journalDemoSource, /function createDemoBackfillDraft/);
  assert.match(journalDemoSource, /onBackfillAction=\{sealAnotherDay\}/);

  assert.match(appMemoryRouteSource, /searchParams: Promise<\{ create\?: string \}>/);
  assert.match(appMemoryRouteSource, /create === "today" \|\| create === "backfill"/);
  assert.match(capsulePageSource, /createIntent\?: "today" \| "backfill"/);
  assert.match(
    capsulePageSource,
    /const canUseCachedAccess =[\s\S]*initialGateAllowsCachedAccess[\s\S]*!memoryId \|\| Boolean\(createIntent\)/,
  );
  assert.match(capsulePageSource, /if \(active && cachedAccess && canUseCachedAccess\)/);
  assert.match(capsulePageSource, /createIntent=\{createIntent\}/);
  assert.match(journalMemoryPageSource, /createIntent\?: "today" \| "backfill"/);
  assert.match(journalMemoryPageSource, /createIntent === "today" && !initialMemory/);
  assert.doesNotMatch(journalMemoryPageSource, /!initialMemory && !isBackfillCreate/);
  assert.match(persistentFlowSource, /createIntent\?: "today" \| "backfill"/);
  assert.match(persistentFlowSource, /function createDraftForIntent/);
  assert.match(persistentFlowSource, /localDate: ""/);
  assert.doesNotMatch(persistentFlowSource, /backfillDate\.setDate/);
  assert.match(journalDemoSource, /function createDemoBackfillDraft[\s\S]*localDate: ""/);

  assert.match(memoryFormSource, /type="date"/);
  assert.match(memoryFormSource, /aria-label="Choose stamp date"/);
  assert.match(memoryFormSource, /draft\.localDate === ""/);
  assert.match(memoryFormSource, /: "Choose a date"/);
  assert.match(memoryFormSource, /value=\{selectedLocalDate\}/);
  assert.match(memoryFormSource, /!selectedLocalDate/);
  assert.match(memoryFormSource, /That day is already sealed in this journal\./);
  assert.match(memoryFormSource, /Open that stamp instead\./);

  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.doesNotMatch(stampDetailSource, /Saved in this journal\./);
  assert.match(stampDetailSource, /Back to month sheet/);
  assert.doesNotMatch(stampDetailSource, /data-playground-detail|bottom action dock/i);
  assert.doesNotMatch(exportRendererSource, /Seal the Day|Seal Another Day|data-playground-detail|content-only/);

  assert.match(playgroundSource, /data-playground-track="daily-detail-action-layout-exploration"/);
  assert.match(playgroundSource, /detail-current-reference/);
  assert.match(playgroundSource, /detail-clean-shell-bottom-save/);
  assert.match(playgroundSource, /data-playground-detail-overlay=\{/);
  assert.match(playgroundSource, /data-playground-detail-shell-actions=\{/);
  assert.match(playgroundSource, /data-playground-detail-photo-count=\{photoCount\}/);
  assert.match(playgroundSource, /detailPhotoCounts = \[1, 5, 9\]/);
  assert.match(playgroundSource, /detailThemeIds = \["wine", "ivory"\]/);
});

test("phase 7R.5I aligns CTA tray visuals and keeps Detail shell variants playground-only", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5I_CTA_TRAY_AND_DETAIL_PLAYGROUND.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const journalThemeSource = readSource("data/journal-themes.ts");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );

  assert.match(implementationSource, /CTA Tray And Detail Playground/);
  assert.match(implementationSource, /Production CTA Tray Visual Fix/);
  assert.match(implementationSource, /CTA Tray Behavior Not Changed/);
  assert.match(implementationSource, /State-Aware CTA Options Preserved/);
  assert.match(implementationSource, /Playground Daily Detail Variants/);
  assert.match(explorationSource, /Production CTA tray interaction was already accepted/);
  assert.match(explorationSource, /Daily Detail content-only overlay is now being explored in playground only/);
  assert.match(explorationSource, /Save \/ Share becomes bottom primary CTA/);
  assert.match(explorationSource, /Copy will be finalized later in Phase 7R\.6A Copy Inventory/);

  assert.match(journalThemeSource, /homeCtaTrayBackground/);
  assert.match(journalThemeSource, /transparentMix\(theme\.paperSurface, 70\)/);
  assert.match(journalThemeSource, /transparentMix\(theme\.journalBackground, 64\)/);
  assert.match(journalThemeSource, /transparentMix\(theme\.paperSurface, 16\)/);
  assert.match(journalThemeSource, /"--journal-home-cta-tray-bg": homeCtaTrayBackground/);
  assert.match(journalThemeSource, /"--journal-home-cta-tray-shadow": homeCtaTrayShadow/);

  assert.match(bottomRitualActionSource, /data-seal-the-day-default-label="Seal the Day"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-tray-visual="approved-playground"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-tray-state=\{trayOpen \? "open" : "closed"\}/);
  assert.match(bottomRitualActionSource, /\{trayOpen \? \(/);
  assert.match(bottomRitualActionSource, /role="menu"/);
  assert.match(bottomRitualActionSource, /todaySealed \? "Today's Stamp" : "Seal Today"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-option="seal-another-day"/);
  assert.match(bottomRitualActionSource, /onClick=\{\(\) => choose\(onBackfillAction\)\}/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("pointerdown"/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("keydown"/);

  const trayCss = cssRuleBody(globalCssSource, ".journal-bottom-ritual-action__tray");
  const trayOptionCss = cssRuleBody(
    globalCssSource,
    ".journal-bottom-ritual-action__tray-option",
  );
  const traySecondaryCss = cssRuleBody(
    globalCssSource,
    ".journal-bottom-ritual-action__tray-option--secondary",
  );
  assert.match(trayCss, /--journal-home-cta-tray-bg/);
  assert.match(trayCss, /-webkit-backdrop-filter: blur\(8px\)/);
  assert.match(trayCss, /backdrop-filter: blur\(8px\)/);
  assert.match(trayCss, /border: 0/);
  assert.match(trayCss, /border-radius: 1\.1rem/);
  assert.match(trayCss, /--journal-home-cta-tray-shadow/);
  assert.match(trayCss, /gap: 0\.375rem/);
  assert.match(trayCss, /padding: 0\.5rem/);
  assert.match(trayOptionCss, /background: var\(--journal-home-control-bg\)/);
  assert.match(trayOptionCss, /color: var\(--journal-home-control-text\)/);
  assert.match(trayOptionCss, /font-size: 0\.75rem/);
  assert.match(trayOptionCss, /min-height: 2\.5rem/);
  assert.match(trayOptionCss, /padding: 0\.5rem 1rem/);
  assert.match(traySecondaryCss, /background: var\(--journal-home-control-bg\)/);
  assert.match(traySecondaryCss, /color: var\(--journal-home-control-text\)/);

  assert.match(journalHomeSource, /todaySealed=\{Boolean\(existingToday\)\}/);
  assert.match(journalHomeSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalHomeSource, /onBackfillAction=\{sealAnotherDay\}/);
  assert.match(journalDemoSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalDemoSource, /onBackfillAction=\{sealAnotherDay\}/);

  assert.match(playgroundSource, /data-playground-track="daily-detail-action-layout-exploration"/);
  assert.match(playgroundSource, /detail-current-reference/);
  assert.match(playgroundSource, /detail-clean-shell-bottom-save/);
  assert.doesNotMatch(playgroundSource, /detail-content-only-shell-actions|detail-content-only-action-dock|detail-shell-nav-bottom-save|detail-settings-edit-bottom-save|detail-shell-status-bottom-save/);
  assert.match(playgroundSource, /data-playground-detail-shell-row="back-title-spacer"/);
  assert.match(playgroundSource, /aria-label="Back to month sheet"/);
  assert.match(playgroundSource, /data-playground-detail-back-placement="shell-icon"/);
  assert.match(playgroundSource, /data-playground-detail-right-spacer="balance"/);
  assert.match(playgroundSource, /data-playground-detail-bottom-cta="save-share"/);
  assert.match(playgroundSource, /data-playground-detail-edit-placement="overlay-icon"/);
  assert.match(playgroundSource, /aria-label="Edit stamp"/);
  assert.match(playgroundSource, /detailPhotoCounts = \[1, 5, 9\]/);
  assert.match(playgroundSource, /detailThemeIds = \["wine", "ivory"\]/);

  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.doesNotMatch(stampDetailSource, /Saved in this journal\./);
  assert.match(stampDetailSource, /Back to month sheet/);
  assert.match(stampDetailSource, /data-daily-detail-bottom-cta="save-share"/);
  assert.match(stampDetailSource, /data-daily-detail-edit-placement="overlay-icon"/);
  assert.doesNotMatch(stampDetailSource, /data-playground-detail-shell-row|detail-clean-shell-bottom-save/);
  assert.doesNotMatch(memoryFormSource, /data-playground-detail-bottom-cta|detail-clean-shell-bottom-save/);
  assert.doesNotMatch(exportRendererSource, /data-playground-detail|detail-clean-shell-bottom-save/);
});

test("phase 7R.5I.1 locks bottom CTA parity and final Detail playground cleanup", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5I_1_FINAL_POLISH.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const memoryFormSource = readSource("components/memory/memory-form.tsx");
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const exportComposerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );

  assert.match(implementationSource, /Final Polish/);
  assert.match(implementationSource, /Production Bottom CTA Visual Parity Fix/);
  assert.match(implementationSource, /CTA Behavior And Tray Logic Unchanged/);
  assert.match(implementationSource, /Daily Detail Playground Cleanup/);
  assert.match(implementationSource, /Save\/Share Behavior Note/);
  assert.match(explorationSource, /Production bottom CTA visual was aligned to the approved playground button/);
  assert.match(explorationSource, /Daily Detail candidate now removes `Saved in this journal\.`/);
  assert.match(explorationSource, /Daily Detail candidate removes the top-right settings\/more button/);
  assert.match(explorationSource, /Daily Detail candidate keeps edit as a small pencil icon/);
  assert.match(explorationSource, /Daily Detail candidate keeps Save \/ Share as bottom primary CTA/);
  assert.match(explorationSource, /Export artifact redesign remains Phase 7\.2/);

  assert.match(bottomRitualActionSource, /data-seal-the-day-default-label="Seal the Day"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-cta-visual="approved-playground-button"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-tray-state=\{trayOpen \? "open" : "closed"\}/);
  assert.match(bottomRitualActionSource, /\{trayOpen \? \(/);
  assert.match(bottomRitualActionSource, /role="menu"/);
  assert.match(bottomRitualActionSource, /todaySealed \? "Today's Stamp" : "Seal Today"/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-option="seal-another-day"/);
  assert.match(bottomRitualActionSource, /setTrayOpen\(\(current\) => !current\)/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("pointerdown"/);
  assert.match(bottomRitualActionSource, /document\.addEventListener\("keydown"/);

  const bottomSpecificCtaCss = cssRuleBody(
    globalCssSource,
    ".journal-bottom-ritual-action .journal-bottom-ritual-action__button",
  );
  const bottomCtaCss = cssRuleBody(globalCssSource, ".journal-primary-bottom-cta");
  const bottomDockCss = cssRuleBody(globalCssSource, ".journal-bottom-ritual-action");
  const homeBottomDockCss = cssRuleBody(
    globalCssSource,
    ".journal-home-surface .journal-bottom-ritual-action",
  );
  const homeSurfaceCss = cssRuleBody(globalCssSource, ".journal-home-surface");
  assert.match(bottomCtaCss, /border-radius: 999px/);
  assert.match(bottomCtaCss, /font-size: 0\.875rem/);
  assert.match(bottomCtaCss, /font-weight: 600/);
  assert.match(bottomCtaCss, /min-height: 3rem/);
  assert.match(bottomCtaCss, /padding: 0\.75rem 1rem/);
  assert.match(bottomSpecificCtaCss, /min-height: 3rem/);
  assert.match(bottomDockCss, /bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(bottomDockCss, /position: fixed/);
  assert.match(bottomDockCss, /width: min\(calc\(100vw - 1\.5rem\), 28\.5rem\)/);
  assert.match(homeBottomDockCss, /position: absolute/);
  assert.match(homeBottomDockCss, /left: 0\.75rem/);
  assert.match(homeBottomDockCss, /right: 0\.75rem/);
  assert.match(homeBottomDockCss, /transform: none/);
  assert.match(homeBottomDockCss, /width: auto/);
  assert.match(homeSurfaceCss, /padding-bottom: calc\(4\.5rem \+ env\(safe-area-inset-bottom\)\)/);

  assert.match(journalHomeSource, /<BottomRitualAction/);
  assert.match(journalHomeSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalHomeSource, /onBackfillAction=\{sealAnotherDay\}/);
  assert.match(journalDemoSource, /<BottomRitualAction/);
  assert.match(journalDemoSource, /onTodayAction=\{sealToday\}/);
  assert.match(journalDemoSource, /onBackfillAction=\{sealAnotherDay\}/);

  assert.match(playgroundSource, /detail-clean-shell-bottom-save/);
  assert.match(playgroundSource, /data-playground-detail-shell-row="back-title-spacer"/);
  assert.match(playgroundSource, /data-playground-detail-right-spacer="balance"/);
  assert.match(playgroundSource, /aria-label="Back to month sheet"/);
  assert.match(playgroundSource, /aria-label="Edit stamp"/);
  assert.match(playgroundSource, /data-playground-detail-edit-placement="overlay-icon"/);
  assert.match(playgroundSource, /data-playground-detail-bottom-cta="save-share"/);
  assert.match(playgroundSource, /existing\s+Save \/ Share modal\/composer/);
  assert.match(playgroundSource, /modal chrome and export\s+canvas\s+remain unchanged/);
  assert.match(playgroundSource, /detailPhotoCounts = \[1, 5, 9\]/);
  assert.match(playgroundSource, /detailThemeIds = \["wine", "ivory"\]/);
  assert.doesNotMatch(playgroundSource, /data-playground-detail-settings-button|data-playground-detail-edit-placement="settings-menu"|data-playground-detail-shell-status/);
  assert.doesNotMatch(playgroundSource, /detail-shell-nav-bottom-save|detail-settings-edit-bottom-save|detail-shell-status-bottom-save/);
  assert.equal((playgroundSource.match(/Saved in this journal\./g) ?? []).length, 1);

  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.doesNotMatch(stampDetailSource, /Saved in this journal\./);
  assert.match(stampDetailSource, /Back to month sheet/);
  assert.match(stampDetailSource, /data-daily-detail-bottom-cta="save-share"/);
  assert.doesNotMatch(stampDetailSource, /detail-clean-shell-bottom-save|data-playground-detail-right-spacer/);
  assert.doesNotMatch(memoryFormSource, /detail-clean-shell-bottom-save|data-playground-detail-bottom-cta/);
  assert.doesNotMatch(exportComposerSource, /JournalIdentityHeader|data-journal-identity-header/);
  assert.doesNotMatch(exportRendererSource, /detail-clean-shell-bottom-save|data-playground-detail|Seal the Day|Seal Another Day/);
});

test("phase 7R.5J locks strict visual parity and Detail rebalance correction", () => {
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5J_STRICT_VISUAL_PARITY_AND_DETAIL_REBALANCE.md",
  );
  const parityLockSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5J_VISUAL_PARITY_LOCK.md",
  );
  const parityFailureFixSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5J_1_VISUAL_PARITY_FAILURE_FIX.md",
  );
  const explorationSource = readSource(
    "SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md",
  );
  const globalCssSource = readSource("app/globals.css");
  const visualPrimitivesSource = readSource(
    "components/journal/journal-visual-primitives.tsx",
  );
  const journalIdentityHeaderSource = readSource(
    "components/journal/journal-identity-header.tsx",
  );
  const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
  const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
  const bottomRitualActionSource = readSource(
    "components/journal/bottom-ritual-action.tsx",
  );
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
  const exportComposerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const playgroundSource = readSource(
    "app/design/scrap-day-v2/scrap-day-v2-playground.tsx",
  );

  assert.match(implementationSource, /Strict Visual Parity And Detail Rebalance/);
  assert.match(implementationSource, /Exact Production Fixes Applied/);
  assert.match(implementationSource, /Exact Playground-Only Experiments/);
  assert.match(implementationSource, /Token \/ Shared-Style Hardening/);
  assert.match(implementationSource, /Save \/ Share interaction logic is unchanged/);
  assert.match(parityLockSource, /Pre-edit Parity Audit/);
  assert.match(parityLockSource, /Approved playground component\/file\/class\/token/);
  assert.match(parityLockSource, /JournalStageOverlay/);
  assert.match(parityLockSource, /JournalPrimaryCTA/);
  assert.match(parityLockSource, /JournalActionTray/);
  assert.match(parityFailureFixSource, /Computed Style Parity Audit/);
  assert.match(parityFailureFixSource, /Month Sheet Overlay/);
  assert.match(parityFailureFixSource, /Daily Detail Save \/ Share CTA/);
  assert.match(parityFailureFixSource, /rgba\(232, 219, 204, 0\.13\)/);
  assert.match(parityFailureFixSource, /Shared arrow\/icon primitive/);
  assert.match(explorationSource, /Phase 7R\.5J: Strict Visual Parity \+ Detail Rebalance/);
  assert.match(explorationSource, /Strict correction pass restores the accepted Variant C hierarchy/);
  assert.match(explorationSource, /Daily Detail production now belongs to the same shell system as Month Sheet/);
  assert.match(explorationSource, /Scrap Finder primary `Use this scrap` now uses the same primary CTA family/);

  assert.match(visualPrimitivesSource, /export function JournalStageOverlay/);
  assert.match(visualPrimitivesSource, /data-journal-stage-overlay=\{variant\}/);
  assert.match(visualPrimitivesSource, /export function JournalPrimaryCTA/);
  assert.match(visualPrimitivesSource, /tone="home"/);
  assert.match(visualPrimitivesSource, /data-journal-primary-cta="approved-playground"/);
  assert.match(visualPrimitivesSource, /export function JournalShellIconButton/);
  assert.match(visualPrimitivesSource, /data-journal-icon-button="approved-playground"/);
  assert.match(visualPrimitivesSource, /export function JournalActionTray/);
  assert.match(visualPrimitivesSource, /data-journal-action-tray="approved-playground"/);
  assert.match(visualPrimitivesSource, /export function JournalActionTrayOption/);

  assert.match(journalIdentityHeaderSource, /leftControl\?: ReactNode/);
  assert.match(journalIdentityHeaderSource, /showSettings\?: boolean/);
  assert.match(journalIdentityHeaderSource, /data-journal-header-row=\{rowMode\}/);
  assert.match(journalIdentityHeaderSource, /data-journal-header-right-spacer="balance"/);
  assert.match(journalIdentityHeaderSource, /showSettings \? \(/);

  const variantHeaderCss = cssRuleBody(
    globalCssSource,
    ".journal-identity-header--home-variant-c .journal-identity-header__title",
  );
  const stageOverlayCss = cssRuleBody(globalCssSource, ".journal-stage-overlay");
  const monthStageOverlayCss = cssRuleBody(
    globalCssSource,
    ".journal-stage-overlay--month-sheet",
  );
  const actionTrayCss = cssRuleBody(globalCssSource, ".journal-action-tray");
  const actionTrayOptionCss = cssRuleBody(globalCssSource, ".journal-action-tray__option");
  const detailShellCss = cssRuleBody(globalCssSource, ".daily-detail-shell-surface");
  const shellIconCss = cssRuleBody(
    globalCssSource,
    ".editorial-icon-button.journal-shell-icon-button",
  );
  const homeSurfaceCss = cssRuleBody(globalCssSource, ".journal-home-surface");
  const homeMonthStageOverlayCss = cssRuleBody(
    globalCssSource,
    ".journal-home-surface .journal-stage-overlay--month-sheet",
  );
  const homeDensityCss = cssRuleBody(globalCssSource, ".journal-home-surface--mobile-density");
  const detailBottomActionCss = cssRuleBody(globalCssSource, ".daily-detail-bottom-action");
  const monthTitleCss = cssRuleBody(globalCssSource, ".month-sheet-title--home-variant-c");
  const primaryCtaCss = cssRuleBody(globalCssSource, ".journal-primary-bottom-cta");
  assert.match(variantHeaderCss, /--journal-shell-title-size: 1\.52rem/);
  assert.match(variantHeaderCss, /--journal-shell-title-line-height: 1\.12/);
  assert.match(variantHeaderCss, /--journal-shell-title-weight: 600/);
  assert.match(stageOverlayCss, /background-color: var\(--journal-home-overlay\)/);
  assert.match(stageOverlayCss, /background-image: var\(--journal-home-overlay-gradient\)/);
  assert.match(stageOverlayCss, /backdrop-filter: blur\(1\.5px\)/);
  assert.match(stageOverlayCss, /border: 0/);
  assert.match(stageOverlayCss, /border-radius: 0\.5rem/);
  assert.match(stageOverlayCss, /box-shadow: none/);
  assert.match(stageOverlayCss, /overflow: hidden/);
  assert.match(monthStageOverlayCss, /margin-inline: 0/);
  assert.match(monthStageOverlayCss, /padding: 0/);
  assert.match(shellIconCss, /background: var\(--journal-home-control-bg\)/);
  assert.match(shellIconCss, /height: 2\.75rem/);
  assert.match(shellIconCss, /width: 2\.75rem/);
  assert.match(shellIconCss, /border: 0/);
  assert.match(shellIconCss, /box-shadow: none/);
  assert.match(homeSurfaceCss, /display: flex/);
  assert.match(homeSurfaceCss, /height: 100dvh/);
  assert.match(homeSurfaceCss, /min-height: 100dvh/);
  assert.match(homeSurfaceCss, /position: relative/);
  assert.match(homeSurfaceCss, /width: calc\(100% \+ 1\.5rem\)/);
  assert.match(homeSurfaceCss, /margin: calc\(-0\.75rem - env\(safe-area-inset-top\)\) -0\.75rem/);
  assert.match(homeSurfaceCss, /padding-top: 0\.75rem/);
  assert.match(homeMonthStageOverlayCss, /flex: 1 1 auto/);
  assert.match(homeMonthStageOverlayCss, /max-height: none/);
  assert.match(homeMonthStageOverlayCss, /overflow-y: auto/);
  assert.match(homeDensityCss, /padding-inline: 0\.75rem/);
  assert.match(actionTrayCss, /--journal-home-cta-tray-bg/);
  assert.match(actionTrayCss, /border-radius: 1\.1rem/);
  assert.match(actionTrayCss, /gap: 0\.375rem/);
  assert.match(actionTrayOptionCss, /min-height: 2\.5rem/);
  assert.match(actionTrayOptionCss, /border-radius: 999px/);
  assert.match(detailShellCss, /min-height: 100dvh/);
  assert.match(detailShellCss, /width: calc\(100% \+ 1\.5rem\)/);
  assert.match(detailShellCss, /margin: calc\(-0\.75rem - env\(safe-area-inset-top\)\) -0\.75rem/);
  assert.match(detailShellCss, /padding-bottom: calc\(4\.5rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(detailShellCss, /position: relative/);
  assert.match(detailBottomActionCss, /bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(detailBottomActionCss, /left: 0\.75rem/);
  assert.match(detailBottomActionCss, /position: absolute/);
  assert.match(detailBottomActionCss, /right: 0\.75rem/);
  assert.match(
    globalCssSource,
    /\.journal-themed-background \.journal-leather-surface\s*\{[\s\S]*background: transparent/,
  );
  assert.match(
    globalCssSource,
    /\.journal-themed-background \.journal-leather-surface::before\s*\{[\s\S]*opacity: 0/,
  );
  assert.match(
    globalCssSource,
    /\.journal-themed-background \.journal-leather-surface::after\s*\{[\s\S]*opacity: 0/,
  );
  assert.match(monthTitleCss, /font-size: var\(--journal-month-title-variant-c-size, 1\.36rem\)/);
  assert.match(monthTitleCss, /line-height: 1\.1/);
  assert.match(primaryCtaCss, /min-height: 3rem/);
  assert.match(primaryCtaCss, /border-radius: 999px/);
  assert.match(primaryCtaCss, /font-size: 0\.875rem/);
  assert.match(primaryCtaCss, /font-weight: 600/);
  assert.match(primaryCtaCss, /padding: 0\.75rem 1rem/);

  assert.match(monthlyStampSheetSource, /JournalStageOverlay/);
  assert.match(monthlyStampSheetSource, /JournalShellIconButton/);
  assert.match(monthlyStampSheetSource, /variant="month-sheet"/);
  assert.match(monthlyStampSheetSource, /data-month-sheet-content="approved-playground-inner"/);
  assert.match(monthlyStampSheetSource, /month-sheet-return-row mt-2 min-h-4/);
  assert.match(monthlyStampSheetSource, /month-sheet-approved-content flex flex-col p-2/);
  assert.doesNotMatch(monthlyStampSheetSource, /month-sheet-mobile-density|px-2\.5 py-3/);
  assert.match(monthlyStampSheetSource, /month-sheet-title--home-variant-c/);
  assert.doesNotMatch(monthlyStampSheetSource, /text-\[1\.48rem\]|sm:text-\[1\.58rem\]/);
  assert.match(monthSheetGridSource, /app: "grid-cols-3 gap-1"/);
  assert.match(monthSheetGridSource, /variant === "app" \? "mt-2" : "mt-3"/);
  assert.match(bottomRitualActionSource, /JournalActionTray/);
  assert.match(bottomRitualActionSource, /JournalActionTrayOption/);
  assert.match(bottomRitualActionSource, /JournalPrimaryCTA/);
  assert.match(bottomRitualActionSource, /journal-primary-bottom-cta/);
  assert.match(bottomRitualActionSource, /data-seal-the-day-cta-visual="approved-playground-button"/);

  assert.match(stampDetailSource, /JournalStageOverlay/);
  assert.match(stampDetailSource, /JournalShellIconButton/);
  assert.match(stampDetailSource, /variant="daily-detail"/);
  assert.match(stampDetailSource, /JournalPrimaryCTA/);
  assert.doesNotMatch(
    stampDetailSource,
    /className="daily-detail-content-surface mt-3/,
  );
  assert.match(stampDetailSource, /typography="home-variant-c"/);
  assert.match(stampDetailSource, /leftControl=\{backControl\}/);
  assert.match(stampDetailSource, /showSettings=\{false\}/);
  assert.match(stampDetailSource, /px-3 py-3/);
  assert.match(stampDetailSource, /data-daily-detail-back-placement="shell-icon"/);
  assert.match(stampDetailSource, /aria-label="Back to month sheet"/);
  assert.match(stampDetailSource, /data-daily-detail-spacing="approved-playground-baseline"/);
  assert.match(stampDetailSource, /text-\[0\.62rem\]/);
  assert.match(stampDetailSource, /text-\[1\.48rem\]/);
  assert.doesNotMatch(
    stampDetailSource,
    /text-\[2\.15rem\]|journal-home-surface--mobile-density|month-sheet-mobile-density/,
  );
  assert.match(stampDetailSource, /data-daily-detail-edit-placement="overlay-icon"/);
  assert.match(stampDetailSource, /aria-label="Edit stamp"/);
  assert.match(stampDetailSource, /data-daily-detail-actions="bottom-shell-primary"/);
  assert.match(stampDetailSource, /journal-primary-bottom-cta/);
  assert.match(stampDetailSource, /data-daily-detail-bottom-cta="save-share"/);
  assert.match(stampDetailSource, /onClick=\{\(\) => setExportOpen\(true\)\}/);
  assert.match(stampDetailSource, /DailyStampExportComposer/);
  assert.doesNotMatch(stampDetailSource, /data-journal-settings-trigger|Journal settings|Saved in this journal|<span>Back to month sheet<\/span>/);

  assert.match(scrapTableSource, /JournalPrimaryCTA/);
  assert.match(scrapTableSource, /scrap-finder-primary-button journal-primary-bottom-cta/);
  assert.match(scrapTableSource, /data-scrap-primary-cta-visual="journal-primary-bottom-cta"/);
  const scrapPrimaryCss = cssRuleBody(globalCssSource, ".scrap-finder-primary-button");
  assert.match(scrapPrimaryCss, /background: var\(--journal-home-cta-bg\)/);
  assert.match(scrapPrimaryCss, /box-shadow: var\(--journal-home-cta-shadow\)/);
  assert.match(scrapPrimaryCss, /color: var\(--journal-home-cta-text\)/);

  assert.match(playgroundSource, /data-playground-track="daily-detail-vertical-rebalance-study"/);
  assert.match(playgroundSource, /spacing-baseline-clean/);
  assert.match(playgroundSource, /spacing-airier-grid-start/);
  assert.match(playgroundSource, /spacing-optical-center/);
  assert.match(playgroundSource, /data-playground-detail-spacing=\{spacingVariant\.id\}/);
  assert.match(playgroundSource, /data-playground-detail-spacing-candidate=\{effectiveSpacing\.id\}/);
  assert.match(playgroundSource, /detailPhotoCounts = \[1, 5, 9\]/);
  assert.match(playgroundSource, /detailThemeIds = \["wine", "ivory"\]/);
  assert.doesNotMatch(playgroundSource, /data-playground-detail-settings-button|data-playground-detail-shell-status/);

  assert.doesNotMatch(exportComposerSource, /JournalIdentityHeader|data-journal-identity-header/);
  assert.doesNotMatch(exportRendererSource, /journal-primary-bottom-cta|data-daily-detail-bottom-cta|data-playground-detail/);
});

test("copy inventory and phase 7.1 handoff stay documentation-only", () => {
  const copyDeckSource = readSource("SCRAP_DAY_COPY_DECK.md");
  const implementationSource = readSource(
    "SCRAP_DAY_IMPLEMENTATION_PHASE_7_1_EDITORIAL_VISUAL_SYSTEM.md",
  );

  assert.match(copyDeckSource, /Copy governance/);
  assert.match(copyDeckSource, /Owner Final Copy/);
  assert.match(copyDeckSource, /Apply only rows whose \*\*Status\*\* is `approved`/);
  assert.match(copyDeckSource, /Preserve every dynamic variable shown in braces/);
  assert.match(copyDeckSource, /Journal Home and Month Sheet/);
  assert.match(copyDeckSource, /Create And Seal Today Flow/);
  assert.match(copyDeckSource, /Cover Scrap And Moments/);
  assert.match(copyDeckSource, /Scrap Finder \/ Scrap Table/);
  assert.match(copyDeckSource, /Daily Memory Stamp Detail/);
  assert.match(copyDeckSource, /Save \/ Share Modal/);
  assert.match(copyDeckSource, /Daily Export/);
  assert.match(copyDeckSource, /Explicitly excluded from customer-copy application/);
  assert.match(implementationSource, /Phase 7\.2 Export Redesign Handoff/);
  assert.match(implementationSource, /Show the journal name by default/);
  assert.match(implementationSource, /photos occupy roughly 60-70%/i);
  assert.match(implementationSource, /transparent MGP logo/);
  assert.match(implementationSource, /Remove heavy childish stamp borders/);
  assert.match(implementationSource, /No runtime copy\s+registry was created/);
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

test("journal rename and identity title handle long names without colliding with shell controls", () => {
  const globalCssSource = readSource("app/globals.css");
  const dataJournalSource = readSource("data/journal.ts");
  const journalHomeSource = readSource("components/journal/journal-home.tsx");
  const journalIdentityHeaderSource = readSource(
    "components/journal/journal-identity-header.tsx",
  );
  const titleCss = cssRuleBody(globalCssSource, ".journal-identity-header__title");
  const variantTitleCss = cssRuleBody(
    globalCssSource,
    ".journal-identity-header--home-variant-c .journal-identity-header__title",
  );

  assert.match(dataJournalSource, /maxTitleLength: 20/);
  assert.match(journalHomeSource, /clampJournalTitle/);
  assert.match(journalHomeSource, /updateJournalTitle\([\s\S]*clampJournalTitle\(titleDraft\)/);
  assert.match(journalHomeSource, /setTitleDraft\(next\.title\)/);
  assert.match(journalHomeSource, /titleDraft\.length > journalConfig\.maxTitleLength/);
  assert.match(journalIdentityHeaderSource, /const displayTitle = title;/);
  assert.match(journalIdentityHeaderSource, /maxLength=\{journalConfig\.maxTitleLength\}/);
  assert.match(journalIdentityHeaderSource, /aria-describedby=\{titleInputHintId\}/);
  assert.match(journalIdentityHeaderSource, /Up to \{journalConfig\.maxTitleLength\} characters/);
  assert.match(journalIdentityHeaderSource, /\{titleLength\}\/\{journalConfig\.maxTitleLength\}/);
  assert.match(journalIdentityHeaderSource, /data-journal-title-lines="2"/);
  assert.doesNotMatch(journalIdentityHeaderSource, /journal-identity-header__title truncate/);

  assert.match(titleCss, /display: -webkit-box/);
  assert.match(titleCss, /-webkit-line-clamp: 2/);
  assert.match(titleCss, /max-width: min\(13\.75rem, 100%\)/);
  assert.match(titleCss, /overflow-wrap: anywhere/);
  assert.match(titleCss, /font-weight: var\(--journal-shell-title-weight, 600\)/);
  assert.match(titleCss, /padding-block: 0\.05em 0\.18em/);
  assert.match(variantTitleCss, /--journal-shell-title-size: 1\.52rem/);
  assert.match(variantTitleCss, /--journal-shell-title-line-height: 1\.12/);
  assert.match(variantTitleCss, /--journal-shell-title-weight: 600/);
  assert.match(variantTitleCss, /max-width: min\(13\.25rem, 100%\)/);
});

test("additional moments keep the first available selections and render compact previews", () => {
  const journalPhotoPickerSource = readSource(
    "components/memory/journal-photo-picker.tsx",
  );
  const photoOptimisationSource = readSource(
    "lib/media/photo-optimisation.ts",
  );

  assert.match(
    journalPhotoPickerSource,
    /const acceptedFiles = allowedBySize\.slice\(0, remainingAdditionalSlots\)/,
  );
  assert.match(
    journalPhotoPickerSource,
    /const overLimitCount = allowedBySize\.length - acceptedFiles\.length/,
  );
  assert.doesNotMatch(journalPhotoPickerSource, /No moments were added/);
  assert.match(journalPhotoPickerSource, /createPhotoEditorPreview/);
  assert.match(journalPhotoPickerSource, /thumbnailObjectUrl: previewUrl/);
  assert.match(journalPhotoPickerSource, /await yieldToBrowser\(\)/);
  assert.match(journalPhotoPickerSource, /isPreparingAdditional/);
  assert.match(
    journalPhotoPickerSource,
    /additionalCapacity\.remaining === 0 \|\| isPreparingAdditional/,
  );
  assert.match(journalPhotoPickerSource, /This journal has reached its photo limit\./);
  assert.doesNotMatch(journalPhotoPickerSource, /Choose up to \{remainingAdditional\} at once/);
  assert.match(
    photoOptimisationSource,
    /export async function createPhotoEditorPreview/,
  );
  assert.match(
    photoOptimisationSource,
    /config\.maxThumbnailPhotoEdgePixels/,
  );
});

test("editing an existing journal stamp uses the full cover image and compact moment thumbnails", () => {
  const journalPhotoPickerSource = readSource(
    "components/memory/journal-photo-picker.tsx",
  );
  const persistentFlowSource = readSource(
    "components/capsule/persistent-memory-flow.tsx",
  );
  const sortableGridSource = readSource(
    "components/memory/sortable-photo-grid.tsx",
  );

  assert.match(
    journalPhotoPickerSource,
    /return photo\?\.objectUrl \?\? photo\?\.thumbnailObjectUrl/,
  );
  assert.match(
    persistentFlowSource,
    /const coverDisplayUrl = saved\.photos\[0\]\?\.storagePath[\s\S]*urlCache\.resolve\(saved\.photos\[0\]\.storagePath\)/,
  );
  assert.match(
    sortableGridSource,
    /photo\.thumbnailObjectUrl \?\? photo\.objectUrl/,
  );
});
