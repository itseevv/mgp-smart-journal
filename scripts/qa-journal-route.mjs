import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  DEFAULT_STAMP_FRAME_ASPECT_RATIO,
  JOURNAL_VOLUME_VOICE_NOTE_MAX_BYTES,
  JOURNAL_VOICE_MEMOS_ENABLED,
  JOURNAL_VOICE_NOTE_MAX_BYTES,
  JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND,
  STAMP_FRAME_RATIO_MODE,
} from "../data/journal-product.ts";
import { getMemoryFormProductRules } from "../data/memory-form-product.ts";
import { getStampLayout } from "../data/stamp-layouts.ts";

const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const isSmoke =
  process.env.JOURNAL_QA_SMOKE === "1" || process.argv.includes("--smoke");
const routeTimeoutMs = Number.parseInt(
  process.env.JOURNAL_QA_TIMEOUT_MS ?? (isSmoke ? "8000" : "15000"),
  10,
);
const oldStrings = [
  "New memory",
  "Name this memory",
  "Memory title",
  "Photographs",
  "0 of 30 photos",
  "30 photos",
  "Voice memos",
  "Record a voice memo",
  "Save memory",
  "New Daily Scrap",
  "Edit stamp",
  "Save stamp",
  "Choose today's scrap",
  "Find today's scrap",
  "Save / Share",
  "Save or share",
  "Save Image",
  "Creating image...",
  "No scraps yet.",
];
const createStrings = [
  "New Memory Stamp",
  "One line to keep",
  "What would you call today?",
  "Cover Scrap",
  "Choose today’s Cover Scrap",
  "One photo is enough to seal the day.",
  "Seal this day",
];
const sealingStrings = [
  "One line to keep",
  "What would you call today?",
  "Adjust scrap",
  "Add more moments",
  "Seal this day",
];
const cropStrings = [
  "Find Your Cover Scrap",
  "Move the photo under the finder.",
  "Use this scrap",
  "Reset",
];
const createForbiddenStrings = [
  "Time",
  "Draft",
  "Date and time are added automatically",
  "0 of 9 moments",
  "1 of 9 moments",
  "Up to 9 moments.",
  "1 moment added",
  "Press and drag to reorder",
];
const archiveForbiddenStrings = [
  "missed day",
  "missed days",
  "streak",
  "habit",
  "0/31",
  "0 / 31",
  "photo quota",
  "voice memo",
];

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function assertMobileShell(routeName, html) {
  assert.match(
    html,
    /data-journal-mobile-shell="true"/,
    `${routeName} is missing the journal mobile shell marker`,
  );
  assert.match(
    html,
    /journal-mobile-shell/,
    `${routeName} is missing the journal mobile shell class`,
  );
}

function assertNoOldStrings(routeName, html) {
  const text = visibleText(html);
  for (const phrase of oldStrings) {
    assert.equal(
      text.includes(phrase) || html.includes(phrase),
      false,
      `${routeName} still exposes old journal QA copy: ${phrase}`,
    );
  }
}

