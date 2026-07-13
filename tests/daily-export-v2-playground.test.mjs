import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 7.2A daily export v2 playground stays isolated from production export", () => {
  const pageSource = readSource("app/design/daily-export-v2/page.tsx");
  const playgroundSource = readSource(
    "app/design/daily-export-v2/daily-export-v2-playground.tsx",
  );
  const exportComposerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );
  const exportRendererSource = readSource("lib/export/daily-memory-stamp-export.ts");
  const logoPath = new URL(
    "../public/images/design-scrap-day-v2/mgp-full-logo-transparent-playground.png",
    import.meta.url,
  );

  assert.match(pageSource, /DailyExportV2Playground/);
  assert.match(playgroundSource, /data-daily-export-v2-playground="true"/);
  assert.match(playgroundSource, /data-daily-export-v2-non-production="true"/);
  assert.match(playgroundSource, /data-save-share-modal-chrome="utility-action-surface"/);
  assert.match(playgroundSource, /data-save-share-modal-production-wiring="none"/);
  assert.match(playgroundSource, /data-save-share-modal-title="simple"/);
  assert.match(playgroundSource, /Save or share/);
  assert.match(playgroundSource, /Save Image/);
  assert.match(playgroundSource, /Share/);
  assert.match(playgroundSource, /Creating image\.\.\./);
  assert.doesNotMatch(playgroundSource, /Image ready\./);
  assert.match(playgroundSource, /data-save-share-modal-preview-scale="proportional-artifact"/);
  assert.match(playgroundSource, /data-save-share-modal-preview-scale-source="full-artifact"/);
  assert.match(playgroundSource, /data-export-artifact-loading-treatment="quiet-leather-only"/);
  assert.doesNotMatch(playgroundSource, /role="status"/);

  assert.match(playgroundSource, /data-export-artifact-source="daily-memory-stamp-view"/);
  assert.match(playgroundSource, /data-export-artifact-journal-header="shell-title-only"/);
  assert.match(playgroundSource, /data-export-artifact-overlay="translucent-daily-detail-layer"/);
  assert.match(playgroundSource, /data-export-artifact-logo="full-transparent-mgp-lockup"/);
  assert.match(playgroundSource, /data-export-artifact-logo-color=/);
  assert.match(playgroundSource, /deep-burgundy-journal-title/);
  assert.match(playgroundSource, /data-export-artifact-logo-source="desktop-provided-transparent-png"/);
  assert.match(playgroundSource, /data-export-artifact-maker-mark-position="bottom"/);
  assert.match(playgroundSource, /mgp-full-logo-transparent-playground\.png/);
  assert.doesNotMatch(playgroundSource, /mgp-goddess-icon-mask-playground\.png/);
  assert.doesNotMatch(playgroundSource, /logo-square-mgp\.jpeg/);
  assert.equal(existsSync(logoPath), true);

  assert.match(playgroundSource, /const themeIds = \["wine", "ivory"\] as const/);
  assert.match(playgroundSource, /const photoCases = \[1, 2, 5, 9\] as const/);
  assert.match(playgroundSource, /photoCount <= 1\) return 1/);
  assert.match(playgroundSource, /photoCount <= 4\) return 2/);
  assert.match(playgroundSource, /return 3/);
  assert.match(playgroundSource, /data-export-photo-grid-treatment="borderless-square"/);

  assert.doesNotMatch(playgroundSource, /Private by nature/);
  assert.doesNotMatch(playgroundSource, /format picker/i);
  assert.doesNotMatch(playgroundSource, /journal management/i);
  assert.doesNotMatch(playgroundSource, /postage|perforated|photo mat/i);
  assert.doesNotMatch(playgroundSource, /Scrap the Day/);

  assert.doesNotMatch(exportComposerSource, /daily-export-v2|mgp-goddess-icon-mask-playground/);
  assert.doesNotMatch(exportRendererSource, /daily-export-v2|mgp-goddess-icon-mask-playground/);
});
