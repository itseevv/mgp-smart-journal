import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JOURNAL_THEME_ASSET_BUCKET,
  journalThemeTextureStoragePath,
  validateJournalThemeTextureUpload,
} from "../lib/admin/journal-theme-assets.ts";
import {
  JOURNAL_THEME_BACKGROUND_DEFAULTS,
  JOURNAL_THEME_BACKGROUND_MODE,
  computeJournalThemeBackgroundRect,
  computeObjectFitCoverRect,
  computePreparedPortraitFullFrameRect,
  isCloseToPortraitBackgroundAspect,
} from "../lib/journal-theme-background.ts";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function pngHeader({ width, height }) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 2;
  return bytes;
}

test("phase 6B texture upload validation accepts public leather image formats", () => {
  const result = validateJournalThemeTextureUpload({
    contentType: "image/png",
    sizeBytes: 900_000,
    bytes: pngHeader({ width: 2160, height: 3840 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.extension, "png");
  assert.equal(result.width, 2160);
  assert.equal(result.height, 3840);
  assert.deepEqual(result.warnings, []);
});

test("phase 6B texture upload validation rejects unsafe or mismatched files", () => {
  assert.deepEqual(
    validateJournalThemeTextureUpload({
      contentType: "application/pdf",
      sizeBytes: 100,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    }),
    { ok: false, code: "TEXTURE_TYPE_UNSUPPORTED" },
  );

  assert.deepEqual(
    validateJournalThemeTextureUpload({
      contentType: "image/jpeg",
      sizeBytes: 100,
      bytes: pngHeader({ width: 1200, height: 2000 }),
    }),
    { ok: false, code: "TEXTURE_TYPE_MISMATCH" },
  );
});

test("phase 6B texture validation returns admin warnings without blocking imperfect assets", () => {
  const result = validateJournalThemeTextureUpload({
    contentType: "image/png",
    sizeBytes: 120_000,
    bytes: pngHeader({ width: 900, height: 900 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.width, 900);
  assert.equal(result.height, 900);
  assert.match(result.warnings.join("\n"), /recommended 1080px width/);
  assert.match(result.warnings.join("\n"), /recommended 1920px height/);
  assert.match(result.warnings.join("\n"), /far from 9:16/);
  assert.match(result.warnings.join("\n"), /small file/);
});

test("phase 6B theme assets use the dedicated public bucket and stable texture path", () => {
  const themeId = "70442906-d2c9-4a1a-a39b-ab37ffdf66dc";

  assert.equal(JOURNAL_THEME_ASSET_BUCKET, "journal-theme-assets");
  assert.equal(
    journalThemeTextureStoragePath(themeId, "image/webp"),
    "journal-themes/70442906-d2c9-4a1a-a39b-ab37ffdf66dc/texture-original.webp",
  );
});

test("phase 6B background cover math respects focus and zoom", () => {
  assert.deepEqual(
    computeObjectFitCoverRect({
      sourceWidth: 2160,
      sourceHeight: 3840,
      targetWidth: 1080,
      targetHeight: 1920,
      focusX: 0.5,
      focusY: 0.5,
      zoom: 2,
    }),
    {
      sx: 540,
      sy: 960,
      sw: 1080,
      sh: 1920,
      dx: 0,
      dy: 0,
      dw: 1080,
      dh: 1920,
    },
  );

  assert.deepEqual(
    computeObjectFitCoverRect({
      sourceWidth: 4000,
      sourceHeight: 2000,
      targetWidth: 1000,
      targetHeight: 1000,
      focusX: 1,
      focusY: 0,
      zoom: 1,
    }),
    {
      sx: 2000,
      sy: 0,
      sw: 2000,
      sh: 2000,
      dx: 0,
      dy: 0,
      dw: 1000,
      dh: 1000,
    },
  );
});

test("phase 6B.3 prepared portrait background uses the full uploaded asset by default", () => {
  assert.deepEqual(JOURNAL_THEME_BACKGROUND_DEFAULTS, {
    focusX: 0.5,
    focusY: 0.5,
    zoom: 1,
    overlayOpacity: 0,
  });
  assert.equal(
    JOURNAL_THEME_BACKGROUND_MODE.preparedPortraitFullFrame,
    "preparedPortraitFullFrame",
  );
  assert.equal(
    isCloseToPortraitBackgroundAspect({ width: 2160, height: 3840 }),
    true,
  );
  assert.deepEqual(
    computePreparedPortraitFullFrameRect({
      sourceWidth: 2160,
      sourceHeight: 3840,
      targetWidth: 1080,
      targetHeight: 1920,
      focusX: 0,
      focusY: 1,
      zoom: 3,
    }),
    {
      sx: 0,
      sy: 0,
      sw: 2160,
      sh: 3840,
      dx: 0,
      dy: 0,
      dw: 1080,
      dh: 1920,
    },
  );
  assert.deepEqual(
    computeJournalThemeBackgroundRect({
      sourceWidth: 900,
      sourceHeight: 900,
      targetWidth: 1080,
      targetHeight: 1920,
    }),
    {
      sx: 0,
      sy: 0,
      sw: 900,
      sh: 900,
      dx: 0,
      dy: 420,
      dw: 1080,
      dh: 1080,
    },
  );
  assert.deepEqual(
    computeJournalThemeBackgroundRect({
      sourceWidth: 2160,
      sourceHeight: 3840,
      targetWidth: 1080,
      targetHeight: 1920,
      focusX: 0,
      focusY: 1,
      zoom: 3,
    }),
    {
      sx: 0,
      sy: 0,
      sw: 2160,
      sh: 3840,
      dx: 0,
      dy: 0,
      dw: 1080,
      dh: 1920,
    },
  );
});

test("phase 6B routes and migrations keep upload admin-only and bucket public-read", async () => {
  const route = await readSource("app/api/admin/journal-themes/[themeId]/texture/route.ts");
  const migration = await readSource(
    "supabase/migrations/202607060002_scrap_day_phase_6b_journal_theme_assets.sql",
  );

  assert.match(route, /requireAdminSession/);
  assert.match(route, /validateJournalThemeTextureUpload/);
  assert.match(route, /JOURNAL_THEME_ASSET_BUCKET/);
  assert.doesNotMatch(route, /ADMIN_PASSCODE|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(migration, /journal-theme-assets/);
  assert.match(migration, /public\)\s*values \('journal-theme-assets', 'journal-theme-assets', true\)/i);
  assert.doesNotMatch(migration, /for insert to anon|for insert to authenticated/i);
});

test("phase 6B renders assigned theme texture in app CSS and daily export", async () => {
  const themeSource = await readSource("data/journal-themes.ts");
  const css = await readSource("app/globals.css");
  const capsulePage = await readSource("components/capsule/capsule-page.tsx");
  const journalHome = await readSource("components/journal/journal-home.tsx");
  const dailyStamp = await readSource("components/stamp/daily-memory-stamp.tsx");
  const exportRenderer = await readSource("lib/export/daily-memory-stamp-export.ts");
  const themedRule =
    css.match(/\.journal-themed-background::before \{[\s\S]*?\n\}/)?.[0] ?? "";
  const leatherRule =
    css.match(/\.journal-leather-surface::before \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(themeSource, /--journal-texture-url/);
  assert.match(themeSource, /--journal-mobile-background-image/);
  assert.match(themeSource, /--journal-mobile-background-size/);
  assert.match(themeSource, /--journal-texture-position/);
  assert.match(themeSource, /--journal-texture-zoom/);
  assert.match(themeSource, /--journal-texture-opacity/);
  assert.match(css, /\.journal-themed-background/);
  assert.match(css, /\.journal-mobile-shell \{[\s\S]*?width: min\(100%, 30rem\)/);
  assert.match(css, /@media \(min-width: 640px\) \{[\s\S]*?\.journal-mobile-shell \{[\s\S]*?aspect-ratio: 9 \/ 16/);
  assert.match(css, /@media \(min-width: 640px\) \{[\s\S]*?\.journal-mobile-shell \{[\s\S]*?min-height: auto/);
  assert.match(themedRule, /var\(--journal-mobile-background-image/);
  assert.match(themedRule, /cover/);
  assert.doesNotMatch(themedRule, /contain/);
  assert.doesNotMatch(themedRule, /transform:\s*scale/);
  assert.doesNotMatch(leatherRule, /--journal-texture-url/);
  assert.doesNotMatch(leatherRule, /--journal-mobile-background-image/);
  assert.match(css, /\.journal-themed-background \.journal-leather-surface/);
  assert.match(css, /var\(--journal-overlay-opacity/);
  assert.match(css, /image-rendering: auto/);
  assert.match(capsulePage, /className="journal-mobile-page journal-themed-background"/);
  assert.match(capsulePage, /journalThemeStyle\(theme\)/);
  assert.doesNotMatch(journalHome, /className="journal-leather-surface/);
  assert.doesNotMatch(dailyStamp, /className="journal-leather-surface/);
  assert.match(exportRenderer, /loadThemeTexture/);
  assert.match(exportRenderer, /computePreparedPortraitFullFrameRect/);
  assert.doesNotMatch(exportRenderer, /focusX:\s*theme\.focusX/);
  assert.doesNotMatch(exportRenderer, /zoom:\s*theme\.zoom/);
  assert.match(exportRenderer, /imageSmoothingQuality = "high"/);
  assert.match(exportRenderer, /if \(!texture\)/);
  assert.match(exportRenderer, /theme\.overlayOpacity/);
  assert.doesNotMatch(exportRenderer, /theme\.thumbnail/i);
});
