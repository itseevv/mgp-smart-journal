import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DAILY_STAMP_EXPORT_ASPECT_RATIO,
  DAILY_STAMP_EXPORT_HEIGHT,
  DAILY_STAMP_EXPORT_LOGO_SRC,
  DAILY_STAMP_EXPORT_MIME_TYPE,
  DAILY_STAMP_EXPORT_WIDTH,
  canShareDailyStampExport,
  dailyStampExportArtifactModel,
  dailyStampExportFilename,
  dailyStampExportPhotoItems,
  defaultDailyStampExportBrandMark,
} from "../lib/export/daily-memory-stamp-export.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const cropMetadata = {
  kind: "cover-scrap",
  aspectRatio: 1,
  x: 0.2,
  y: 0.1,
  width: 0.6,
  height: 0.6,
  imageWidth: 1600,
  imageHeight: 1200,
  createdAt: "2026-07-04T12:00:00.000Z",
};

const photo = (input = {}) => ({
  id: input.id ?? "photo-1",
  name: input.name ?? "Photo 1",
  objectUrl: input.objectUrl ?? "data:image/png;base64,AA==",
  sizeBytes: 0,
  mimeType: "image/png",
  width: Object.hasOwn(input, "width") ? input.width : 1600,
  height: Object.hasOwn(input, "height") ? input.height : 1200,
  thumbnailWidth: input.thumbnailWidth,
  thumbnailHeight: input.thumbnailHeight,
  cropMetadata: input.cropMetadata,
  status: "persisted",
});

const memory = {
  capturedAt: "2026-07-04T22:30:00.000Z",
  localDate: "2026-07-04",
  localTimezone: "Europe/London",
  title: "  Coffee   before the rain 🌧️  ",
  photos: [
    photo({ id: "cover", name: "Cover", cropMetadata }),
    photo({ id: "moment", name: "Moment", width: 900, height: 1200 }),
  ],
  voiceMemos: [
    {
      id: "memo",
      title: "Voice memo",
      durationSeconds: 12,
      mimeType: "audio/webm",
      sizeBytes: 12,
      createdAt: "2026-07-04T12:00:00.000Z",
      order: 0,
    },
  ],
};

test("daily stamp export uses one fixed 9:16 PNG format", () => {
  assert.equal(DAILY_STAMP_EXPORT_WIDTH, 1080);
  assert.equal(DAILY_STAMP_EXPORT_HEIGHT, 1920);
  assert.equal(DAILY_STAMP_EXPORT_ASPECT_RATIO, 9 / 16);
  assert.equal(DAILY_STAMP_EXPORT_MIME_TYPE, "image/png");

  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");
  assert.doesNotMatch(exportSource, /DAILY_STAMP_EXPORT_FORMATS/);
  assert.doesNotMatch(exportSource, /formatSelector|templatePicker/);
});

test("daily stamp export artifact model includes only the approved content", () => {
  const model = dailyStampExportArtifactModel({ memory });

  assert.equal(model.dateLabel, "JULY 4, 2026");
  assert.equal(model.localDate, "2026-07-04");
  assert.equal(model.title, "Coffee before the rain 🌧️");
  assert.equal(model.photos.length, 2);
  assert.equal(model.photos[0].cropMetadata, cropMetadata);
  assert.equal(model.photos[0].cropMode, "metadata");
  assert.equal(model.photos[1].cropMode, "center");

  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /My Journal/);
  assert.doesNotMatch(serialized, /Private by nature/);
  assert.doesNotMatch(serialized, /Edit stamp/);
  assert.doesNotMatch(serialized, /photo count/i);
  assert.doesNotMatch(serialized, /voice memo/i);
  assert.doesNotMatch(serialized, /powered by/i);
  assert.doesNotMatch(serialized, /\bSD\b/);
});

