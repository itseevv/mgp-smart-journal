import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const projectRequire = createRequire(
  pathToFileURL(`${process.cwd()}/package.json`),
);
const { createClient } = projectRequire("@supabase/supabase-js");
const sharp = projectRequire("sharp");

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
const localOriginProxy = /^http:\/\/(?:127\.0\.0\.1|localhost):/.test(baseUrl);
const browserBaseUrl = localOriginProxy
  ? "https://journal-chip.vercel.app"
  : baseUrl;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};
const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
let publicToken = randomBytes(24).toString("hex");
const ownerPin = String(Math.floor(100_000 + Math.random() * 900_000));
let capsuleId;
let authUserId;
let browser;
const storagePaths = [];

function seededBytes(length, seed) {
  let state = seed >>> 0;
  const bytes = Buffer.allocUnsafe(length);
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    bytes[index] = state >>> 24;
  }
  return bytes;
}

async function serviceRequest(path, options = {}) {
  return fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...serviceHeaders,
      ...(options.headers ?? {}),
    },
  });
}

async function removeStorageDirectory(directory) {
  const listed = await serviceClient.storage
    .from("memory-media")
    .list(directory, { limit: 100 });
  if (listed.error || !listed.data?.length) return;
  await serviceClient.storage
    .from("memory-media")
    .remove(listed.data.map((item) => `${directory}/${item.name}`));
}

async function removeArtifactRegistriesForCapsule(targetCapsuleId) {
  const directory = "_system/monthly-export-artifacts";
  const listed = await serviceClient.storage
    .from("memory-media")
    .list(directory, { limit: 100, search: `${targetCapsuleId}-` });
  if (listed.error || !listed.data?.length) return;
  await serviceClient.storage
    .from("memory-media")
    .remove(listed.data.map((item) => `${directory}/${item.name}`));
}

