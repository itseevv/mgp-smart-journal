import { pathToFileURL } from "node:url";

const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const isSmoke =
  process.env.JOURNAL_QA_SMOKE === "1" || process.argv.includes("--smoke");
const routeTimeoutMs = Number.parseInt(
  process.env.JOURNAL_QA_TIMEOUT_MS ?? (isSmoke ? "8000" : "15000"),
  10,
);
const widths = isSmoke ? [390] : [375, 390, 430];
const fullRoutes = [
  "/journal/demo",
  "/journal/demo?screen=create",
  "/journal/demo?screen=crop",
  "/journal/demo?screen=sealed",
  "/journal/demo?screen=create&photos=1",
  "/journal/demo?screen=create&photos=2",
  ...Array.from(
    { length: 9 },
    (_, index) => `/journal/demo?screen=detail&photos=${index + 1}`,
  ),
];
const routes = isSmoke
  ? [
      "/journal/demo",
      "/journal/demo?screen=create",
      "/journal/demo?screen=detail&photos=1",
    ]
  : fullRoutes;
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

function expectedLayout(photoCount) {
  if (photoCount <= 1) return { variant: "single", rowSizes: "1" };
  if (photoCount === 2) return { variant: "two-up", rowSizes: "2" };
  if (photoCount === 3) return { variant: "cover-plus-two", rowSizes: "1,2" };
  if (photoCount === 4) return { variant: "balanced-four", rowSizes: "2,2" };
  if (photoCount === 5) return { variant: "cover-plus-four", rowSizes: "1,2,2" };
  if (photoCount === 6) return { variant: "six-grid", rowSizes: "3,3" };
  if (photoCount === 7) return { variant: "cover-three-three", rowSizes: "1,3,3" };
  if (photoCount === 8) return { variant: "two-three-three", rowSizes: "2,3,3" };
  return { variant: "three-three-three", rowSizes: "3,3,3" };
}

function hasVisibleStampFrame(metrics, variant, expectedRimWidth, minimumOpacity) {
  return metrics.stampFrameStyles.some((frame) => {
    const rimWidth = Number.parseFloat(frame.rimWidth);
    const opacity = Number.parseFloat(frame.edgeOpacity);
    return (
      frame.variant === variant &&
      Number.isFinite(rimWidth) &&
      rimWidth >= expectedRimWidth &&
      Number.isFinite(opacity) &&
      opacity >= minimumOpacity &&
      frame.beforeBoxShadow !== "none" &&
      frame.afterBackgroundImage !== "none"
    );
  });
}

let chromium;
try {
  if (process.env.PLAYWRIGHT_MODULE_DIR) {
    ({ chromium } = await import(
      pathToFileURL(`${process.env.PLAYWRIGHT_MODULE_DIR}/playwright/index.mjs`).href
    ));
  } else {
    ({ chromium } = await import("playwright"));
  }
} catch {
  throw new Error(
    "Playwright is not available in this environment. Run the HTML QA script and manual mobile QA instead.",
  );
}

const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
}

const browser = await chromium.launch(launchOptions);
const results = [];
const failures = [];

