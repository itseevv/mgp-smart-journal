import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  DEFAULT_STAMP_FRAME_ASPECT_RATIO,
  JOURNAL_VOICE_MEMOS_ENABLED,
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
];
const createStrings = [
  "New Daily Scrap",
  "One line to keep",
  "What would you call today?",
  "Cover Scrap",
  "Choose today's scrap",
  "One photo is enough to seal the day.",
  "Seal this day",
];
const sealingStrings = [
  "One line to keep",
  "What would you call today?",
  "Adjust scrap",
  "Add more moments (optional)",
  "Seal this day",
];
const cropStrings = [
  "Find today's scrap",
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
assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, false);
assert.equal(STAMP_FRAME_RATIO_MODE, "square");
assert.equal(DEFAULT_STAMP_FRAME_ASPECT_RATIO, 1);
assert.equal(rules.maxPhotosPerEntry, 9);
assert.equal(rules.voiceMemosEnabled, false);

const journalRouteSource = readSource("components/journal/journal-memory-page.tsx");
const persistentFlowSource = readSource("components/capsule/persistent-memory-flow.tsx");
const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
const memoryDemoSource = readSource("app/memory/demo/page.tsx");
const journalDemoPageSource = readSource("app/journal/demo/page.tsx");
const capsulePageSource = readSource("components/capsule/capsule-page.tsx");
const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
const stampGridSource = readSource("components/stamp/stamp-grid.tsx");
const journalPhotoPickerSource = readSource("components/memory/journal-photo-picker.tsx");
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

assert.match(journalRouteSource, /productMode="journal"/);
assert.match(journalRouteSource, /existingToday/);
assert.match(journalRouteSource, /Today is already sealed in this journal/);
assert.match(journalRouteSource, /Open today’s stamp/);
assert.match(persistentFlowSource, /Math\.min\(productRules\.maxPhotosPerEntry, maxPhotos\)/);
assert.match(persistentFlowSource, /journalStamps/);
assert.match(persistentFlowSource, /findDuplicateStampForLocalDate/);
assert.match(journalDemoSource, /productMode="journal"/);
assert.match(journalDemoSource, /initialScreen\?: "home" \| "create" \| "crop" \| "sealed" \| "detail"/);
assert.match(journalDemoSource, /scenario\?: "duplicate-today" \| "backfill-may"/);
assert.match(journalDemoSource, /createBackfillDemoStamp/);
assert.match(journalDemoSource, /maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS/);
assert.match(memoryDemoSource, /redirect\("\/journal\/demo"\)/);
assert.match(journalDemoPageSource, /JournalMobileShell/);
assert.match(journalDemoPageSource, /screen === "crop"/);
assert.match(journalDemoPageSource, /screen === "sealed"/);
assert.match(capsulePageSource, /JournalMobileShell/);
assert.doesNotMatch(stampDetailSource, />\s*SD\s*</);
assert.match(stampGridSource, /buildStampFrameRows/);
assert.match(stampGridSource, /PhotoViewer/);
assert.match(stampGridSource, /object-cover/);
assert.match(stampGridSource, /StampFrameButton/);
assert.match(stampGridSource, /variant="sm"/);
assert.match(stampGridSource, /data-stamp-frame-ratio/);
assert.match(stampGridSource, /data-stamp-cover-crop/);
assert.doesNotMatch(stampGridSource, /object-contain|data-stamp-filler-count|StampFiller/);
assert.match(journalPhotoPickerSource, /object-cover/);
assert.match(journalPhotoPickerSource, /StampFrame/);
assert.match(journalPhotoPickerSource, /variant="md"/);
assert.match(journalPhotoPickerSource, /data-journal-cover-preview="stamp-frame"/);
assert.match(journalPhotoPickerSource, /data-journal-cover-crop/);
assert.match(journalPhotoPickerSource, /onConfirmCrop/);
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
assert.match(scrapTableSource, /data-scrap-layout="tight-mobile"/);
assert.match(scrapTableSource, /data-scrap-controls="tight"/);
assert.match(scrapTableSource, /data-finder-tool="physical-frame"/);
assert.match(scrapTableSource, /data-scrap-aperture="stamp-window"/);
assert.match(scrapTableSource, /StampFrame/);
assert.match(scrapTableSource, /variant="lg"/);
assert.match(scrapTableSource, /data-punch-feedback="enabled"/);
assert.match(scrapTableSource, /data-scrap-photo-natural="true"/);
assert.match(scrapTableSource, /Use this scrap/);
assert.doesNotMatch(scrapTableSource, />\s*Scrap Table\s*</);
assert.doesNotMatch(scrapTableSource, /Crop image|Edit photo|Aspect ratio|Template|Collage/);
assert.match(photoViewerSource, /object-contain/);
assert.doesNotMatch(photoViewerSource, /object-cover/);
assert.match(migrationSource, /add column if not exists crop_metadata jsonb/);
assert.match(migrationSource, /crop_metadata = item\.crop_metadata/);
assert.match(phase3MigrationSource, /add column if not exists local_date date/);
assert.match(phase3MigrationSource, /add column if not exists local_timezone text/);
assert.match(phase3MigrationSource, /memories_capsule_local_date_unique/);
assert.match(phase3MigrationSource, /DUPLICATE_LOCAL_DATE/);
assert.match(phase3MigrationSource, /coalesce\(memory\.local_date, memory\.occurred_at::date\)/);