function visibleText(html) {
  return htmlWithoutScripts(html)
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlWithoutScripts(html) {
  return html
    .replace(/<script\b[^>]*>.*?<\/script>/gs, " ")
    .replace(/<style\b[^>]*>.*?<\/style>/gs, " ");
}

function normalizedContent(html) {
  return `${visibleText(html)} ${htmlWithoutScripts(html)}`
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

async function fetchRoute(path) {
  const url = `${baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(routeTimeoutMs),
    });
  } catch (error) {
    throw new Error(
      `${path} did not respond within ${routeTimeoutMs}ms at ${url}: ${error.message}`,
      { cause: error },
    );
  }
  const html = await response.text();
  assert.equal(
    response.ok,
    true,
    `${path} returned ${response.status}: ${html.slice(0, 200)}`,
  );
  return { html, url: response.url };
}

const rules = getMemoryFormProductRules("journal");
assert.equal(DAILY_MEMORY_STAMP_MAX_PHOTOS, 9);
assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, true);
assert.equal(JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND, 32_000);
assert.equal(JOURNAL_VOICE_NOTE_MAX_BYTES, 6 * 1024 * 1024);
assert.equal(JOURNAL_VOLUME_VOICE_NOTE_MAX_BYTES, 2_296_381_440);
assert.equal(STAMP_FRAME_RATIO_MODE, "square");
assert.equal(DEFAULT_STAMP_FRAME_ASPECT_RATIO, 1);
assert.equal(rules.maxPhotosPerEntry, 9);
assert.equal(rules.voiceMemosEnabled, true);

const journalRouteSource = readSource("components/journal/journal-memory-page.tsx");
const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
const monthSheetGridSource = readSource("components/journal/month-sheet-grid.tsx");
const monthlyStampSheetSource = readSource("components/journal/monthly-stamp-sheet.tsx");
const stampTileSource = readSource("components/journal/stamp-tile.tsx");
const memoryDemoSource = readSource("app/memory/demo/page.tsx");
const journalDemoPageSource = readSource("app/journal/demo/page.tsx");
const capsulePageSource = readSource("components/capsule/capsule-page.tsx");
const publicCapsulePageSource = readSource("app/c/[publicToken]/page.tsx");
const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
const croppedStampImageSource = readSource("components/stamp/cropped-stamp-image.tsx");
const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
const voiceRecorderSource = readSource("components/memory/voice-recorder.tsx");
const journalVoiceNotePlayerSource = readSource(
  "components/memory/journal-voice-note-player.tsx",
);
const scrapTableSource = readSource("components/scrap/scrap-table.tsx");
const stampFrameSource = readSource("components/stamp/stamp-frame.tsx");
const photoViewerSource = readSource("components/memory/photo-viewer.tsx");
const globalCssSource = readSource("app/globals.css");
const migrationSource = readSource(
  "supabase/migrations/202607030001_scrap_day_phase_2_cover_crop.sql",
);
const phase3MigrationSource = readSource(
  "supabase/migrations/202607040001_scrap_day_phase_3_local_date.sql",
);
const phase42MigrationSource = readSource(
  "supabase/migrations/202607050001_scrap_day_phase_4_2_month_sheet_cover_crop.sql",
);

assert.match(publicCapsulePageSource, /searchParams/);
assert.match(publicCapsulePageSource, /initialMonth=\{month\}/);
assert.match(journalRouteSource, /productMode="journal"/);
assert.match(journalRouteSource, /existingToday/);
assert.match(journalRouteSource, /Today is already sealed in this journal/);
assert.match(journalRouteSource, /Open today’s stamp/);
assert.match(journalRouteSource, /monthKeyForJournalMemory/);
assert.match(journalRouteSource, /\?month=/);
assert.match(persistentFlowSource, /Math\.min\(productRules\.maxPhotosPerEntry, maxPhotos\)/);
assert.match(persistentFlowSource, /journalStamps/);
assert.match(persistentFlowSource, /findDuplicateStampForLocalDate/);
assert.match(persistentFlowSource, /onBackToJournalMonth/);
assert.match(journalDemoSource, /productMode="journal"/);
assert.match(journalDemoSource, /initialScreen\?: "home" \| "create" \| "crop" \| "sealed" \| "detail"/);
assert.match(journalDemoSource, /scenario\?: "duplicate-today" \| "backfill-may"/);
assert.match(journalDemoSource, /createBackfillDemoStamp/);
assert.match(journalDemoSource, /createArchiveDemoStamps/);
assert.match(journalDemoSource, /monthlyStampArchive/);
assert.match(journalDemoSource, /useMonthQueryState/);
assert.match(journalDemoSource, /returnToMonthSheet/);
assert.match(journalDemoSource, /searchParams\.set\("screen", "home"\)/);
assert.match(journalDemoSource, /createArchiveMonthStamps\("2026-08"/);
assert.match(journalDemoSource, /Array\.from\(\{ length: 31 \}/);
assert.match(journalDemoSource, /maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS/);
assert.match(memoryDemoSource, /redirect\("\/journal\/demo"\)/);
assert.match(journalDemoPageSource, /JournalMobileShell/);
assert.match(journalDemoPageSource, /month\?: string/);
assert.match(journalDemoPageSource, /screen === "crop"/);
assert.match(journalDemoPageSource, /screen === "sealed"/);
assert.match(capsulePageSource, /JournalMobileShell/);
assert.match(capsulePageSource, /initialMonth\?: string/);
assert.match(capsulePageSource, /initialMonth=\{initialMonth\}/);
assert.match(monthlyStampSheetSource, /Back to this month/);
assert.match(monthlyStampSheetSource, /MonthSheetGrid/);
assert.match(monthlyStampSheetSource, /data-monthly-stamp-export-action="true"/);
assert.doesNotMatch(monthlyStampSheetSource, /journal-sheets-title/);
assert.doesNotMatch(monthlyStampSheetSource, /archive\.stampedSheets/);
assert.doesNotMatch(monthlyStampSheetSource, />\s*Sheets\s*</);
assert.doesNotMatch(monthlyStampSheetSource, /grid-cols-2/);
assert.doesNotMatch(
  monthlyStampSheetSource,
  /missed|streak|habit|voiceMemoCount|photo quota/i,
);
assert.match(monthSheetGridSource, /MONTH_SHEET_COLUMNS/);
assert.match(monthSheetGridSource, /MONTH_SHEET_ROWS/);
assert.match(monthSheetGridSource, /MONTH_SHEET_CAPACITY/);
assert.match(monthSheetGridSource, /data-month-sheet-grid="true"/);
assert.match(monthSheetGridSource, /grid-cols-4/);
assert.match(monthSheetGridSource, /variant\?: "app" \| "export"/);
assert.match(stampTileSource, /StampFrame/);
assert.match(stampTileSource, /variant="sm"/);
assert.match(stampTileSource, /data-month-sheet-day/);
assert.match(stampTileSource, /data-month-sheet-position/);
assert.match(stampTileSource, /CroppedStampImage/);
assert.match(stampTileSource, /data-month-sheet-cover-crop/);
assert.match(stampTileSource, /coverCropMetadata/);
assert.doesNotMatch(stampTileSource, /<time|mt-2 block truncate/);
assert.match(stampDetailSource, /Back to month sheet/);
assert.match(stampDetailSource, /onBackToMonthSheet/);
assert.doesNotMatch(stampDetailSource, />\s*SD\s*</);
assert.match(stampGridSource, /getStampLayout/);
assert.match(stampGridSource, /PhotoViewer/);
assert.match(stampGridSource, /object-cover/);
assert.match(stampGridSource, /data-stamp-grid-columns=\{columns\}/);
assert.match(stampGridSource, /data-stamp-row-sizes=\{layout\.rowSizes\.join\(","\)\}/);
assert.match(stampGridSource, /data-daily-detail-photo-grid="borderless-adaptive"/);
assert.match(stampGridSource, /data-stamp-frame-ratio/);
assert.match(stampGridSource, /data-stamp-cover-crop/);
assert.match(stampGridSource, /CroppedPrivateStampImage/);
assert.match(croppedStampImageSource, /cropMetadataToImageStyle/);
assert.match(croppedStampImageSource, /centerSquareCropMetadata/);
assert.match(croppedStampImageSource, /data-stamp-cropped-image/);
assert.doesNotMatch(stampGridSource, /object-contain|data-stamp-filler-count|StampFiller/);
assert.match(journalPhotoPickerSource, /object-cover/);
assert.match(journalPhotoPickerSource, /journal-cover-photo-preview/);
assert.match(journalPhotoPickerSource, /data-journal-cover-preview="editorial-photo"/);
assert.match(journalPhotoPickerSource, /data-journal-cover-treatment="borderless-editorial"/);
assert.match(journalPhotoPickerSource, /data-journal-cover-crop/);
assert.match(journalPhotoPickerSource, /onConfirmCrop/);
assert.match(voiceRecorderSource, /A whisper from today/);
assert.match(
  voiceRecorderSource,
  /Let today linger in your voice before it is sealed\./,
);
assert.match(voiceRecorderSource, /aria-label="Record a voice note"/);
assert.match(
  voiceRecorderSource,
  /audioBitsPerSecond: JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND/,
);
assert.match(voiceRecorderSource, /"audio\/mp4"/);
assert.match(
  voiceRecorderSource,
  /blob\.size > config\.maxVoiceMemoFileSizeBytes/,
);
assert.match(journalVoiceNotePlayerSource, /aria-label="Voice note"/);
assert.match(journalVoiceNotePlayerSource, /Play voice note/);
assert.match(journalVoiceNotePlayerSource, /state = "viewer"/);
assert.doesNotMatch(journalPhotoPickerSource, /StampFrame|data-stamp-edge|variant="md"/);
assert.doesNotMatch(journalPhotoPickerSource, /object-contain|aspect-\[4\/5\]|preserveAspectRatio/);
assert.match(stampFrameSource, /export type StampFrameVariant = "lg" \| "md" \| "sm"/);
assert.match(stampFrameSource, /export const StampFrame/);
assert.match(stampFrameSource, /export const StampFrameButton/);
assert.match(stampFrameSource, /data-stamp-edge="perforated"/);
assert.match(stampFrameSource, /data-stamp-frame=\{variant\}/);
assert.match(globalCssSource, /\.stamp-frame::before/);
assert.match(globalCssSource, /--stamp-rim-width/);
assert.match(globalCssSource, /--stamp-rim-color/);
assert.match(globalCssSource, /--stamp-inner-contrast/);
assert.match(globalCssSource, /--stamp-cutout-shadow/);
assert.match(globalCssSource, /\.stamp-frame--lg\s*\{[\s\S]*--stamp-rim-width: 10px/);
assert.match(globalCssSource, /\.stamp-frame--md\s*\{[\s\S]*--stamp-rim-width: 7px/);
assert.match(globalCssSource, /\.stamp-frame--sm\s*\{[\s\S]*--stamp-rim-width: 4px/);
assert.match(globalCssSource, /\.stamp-frame--sm\s*\{[\s\S]*--stamp-edge-opacity: 0\.92/);
assert.match(scrapTableSource, /data-scrap-table="true"/);
assert.match(scrapTableSource, /data-scrap-table-mode="immersive"/);
assert.match(scrapTableSource, /data-scrap-frame="square"/);
assert.match(scrapTableSource, /data-scrap-layout="dedicated-mobile"/);
assert.match(scrapTableSource, /data-scrap-controls="action-row"/);
assert.match(scrapTableSource, /data-finder-tool="editorial-finder"/);
assert.match(scrapTableSource, /data-scrap-aperture="finder-window"/);
assert.match(scrapTableSource, /data-punch-feedback="enabled"/);
assert.match(scrapTableSource, /data-scrap-photo-natural="true"/);
assert.match(scrapTableSource, /Use this scrap/);
assert.doesNotMatch(scrapTableSource, /StampFrame|data-stamp-edge|variant="lg"/);
assert.doesNotMatch(scrapTableSource, />\s*Scrap Table\s*</);
assert.doesNotMatch(scrapTableSource, /Crop image|Edit photo|Aspect ratio|Template|Collage/);
assert.match(photoViewerSource, /object-contain/);
assert.doesNotMatch(photoViewerSource, /object-cover/);
assert.match(migrationSource, /add column if not exists crop_metadata jsonb/);
assert.match(migrationSource, /crop_metadata = item\.crop_metadata/);
assert.match(phase42MigrationSource, /'coverCropMetadata', first_photo\.crop_metadata/);
assert.match(phase42MigrationSource, /'firstPhotoStoragePath', first_photo\.storage_path/);
assert.match(phase3MigrationSource, /add column if not exists local_date date/);
assert.match(phase3MigrationSource, /add column if not exists local_timezone text/);
assert.match(phase3MigrationSource, /memories_capsule_local_date_unique/);
assert.match(phase3MigrationSource, /DUPLICATE_LOCAL_DATE/);
assert.match(phase3MigrationSource, /coalesce\(memory\.local_date, memory\.occurred_at::date\)/);

const journalHome = await fetchRoute("/journal/demo");
assertNoOldStrings("journal demo home", journalHome.html);
assertMobileShell("journal demo home", journalHome.html);
const journalHomeText = visibleText(journalHome.html);
assert.match(journalHomeText, /Seal the Day/);
assert.match(journalHomeText, /August 2026/);

const journalHomeScreen = await fetchRoute("/journal/demo?screen=home");
assertNoOldStrings("journal demo home screen", journalHomeScreen.html);
assertMobileShell("journal demo home screen", journalHomeScreen.html);
assert.match(visibleText(journalHomeScreen.html), /AUGUST 2026/i);

const journalHomeJuly = await fetchRoute("/journal/demo?screen=home&month=2026-07");
assertNoOldStrings("journal demo July sheet", journalHomeJuly.html);
assertMobileShell("journal demo July sheet", journalHomeJuly.html);
const journalHomeJulyText = visibleText(journalHomeJuly.html);
assert.match(journalHomeJulyText, /JULY 2026/i);
assert.match(journalHomeJuly.html, /data-month-sheet-grid="true"/);
assert.match(journalHomeJuly.html, /data-month-sheet-columns="3"/);
assert.doesNotMatch(journalHomeJuly.html, /data-month-sheet-rows=/);
assert.match(journalHomeJuly.html, /data-month-sheet-capacity="32"/);
assert.match(journalHomeJuly.html, /data-month-sheet-cover-crop="metadata"/);
assert.doesNotMatch(journalHomeJulyText, /\bSheets\b/);
assert.doesNotMatch(journalHomeJulyText, /Peaches on the sill|Late light on the bus/);
assert.doesNotMatch(journalHomeJulyText, /2026-07-/);

const journalHomeJune = await fetchRoute("/journal/demo?screen=home&month=2026-06");
assertNoOldStrings("journal demo June sheet", journalHomeJune.html);
assertMobileShell("journal demo June sheet", journalHomeJune.html);
const journalHomeJuneText = visibleText(journalHomeJune.html);
assert.match(journalHomeJuneText, /JUNE 2026/i);
assert.match(journalHomeJuneText, /7 .*8 .*15 .*22/);
assert.match(journalHomeJune.html, /data-month-sheet-position="1"/);
assert.match(journalHomeJune.html, /data-month-sheet-position="4"/);
assert.match(journalHomeJune.html, /data-month-sheet-cover-crop="metadata"/);
assert.doesNotMatch(journalHomeJuneText, /\bSheets\b/);
assert.doesNotMatch(journalHomeJuneText, /Market flowers|Blue hour walk/);
assert.doesNotMatch(journalHomeJuneText, /2026-06-/);
assert.match(journalHomeJuneText, /Back to this month/);

const journalHomeAugust = await fetchRoute("/journal/demo?screen=home&month=2026-08");
assertNoOldStrings("journal demo August dense sheet", journalHomeAugust.html);
assertMobileShell("journal demo August dense sheet", journalHomeAugust.html);
const journalHomeAugustText = visibleText(journalHomeAugust.html);
assert.match(journalHomeAugustText, /AUGUST 2026/i);
assert.match(journalHomeAugust.html, /data-month-sheet-position="31"/);
assert.doesNotMatch(journalHomeAugust.html, /data-month-sheet-position="33"/);
assert.doesNotMatch(journalHomeAugustText, /Market flowers|Night market/);
assert.doesNotMatch(journalHomeAugustText, /2026-08-/);

const journalHomeMay = await fetchRoute("/journal/demo?screen=home&month=2026-05");
assertNoOldStrings("journal demo May sheet", journalHomeMay.html);
assertMobileShell("journal demo May sheet", journalHomeMay.html);
const journalHomeMayText = visibleText(journalHomeMay.html);
assert.match(journalHomeMayText, /MAY 2026/i);
assert.match(journalHomeMayText, /8 .*21/);
assert.doesNotMatch(journalHomeMayText, /A quiet May morning|First iced coffee/);
assert.doesNotMatch(journalHomeMayText, /2026-05-/);

const journalHomeApril = await fetchRoute("/journal/demo?screen=home&month=2026-04");
assertNoOldStrings("journal demo empty April sheet", journalHomeApril.html);
assertMobileShell("journal demo empty April sheet", journalHomeApril.html);
const journalHomeAprilText = visibleText(journalHomeApril.html);
assert.match(journalHomeAprilText, /APRIL 2026/i);
assert.doesNotMatch(journalHomeApril.html, /data-month-sheet-day=/);
assert.match(journalHomeAprilText, /Seal the Day/);

const journalHomeInvalidMonth = await fetchRoute(
  "/journal/demo?screen=home&month=not-a-month",
);
assertNoOldStrings("journal demo invalid month", journalHomeInvalidMonth.html);
assertMobileShell("journal demo invalid month", journalHomeInvalidMonth.html);
assert.match(visibleText(journalHomeInvalidMonth.html), /AUGUST 2026/i);

for (const [routeName, html] of [
  ["journal demo home", journalHome.html],
  ["journal demo July sheet", journalHomeJuly.html],
  ["journal demo June sheet", journalHomeJune.html],
  ["journal demo August dense sheet", journalHomeAugust.html],
  ["journal demo May sheet", journalHomeMay.html],
  ["journal demo empty April sheet", journalHomeApril.html],
]) {
  const text = visibleText(html).toLowerCase();
  for (const phrase of archiveForbiddenStrings) {
    assert.equal(
      text.includes(phrase),
      false,
      `${routeName} exposes archive pressure copy: ${phrase}`,
    );
  }
}

const journalCreate = await fetchRoute("/journal/demo?screen=create");
assertNoOldStrings("journal demo create", journalCreate.html);
assertMobileShell("journal demo create", journalCreate.html);
const journalCreateText = normalizedContent(journalCreate.html);
const journalCreateVisibleText = visibleText(journalCreate.html)
  .replace(/&apos;|&#x27;/g, "'")
  .replace(/\s+/g, " ");
for (const phrase of createStrings) {
  assert.equal(
    journalCreateText.includes(phrase),
    true,
    `journal demo create is missing expected copy: ${phrase}`,
  );
}
for (const phrase of createForbiddenStrings) {
  assert.equal(
    journalCreateVisibleText.includes(phrase),
    false,
    `journal demo create still exposes dense form copy: ${phrase}`,
  );
}
assert.equal(
  journalCreateVisibleText.includes("Add more moments"),
  false,
  "journal demo empty create should not show optional moments before a cover exists",
);
assert.equal(
  journalCreateVisibleText.includes("One line to keep"),
  true,
  "journal demo empty create should show the one-line field before cover crop",
);
assert.doesNotMatch(
  journalCreate.html,
  /data-scrap-table="true"/,
  "journal demo empty create should not render an inline Scrap Table",
);
assert.match(
  journalCreate.html,
  /disabled=""/,
  "journal demo empty create should render the Seal this day CTA as disabled",
);

if (isSmoke) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "smoke",
        timeoutMs: routeTimeoutMs,
        checkedRoutes: [
          `${baseUrl}/journal/demo`,
          `${baseUrl}/journal/demo?screen=home`,
          `${baseUrl}/journal/demo?screen=home&month=2026-07`,
          `${baseUrl}/journal/demo?screen=home&month=2026-06`,
          `${baseUrl}/journal/demo?screen=home&month=2026-08`,
          `${baseUrl}/journal/demo?screen=home&month=2026-04`,
          `${baseUrl}/journal/demo?screen=home&month=not-a-month`,
          `${baseUrl}/journal/demo?screen=create`,
        ],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const journalDuplicateToday = await fetchRoute(
  "/journal/demo?screen=create&scenario=duplicate-today",
);
assertNoOldStrings("journal demo duplicate today", journalDuplicateToday.html);
assertMobileShell("journal demo duplicate today", journalDuplicateToday.html);
const journalDuplicateTodayText = normalizedContent(journalDuplicateToday.html);
assert.match(
  journalDuplicateTodayText,
  /That day is already sealed in this journal/,
);
assert.match(journalDuplicateTodayText, /Open that stamp instead/);

const journalBackfillDuplicate = await fetchRoute(
  "/journal/demo?screen=create&scenario=backfill-may",
);
assertNoOldStrings("journal demo backfill duplicate", journalBackfillDuplicate.html);
assertMobileShell("journal demo backfill duplicate", journalBackfillDuplicate.html);
const journalBackfillDuplicateText = normalizedContent(
  journalBackfillDuplicate.html,
);
assert.match(
  journalBackfillDuplicateText,
  /That day is already sealed in this journal/,
);

const journalCrop = await fetchRoute("/journal/demo?screen=crop");
assertNoOldStrings("journal demo crop", journalCrop.html);
assertMobileShell("journal demo crop", journalCrop.html);
const journalCropText = normalizedContent(journalCrop.html);
for (const phrase of cropStrings) {
  assert.equal(
    journalCropText.includes(phrase),
    true,
    `journal demo crop is missing expected copy: ${phrase}`,
  );
}
assert.match(journalCrop.html, /data-scrap-table="true"/);
assert.match(journalCrop.html, /data-scrap-table-mode="immersive"/);
assert.match(journalCrop.html, /data-scrap-frame="square"/);
assert.match(journalCrop.html, /data-scrap-layout="dedicated-mobile"/);
assert.match(journalCrop.html, /data-scrap-controls="action-row"/);
assert.match(journalCrop.html, /data-finder-tool="editorial-finder"/);
assert.match(journalCrop.html, /data-scrap-aperture="finder-window"/);
assert.doesNotMatch(journalCrop.html, /data-stamp-edge="perforated"|data-stamp-frame="lg"/);
assert.match(journalCrop.html, /data-punch-feedback="enabled"/);
assert.match(journalCrop.html, /data-scrap-photo-natural="true"/);
assert.doesNotMatch(visibleText(journalCrop.html), /SCRAP TABLE|Scrap Table/);

const journalCreateWithCover = await fetchRoute(
  "/journal/demo?screen=create&photos=1",
);
const journalCreateWithCoverText = normalizedContent(
  journalCreateWithCover.html,
);
const journalCreateWithCoverVisibleText = visibleText(
  journalCreateWithCover.html,
)
  .replace(/&apos;|&#x27;/g, "'")
  .replace(/\s+/g, " ");
assertNoOldStrings("journal demo create with cover", journalCreateWithCover.html);
assertMobileShell("journal demo create with cover", journalCreateWithCover.html);
assert.match(journalCreateWithCoverText, /Cover Scrap/);
assert.match(journalCreateWithCoverText, /A whisper from today/);
assert.match(
  journalCreateWithCover.html,
  /class="journal-voice-note-field"/,
);
for (const phrase of sealingStrings) {
  assert.equal(
    journalCreateWithCoverText.includes(phrase),
    true,
    `journal demo sealing page is missing expected copy: ${phrase}`,
  );
}
assert.doesNotMatch(journalCreateWithCoverVisibleText, /1 of 9 moments/);
assert.match(journalCreateWithCover.html, /data-journal-cover-preview="editorial-photo"/);
assert.match(journalCreateWithCover.html, /data-journal-cover-treatment="borderless-editorial"/);
assert.match(journalCreateWithCover.html, /data-journal-cover-crop="metadata"/);
assert.doesNotMatch(journalCreateWithCover.html, /data-stamp-edge="perforated"|data-stamp-frame="md"/);

const journalCreateWithMoments = await fetchRoute(
  "/journal/demo?screen=create&photos=2",
);
const journalCreateWithMomentsText = normalizedContent(
  journalCreateWithMoments.html,
);
assert.match(journalCreateWithMomentsText, /Add up to 7 more moments\./);
assert.doesNotMatch(visibleText(journalCreateWithMoments.html), /Press and drag to reorder/);
assert.match(journalCreateWithMoments.html, /data-photo-preview-fit="editorial-square"/);
assert.match(journalCreateWithMoments.html, /data-photo-preview-frame="borderless-editorial"/);
assert.doesNotMatch(
  journalCreateWithMoments.html,
  /data-stamp-edge="perforated"|data-stamp-frame="md"|data-stamp-frame="sm"/,
);

const journalDetail = await fetchRoute("/journal/demo?screen=detail&photos=1");
assertNoOldStrings("journal demo detail", journalDetail.html);
assertMobileShell("journal demo detail", journalDetail.html);
const journalDetailText = visibleText(journalDetail.html);
assert.match(journalDetailText, /Coffee before the rain/);
assert.match(journalDetail.html, /aria-label="Back to month sheet"/);
assert.doesNotMatch(
  journalDetailText,
  /\bSD\b/,
  "journal detail still exposes the unexplained SD mark",
);
assert.doesNotMatch(
  journalDetailText,
  /Cover Scrap/,
  "polished journal detail should not show a visible Cover Scrap badge",
);

for (let photoCount = 1; photoCount <= 9; photoCount += 1) {
  const detail = await fetchRoute(
    `/journal/demo?screen=detail&photos=${photoCount}`,
  );
  const layout = getStampLayout(photoCount);
  assert.match(
    detail.html,
    new RegExp(`data-stamp-layout="${layout.variant}"`),
    `detail photos=${photoCount} rendered the wrong stamp layout`,
  );
  assert.match(
    detail.html,
    new RegExp(`data-stamp-row-sizes="${layout.rowSizes.join(",")}"`),
    `detail photos=${photoCount} rendered the wrong stamp row sizes`,
  );
  assert.match(
    detail.html,
    new RegExp(`data-stamp-frame-ratio="${DEFAULT_STAMP_FRAME_ASPECT_RATIO}"`),
    `detail photos=${photoCount} rendered the wrong stamp frame ratio`,
  );
  assert.match(
    detail.html,
    new RegExp(`data-stamp-grid-columns="${photoCount <= 1 ? 1 : photoCount <= 4 ? 2 : 3}"`),
    `detail photos=${photoCount} rendered the wrong adaptive grid columns`,
  );
  assert.match(
    detail.html,
    /data-daily-detail-photo-grid="borderless-adaptive"/,
    `detail photos=${photoCount} is missing the borderless detail grid marker`,
  );
  assert.match(
    detail.html,
    /data-daily-detail-photo-tile="borderless-square"/,
    `detail photos=${photoCount} is missing borderless photo tile markers`,
  );
  assert.match(
    detail.html,
    /data-stamp-cover-crop="metadata"/,
    `detail photos=${photoCount} is missing cover crop metadata marker`,
  );
  assert.doesNotMatch(
    detail.html,
    /data-stamp-filler/,
    `detail photos=${photoCount} still rendered filler slot markers`,
  );
  assert.doesNotMatch(
    detail.html,
    /data-stamp-edge="perforated"|data-stamp-frame="sm"|data-stamp-frame-fit="cover"/,
    `detail photos=${photoCount} still rendered old stamp frame markers`,
  );
}

const migratedMemoryDemo = await fetchRoute("/memory/demo");
assertNoOldStrings("migrated memory demo", migratedMemoryDemo.html);
assertMobileShell("migrated memory demo", migratedMemoryDemo.html);
assert.match(migratedMemoryDemo.url, /\/journal\/demo$/);

console.log(
  JSON.stringify(
    {
      ok: true,
      qaRoute: `${baseUrl}/journal/demo`,
      monthHomeRoute: `${baseUrl}/journal/demo?screen=home`,
      monthJulyRoute: `${baseUrl}/journal/demo?screen=home&month=2026-07`,
      monthJuneRoute: `${baseUrl}/journal/demo?screen=home&month=2026-06`,
      monthAugustDenseRoute: `${baseUrl}/journal/demo?screen=home&month=2026-08`,
      monthMayRoute: `${baseUrl}/journal/demo?screen=home&month=2026-05`,
      monthEmptyRoute: `${baseUrl}/journal/demo?screen=home&month=2026-04`,
      directCreateRoute: `${baseUrl}/journal/demo?screen=create`,
      duplicateTodayRoute: `${baseUrl}/journal/demo?screen=create&scenario=duplicate-today`,
      backfillDuplicateRoute: `${baseUrl}/journal/demo?screen=create&scenario=backfill-may`,
      createWithCoverRoute: `${baseUrl}/journal/demo?screen=create&photos=1`,
      cropRoute: `${baseUrl}/journal/demo?screen=crop`,
      sealedRoute: `${baseUrl}/journal/demo?screen=sealed`,
      detailRoute: `${baseUrl}/journal/demo?screen=detail&photos=1`,
      detailNineRoute: `${baseUrl}/journal/demo?screen=detail&photos=9`,
      migratedRoute: `${baseUrl}/memory/demo -> ${migratedMemoryDemo.url}`,
      routeTruth: {
        memoryDemo: "app/memory/demo/page.tsx redirects to /journal/demo",
        journalDemo:
          "app/journal/demo/page.tsx -> JournalMobileShell -> JournalDemoFlow -> MemoryForm(productMode=\"journal\")",
        journalCustomer:
          "app/c/[publicToken]/m/[memoryId] -> CapsulePage -> JournalMobileShell -> JournalMemoryPage -> PersistentMemoryFlow(productMode=\"journal\") -> MemoryForm",
      },
      runtimeConfig: {
        maxPhotosPerEntry: rules.maxPhotosPerEntry,
        voiceMemosEnabled: rules.voiceMemosEnabled,
        voiceNoteTargetBitsPerSecond:
          JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND,
        voiceNoteMaxBytes: JOURNAL_VOICE_NOTE_MAX_BYTES,
        volumeVoiceNoteMaxBytes: JOURNAL_VOLUME_VOICE_NOTE_MAX_BYTES,
        copyVariant: rules.copy.newTitle,
        mobileShell: true,
        privateStampMonogram: false,
        stampFrameRatioMode: STAMP_FRAME_RATIO_MODE,
        detailPhotoFit: "cover",
        coverFirst: true,
        cropMetadata: true,
        semanticLocalDate: true,
        duplicateLocalDateGuard: true,
        monthQuery: true,
        monthArchiveNavigation: true,
        fullscreenFit: "contain",
      },
    },
    null,
    2,
  ),
);