try {
  const capsuleResponse = await serviceRequest("/rest/v1/capsules", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      public_token: publicToken,
      product_type: "journal",
      status: "unactivated",
    }),
  });
  assert.equal(capsuleResponse.status, 201);
  const [capsule] = await capsuleResponse.json();
  capsuleId = capsule.id;
  publicToken = capsule.public_token ?? publicToken;
  assert.ok(capsuleId);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
  });
  if (localOriginProxy) {
    await page.route(`${browserBaseUrl}/**`, async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `${baseUrl}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    });
  }
  const issues = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      issues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));

  await page.goto(`${browserBaseUrl}/c/${publicToken}?month=2026-07`, {
    waitUntil: "networkidle",
  });
  await page.getByText("Activate this journal").waitFor({ timeout: 20_000 });
  await page.getByLabel("Owner PIN", { exact: true }).fill(ownerPin);
  await page.getByLabel("Confirm Owner PIN", { exact: true }).fill(ownerPin);
  await page.getByRole("button", { name: "Activate journal" }).click();
  await page.getByText("No stamps yet.").waitFor({ timeout: 20_000 });

  authUserId = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.endsWith("-auth-token")) continue;
      try {
        const session = JSON.parse(localStorage.getItem(key) ?? "null");
        if (session?.user?.id) return session.user.id;
      } catch {
        // Continue to another Supabase storage key.
      }
    }
    return undefined;
  });
  assert.ok(authUserId);

  const memories = Array.from({ length: 31 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      id: randomUUID(),
      capsule_id: capsuleId,
      title: `Authenticated QA ${day}`,
      occurred_at: `2026-07-${day}T12:00:00.000Z`,
      local_date: `2026-07-${day}`,
      local_timezone: "Europe/London",
    };
  });
  const memoryResponse = await serviceRequest("/rest/v1/memories", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(memories),
  });
  assert.equal(memoryResponse.status, 201);

  const photos = [];
  for (const [index, memory] of memories.entries()) {
    const photoId = randomUUID();
    const storagePath = `monthly-export-qa/${capsuleId}/${photoId}.png`;
    const image = await sharp(seededBytes(360 * 360 * 3, index + 1), {
      raw: { width: 360, height: 360, channels: 3 },
    })
      .png()
      .toBuffer();
    const upload = await serviceClient.storage
      .from("memory-media")
      .upload(storagePath, image, {
        contentType: "image/png",
        upsert: false,
      });
    assert.equal(upload.error, null);
    storagePaths.push(storagePath);
    photos.push({
      id: photoId,
      memory_id: memory.id,
      storage_path: storagePath,
      order_index: 0,
      mime_type: "image/png",
      size_bytes: image.byteLength,
      width: 360,
      height: 360,
      crop_metadata: {
        kind: "cover-scrap",
        aspectRatio: 1,
        x: 0.08,
        y: 0.08,
        width: 0.84,
        height: 0.84,
        imageWidth: 360,
        imageHeight: 360,
        createdAt: new Date().toISOString(),
      },
    });
  }
  const photoResponse = await serviceRequest("/rest/v1/photos", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(photos),
  });
  assert.equal(photoResponse.status, 201);

  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator('[data-month-sheet-position]')
    .first()
    .waitFor({ timeout: 20_000 });
  assert.equal(await page.locator('[data-month-sheet-position]').count(), 31);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/export/monthly-sheet") &&
      response.request().method() === "POST",
    { timeout: 55_000 },
  );
  const startedAt = Date.now();
  await page.locator('[data-monthly-stamp-export-action="true"]').click();
  const exportResponse = await responsePromise;
  const routeBody = await exportResponse.body();
  await page.locator('[data-monthly-stamp-export-state="ready"]').waitFor({
    timeout: 55_000,
  });
  const elapsedMs = Date.now() - startedAt;
  const preview = await page
    .locator('[data-monthly-stamp-export-preview="ready"]')
    .evaluate(async (image) => {
      const src = image.getAttribute("src");
      const blob = src
        ? await fetch(src).then((response) => response.blob())
        : null;
      return {
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        src,
        bytes: blob?.size ?? 0,
      };
    });
  const routeContentType =
    exportResponse.headers()["content-type"]?.split(";")[0];
  const delivery =
    routeContentType === "application/json"
      ? JSON.parse(routeBody.toString("utf8"))
      : undefined;

  assert.equal(exportResponse.status(), 200);
  assert.equal(routeContentType, "application/json");
  assert.equal(delivery?.delivery, "signed-url");
  assert.match(delivery.artifactId, /^[0-9a-f-]{36}$/i);
  assert.match(delivery.url, /^https:\/\//);
  assert.equal(exportResponse.headers()["cache-control"], "private, no-store");
  assert.equal(preview.naturalWidth, 1080);
  assert.equal(preview.naturalHeight, 4050);
  assert.match(preview.src ?? "", /^blob:/);
  assert.ok(preview.bytes > 0);
  assert.ok(preview.bytes <= 20 * 1024 * 1024);
  assert.ok(routeBody.byteLength <= 2_500_000);
  assert.ok(elapsedMs < 55_000);
  assert.deepEqual(issues, []);

  const artifactDirectory =
    `capsules/${capsuleId}/exports/monthly`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listed = await serviceClient.storage
      .from("memory-media")
      .list(artifactDirectory, {
        limit: 100,
        search: `${delivery.artifactId}.png`,
      });
    if (!listed.data?.some((item) => item.name === `${delivery.artifactId}.png`)) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const listed = await serviceClient.storage
    .from("memory-media")
    .list(artifactDirectory, {
      limit: 100,
      search: `${delivery.artifactId}.png`,
    });
  assert.equal(
    listed.data?.some((item) => item.name === `${delivery.artifactId}.png`),
    false,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        stamps: 31,
        status: exportResponse.status(),
        contentType: routeContentType,
        delivery: delivery?.delivery ?? "direct",
        cacheControl: exportResponse.headers()["cache-control"],
        bytes: preview.bytes,
        elapsedMs,
        preview: {
          naturalWidth: preview.naturalWidth,
          naturalHeight: preview.naturalHeight,
          blobUrl: Boolean(preview.src?.startsWith("blob:")),
        },
        artifactCleaned: Boolean(delivery),
        consoleIssues: issues,
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  if (storagePaths.length) {
    await serviceClient.storage.from("memory-media").remove(storagePaths);
  }
  if (capsuleId) {
    for (const state of ["claiming", "active", "cooldown"]) {
      await removeStorageDirectory(
        `_system/monthly-export-admission/${capsuleId}/${state}`,
      );
    }
    await removeStorageDirectory(
      `capsules/${capsuleId}/exports/monthly`,
    );
    await removeArtifactRegistriesForCapsule(capsuleId);
    await serviceRequest(`/rest/v1/capsules?id=eq.${capsuleId}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }
  if (authUserId) {
    await serviceRequest(`/auth/v1/admin/users/${authUserId}`, {
      method: "DELETE",
    });
  }
}
