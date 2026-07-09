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
  "/journal/demo?screen=home&month=2026-07",
  "/journal/demo?screen=home&month=2026-06",
  "/journal/demo?screen=home&month=2026-08",
  "/journal/demo?screen=home&month=2026-04",
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
      "/journal/demo?screen=home&month=2026-07",
      "/journal/demo?screen=home&month=2026-06",
      "/journal/demo?screen=home&month=2026-08",
      "/journal/demo?screen=home&month=2026-04",
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
      const monthSheetGrid = document.querySelector(
        '[data-month-sheet-grid="true"]',
      );
      const scrapTable = document.querySelector('[data-scrap-table="true"]');
      const scrapMobileShell = document.querySelector(
        '[data-scrap-mobile-shell="true"]',
      );
      const scrapFrame = document.querySelector('[data-scrap-frame="square"]');
      const scrapFinderPlate = document.querySelector(
        '[data-finder-tool="editorial-finder"]',
      );
      const scrapAperture = document.querySelector(
        '[data-scrap-aperture="finder-window"]',
      );
      const scrapPhoto = document.querySelector('[data-scrap-photo-natural="true"]');
      const scrapTitle = document.querySelector("#scrap-table-title");
      const scrapHelper = document.querySelector(".scrap-finder-helper");
      const scrapControls = document.querySelector('[data-scrap-controls="action-row"]');
      const scrapPrimary = document.querySelector(
        '[data-scrap-primary-action="use-this-scrap"]',
      );
      const coverPreview = document.querySelector(
        '[data-journal-cover-preview="editorial-photo"]',
      );
      const bodyText = document.body.innerText;
      const shellRect = shell?.getBoundingClientRect();
      const stampRect = stamp?.getBoundingClientRect();
      const gridRect = grid?.getBoundingClientRect();
      const monthSheetGridRect = monthSheetGrid?.getBoundingClientRect();
      const scrapMobileShellRect = scrapMobileShell?.getBoundingClientRect();
      const scrapFinderPlateRect = scrapFinderPlate?.getBoundingClientRect();
      const scrapFrameRect = scrapFrame?.getBoundingClientRect();
      const scrapTitleRect = scrapTitle?.getBoundingClientRect();
      const scrapHelperRect = scrapHelper?.getBoundingClientRect();
      const scrapControlsRect = scrapControls?.getBoundingClientRect();
      const scrapPhotoRect = scrapPhoto?.getBoundingClientRect();
      const coverRect = coverPreview?.getBoundingClientRect();
      const bodyTextLower = bodyText.toLowerCase();
      const titleInput = document.querySelector('input[placeholder]');
      const stampFrameRects = [
        ...document.querySelectorAll('[data-daily-detail-photo-tile]'),
      ].map((frame) => {
        const rect = frame.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const stampImageFits = [
        ...document.querySelectorAll(
          '[data-daily-detail-photo-tile] img',
        ),
      ].map((image) => getComputedStyle(image).objectFit);
      const coverImageFits = [
        ...document.querySelectorAll(
          '[data-journal-cover-preview="editorial-photo"] img',
        ),
      ].map((image) => getComputedStyle(image).objectFit);
      const journalPreviewFits = [
        ...document.querySelectorAll(
          '[data-journal-cover-preview="editorial-photo"] img, [data-photo-preview-fit="editorial-square"] img',
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
        monthSheetCapacity: monthSheetGrid?.getAttribute(
          "data-month-sheet-capacity",
        ),
        monthSheetAppColumns: monthSheetGrid?.getAttribute(
          "data-month-sheet-app-columns",
        ),
        monthSheetColumns: monthSheetGrid?.getAttribute(
          "data-month-sheet-columns",
        ),
        monthSheetGridWidth: monthSheetGridRect?.width ?? null,
        monthSheetPositionCount: document.querySelectorAll(
          "[data-month-sheet-position]",
        ).length,
        monthSheetRows: monthSheetGrid?.getAttribute("data-month-sheet-rows"),
        monthSheetVisibleFullDates: /\b2026-\d{2}-\d{2}\b/.test(bodyText),
        monthSheetVisibleTitles:
          bodyText.includes("Market flowers") ||
          bodyText.includes("Peaches on the sill") ||
          bodyText.includes("Night market"),
        monthSheetVisibleSheetsHeading: /\bSheets\b/.test(bodyText),
        initialSealingCopyVisible:
          bodyTextLower.includes("one line to keep") &&
          titleInput?.getAttribute("placeholder") === "What would you call today?" &&
          bodyText.includes("Seal this day"),
        inlineScrapTableVisible: Boolean(scrapTable) && !location.href.includes("screen=crop"),
        coverCropMarkers: [
          ...document.querySelectorAll(
            '[data-journal-cover-crop], [data-stamp-cover-crop], [data-month-sheet-cover-crop]',
          ),
        ].map((node) =>
          node.getAttribute("data-journal-cover-crop") ??
          node.getAttribute("data-stamp-cover-crop") ??
          node.getAttribute("data-month-sheet-cover-crop"),
        ),
        scrapFrameHeight: scrapFrameRect?.height ?? null,
        scrapFrameWidth: scrapFrameRect?.width ?? null,
        scrapHeaderGap:
          scrapFinderPlateRect && (scrapHelperRect ?? scrapTitleRect)
            ? scrapFinderPlateRect.top - (scrapHelperRect ?? scrapTitleRect).bottom
            : null,
        scrapControlsBottom: scrapControlsRect?.bottom ?? null,
        scrapPrimaryCtaVisual: scrapPrimary?.getAttribute(
          "data-scrap-primary-cta-visual",
        ),
        scrapPrimaryClassName: scrapPrimary?.getAttribute("class"),
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
        stampGridColumns: grid?.getAttribute("data-stamp-grid-columns"),
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
    if (route.includes("screen=home&month=") && !route.includes("2026-04")) {
      if (metrics.monthSheetAppColumns !== "3") {
        failures.push(`${route} @ ${width}: month sheet app columns are not 3`);
      }
      if (metrics.monthSheetColumns !== "3") {
        failures.push(`${route} @ ${width}: month sheet render columns are not 3`);
      }
      if (metrics.monthSheetRows !== null) {
        failures.push(`${route} @ ${width}: app month sheet should not expose export rows`);
      }
      if (metrics.monthSheetCapacity !== "32") {
        failures.push(`${route} @ ${width}: month sheet capacity is not 32`);
      }
      if (metrics.monthSheetGridWidth && metrics.monthSheetGridWidth > width + 1) {
        failures.push(
          `${route} @ ${width}: month sheet grid too wide ${metrics.monthSheetGridWidth}`,
        );
      }
      if (metrics.monthSheetVisibleFullDates) {
        failures.push(`${route} @ ${width}: full date visible on Month Sheet`);
      }
      if (metrics.monthSheetVisibleTitles) {
        failures.push(`${route} @ ${width}: title visible on Month Sheet`);
      }
      if (metrics.monthSheetVisibleSheetsHeading) {
        failures.push(`${route} @ ${width}: bottom Sheets list is visible`);
      }
      if (!metrics.coverCropMarkers.includes("metadata")) {
        failures.push(`${route} @ ${width}: month sheet cover crop marker missing`);
      }
    }
    if (
      route.includes("month=2026-08") &&
      metrics.monthSheetPositionCount !== 31
    ) {
      failures.push(
        `${route} @ ${width}: dense month rendered ${metrics.monthSheetPositionCount} positions`,
      );
    }
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
        failures.push(`${route} @ ${width}: editorial finder plate missing`);
      }
      if (!metrics.hasScrapAperture) {
        failures.push(`${route} @ ${width}: finder aperture missing`);
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
      if (metrics.stampEdgeCount > 0 || metrics.stampFrameVariants.includes("lg")) {
        failures.push(`${route} @ ${width}: old Scrap Finder stamp-frame markers visible`);
      }
      if (metrics.scrapPrimaryCtaVisual !== "journal-primary-bottom-cta") {
        failures.push(`${route} @ ${width}: Scrap Finder primary CTA is not using shared CTA`);
      }
      if (
        typeof metrics.scrapPrimaryClassName === "string" &&
        !metrics.scrapPrimaryClassName.includes("journal-primary-bottom-cta")
      ) {
        failures.push(`${route} @ ${width}: Scrap Finder primary CTA class missing`);
      }
      if (
        metrics.scrapControlsBottom !== null &&
        metrics.scrapControlsBottom > 812 + 1
      ) {
        failures.push(`${route} @ ${width}: Scrap Table controls overflow the viewport`);
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
      failures.push(`${route} @ ${width}: journal preview is not using the editorial crop`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      !metrics.coverCropMarkers.includes("metadata")
    ) {
      failures.push(`${route} @ ${width}: cover crop metadata marker missing`);
    }
    if (
      (route.includes("screen=create&photos=") || route.includes("screen=sealed")) &&
      (metrics.stampEdgeCount > 0 || metrics.stampFrameVariants.includes("md"))
    ) {
      failures.push(`${route} @ ${width}: old cover preview stamp-frame markers visible`);
    }
    if (
      route.includes("screen=create&photos=2") &&
      metrics.stampFrameVariants.includes("sm")
    ) {
      failures.push(`${route} @ ${width}: old additional moment stamp-frame marker visible`);
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
        metrics.stampGridColumns !== String(photoCount <= 1 ? 1 : photoCount <= 4 ? 2 : 3)
      ) {
        failures.push(
          `${route} @ ${width}: grid columns ${metrics.stampGridColumns} do not match photo count ${photoCount}`,
        );
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
      if (metrics.stampEdgeCount > 0) {
        failures.push(`${route} @ ${width}: old stamp-edge markers visible`);
      }
      if (metrics.stampFrameVariants.includes("sm")) {
        failures.push(`${route} @ ${width}: old small stamp-frame marker visible`);
      }
      if (!metrics.coverCropMarkers.includes("metadata")) {
        failures.push(`${route} @ ${width}: stamp cover crop marker missing`);
      }
      if (metrics.stampImageFits.some((fit) => !["cover", "fill"].includes(fit))) {
        failures.push(`${route} @ ${width}: stamp image is not using a display crop`);
      }

      const firstStampFrame = page
        .locator('[data-daily-detail-photo-tile]')
        .first();
      await firstStampFrame.waitFor({
        state: "visible",
        timeout: routeTimeoutMs,
      });
      await page.waitForFunction(
        () => {
          const frame = document.querySelector(
            '[data-daily-detail-photo-tile]',
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