try {
for (const width of widths) {
  for (const route of routes) {
    const page = await browser.newPage({
      viewport: { width, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
    });
    const consoleIssues = [];
    page.setDefaultTimeout(routeTimeoutMs);
    page.setDefaultNavigationTimeout(routeTimeoutMs);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(`${baseUrl}${route}`, {
      timeout: routeTimeoutMs,
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-journal-mobile-shell="true"]', {
      timeout: routeTimeoutMs,
    });
    const metrics = await page.evaluate((input) => {
      const { oldPhrases, createForbiddenPhrases } = input;
      const shell = document.querySelector(
        '[data-journal-mobile-shell="true"]',
      );
      const stamp = document.querySelector('[data-journal-stamp-detail="true"]');
      const grid = document.querySelector('[aria-label="Daily Memory Stamp"]');
      const scrapTable = document.querySelector('[data-scrap-table="true"]');
      const scrapMobileShell = document.querySelector(
        '[data-scrap-mobile-shell="true"]',
      );
      const scrapFrame = document.querySelector('[data-scrap-frame="square"]');
      const scrapFinderPlate = document.querySelector(
        '[data-finder-tool="physical-frame"]',
      );
      const scrapAperture = document.querySelector(
        '[data-scrap-aperture="stamp-window"]',
      );
      const scrapPhoto = document.querySelector('[data-scrap-photo-natural="true"]');
      const scrapTitle = document.querySelector("#scrap-table-title");
      const scrapControls = document.querySelector('[data-scrap-controls="tight"]');
      const coverPreview = document.querySelector(
        '[data-journal-cover-preview="stamp-frame"]',
      );
      const bodyText = document.body.innerText;
      const shellRect = shell?.getBoundingClientRect();
      const stampRect = stamp?.getBoundingClientRect();
      const gridRect = grid?.getBoundingClientRect();
      const scrapMobileShellRect = scrapMobileShell?.getBoundingClientRect();
      const scrapFrameRect = scrapFrame?.getBoundingClientRect();
      const scrapTitleRect = scrapTitle?.getBoundingClientRect();
      const scrapControlsRect = scrapControls?.getBoundingClientRect();
      const scrapPhotoRect = scrapPhoto?.getBoundingClientRect();
      const coverRect = coverPreview?.getBoundingClientRect();
      const bodyTextLower = bodyText.toLowerCase();
      const titleInput = document.querySelector('input[placeholder]');
      const stampFrameRects = [
        ...document.querySelectorAll('[data-stamp-photo-frame="true"]'),
      ].map((frame) => {
        const rect = frame.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const stampImageFits = [
        ...document.querySelectorAll(
          '[data-stamp-photo-frame="true"] img',
        ),
      ].map((image) => getComputedStyle(image).objectFit);
      const coverImageFits = [
        ...document.querySelectorAll(
          '[data-journal-cover-preview="stamp-frame"] img',
        ),
      ].map((image) => getComputedStyle(image).objectFit);
      const journalPreviewFits = [
        ...document.querySelectorAll(
          '[data-journal-cover-preview="stamp-frame"] img, [data-photo-preview-fit="stamp-cover"] img',
        ),
      ].map((image) => getComputedStyle(image).objectFit);
      const stampFrameStyles = [
        ...document.querySelectorAll("[data-stamp-frame]"),
      ].map((node) => {
        const style = getComputedStyle(node);
        const beforeStyle = getComputedStyle(node, "::before");
        const afterStyle = getComputedStyle(node, "::after");
        return {
          afterBackgroundImage: afterStyle.backgroundImage,
          beforeBoxShadow: beforeStyle.boxShadow,
          edgeOpacity: style.getPropertyValue("--stamp-edge-opacity").trim(),
          rimWidth: style.getPropertyValue("--stamp-rim-width").trim(),
          variant: node.getAttribute("data-stamp-frame"),
        };
      });

      return {
        bodyScrollWidth: document.body.scrollWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        coverImageFits,
        coverPreviewHeight: coverRect?.height ?? null,
        coverPreviewWidth: coverRect?.width ?? null,
        createForbiddenCopy: createForbiddenPhrases.filter((phrase) =>
          bodyText.includes(phrase),
        ),
        hasOldCopy: oldPhrases.some((phrase) => bodyText.includes(phrase)),
        hasSdText: /\bSD\b/.test(bodyText),
        hasShell: Boolean(shell),
        hasScrapTable: Boolean(scrapTable),
        hasScrapFinderPlate: Boolean(scrapFinderPlate),
        hasScrapAperture: Boolean(scrapAperture),
        hasScrapPhoto: Boolean(scrapPhoto),
        hasVisibleScrapTableEyebrow: /SCRAP TABLE|Scrap Table/.test(bodyText),
        innerWidth: window.innerWidth,
        journalPreviewFits,
        initialSealingCopyVisible:
          bodyTextLower.includes("one line to keep") &&
          titleInput?.getAttribute("placeholder") === "What would you call today?" &&
          bodyText.includes("Seal this day"),
        inlineScrapTableVisible: Boolean(scrapTable) && !location.href.includes("screen=crop"),
        coverCropMarkers: [
          ...document.querySelectorAll(
            '[data-journal-cover-crop], [data-stamp-cover-crop]',
          ),
        ].map((node) =>
          node.getAttribute("data-journal-cover-crop") ??
          node.getAttribute("data-stamp-cover-crop"),
        ),
        scrapFrameHeight: scrapFrameRect?.height ?? null,
        scrapFrameWidth: scrapFrameRect?.width ?? null,
        scrapHeaderGap:
          scrapTitleRect && scrapFrameRect
            ? scrapFrameRect.top - scrapTitleRect.bottom
            : null,
        scrapControlsGap:
          scrapFrameRect && scrapControlsRect
            ? scrapControlsRect.top - scrapFrameRect.bottom
            : null,
        scrapMobileShellWidth: scrapMobileShellRect?.width ?? null,
        scrapPhotoHeight: scrapPhotoRect?.height ?? null,
        scrapPhotoNaturalHeight: scrapPhoto?.naturalHeight ?? null,
        scrapPhotoNaturalWidth: scrapPhoto?.naturalWidth ?? null,
        scrapPhotoWidth: scrapPhotoRect?.width ?? null,
        stampFillerMarkerCount: document.querySelectorAll(
          "[data-stamp-filler-count], [data-stamp-filler]",
        ).length,
        stampEdgeCount: document.querySelectorAll(
          '[data-stamp-edge="perforated"]',
        ).length,
        stampFrameVariants: [
          ...document.querySelectorAll("[data-stamp-frame]"),
        ].map((node) => node.getAttribute("data-stamp-frame")),
        stampFrameStyles,
        stampFrameRatio: grid?.getAttribute("data-stamp-frame-ratio"),
        stampFrameRects,
        stampImageFits,
        stampLayout: grid?.getAttribute("data-stamp-layout"),
        stampRowSizes: grid?.getAttribute("data-stamp-row-sizes"),
        shellWidth: shellRect?.width ?? null,
        stampWidth: stampRect?.width ?? null,
        gridWidth: gridRect?.width ?? null,
      };
    }, {
      oldPhrases: oldStrings,
      createForbiddenPhrases: createForbiddenStrings,
    });

    const maxScroll = Math.max(metrics.bodyScrollWidth, metrics.docScrollWidth);
    results.push({ width, route, ...metrics, maxScroll, consoleIssues });

    if (!metrics.hasShell) failures.push(`${route} @ ${width}: missing shell`);
    if (maxScroll > width + 1) {
      failures.push(`${route} @ ${width}: horizontal overflow ${maxScroll}`);
    }
    if (metrics.shellWidth && metrics.shellWidth > Math.min(width, 480) + 1) {
      failures.push(`${route} @ ${width}: shell too wide ${metrics.shellWidth}`);
    }
    if (metrics.hasOldCopy) failures.push(`${route} @ ${width}: old copy visible`);
    if (route.includes("screen=create") && metrics.createForbiddenCopy.length > 0) {
      failures.push(
        `${route} @ ${width}: dense create copy ${metrics.createForbiddenCopy.join(", ")}`,
      );
    }
    if (route === "/journal/demo?screen=create" && !metrics.initialSealingCopyVisible) {
      failures.push(`${route} @ ${width}: initial sealing fields are missing`);
    }
    if (route === "/journal/demo?screen=create" && metrics.inlineScrapTableVisible) {
      failures.push(`${route} @ ${width}: inline Scrap Table visible on initial create`);
    }
    if (route.includes("screen=crop")) {
      if (!metrics.hasScrapTable) {
        failures.push(`${route} @ ${width}: Scrap Table missing`);
      }
      if (!metrics.hasScrapFinderPlate) {
        failures.push(`${route} @ ${width}: physical finder plate missing`);
      }
      if (!metrics.hasScrapAperture) {
        failures.push(`${route} @ ${width}: stamp aperture missing`);
      }
      if (!metrics.hasScrapPhoto) {
        failures.push(`${route} @ ${width}: natural photo surface missing`);
      }
      if (metrics.hasVisibleScrapTableEyebrow) {
        failures.push(`${route} @ ${width}: Scrap Table eyebrow is visible`);
      }
      if (
        metrics.scrapMobileShellWidth &&
        metrics.scrapMobileShellWidth > Math.min(width, 430) + 1
      ) {
        failures.push(
          `${route} @ ${width}: Scrap Table shell too wide ${metrics.scrapMobileShellWidth}`,
        );
      }
      if (
        metrics.scrapHeaderGap !== null &&
        (metrics.scrapHeaderGap < 8 || metrics.scrapHeaderGap > 120)
      ) {
        failures.push(`${route} @ ${width}: Scrap Table header is detached from finder`);
      }
      if (metrics.stampEdgeCount < 1) {
        failures.push(`${route} @ ${width}: perforated aperture edge missing`);
      }
      if (!metrics.stampFrameVariants.includes("lg")) {
        failures.push(`${route} @ ${width}: large Scrap Table stamp frame missing`);
      }
      if (!hasVisibleStampFrame(metrics, "lg", 10, 1)) {
        failures.push(`${route} @ ${width}: large Scrap Table stamp edge is too faint`);
      }
      if (
        metrics.scrapControlsGap !== null &&
        (metrics.scrapControlsGap < 0 || metrics.scrapControlsGap > 56)
      ) {
        failures.push(`${route} @ ${width}: Scrap Table controls are detached from finder`);
      }
      if (
        !metrics.scrapFrameWidth ||
        !metrics.scrapFrameHeight ||
        Math.abs(metrics.scrapFrameWidth - metrics.scrapFrameHeight) > 1
      ) {
        failures.push(`${route} @ ${width}: Scrap Table frame is not square`);
      }
      if (
        metrics.scrapPhotoNaturalWidth &&
        metrics.scrapPhotoNaturalHeight &&
        metrics.scrapPhotoWidth &&
        metrics.scrapPhotoHeight
      ) {
        const naturalRatio =
          metrics.scrapPhotoNaturalWidth / metrics.scrapPhotoNaturalHeight;
        const renderedRatio = metrics.scrapPhotoWidth / metrics.scrapPhotoHeight;
        if (Math.abs(naturalRatio - renderedRatio) > 0.03) {
          failures.push(`${route} @ ${width}: Scrap Table photo is distorted`);
        }
      }
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      metrics.journalPreviewFits.some((fit) => !["cover", "fill"].includes(fit))
    ) {
      failures.push(`${route} @ ${width}: journal preview is not using a stamp crop`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      !metrics.coverCropMarkers.includes("metadata")
    ) {
      failures.push(`${route} @ ${width}: cover crop metadata marker missing`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      metrics.stampEdgeCount < 1
    ) {
      failures.push(`${route} @ ${width}: cover preview stamp edge missing`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      !metrics.stampFrameVariants.includes("md")
    ) {
      failures.push(`${route} @ ${width}: medium cover stamp frame missing`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      !hasVisibleStampFrame(metrics, "md", 7, 0.98)
    ) {
      failures.push(`${route} @ ${width}: medium cover stamp edge is too faint`);
    }
    if (
      route.includes("screen=create&photos=2") &&
      !metrics.stampFrameVariants.includes("sm")
    ) {
      failures.push(`${route} @ ${width}: small additional moment stamp frame missing`);
    }
    if (
      route.includes("screen=create&photos=2") &&
      !hasVisibleStampFrame(metrics, "sm", 4, 0.92)
    ) {
      failures.push(`${route} @ ${width}: small additional moment stamp edge is too faint`);
    }
    if (route.includes("screen=detail")) {
      const photoCount = Number(new URL(`${baseUrl}${route}`).searchParams.get("photos"));
      const expected = expectedLayout(photoCount);
      if (metrics.hasSdText) {
        failures.push(`${route} @ ${width}: SD mark visible`);
      }
      if (metrics.stampLayout !== expected.variant) {
        failures.push(
          `${route} @ ${width}: layout ${metrics.stampLayout} !== ${expected.variant}`,
        );
      }
      if (metrics.stampRowSizes !== expected.rowSizes) {
        failures.push(
          `${route} @ ${width}: row sizes ${metrics.stampRowSizes} !== ${expected.rowSizes}`,
        );
      }
      if (metrics.stampFrameRatio !== "1") {
        failures.push(`${route} @ ${width}: frame ratio ${metrics.stampFrameRatio} !== 1`);
      }
      if (
        metrics.stampFrameRects.some(
          (rect) => Math.abs(rect.width - rect.height) > 1,
        )
      ) {
        failures.push(`${route} @ ${width}: stamp frames are not square`);
      }
      if (metrics.stampFillerMarkerCount > 0) {
        failures.push(`${route} @ ${width}: filler markers still present`);
      }
      if (metrics.stampEdgeCount < photoCount) {
        failures.push(`${route} @ ${width}: missing stamp-edge markers`);
      }
      if (
        metrics.stampFrameVariants.filter((variant) => variant === "sm")
          .length < photoCount
      ) {
        failures.push(`${route} @ ${width}: missing small stamp-frame markers`);
      }
      if (!hasVisibleStampFrame(metrics, "sm", 4, 0.92)) {
        failures.push(`${route} @ ${width}: saved detail stamp edge is too faint`);
      }
      if (!metrics.coverCropMarkers.includes("metadata")) {
        failures.push(`${route} @ ${width}: stamp cover crop marker missing`);
      }
      if (metrics.stampImageFits.some((fit) => !["cover", "fill"].includes(fit))) {
        failures.push(`${route} @ ${width}: stamp image is not using a display crop`);
      }

      const firstStampFrame = page
        .locator('[data-stamp-photo-frame="true"]')
        .first();
      await firstStampFrame.waitFor({
        state: "visible",
        timeout: routeTimeoutMs,
      });
      await page.waitForFunction(
        () => {
          const frame = document.querySelector(
            '[data-stamp-photo-frame="true"]',
          );
          return Boolean(frame && !frame.querySelector('[role="status"]'));
        },
        null,
        { timeout: routeTimeoutMs },
      );
      await firstStampFrame.click();
      await page.waitForSelector('div[role="dialog"][aria-label^="Photo "] img', {
        timeout: routeTimeoutMs,
      });
      const viewerMetrics = await page.evaluate(() => {
        const dialog = document.querySelector(
          'div[role="dialog"][aria-label^="Photo "]',
        );
        const image = dialog?.querySelector("img");
        return {
          dialogLabel: dialog?.getAttribute("aria-label"),
          imageFit: image ? getComputedStyle(image).objectFit : null,
          hasClose: Boolean(
            dialog?.querySelector('button[aria-label="Close photo viewer"]'),
          ),
        };
      });
      results[results.length - 1].viewerMetrics = viewerMetrics;
      if (viewerMetrics.imageFit !== "contain") {
        failures.push(`${route} @ ${width}: fullscreen viewer is not contain-fit`);
      }
      if (!viewerMetrics.hasClose) {
        failures.push(`${route} @ ${width}: fullscreen viewer close missing`);
      }
      await page.keyboard.press("Escape");
      await page.waitForSelector('div[role="dialog"][aria-label^="Photo "]', {
        state: "detached",
        timeout: routeTimeoutMs,
      });
    }
    if (consoleIssues.some((issue) => issue.startsWith("error:"))) {
      failures.push(`${route} @ ${width}: console error`);
    }

    await page.close();
  }
}

if (failures.length > 0) {
  throw new Error(`Mobile browser QA failed:\n${failures.join("\n")}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      mode: isSmoke ? "smoke" : "full",
      timeoutMs: routeTimeoutMs,
      results,
    },
    null,
    2,
  ),
);
} finally {
  await browser.close();
}
