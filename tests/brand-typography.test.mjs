import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("brand fonts are loaded through Next and exposed as shared CSS variables", () => {
  const layoutSource = readSource("app/layout.tsx");
  const globalStyles = readSource("app/globals.css");

  assert.match(layoutSource, /Cormorant_Garamond/);
  assert.match(layoutSource, /Inter/);
  assert.match(layoutSource, /variable:\s*"--font-brand-display"/);
  assert.match(layoutSource, /variable:\s*"--font-brand-interface"/);
  assert.match(layoutSource, /brandDisplayFont\.variable/);
  assert.match(layoutSource, /brandInterfaceFont\.variable/);

  assert.match(globalStyles, /--font-display:\s*var\(--font-brand-display\)/);
  assert.match(globalStyles, /--font-body:\s*var\(--font-brand-interface\)/);
  assert.match(globalStyles, /--font-ui:\s*var\(--font-brand-interface\)/);
  assert.match(globalStyles, /--font-serif:\s*var\(--font-display\)/);
  assert.match(globalStyles, /--font-sans:\s*var\(--font-ui\)/);
  assert.match(globalStyles, /body\s*\{[\s\S]*font-family:\s*var\(--font-body\)/);
  assert.doesNotMatch(globalStyles, /--font-editorial:/);
  assert.doesNotMatch(globalStyles, /--font-interface:/);
  assert.doesNotMatch(globalStyles, /Avenir Next|Iowan Old Style|Palatino Linotype/);
});

test("page and export typography share the same brand roles", () => {
  const globalStyles = readSource("app/globals.css");
  const composerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );
  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(globalStyles, /--mgp-display-font:\s*var\(--font-display\)/);
  assert.match(globalStyles, /--mgp-utility-font:\s*var\(--font-ui\)/);
  assert.match(composerSource, /var\(--font-display\)/);
  assert.match(composerSource, /var\(--font-ui\)/);
  assert.match(exportSource, /--font-brand-display/);
  assert.match(exportSource, /--font-brand-interface/);
  assert.match(exportSource, /document\.fonts\.load/);
  assert.match(exportSource, /await loadDailyStampExportFonts/);
  assert.doesNotMatch(exportSource, /Avenir Next|Helvetica Neue/);
});