test("daily stamp export crop items preserve metadata and fall back safely", () => {
  const [croppedCover, centerFallback, coverFallback] = dailyStampExportPhotoItems([
    photo({ id: "cropped-cover", cropMetadata }),
    photo({ id: "center-fallback", width: 1400, height: 900 }),
    photo({
      id: "cover-fallback",
      width: undefined,
      height: undefined,
      thumbnailWidth: undefined,
      thumbnailHeight: undefined,
    }),
  ]);

  assert.equal(croppedCover.cropMode, "metadata");
  assert.equal(croppedCover.cropMetadata, cropMetadata);
  assert.equal(centerFallback.cropMode, "center");
  assert.equal(centerFallback.cropMetadata.kind, "cover-scrap");
  assert.equal(coverFallback.cropMode, "cover");
  assert.equal(coverFallback.cropMetadata, undefined);
});

test("daily stamp export uses the provided MGP logo asset as a subtle brand mark", () => {
  assert.equal(DAILY_STAMP_EXPORT_LOGO_SRC, "/brand/logo-square-mgp.jpeg");
  assert.deepEqual(defaultDailyStampExportBrandMark, {
    kind: "logo",
    src: DAILY_STAMP_EXPORT_LOGO_SRC,
    alt: "Modern Goddess Patina",
  });
  assert.doesNotMatch(JSON.stringify(defaultDailyStampExportBrandMark), /\bSD\b/);
  assert.doesNotMatch(JSON.stringify(defaultDailyStampExportBrandMark), /powered by/i);
});

test("daily stamp export filename is safe and token-free", () => {
  const filename = dailyStampExportFilename(memory);

  assert.equal(filename, "scrap-the-day-2026-07-04.png");
  assert.doesNotMatch(filename, /https?:|token|signed|capsules\//i);
});

test("daily stamp export draws the high-resolution journal theme background", () => {
  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(exportSource, /loadThemeTexture/);
  assert.match(exportSource, /theme\.textureUrl/);
  assert.match(exportSource, /computePreparedPortraitFullFrameRect/);
  assert.doesNotMatch(exportSource, /focusX:\s*theme\.focusX/);
  assert.doesNotMatch(exportSource, /zoom:\s*theme\.zoom/);
  assert.match(exportSource, /imageSmoothingQuality = "high"/);
  assert.match(exportSource, /if \(!texture\)/);
  assert.doesNotMatch(exportSource, /theme\.thumbnail/i);
});

test("daily stamp share helper falls back cleanly when file sharing is unsupported", () => {
  const fakeFile = { name: "scrap-the-day-2026-07-04.png" };

  assert.equal(canShareDailyStampExport(undefined, fakeFile), false);
  assert.equal(
    canShareDailyStampExport({
      canShare: () => false,
      share: async () => undefined,
    }, fakeFile),
    false,
  );
  assert.equal(
    canShareDailyStampExport({
      canShare: (data) => data.files?.length === 1,
      share: async () => undefined,
    }, fakeFile),
    true,
  );
});

test("daily detail demo exposes the Phase 5A export composer entry point", () => {
  const stampDetailSource = readSource("components/stamp/daily-memory-stamp.tsx");
  const composerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );
  const journalDemoSource = readSource("components/journal/journal-demo-flow.tsx");
  const journalDemoPageSource = readSource("app/journal/demo/page.tsx");

  assert.match(stampDetailSource, /DailyStampExportComposer/);
  assert.match(stampDetailSource, /data-daily-stamp-export-action="true"/);
  assert.match(stampDetailSource, /Save \/ Share/);
  assert.match(composerSource, /Save or share/);
  assert.match(composerSource, /data-daily-stamp-export-preview/);
  assert.match(composerSource, /Save Image/);
  assert.match(composerSource, /Share/);
  assert.match(composerSource, /Sharing isn’t supported here/);
  assert.match(journalDemoSource, /initialScreen === "detail"/);
  assert.match(journalDemoPageSource, /screen === "detail"/);
  assert.doesNotMatch(composerSource, /Monthly Sheet|Year in Stamps/);
  assert.doesNotMatch(composerSource, /format selector|template selector/i);
});
