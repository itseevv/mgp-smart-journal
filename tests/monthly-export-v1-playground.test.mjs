import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const artifactPath = new URL(
  "../app/design/monthly-export-v1/monthly-export-artifact.tsx",
  import.meta.url,
);
const playgroundPath = new URL(
  "../app/design/monthly-export-v1/monthly-export-v1-playground.tsx",
  import.meta.url,
);
const journeyPath = new URL(
  "../app/design/monthly-export-v1/monthly-export-journey.tsx",
  import.meta.url,
);
const saveSharePreviewPath = new URL(
  "../app/design/monthly-export-v1/monthly-export-save-share-preview.tsx",
  import.meta.url,
);
const stylesPath = new URL(
  "../app/design/monthly-export-v1/monthly-export-v1.module.css",
  import.meta.url,
);
const productionSheetPath = new URL(
  "../components/journal/monthly-stamp-sheet.tsx",
  import.meta.url,
);
const productionGlobalsPath = new URL("../app/globals.css", import.meta.url);

test("BL-001 monthly export playground models one complete 31-stamp long artifact", async () => {
  const [
    artifactSource,
    playgroundSource,
    journeySource,
    previewSource,
    stylesSource,
    productionGlobalsSource,
  ] = await Promise.all([
    readFile(artifactPath, "utf8"),
    readFile(playgroundPath, "utf8"),
    readFile(journeyPath, "utf8"),
    readFile(saveSharePreviewPath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(productionGlobalsPath, "utf8"),
  ]);

  assert.match(artifactSource, /MONTHLY_EXPORT_ARTIFACT_WIDTH = 1080/);
  assert.match(artifactSource, /MONTHLY_EXPORT_ARTIFACT_HEIGHT =/);
  assert.match(artifactSource, /MONTHLY_EXPORT_COLUMNS = 3/);
  assert.match(artifactSource, /MONTHLY_EXPORT_ROWS = 11/);
  assert.match(artifactSource, /MONTHLY_EXPORT_STAMP_COUNT = 31/);
  assert.match(artifactSource, /length: MONTHLY_EXPORT_STAMP_COUNT/);
  assert.match(artifactSource, /data-monthly-export-completeness="31-of-31"/);
  assert.match(artifactSource, /data-monthly-export-texture="single-cover-no-repeat"/);
  assert.match(artifactSource, /CroppedStampImage/);
  assert.match(artifactSource, /loading="eager"/);
  assert.match(artifactSource, /July 2026 Edition/);
  assert.match(artifactSource, /The whole month, kept together/);
  assert.doesNotMatch(artifactSource, /Monthly Sheet · Complete edition/);
  assert.doesNotMatch(artifactSource, /31 sealed days/);
  assert.match(stylesSource, /grid-template-columns: repeat\(3,/);
  assert.match(stylesSource, /\.stamp:last-child \{\s*grid-column: 2;/);
  assert.match(stylesSource, /var\(--journal-texture-url\)/);
  assert.match(
    stylesSource,
    /\.artifact::before \{[\s\S]*background-repeat:\s*no-repeat,\s*repeat,\s*no-repeat;/,
  );
  assert.match(
    productionGlobalsSource,
    /journal-identity-header--home-variant-c[\s\S]*--journal-shell-title-size: 1\.52rem;/,
  );
  assert.match(
    productionGlobalsSource,
    /\.month-sheet-title--home-variant-c \{[\s\S]*1\.36rem/,
  );
  assert.match(stylesSource, /\.phoneJournalHeader p \{[\s\S]*font-size: 1\.52rem;/);
  assert.match(
    stylesSource,
    /\.phoneMonthHeader h3,[\s\S]*font-size: 1\.36rem;/,
  );
  assert.match(stylesSource, /\.journalTitle \{[\s\S]*var\(--journal-home-title\)/);
  assert.match(stylesSource, /\.monthTitle \{[\s\S]*var\(--journal-home-month-title\)/);
  assert.match(playgroundSource, /Fit complete sheet/);
  assert.match(playgroundSource, /Full size · 1:1/);
  assert.match(playgroundSource, /Inspect row 11/);
  assert.match(playgroundSource, /Playground-only proposal/);
  assert.match(playgroundSource, /MonthlyExportJourney/);
  assert.match(playgroundSource, /MonthlyExportSaveSharePreview/);
  assert.match(
    journeySource,
    /data-monthly-export-entry="quiet-header-download"/,
  );
  assert.match(
    journeySource,
    /data-monthly-export-selected-direction="quiet-header-download"/,
  );
  assert.match(journeySource, /Quiet header download/);
  assert.match(journeySource, /<DownloadIcon \/>/);
  assert.doesNotMatch(journeySource, /<ShareIcon \/>/);
  assert.match(journeySource, /journalThemeStyle\(monthlyExportPlaygroundTheme\)/);
  assert.match(journeySource, /data-monthly-export-production-wiring="none"/);
  assert.match(previewSource, /Your \{monthName\} Memory Edition/);
  assert.match(previewSource, /Preparing your \{monthName\} Memory Edition\.\.\./);
  assert.match(previewSource, /data-monthly-export-loading-state="preparing-image"/);
  assert.match(previewSource, /setPreviewState\("ready"\)/);
  assert.match(previewSource, /<DownloadIcon \/>[\s\S]*\n\s*Save\s*\n/);
  assert.doesNotMatch(previewSource, /Save \{monthName\} Memory Edition/);
  assert.doesNotMatch(previewSource, /Save Image/);
  assert.doesNotMatch(previewSource, /Complete preview/);
  assert.doesNotMatch(previewSource, /31 days/);
  assert.match(previewSource, />\s*Share\s*</);
  assert.match(previewSource, /MonthlyExportArtifact/);
  assert.match(
    previewSource,
    /data-monthly-export-modal-preview="proportional-full-artifact"/,
  );
  assert.match(
    previewSource,
    /data-monthly-export-production-wiring="none"/,
  );
  assert.match(stylesSource, /\.saveShareArtifactFrame \{[\s\S]*container-type: inline-size;/);
  assert.match(stylesSource, /\.saveShareArtifactFrame \{[\s\S]*width: 9\.5rem;/);
});

test("BL-001 approved playground remains the production Monthly Sheet QC source", async () => {
  const [playgroundSource, productionSheetSource] = await Promise.all([
    readFile(playgroundPath, "utf8"),
    readFile(productionSheetPath, "utf8"),
  ]);

  assert.match(playgroundSource, /data-monthly-export-v1-non-production="true"/);
  assert.doesNotMatch(productionSheetSource, /monthly-export-v1/i);
  assert.doesNotMatch(productionSheetSource, /MonthlyExportArtifact/);
  assert.match(
    productionSheetSource,
    /data-monthly-stamp-export-action="true"/,
  );
  assert.match(productionSheetSource, /<DownloadIcon className="h-4 w-4" \/>/);
});
