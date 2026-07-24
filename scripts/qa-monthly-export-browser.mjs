import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const projectRequire = createRequire(import.meta.url);
const sharp = projectRequire("sharp");
const { resolveJournalTheme, rubyJournalTheme } = await import(
  "../data/journal-themes.ts"
);
const { renderServerMonthlyMemoryEditionPng } = await import(
  "../lib/export/monthly-memory-sheet-server.ts"
);

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    "playwright",
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  let lastError;
  for (const target of candidates) {
    try {
      return await import(
        target.startsWith("/") ? pathToFileURL(target).href : target
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = await loadPlaywright();
const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3006").replace(/\/$/, "");
const screenshotDirectory =
  process.env.MONTHLY_EXPORT_QA_SCREENSHOTS ?? "/private/tmp";
const demoUrl = `${baseUrl}/journal/demo?screen=home&month=2026-08`;
const browser = await chromium.launch({ headless: true });
const results = [];

async function patchMean(imagePath, x, y, width = 24, height = 24) {
  const { data, info } = await sharp(imagePath)
    .extract({ left: x, top: y, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = Array.from({ length: info.channels }, () => 0);
  for (let offset = 0; offset < data.length; offset += info.channels) {
    for (let channel = 0; channel < info.channels; channel += 1) {
      channels[channel] += data[offset + channel];
    }
  }
  return channels.map((total) => total / (width * height));
}

async function openReadyComposer(page) {
  await page.goto(demoUrl, { waitUntil: "networkidle" });
  const entry = page.locator('[data-monthly-stamp-export-action="true"]');
  await entry.focus();
  await entry.click();
  await page.locator('[data-monthly-stamp-export-state="ready"]').waitFor({
    timeout: 30_000,
  });
}

try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const issues = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        issues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
      window.__monthlyRevokeCount = 0;
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => {
        window.__monthlyRevokeCount += 1;
        revoke(url);
      };
    });
    await openReadyComposer(page);

    const modal = await page.evaluate(() => {
      const overlay = document.querySelector(
        '[data-monthly-stamp-export-composer="true"]',
      );
      const dialog = overlay?.querySelector('[role="dialog"]');
      const preview = overlay?.querySelector(
        '[data-monthly-stamp-export-preview="ready"]',
      );
      const dialogRect = dialog?.getBoundingClientRect();
      const previewRect = preview?.getBoundingClientRect();
      return {
        bodyOverflow: document.body.style.overflow,
        state: overlay?.getAttribute("data-monthly-stamp-export-state"),
        dialogTitle: dialog?.querySelector("h2")?.textContent?.trim(),
        buttonText: [...(dialog?.querySelectorAll("button") ?? [])].map(
          (button) => button.textContent?.trim(),
        ),
        statusText: dialog?.querySelector('[role="status"]')?.textContent?.trim(),
        previewSource: preview?.getAttribute(
          "data-monthly-stamp-export-preview-source",
        ),
        previewSrc: preview?.getAttribute("src"),
        dialogWidth: dialogRect?.width,
        previewWidth: previewRect?.width,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });
    assert.equal(modal.state, "ready");
    assert.equal(modal.dialogTitle, "Your August Memory Edition");
    assert.deepEqual(modal.buttonText.slice(-2), ["Save", "Share"]);
    assert.match(modal.statusText ?? "", /is ready\.$/);
    assert.equal(modal.previewSource, "generated-blob");
    assert.match(modal.previewSrc ?? "", /^blob:/);
    assert.equal(modal.horizontalOverflow, false);
    assert.ok((modal.dialogWidth ?? 0) <= 306);
    assert.ok((modal.previewWidth ?? 0) <= 152);
    await page.screenshot({
      path: `${screenshotDirectory}/monthly-export-${width}.png`,
      fullPage: true,
    });

    if (width === 390) {
      const saveDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Save" }).click();
      assert.equal(
        (await saveDownload).suggestedFilename(),
        "2026-08-memory-edition.png",
      );
      const shareDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Share" }).click();
      assert.equal(
        (await shareDownload).suggestedFilename(),
        "2026-08-memory-edition.png",
      );
      await page.getByText(
        "Sharing isn’t supported here. The image was saved instead.",
      ).waitFor();
    }

    if (width === 390) {
      await page.keyboard.press("Escape");
    } else {
      await page
        .getByRole("button", {
          name: "Close Monthly Memory Edition preview",
        })
        .click();
    }
    await page
      .locator('[data-monthly-stamp-export-composer="true"]')
      .waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.ok(
      (await page.evaluate(() => window.__monthlyRevokeCount)) >= 1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement?.getAttribute(
            "data-monthly-stamp-export-action",
          ) === "true",
      ),
      true,
    );
    results.push({ width, modal, issues });
    await page.close();
  }

  const reducedPage = await browser.newPage({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
  });
  await reducedPage.goto(demoUrl, { waitUntil: "networkidle" });
  const reducedMotion = await reducedPage
    .locator('[data-monthly-stamp-export-action="true"]')
    .evaluate((button) => ({
      transition: getComputedStyle(button).transition,
      transform: getComputedStyle(button).transform,
    }));
  assert.equal(reducedMotion.transition, "none");
  assert.equal(reducedMotion.transform, "none");
  await reducedPage.locator('[data-monthly-stamp-export-action="true"]').click();
  await reducedPage.keyboard.press("Escape");
  await reducedPage.waitForTimeout(1_000);
  assert.equal(
    await reducedPage
      .locator('[data-monthly-stamp-export-composer="true"]')
      .count(),
    0,
  );
  await reducedPage.close();

  const retryPage = await browser.newPage({
    viewport: { width: 390, height: 900 },
  });
  let retryDownloads = 0;
  retryPage.on("download", () => {
    retryDownloads += 1;
  });
  await retryPage.goto(demoUrl, { waitUntil: "networkidle" });
  await retryPage.evaluate(() => {
    window.__monthlyOriginalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
  });
  await retryPage.locator('[data-monthly-stamp-export-action="true"]').click();
  await retryPage.locator('[data-monthly-stamp-export-state="error"]').waitFor({
    timeout: 30_000,
  });
  assert.equal(
    await retryPage.getByRole("button", { name: "Retry" }).count(),
    1,
  );
  assert.equal(
    await retryPage
      .getByRole("alert")
      .filter({ hasText: "Couldn’t create your Monthly Memory Edition." })
      .count(),
    1,
  );
  await retryPage.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = window.__monthlyOriginalToBlob;
  });
  await retryPage.getByRole("button", { name: "Retry" }).click();
  await retryPage.locator('[data-monthly-stamp-export-state="ready"]').waitFor({
    timeout: 30_000,
  });
  await retryPage.waitForTimeout(100);
  assert.equal(retryDownloads, 0);
  await retryPage.close();

  for (const outcome of ["success", "cancel", "failure"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript((shareOutcome) => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          if (shareOutcome === "cancel") {
            throw new DOMException("Canceled", "AbortError");
          }
          if (shareOutcome === "failure") throw new Error("Share failed");
        },
      });
    }, outcome);
    await openReadyComposer(page);
    await page.getByRole("button", { name: "Share" }).click();
    const message =
      outcome === "success"
        ? "Shared."
        : outcome === "cancel"
          ? "Share canceled."
          : "The image couldn’t be shared. You can save it instead.";
    await page.getByText(message, { exact: true }).waitFor();
    await page.close();
  }

  const staleSharePage = await browser.newPage({
    viewport: { width: 390, height: 900 },
  });
  await staleSharePage.addInitScript(() => {
    window.__monthlyShareStarted = false;
    window.__monthlyResolveShare = undefined;
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => {
        window.__monthlyShareStarted = true;
        return new Promise((resolve) => {
          window.__monthlyResolveShare = resolve;
        });
      },
    });
  });
  await openReadyComposer(staleSharePage);
  await staleSharePage.getByRole("button", { name: "Share" }).click();
  await staleSharePage.waitForFunction(() => window.__monthlyShareStarted);
  await staleSharePage
    .getByRole("button", {
      name: "Close Monthly Memory Edition preview",
    })
    .click();
  await staleSharePage.locator('[data-monthly-stamp-export-action="true"]').click();
  await staleSharePage
    .locator('[data-monthly-stamp-export-state="ready"]')
    .waitFor({ timeout: 30_000 });
  await staleSharePage.evaluate(() => window.__monthlyResolveShare?.());
  await staleSharePage.waitForTimeout(100);
  assert.match(
    await staleSharePage.getByRole("status").textContent(),
    /is ready\.$/,
  );
  await staleSharePage.close();

  const emptyPage = await browser.newPage({
    viewport: { width: 390, height: 900 },
  });
  let emptyExportRequests = 0;
  emptyPage.on("request", (request) => {
    if (request.url().endsWith("/api/export/monthly-sheet")) {
      emptyExportRequests += 1;
    }
  });
  await emptyPage.goto(
    `${baseUrl}/journal/demo?screen=home&month=2025-01`,
    { waitUntil: "networkidle" },
  );
  await emptyPage.getByText("No stamps yet.", { exact: true }).waitFor();
  const emptyExportEntry = emptyPage.locator(
    '[data-monthly-stamp-export-action="true"]',
  );
  assert.equal(await emptyExportEntry.isDisabled(), true);
  await emptyExportEntry.click({ force: true });
  await emptyPage.waitForTimeout(100);
  assert.equal(
    await emptyPage
      .locator('[data-monthly-stamp-export-composer="true"]')
      .count(),
    0,
  );
  assert.equal(emptyExportRequests, 0);
  await emptyPage.close();

  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const issues = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        issues.push(`${message.type()}: ${message.text()}`);
      }
    });
    await page.goto(`${baseUrl}/design/monthly-export-v1`, {
      waitUntil: "networkidle",
    });
    const playground = await page.evaluate(() => ({
      completeness: document
        .querySelector("[data-monthly-export-completeness]")
        ?.getAttribute("data-monthly-export-completeness"),
      stampCount: document.querySelectorAll(
        "[data-monthly-export-completeness] [data-monthly-export-stamp]",
      ).length,
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    }));
    assert.equal(playground.completeness, "31-of-31");
    assert.equal(playground.stampCount, 31);
    assert.equal(playground.horizontalOverflow, false);
    await page.screenshot({
      path: `${screenshotDirectory}/monthly-playground-${width}.png`,
      fullPage: true,
    });
    results.push({ width, playground, issues });

    if (width === 1280) {
      await page.getByRole("button", { name: "Full size · 1:1" }).click();
      const browserArtifactPath =
        `${screenshotDirectory}/monthly-playground-artifact-browser.png`;
      const serverArtifactPath =
        `${screenshotDirectory}/monthly-playground-artifact-server.png`;
      const browserArtifact = page.locator(
        '[data-monthly-export-artifact="complete-long-image"]',
      );
      await browserArtifact.evaluate((element) => {
        const viewport = element.closest(
          '[data-monthly-export-preview-mode="full"]',
        );
        if (viewport instanceof HTMLElement) {
          viewport.style.maxHeight = "none";
          viewport.style.overflow = "visible";
        }
      });
      const structuralGeometry = await browserArtifact.evaluate((artifact) => {
        const artifactRect = artifact.getBoundingClientRect();
        const scale = 1080 / artifactRect.width;
        const relativeRect = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: (rect.left - artifactRect.left) * scale,
            y: (rect.top - artifactRect.top) * scale,
            width: rect.width * scale,
            height: rect.height * scale,
          };
        };
        const required = (selector) => {
          const element = artifact.querySelector(selector);
          if (!(element instanceof HTMLElement)) {
            throw new Error(`Missing artifact landmark: ${selector}`);
          }
          return element;
        };
        return {
          artifact: {
            x: 0,
            y: 0,
            width: artifactRect.width * scale,
            height: artifactRect.height * scale,
          },
          header: relativeRect(required("header")),
          sheet: relativeRect(
            required('[aria-label^="July 2026 monthly sheet"]'),
          ),
          grid: relativeRect(
            required('[data-monthly-export-grid="3-columns-11-rows"]'),
          ),
          firstStamp: relativeRect(
            required('[data-monthly-export-day="1"]'),
          ),
          finalStamp: relativeRect(
            required('[data-monthly-export-day="31"]'),
          ),
          footer: relativeRect(required("footer")),
          logo: relativeRect(required("footer img")),
        };
      });
      const assertRect = (actual, expected, label) => {
        for (const key of ["x", "y", "width", "height"]) {
          assert.ok(
            Math.abs(actual[key] - expected[key]) <= 1,
            `${label} ${key} expected ${expected[key]}, got ${actual[key]}`,
          );
        }
      };
      assertRect(
        structuralGeometry.artifact,
        { x: 0, y: 0, width: 1080, height: 4050 },
        "artifact",
      );
      assertRect(
        structuralGeometry.header,
        { x: 60, y: 56, width: 960, height: 112 },
        "header",
      );
      assertRect(
        structuralGeometry.sheet,
        { x: 60, y: 196, width: 960, height: 3594 },
        "sheet",
      );
      assertRect(
        structuralGeometry.grid,
        { x: 84, y: 368, width: 912, height: 3392 },
        "grid",
      );
      assertRect(
        structuralGeometry.firstStamp,
        { x: 84, y: 368, width: 292, height: 292 },
        "first stamp",
      );
      assertRect(
        structuralGeometry.finalStamp,
        { x: 394, y: 3468, width: 292, height: 292 },
        "centered row 11 stamp",
      );
      assertRect(
        structuralGeometry.footer,
        { x: 60, y: 3822, width: 960, height: 180 },
        "footer",
      );
      assertRect(
        structuralGeometry.logo,
        { x: 450, y: 3822, width: 180, height: 180 },
        "logo",
      );
      await browserArtifact.screenshot({ path: browserArtifactPath });
      const texture = await readFile(
        new URL(
          "../public/images/textures/wine-red-leather-texture-9x16.png",
          import.meta.url,
        ),
      );
      const logo = await readFile(
        new URL(
          "../public/brand/mgp-full-logo-transparent.png",
          import.meta.url,
        ),
      );
      const serverArtifact =
        await renderServerMonthlyMemoryEditionPng({
          journalTitle: "Margot's Journal",
          monthKey: "2026-07",
          theme: resolveJournalTheme({
            ...rubyJournalTheme,
            name: "Wine leather",
          }),
          stamps: Array.from({ length: 31 }, (_, index) => ({
            dayLabel: String(index + 1),
          })),
          texture,
          logo,
        });
      await sharp(serverArtifact).toFile(serverArtifactPath);
      const landmarks = [
        [12, 12],
        [1044, 12],
        [12, 1900],
        [1044, 3980],
      ];
      for (const [x, y] of landmarks) {
        const [browserMean, serverMean] = await Promise.all([
          patchMean(browserArtifactPath, x, y),
          patchMean(serverArtifactPath, x, y),
        ]);
        const meanError =
          browserMean.reduce(
            (total, value, index) =>
              total + Math.abs(value - serverMean[index]),
            0,
          ) / browserMean.length;
        assert.ok(
          meanError <= 12,
          `Playground/server background landmark ${x},${y} differs by ${meanError}`,
        );
      }
      playground.visualParityLandmarks = `${landmarks.length}-of-${landmarks.length}`;
      await browserArtifact.evaluate((artifact) => {
        artifact.style.setProperty(
          "--journal-mobile-background-image",
          "none",
        );
        artifact.style.setProperty(
          "--journal-mobile-background-opacity",
          "0.8",
        );
      });
      const browserFallbackPath =
        `${screenshotDirectory}/monthly-playground-artifact-fallback-browser.png`;
      const serverFallbackPath =
        `${screenshotDirectory}/monthly-playground-artifact-fallback-server.png`;
      await browserArtifact.screenshot({ path: browserFallbackPath });
      const serverFallback =
        await renderServerMonthlyMemoryEditionPng({
          journalTitle: "Margot's Journal",
          monthKey: "2026-07",
          theme: resolveJournalTheme(rubyJournalTheme),
          stamps: Array.from({ length: 31 }, (_, index) => ({
            dayLabel: String(index + 1),
          })),
          logo,
        });
      await sharp(serverFallback).toFile(serverFallbackPath);
      for (const [x, y] of landmarks) {
        const [browserMean, serverMean] = await Promise.all([
          patchMean(browserFallbackPath, x, y),
          patchMean(serverFallbackPath, x, y),
        ]);
        const meanError =
          browserMean.reduce(
            (total, value, index) =>
              total + Math.abs(value - serverMean[index]),
            0,
          ) / browserMean.length;
        assert.ok(
          meanError <= 4,
          `Fallback grain/sheen landmark ${x},${y} differs by ${meanError}`,
        );
      }
      playground.fallbackVisualParityLandmarks =
        `${landmarks.length}-of-${landmarks.length}`;
      playground.structuralGeometry = structuralGeometry;
    }
    await page.close();
  }

  assert.deepEqual(
    results.flatMap((result) => result.issues),
    [],
  );
  console.log(JSON.stringify({ ok: true, results, reducedMotion }, null, 2));
} finally {
  await browser.close();
}
