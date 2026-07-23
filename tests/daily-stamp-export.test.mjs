import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

import {
  GET as getDailyStampEmoji,
  POST as postDailyStampExport,
  prepareStoredPhotoInput,
  renderServerDailyStampPng,
  serverTextRuns,
} from "../app/api/export/daily-stamp/route.ts";
import { defaultJournalTheme } from "../data/journal-themes.ts";

import {
  DAILY_STAMP_EXPORT_ASPECT_RATIO,
  DAILY_STAMP_EXPORT_HEIGHT,
  DAILY_STAMP_EXPORT_LOGO_SRC,
  DAILY_STAMP_EXPORT_MIME_TYPE,
  DAILY_STAMP_EXPORT_WIDTH,
  canShareDailyStampExport,
  dailyStampEmojiAssetUrl,
  dailyStampEmojiCodepoint,
  dailyStampExportArtifactModel,
  dailyStampExportFilename,
  dailyStampExportImageStrategy,
  dailyStampExportPhotoItems,
  dailyStampTextParts,
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
  const model = dailyStampExportArtifactModel({
    memory,
    journalTitle: "Margot's Journal",
  });

  assert.equal(model.journalTitle, "Margot's Journal");
  assert.equal(model.dateLabel, "JULY 4, 2026");
  assert.equal(model.localDate, "2026-07-04");
  assert.equal(model.title, "Coffee before the rain 🌧️");
  assert.equal(model.photos.length, 2);
  assert.equal(model.photos[0].cropMetadata, cropMetadata);
  assert.equal(model.photos[0].cropMode, "metadata");
  assert.equal(model.photos[1].cropMode, "center");

  const serialized = JSON.stringify(model);
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
  assert.equal(DAILY_STAMP_EXPORT_LOGO_SRC, "/brand/mgp-full-logo-transparent.png");
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

test("daily stamp export keeps image decoding within a mobile-safe budget", () => {
  assert.deepEqual(
    dailyStampExportImageStrategy({
      photoCount: 9,
      textureUrl: "https://assets.example/forest-leather.png",
      textureWidth: 2160,
      textureHeight: 3840,
    }),
    { photoVariant: "thumbnail", useThemeTexture: false },
  );
  assert.deepEqual(
    dailyStampExportImageStrategy({
      photoCount: 4,
      textureUrl: "https://assets.example/safe-leather.png",
      textureWidth: 1080,
      textureHeight: 1920,
    }),
    { photoVariant: "display", useThemeTexture: true },
  );
  assert.deepEqual(
    dailyStampExportImageStrategy({
      photoCount: 4,
      textureUrl: "https://assets.example/unknown-leather.png",
    }),
    { photoVariant: "display", useThemeTexture: false },
  );

  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(exportSource, /loadThemeTexture/);
  assert.match(exportSource, /theme\.textureUrl/);
  assert.match(exportSource, /DAILY_STAMP_EXPORT_MAX_TEXTURE_PIXELS/);
  assert.match(exportSource, /computePreparedPortraitFullFrameRect/);
  assert.doesNotMatch(exportSource, /focusX:\s*theme\.focusX/);
  assert.doesNotMatch(exportSource, /zoom:\s*theme\.zoom/);
  assert.match(exportSource, /imageSmoothingQuality = "high"/);
  assert.match(exportSource, /if \(!texture\)/);
  assert.doesNotMatch(exportSource, /theme\.thumbnail/i);
});

test("daily stamp export tints light-theme brand marks without clearing the artifact", () => {
  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(exportSource, /const tintCanvas = document\.createElement\("canvas"\)/);
  assert.match(exportSource, /const tintContext = tintCanvas\.getContext\("2d"\)/);
  assert.match(exportSource, /tintContext\.globalCompositeOperation = "source-in"/);
  assert.match(exportSource, /context\.drawImage\(tintCanvas, drawX, drawY, width, height\)/);
  assert.doesNotMatch(exportSource, /context\.globalCompositeOperation = "source-in"/);
});

test("daily stamp export releases decoded images as soon as each layer is drawn", () => {
  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.doesNotMatch(exportSource, /loadDrawnPhotos/);
  assert.match(exportSource, /async function drawPhotoGrid/);
  assert.match(
    exportSource,
    /for \(const \[index, item\] of photos\.entries\(\)\)[\s\S]*source = await loadPhotoForExport\([\s\S]*item\.photo,[\s\S]*resolvePhotoUrl,[\s\S]*photoVariant,[\s\S]*finally \{[\s\S]*source\?\.close\(\)/,
  );
  assert.match(exportSource, /resolvePhotoUrl\(photo, photoVariant, true\)/);
  assert.match(exportSource, /resolvePhotoUrl\(photo, "display", true\)/);
  assert.match(
    exportSource,
    /catch \(error\) \{[\s\S]*URL\.revokeObjectURL\(objectUrl\);[\s\S]*throw error/,
  );
  assert.match(
    exportSource,
    /const themeTexture = await loadThemeTexture\([\s\S]*resolvedTheme,[\s\S]*imageStrategy\.useThemeTexture,[\s\S]*try \{[\s\S]*drawLeatherBackground\(context, resolvedTheme, themeTexture\)[\s\S]*finally \{[\s\S]*themeTexture\?\.close\(\)/,
  );
  assert.match(exportSource, /await drawPhotoGrid\(/);
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
  assert.match(composerSource, /data-save-share-modal-surface="edit-stamp-beige-overlay"/);
  assert.match(composerSource, /data-save-share-modal-position="fixed-viewport-centered"/);
  assert.match(composerSource, /data-save-share-modal-preview-scale="proportional-artifact"/);
  assert.match(composerSource, /src=\{composerState\.previewUrl\}/);
  assert.match(composerSource, /object-contain/);
  assert.match(composerSource, /data-export-artifact-loading-treatment="quiet-leather-only"/);
  assert.match(composerSource, /data-save-share-modal-primary-color="journal-theme"/);
  assert.match(composerSource, /data-save-share-modal-secondary-color="previous-primary-control"/);
  assert.match(composerSource, /Save Image/);
  assert.match(composerSource, /Share/);
  assert.match(composerSource, /Sharing isn’t supported here/);
  assert.doesNotMatch(composerSource, /items-end/);
  assert.doesNotMatch(composerSource, /Image ready\./);
  assert.match(journalDemoSource, /initialScreen === "detail"/);
  assert.match(journalDemoPageSource, /screen === "detail"/);
  assert.doesNotMatch(composerSource, /Monthly Sheet|Year in Stamps/);
  assert.doesNotMatch(composerSource, /format selector|template selector/i);
});

test("daily stamp export modal is fixed, centered, and scroll contained", () => {
  const composerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );

  assert.match(composerSource, /className="fixed inset-0 z-50 grid place-items-center/);
  assert.match(composerSource, /height: "100dvh"/);
  assert.match(composerSource, /minHeight: "100svh"/);
  assert.match(composerSource, /env\(safe-area-inset-top\)/);
  assert.match(composerSource, /env\(safe-area-inset-bottom\)/);
  assert.match(composerSource, /body\.style\.overflow = "hidden"/);
  assert.match(composerSource, /documentElement\.style\.overflow = "hidden"/);
  assert.match(composerSource, /overscroll-contain/);
  assert.match(composerSource, /maxHeight: "calc\(100dvh - 1\.5rem\)"/);
  assert.doesNotMatch(composerSource, /sm:items-center/);
});

test("daily stamp export canvas uses dedicated 9:16 scale tokens", () => {
  const exportSource = readSource("lib/export/daily-memory-stamp-export.ts");

  assert.match(exportSource, /journalTitleUsesDarkInk/);
  assert.match(exportSource, /journalTitleUsesDarkInk\(theme\)/);
  assert.match(exportSource, /const dailyStampExportLayout = \{/);
  assert.match(exportSource, /"Cormorant Garamond"/);
  assert.match(exportSource, /Inter/);
  assert.match(exportSource, /"Songti SC"/);
  assert.match(exportSource, /"PingFang SC"/);
  assert.match(exportSource, /"Microsoft YaHei"/);
  assert.match(exportSource, /ensureDailyStampExportBrandFonts/);
  assert.match(exportSource, /document\.fonts\.load/);
  assert.match(exportSource, /journalTitleCenterY: 202/);
  assert.match(exportSource, /journalTitleFontSize: 62/);
  assert.match(exportSource, /journalTitleLineHeight: 68/);
  assert.match(exportSource, /journalTitleMaxWidth: 540/);
  assert.match(exportSource, /overlayCenterY: DAILY_STAMP_EXPORT_HEIGHT \/ 2/);
  assert.match(exportSource, /overlayMinTop: 300/);
  assert.match(exportSource, /overlayX: 27/);
  assert.match(exportSource, /overlayWidth: 1026/);
  assert.match(exportSource, /overlayRadius: 18/);
  assert.match(exportSource, /dateBaselineOffset: 63/);
  assert.match(exportSource, /dateFontSize: 22/);
  assert.match(exportSource, /titleFontSize: 53/);
  assert.match(exportSource, /gridTopOffset: 175/);
  assert.match(exportSource, /gridGap: 18/);
  assert.match(exportSource, /singlePhotoMaxWidth: 981/);
  assert.match(exportSource, /logoBoxSize: 190/);
  assert.match(exportSource, /logoBottom: 170/);
  assert.match(exportSource, /Math\.round\(layout\.overlayCenterY - overlayHeight \/ 2\)/);
  assert.match(exportSource, /const dateBaseline = overlayTop \+ layout\.dateBaselineOffset/);
  assert.match(exportSource, /drawSingleLineText/);
  assert.match(exportSource, /drawCenteredWrappedText/);
  assert.match(exportSource, /maxLines: 2/);
  assert.match(exportSource, /journalConfig\.maxTitleLength/);
  assert.match(exportSource, /context\.roundRect\(x, y, width, height, dailyStampExportLayout\.overlayRadius\)/);
  assert.match(exportSource, /drawTrackedText/);
  assert.doesNotMatch(exportSource, /overlayTop: 153/);
  assert.doesNotMatch(exportSource, /strokeRect|perforated|postage/i);
});

test("persisted daily stamp export is authenticated and rendered on the server", async () => {
  const routeSource = readSource("app/api/export/daily-stamp/route.ts");
  const nextConfigSource = readSource("next.config.ts");
  const composerSource = readSource(
    "components/export/daily-stamp-export-composer.tsx",
  );

  assert.match(routeSource, /runtime = "nodejs"/);
  assert.match(routeSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(routeSource, /\.from\("memories"\)[\s\S]*\.select\("id"\)/);
  assert.match(routeSource, /getAdminSupabaseClient/);
  assert.match(routeSource, /thumbnail_storage_path/);
  assert.match(routeSource, /slice\(0, MAX_EXPORTED_PHOTOS\)/);
  assert.match(routeSource, /Cache-Control": "private, no-store"/);
  assert.match(routeSource, /MAX_PNG_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(routeSource, /MAX_TOTAL_SOURCE_BYTES/);
  assert.match(routeSource, /CormorantGaramond-Medium\.ttf/);
  assert.match(routeSource, /CormorantGaramond-SemiBold\.ttf/);
  assert.match(routeSource, /Inter-SemiBold\.ttf/);
  assert.match(routeSource, /NotoSansCJKsc-Regular\.otf/);
  assert.match(routeSource, /new Resvg/);
  assert.match(routeSource, /loadSystemFonts:\s*false/);
  assert.match(routeSource, /serverTextRuns/);
  assert.match(routeSource, /renderResvgTextLine/);
  assert.doesNotMatch(
    routeSource,
    /font-family="(?:Georgia|Arial)|Times New Roman/,
  );
  assert.doesNotMatch(routeSource, /photos\.map[\s\S]*Promise\.all/);
  assert.doesNotMatch(routeSource, /fetch\(theme\.texture/i);
  assert.match(nextConfigSource, /outputFileTracingIncludes/);
  assert.match(nextConfigSource, /serverExternalPackages:\s*\["@resvg\/resvg-js"\]/);
  assert.match(nextConfigSource, /"\/api\/export\/daily-stamp"/);
  assert.match(nextConfigSource, /CormorantGaramond-Medium\.ttf/);
  assert.match(nextConfigSource, /CormorantGaramond-SemiBold\.ttf/);
  assert.match(nextConfigSource, /Inter-SemiBold\.ttf/);
  assert.match(nextConfigSource, /NotoSansCJKsc-Regular\.otf/);
  assert.match(nextConfigSource, /@twemoji\/api\/assets\/svg\/\*\.svg/);

  assert.match(composerSource, /fetch\("\/api\/export\/daily-stamp"/);
  assert.match(composerSource, /persistentMemoryId\(memory\)/);
  assert.match(composerSource, /const renderExportBlob = useCallback/);
  assert.match(composerSource, /controller\.abort\(\)/);

  const invalid = await postDailyStampExport(
    new Request("https://journal-chip.test/api/export/daily-stamp", {
      method: "POST",
      body: JSON.stringify({ memoryId: "not-a-uuid" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { ok: false, code: "INVALID_REQUEST" });

  const unauthenticated = await postDailyStampExport(
    new Request("https://journal-chip.test/api/export/daily-stamp", {
      method: "POST",
      body: JSON.stringify({
        memoryId: "123e4567-e89b-42d3-a456-426614174000",
      }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), {
    ok: false,
    code: "AUTH_REQUIRED",
  });

  const oversized = await postDailyStampExport(
    new Request("https://journal-chip.test/api/export/daily-stamp", {
      method: "POST",
      body: JSON.stringify({ memoryId: "x".repeat(2_000) }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), {
    ok: false,
    code: "REQUEST_TOO_LARGE",
  });
});

test("bundled server export font contains distinct CJK glyphs", async () => {
  const fontUrl = new URL(
    "../public/fonts/NotoSansCJKsc-Regular.otf",
    import.meta.url,
  );
  const font = readFileSync(fontUrl);
  assert.equal(font.subarray(0, 4).toString("ascii"), "OTTO");
  assert.ok(font.byteLength > 10_000_000);

  const sample = "京都咖啡散步";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80"><text x="0" y="62" font-family="Noto Sans CJK SC" font-size="62">${sample}</text></svg>`;
  const png = new Resvg(svg, {
    font: {
      fontFiles: [fileURLToPath(fontUrl)],
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();
  const rendered = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const glyphWidth = Math.floor(rendered.info.width / sample.length);
  const glyphHashes = Array.from({ length: sample.length }, (_, index) => {
    const left = index * glyphWidth;
    const right =
      index === sample.length - 1
        ? rendered.info.width
        : (index + 1) * glyphWidth;
    const hash = createHash("sha256");
    for (let y = 0; y < rendered.info.height; y += 1) {
      const rowStart = (y * rendered.info.width + left) * 4;
      const rowEnd = (y * rendered.info.width + right) * 4;
      hash.update(rendered.data.subarray(rowStart, rowEnd));
    }
    return hash.digest("hex");
  });
  assert.ok(
    new Set(glyphHashes).size >= sample.length - 1,
    "expected distinct CJK glyphs instead of repeated missing-glyph boxes",
  );
});

test("bundled server export uses the Journal Home brand font families", async () => {
  const displayMediumFontUrl = new URL(
    "../public/fonts/CormorantGaramond-Medium.ttf",
    import.meta.url,
  );
  const displayFontUrl = new URL(
    "../public/fonts/CormorantGaramond-SemiBold.ttf",
    import.meta.url,
  );
  const interfaceFontUrl = new URL(
    "../public/fonts/Inter-SemiBold.ttf",
    import.meta.url,
  );

  for (const fontUrl of [
    displayMediumFontUrl,
    displayFontUrl,
    interfaceFontUrl,
  ]) {
    const font = readFileSync(fontUrl);
    assert.deepEqual(Array.from(font.subarray(0, 4)), [0, 1, 0, 0]);
    assert.ok(font.byteLength > 300_000);
  }

  const text = "My own lil space";
  const fontFiles = [
    fileURLToPath(displayMediumFontUrl),
    fileURLToPath(displayFontUrl),
    fileURLToPath(interfaceFontUrl),
  ];
  const renderFontSample = (fontFamily) =>
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="90"><text x="0" y="70" font-family="${fontFamily}" font-size="62" font-weight="600">${text}</text></svg>`,
      {
        font: {
          fontFiles,
          loadSystemFonts: false,
        },
      },
    )
      .render()
      .asPng();
  const display = renderFontSample("Cormorant Garamond");
  const utility = renderFontSample("Inter");

  assert.notEqual(
    createHash("sha256").update(display).digest("hex"),
    createHash("sha256").update(utility).digest("hex"),
  );
  assert.deepEqual(
    serverTextRuns("My own lil space♥", "Cormorant Garamond"),
    [{ text: "My own lil space♥", family: "Cormorant Garamond" }],
  );
  assert.deepEqual(serverTextRuns("我的 lil space", "Cormorant Garamond"), [
    { text: "我的", family: "Noto Sans CJK SC" },
    { text: " lil space", family: "Cormorant Garamond" },
  ]);
  assert.deepEqual(
    serverTextRuns("Me time in Kyoto 🌧️", "Cormorant Garamond"),
    [
      { text: "Me time in Kyoto ", family: "Cormorant Garamond" },
      { text: "🌧️", family: "Twemoji", emojiCodepoint: "1f327" },
    ],
  );
});

test("daily stamp emoji segmentation preserves every RGI sequence as one image", () => {
  const input = "Rain 🌧️ coder 👩🏽‍💻 Japan 🇯🇵 family 👨‍👩‍👧‍👦 key 1️⃣ new 🫩 ♥ ♥️";
  const emojiParts = dailyStampTextParts(input).filter(
    (part) => part.kind === "emoji",
  );

  assert.deepEqual(
    emojiParts.map(({ text, codepoint }) => ({ text, codepoint })),
    [
      { text: "🌧️", codepoint: "1f327" },
      { text: "👩🏽‍💻", codepoint: "1f469-1f3fd-200d-1f4bb" },
      { text: "🇯🇵", codepoint: "1f1ef-1f1f5" },
      {
        text: "👨‍👩‍👧‍👦",
        codepoint: "1f468-200d-1f469-200d-1f467-200d-1f466",
      },
      { text: "1️⃣", codepoint: "31-20e3" },
      { text: "🫩", codepoint: "1fae9" },
      { text: "♥️", codepoint: "2665" },
    ],
  );
  assert.equal(dailyStampEmojiCodepoint("♥"), undefined);
  assert.equal(dailyStampEmojiAssetUrl("1f327"), "/api/export/daily-stamp?emoji=1f327");

  const dailyStampSource = readSource(
    "components/stamp/daily-memory-stamp.tsx",
  );
  const journalHeaderSource = readSource(
    "components/journal/journal-identity-header.tsx",
  );
  assert.match(dailyStampSource, /DailyStampEmojiText value=\{memory\.title\}/);
  assert.match(journalHeaderSource, /DailyStampEmojiText value=\{displayTitle\}/);
});

test("daily stamp emoji endpoint serves only bundled SVG assets", async () => {
  const response = await getDailyStampEmoji(
    new Request("http://localhost/api/export/daily-stamp?emoji=1f327"),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/svg\+xml/u);
  assert.match(await response.text(), /fill="#5DADEC"/u);

  const invalid = await getDailyStampEmoji(
    new Request(
      "http://localhost/api/export/daily-stamp?emoji=..%2F..%2Fpackage",
    ),
  );
  assert.equal(invalid.status, 404);
});

test("server export renders the real color emoji instead of a replacement dot", async () => {
  const png = await renderServerDailyStampPng({
    memory: {
      ...memory,
      title: "Me time in Kyoto 🌧️",
      photos: [],
    },
    journalTitle: "My own lil space♥",
    photos: [],
  });
  const rendered = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let rainBluePixels = 0;
  for (let index = 0; index < rendered.data.length; index += 4) {
    if (
      rendered.data[index] === 0x5d &&
      rendered.data[index + 1] === 0xad &&
      rendered.data[index + 2] === 0xec &&
      rendered.data[index + 3] === 0xff
    ) {
      rainBluePixels += 1;
    }
  }
  assert.ok(
    rainBluePixels > 20,
    `expected Twemoji rain pixels, received ${rainBluePixels}`,
  );
});

test("server daily stamp renderer handles 9 photos and applies normalized cover crop", async () => {
  const leftHalf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: "#ff0000",
    },
  })
    .png()
    .toBuffer();
  const rightHalf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: "#0000ff",
    },
  })
    .png()
    .toBuffer();
  const cover = await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: "#ff0000",
    },
  })
    .composite([
      { input: leftHalf, left: 0, top: 0 },
      { input: rightHalf, left: 100, top: 0 },
    ])
    .png()
    .toBuffer();
  const remaining = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      sharp({
        create: {
          width: 64,
          height: 64,
          channels: 3,
          background: index % 2 ? "#efe7d6" : "#124f4d",
        },
      })
        .png()
        .toBuffer(),
    ),
  );
  const ninePhotoMemory = {
    ...memory,
    photos: Array.from({ length: 9 }, (_, index) =>
      photo({
        id: `photo-${index}`,
        width: index === 0 ? 200 : 64,
        height: index === 0 ? 100 : 64,
        cropMetadata:
          index === 0
            ? {
                ...cropMetadata,
                x: 0.5,
                y: 0,
                width: 0.5,
                height: 1,
                imageWidth: 200,
                imageHeight: 100,
              }
            : undefined,
      }),
    ),
  };

  const png = await renderServerDailyStampPng({
    memory: ninePhotoMemory,
    journalTitle: "My own lil space💛",
    theme: {
      ...defaultJournalTheme,
      slug: "teal",
      key: "teal",
      journalBackground: "#124f4d",
      fallbackBackgroundColor: "#124f4d",
      textPrimary: "#f4efe1",
      textOnJournal: "#f4efe1",
      textSecondary: "#c9d8cd",
      mutedTextOnJournal: "#c9d8cd",
    },
    photos: [
      { input: cover, cropMetadata: ninePhotoMemory.photos[0].cropMetadata },
      ...remaining.map((input) => ({ input })),
    ],
  });
  const result = sharp(png);
  const metadata = await result.metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, DAILY_STAMP_EXPORT_WIDTH);
  assert.equal(metadata.height, DAILY_STAMP_EXPORT_HEIGHT);
  assert.ok(png.byteLength > 0);
  assert.ok(png.byteLength <= 4 * 1024 * 1024);

  const sampled = await result
    .extract({ left: 207, top: 703, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(sampled[2] > 200, `expected blue crop, got ${sampled.join(",")}`);
  assert.ok(sampled[0] < 50, `expected blue crop, got ${sampled.join(",")}`);
});

test("server export falls back from a corrupt thumbnail to the display photo", async () => {
  const display = await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: "#124f4d",
    },
  })
    .png()
    .toBuffer();
  const requested = [];
  const prepared = await prepareStoredPhotoInput({
    sources: [
      { storagePath: "thumb.webp", maxBytes: 100, maxInputPixels: 1_000_000 },
      { storagePath: "display.webp", maxBytes: 1_000_000, maxInputPixels: 5_000_000 },
    ],
    size: 327,
    download: async (storagePath) => {
      requested.push(storagePath);
      return storagePath === "thumb.webp" ? Buffer.from("not-an-image") : display;
    },
  });
  assert.deepEqual(requested, ["thumb.webp", "display.webp"]);
  assert.equal(prepared.prepared, true);
  const metadata = await sharp(prepared.input).metadata();
  assert.equal(metadata.width, 327);
  assert.equal(metadata.height, 327);
});

test("server export sanitizes XML controls and survives a corrupt texture", async () => {
  const png = await renderServerDailyStampPng({
    memory: {
      ...memory,
      title: "Control\u0001 & <tag> 👩🏽‍💻 café 你好",
      photos: [],
    },
    journalTitle: "Family 👨‍👩‍👧‍👦 & friends\u000B",
    photos: [],
    texture: Buffer.from("corrupt-theme-texture"),
  });
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, DAILY_STAMP_EXPORT_WIDTH);
  assert.equal(metadata.height, DAILY_STAMP_EXPORT_HEIGHT);
});

test("server export tolerates an undated memory without rendering an empty text input", async () => {
  const png = await renderServerDailyStampPng({
    memory: {
      ...memory,
      capturedAt: "",
      localDate: "",
      photos: [],
    },
    journalTitle: "Undated journal",
    photos: [],
  });
  assert.equal((await sharp(png).metadata()).format, "png");
});

test("server export enforces photo-count boundaries", async () => {
  const one = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: "#efe7d6",
    },
  })
    .png()
    .toBuffer();
  const onePhotoMemory = { ...memory, photos: [photo({ id: "one" })] };
  const png = await renderServerDailyStampPng({
    memory: onePhotoMemory,
    journalTitle: "One",
    photos: [{ input: one }],
  });
  assert.equal((await sharp(png).metadata()).format, "png");

  await assert.rejects(
    renderServerDailyStampPng({
      memory: { ...memory, photos: Array.from({ length: 10 }, (_, i) => photo({ id: `${i}` })) },
      journalTitle: "Too many",
      photos: Array.from({ length: 10 }, () => ({ input: one })),
    }),
    /at most 9/,
  );
  await assert.rejects(
    renderServerDailyStampPng({
      memory: onePhotoMemory,
      journalTitle: "Mismatch",
      photos: [],
    }),
    /do not match/,
  );
});

test("high-entropy nine-photo export stays below Vercel's buffered response limit", async () => {
  const inputs = await Promise.all(
    Array.from({ length: 9 }, () =>
      sharp(randomBytes(420 * 420 * 3), {
        raw: { width: 420, height: 420, channels: 3 },
      })
        .png()
        .toBuffer(),
    ),
  );
  const texture = await sharp(randomBytes(540 * 960 * 3), {
    raw: { width: 540, height: 960, channels: 3 },
  })
    .png()
    .toBuffer();
  const noisyMemory = {
    ...memory,
    photos: Array.from({ length: 9 }, (_, index) =>
      photo({ id: `noise-${index}`, width: 420, height: 420 }),
    ),
  };
  const png = await renderServerDailyStampPng({
    memory: noisyMemory,
    journalTitle: "Nine noisy moments",
    photos: inputs.map((input) => ({ input })),
    texture,
  });
  assert.ok(
    png.byteLength <= 4 * 1024 * 1024,
    `expected <= 4 MiB, got ${png.byteLength}`,
  );
  assert.equal((await sharp(png).metadata()).format, "png");
});