const journalHome = await fetchRoute("/journal/demo");
assertNoOldStrings("journal demo home", journalHome.html);
assertMobileShell("journal demo home", journalHome.html);
const journalHomeText = visibleText(journalHome.html);
assert.match(journalHomeText, /Seal Today/);
assert.match(journalHomeText, /Month Sheet/);

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
  journalCreateVisibleText.includes("Add more moments (optional)"),
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
assert.match(journalCrop.html, /data-scrap-layout="tight-mobile"/);
assert.match(journalCrop.html, /data-scrap-controls="tight"/);
assert.match(journalCrop.html, /data-finder-tool="physical-frame"/);
assert.match(journalCrop.html, /data-scrap-aperture="stamp-window"/);
assert.match(journalCrop.html, /data-stamp-edge="perforated"/);
assert.match(journalCrop.html, /data-stamp-frame="lg"/);
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
for (const phrase of sealingStrings) {
  assert.equal(
    journalCreateWithCoverText.includes(phrase),
    true,
    `journal demo sealing page is missing expected copy: ${phrase}`,
  );
}
assert.doesNotMatch(journalCreateWithCoverVisibleText, /1 of 9 moments/);
assert.match(journalCreateWithCover.html, /data-journal-cover-preview="stamp-frame"/);
assert.match(journalCreateWithCover.html, /data-journal-cover-crop="metadata"/);
assert.match(journalCreateWithCover.html, /data-stamp-edge="perforated"/);
assert.match(journalCreateWithCover.html, /data-stamp-frame="md"/);
assert.match(journalCreateWithCover.html, /object-fit:fill/);

const journalCreateWithMoments = await fetchRoute(
  "/journal/demo?screen=create&photos=2",
);
const journalCreateWithMomentsText = normalizedContent(
  journalCreateWithMoments.html,
);
assert.match(journalCreateWithMomentsText, /Up to 8 more moments\./);
assert.doesNotMatch(visibleText(journalCreateWithMoments.html), /Press and drag to reorder/);
assert.match(journalCreateWithMoments.html, /data-photo-preview-fit="stamp-cover"/);
assert.match(journalCreateWithMoments.html, /data-stamp-edge="perforated"/);
assert.match(journalCreateWithMoments.html, /data-stamp-frame="md"/);
assert.match(journalCreateWithMoments.html, /data-stamp-frame="sm"/);
assert.match(journalCreateWithMoments.html, /object-cover/);

const journalDetail = await fetchRoute("/journal/demo?screen=detail&photos=1");
assertNoOldStrings("journal demo detail", journalDetail.html);
assertMobileShell("journal demo detail", journalDetail.html);
const journalDetailText = visibleText(journalDetail.html);
assert.match(journalDetailText, /Coffee before the rain/);
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
    /data-stamp-frame-fit="cover"/,
    `detail photos=${photoCount} is missing stamp cover-frame markers`,
  );
  assert.match(
    detail.html,
    /data-stamp-edge="perforated"/,
    `detail photos=${photoCount} is missing perforated stamp-edge markers`,
  );
  assert.match(
    detail.html,
    /data-stamp-frame="sm"/,
    `detail photos=${photoCount} is missing small stamp-frame markers`,
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
        copyVariant: rules.copy.newTitle,
        mobileShell: true,
        privateStampMonogram: false,
        stampFrameRatioMode: STAMP_FRAME_RATIO_MODE,
        stampFrameFit: "cover",
        coverFirst: true,
        cropMetadata: true,
        semanticLocalDate: true,
        duplicateLocalDateGuard: true,
        fullscreenFit: "contain",
      },
    },
    null,
    2,
  ),
);
