import assert from "node:assert/strict";
import { readFile, readFile as readFileBuffer } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { defaultJournalTheme } from "../data/journal-themes.ts";
import {
  MONTHLY_MEMORY_EDITION_COLUMNS,
  MONTHLY_MEMORY_EDITION_MAX_STAMPS,
  MONTHLY_MEMORY_EDITION_MIME_TYPE,
  MONTHLY_MEMORY_EDITION_WIDTH,
  canShareMonthlyMemoryEdition,
  monthlyMemoryEditionFilename,
  monthlyMemoryEditionHeight,
  monthlyMemoryEditionModel,
} from "../lib/export/monthly-memory-sheet-export.ts";
import { renderServerMonthlyMemoryEditionPng } from "../lib/export/monthly-memory-sheet-server.ts";

const source = async (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const stamp = (day) => ({
  id: `stamp-${day}`,
  title: `Day ${day}`,
  capturedAt: `2026-07-${String(day).padStart(2, "0")}T12:00:00.000Z`,
  createdAt: `2026-07-${String(day).padStart(2, "0")}T12:00:00.000Z`,
  localDate: `2026-07-${String(day).padStart(2, "0")}`,
  photoCount: 1,
  voiceMemoCount: 0,
  firstPhotoWidth: 1200,
  firstPhotoHeight: 900,
});

test("monthly edition model preserves every sealed day in a dynamic 3-column artifact", () => {
  const stamps = Array.from({ length: 31 }, (_, index) => stamp(index + 1));
  const model = monthlyMemoryEditionModel({
    journalTitle: "Margot's Journal",
    monthKey: "2026-07",
    stamps,
  });

  assert.equal(MONTHLY_MEMORY_EDITION_WIDTH, 1080);
  assert.equal(MONTHLY_MEMORY_EDITION_COLUMNS, 3);
  assert.equal(MONTHLY_MEMORY_EDITION_MAX_STAMPS, 31);
  assert.equal(MONTHLY_MEMORY_EDITION_MIME_TYPE, "image/png");
  assert.equal(model.height, 4050);
  assert.equal(monthlyMemoryEditionHeight(31), 4050);
  assert.equal(model.rows, 11);
  assert.equal(model.stamps.length, 31);
  assert.deepEqual(
    model.stamps.map((item) => item.day),
    Array.from({ length: 31 }, (_, index) => index + 1),
  );
  assert.equal(model.editionTitle, "July 2026 Edition");
  assert.equal(model.subheader, "The whole month, kept together");
});

test("monthly edition height grows by complete content rows", () => {
  assert.equal(monthlyMemoryEditionHeight(1), 950);
  assert.equal(monthlyMemoryEditionHeight(3), 950);
  assert.equal(monthlyMemoryEditionHeight(4), 1260);
  assert.equal(monthlyMemoryEditionHeight(30), 3740);
  assert.equal(monthlyMemoryEditionHeight(31), 4050);
});

test("monthly edition filename and sharing helpers do not expose private identifiers", () => {
  const filename = monthlyMemoryEditionFilename("2026-07");
  assert.equal(filename, "2026-07-memory-edition.png");
  assert.doesNotMatch(filename, /token|pin|capsule|https?:|\//i);
  assert.equal(canShareMonthlyMemoryEdition(undefined, {}), false);
  assert.equal(
    canShareMonthlyMemoryEdition(
      {
        canShare: () => true,
        share: async () => undefined,
      },
      {},
    ),
    true,
  );
});

test("server renderer produces one complete 1080x4050 PNG with 31 stamps", async () => {
  const tile = await sharp({
    create: {
      width: 292,
      height: 292,
      channels: 4,
      background: "#a77962",
    },
  })
    .png()
    .toBuffer();
  const logo = await readFileBuffer(
    new URL("../public/brand/mgp-full-logo-transparent.png", import.meta.url),
  );
  const png = await renderServerMonthlyMemoryEditionPng({
    journalTitle: "Margot's Journal",
    monthKey: "2026-07",
    theme: defaultJournalTheme,
    stamps: Array.from({ length: 31 }, (_, index) => ({
      dayLabel: String(index + 1),
      input: tile,
    })),
    logo,
  });
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 4050);
});

test("production Monthly Sheet uses the approved quiet download entry and blob preview", async () => {
  const [sheetSource, composerSource, composerStyles, homeSource, demoSource] =
    await Promise.all([
      source("components/journal/monthly-stamp-sheet.tsx"),
      source("components/export/monthly-stamp-export-composer.tsx"),
      source("components/export/monthly-stamp-export-composer.module.css"),
      source("components/journal/journal-home.tsx"),
      source("components/journal/journal-demo-flow.tsx"),
    ]);

  assert.match(sheetSource, /data-monthly-stamp-export-action="true"/);
  assert.match(sheetSource, /<DownloadIcon className="h-4 w-4" \/>/);
  assert.match(sheetSource, /month-sheet-export-divider/);
  assert.match(sheetSource, /Preview \$\{selectedTitle\} Memory Edition/);
  assert.match(homeSource, /MonthlyStampExportComposer/);
  assert.match(homeSource, /capsuleId=\{capsuleId\}/);
  assert.match(homeSource, /archive\.selectedSheet\.stamps/);
  assert.match(demoSource, /MonthlyStampExportComposer/);

  assert.match(composerSource, /Your \{model\.monthName\} Memory Edition/);
  assert.match(
    composerSource,
    /Preparing your \$\{model\.monthName\} Memory Edition\.\.\./,
  );
  assert.match(composerSource, /data-monthly-stamp-export-preview-source="generated-blob"/);
  assert.match(composerSource, /src=\{composerState\.previewUrl\}/);
  assert.match(composerSource, /<DownloadIcon \/>[\s\S]*\n\s*Save\s*\n/);
  assert.doesNotMatch(composerSource, /Save July Memory Edition|Complete preview/);
  assert.match(composerSource, />\s*Share\s*</);
  assert.match(composerSource, /Sharing isn’t supported here\. The image was saved instead\./);
  assert.match(composerSource, /body\.style\.overflow = "hidden"/);
  assert.match(composerSource, /event\.key === "Escape"/);
  assert.match(composerSource, /event\.key !== "Tab"/);

  assert.match(composerStyles, /max-width: 19\.125rem/);
  assert.match(composerStyles, /width: 9\.5rem/);
  assert.match(composerStyles, /\.primary \{[\s\S]*var\(--journal-background\)/);
  assert.match(composerStyles, /\.secondary \{[\s\S]*var\(--journal-home-cta-bg\)/);
  assert.match(composerStyles, /var\(--journal-texture-url\)/);
});

test("persisted monthly export is authenticated, private, and viewport-independent", async () => {
  const [routeSource, rendererSource, nextConfigSource] = await Promise.all([
    source("app/api/export/monthly-sheet/route.ts"),
    source("lib/export/monthly-memory-sheet-server.ts"),
    source("next.config.ts"),
  ]);

  assert.match(routeSource, /runtime = "nodejs"/);
  assert.match(routeSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(routeSource, /\.from\("capsules"\)[\s\S]*\.select\("id"\)/);
  assert.match(routeSource, /getAdminSupabaseClient/);
  assert.match(routeSource, /thumbnail_storage_path/);
  assert.match(routeSource, /crop_metadata/);
  assert.match(routeSource, /Cache-Control": "private, no-store"/);
  assert.match(routeSource, /Content-Type": "image\/png"/);
  assert.match(routeSource, /MAX_TOTAL_SOURCE_BYTES/);
  assert.match(routeSource, /MAX_PNG_RESPONSE_BYTES/);
  assert.doesNotMatch(routeSource, /publicToken|ownerPin|signedUrl/i);

  assert.match(rendererSource, /resize\(MONTHLY_MEMORY_EDITION_WIDTH, height/);
  assert.match(rendererSource, /fit: "cover"/);
  assert.match(rendererSource, /stamps\.forEach/);
  assert.match(rendererSource, /rowCount === 3/);
  assert.match(rendererSource, /fullGridWidth - rowWidth/);
  assert.match(rendererSource, /journalTitleUsesDarkInk/);
  assert.match(rendererSource, /theme\.logoVariant === "dark"/);
  assert.match(rendererSource, /CormorantGaramond-SemiBold\.ttf/);
  assert.match(rendererSource, /NotoSansCJKsc-Regular\.otf/);
  assert.match(nextConfigSource, /"\/api\/export\/monthly-sheet"/);
});
