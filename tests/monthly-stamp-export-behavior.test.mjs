import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  creamJournalTheme,
  defaultJournalTheme,
} from "../data/journal-themes.ts";
import {
  MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES,
  monthlyMemoryEditionRequestStamps,
  monthlyMemoryEditionSurfaceLayerOpacity,
  shareMonthlyMemoryEditionBlob,
} from "../lib/export/monthly-memory-sheet-export.ts";
import {
  createMonthlyExportGenerationGate,
} from "../lib/export/monthly-memory-sheet-lifecycle.ts";
import {
  createMonthlyExportCleanupHandler,
  monthlyExportArtifactRecordMatchesIdentity,
} from "../lib/export/monthly-memory-sheet-cleanup.ts";
import {
  localDateKeyInTimeZone,
  createMonthlyExportDataLoader,
} from "../lib/export/monthly-memory-sheet-data.ts";
import {
  createMonthlyExportPostHandler,
  MONTHLY_EXPORT_MAX_STORED_PNG_BYTES,
  MonthlyExportRouteError,
  readBoundedJsonObject,
} from "../lib/export/monthly-memory-sheet-route-core.ts";
import {
  mapWithConcurrency,
  withAbortTimeout,
  withTimeout,
} from "../lib/export/monthly-memory-sheet-runtime.ts";
import {
  monthlyMemoryEditionStampPositions,
  prepareServerMonthlyCoverPhoto,
  renderServerMonthlyMemoryEditionPng,
} from "../lib/export/monthly-memory-sheet-server.ts";

const capsuleId = "11111111-1111-4111-8111-111111111111";
const selectedStamp = (day, idSuffix = day) => ({
  id: `22222222-2222-4222-8222-${String(idSuffix).padStart(12, "0")}`,
  dateKey: `2026-07-${String(day).padStart(2, "0")}`,
});

function requestFor(body, headers = {}) {
  const normalizedBody =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "capsuleId" in body &&
    !("timeZone" in body)
      ? { ...body, timeZone: "UTC" }
      : body;
  return new Request("https://journal-chip.test/api/export/monthly-sheet", {
    method: "POST",
    headers: {
      authorization: "Bearer test-session",
      "content-type": "application/json",
      ...headers,
    },
    body:
      typeof normalizedBody === "string"
        ? normalizedBody
        : JSON.stringify(normalizedBody),
  });
}

function seededBytes(length, seed) {
  let state = seed >>> 0;
  const bytes = Buffer.allocUnsafe(length);
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    bytes[index] = state >>> 24;
  }
  return bytes;
}

function createHandler(overrides = {}) {
  return createMonthlyExportPostHandler({
    authorize: async () => undefined,
    render: async () => Buffer.from("png"),
    ...overrides,
  });
}

function cleanupRecord(index) {
  const artifactId = `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`;
  return {
    artifactId,
    capsuleId,
    storagePath:
      `capsules/${capsuleId}/exports/monthly/${artifactId}.png`,
    registryStoragePath:
      `_system/monthly-export-artifacts/${capsuleId}-${artifactId}.json`,
  };
}

test("monthly export route rejects malformed top-level bodies without invoking auth", async () => {
  let authorizationCalls = 0;
  const handler = createHandler({
    authorize: async () => {
      authorizationCalls += 1;
    },
  });

  for (const body of ["null", "[]", '"text"', "42", "{"]) {
    const response = await handler(requestFor(body));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: "INVALID_REQUEST",
    });
  }
  assert.equal(authorizationCalls, 0);
});

test("bounded JSON reader stops a chunked cleanup body at its byte cap", async () => {
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(600));
      if (pulls === 4) controller.close();
    },
  });
  const request = new Request(
    "https://journal-chip.test/api/export/monthly-sheet",
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    },
  );
  await assert.rejects(
    readBoundedJsonObject(request, Date.now() + 1_000, 1_024),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "REQUEST_TOO_LARGE" &&
      error.status === 413,
  );
  assert.ok(pulls <= 3, "the reader cancels before buffering the whole body");
});

test("surface grain and sheen match Playground opacity with and without texture", () => {
  assert.equal(monthlyMemoryEditionSurfaceLayerOpacity(true), 1);
  assert.equal(monthlyMemoryEditionSurfaceLayerOpacity(false), 0.8);
});

test("artifact cleanup requires cron auth and drains more than one bounded batch", async () => {
  const batches = [
    Array.from({ length: 100 }, (_, index) => cleanupRecord(index + 1)),
    Array.from({ length: 37 }, (_, index) => cleanupRecord(index + 101)),
  ];
  const removedPaths = [];
  const deletedRecords = [];
  const handler = createMonthlyExportCleanupHandler({
    secret: "monthly-export-cron-secret",
    listExpired: async () => batches.shift() ?? [],
    removeArtifacts: async (paths) => {
      removedPaths.push(...paths);
    },
    deleteRecords: async (records) => {
      deletedRecords.push(...records);
    },
  });

  const unauthorized = await handler(
    new Request("https://journal-chip.test/api/internal/monthly-export-cleanup"),
  );
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), {
    ok: false,
    code: "AUTH_REQUIRED",
  });

  const response = await handler(
    new Request("https://journal-chip.test/api/internal/monthly-export-cleanup", {
      headers: { authorization: "Bearer monthly-export-cron-secret" },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, removed: 137 });
  assert.equal(removedPaths.length, 137);
  assert.equal(deletedRecords.length, 137);
  assert.equal(
    new Set(deletedRecords.map((record) => record.artifactId)).size,
    137,
  );
});

test("artifact cleanup refuses registry paths outside their immutable capsule artifact", async () => {
  let removals = 0;
  const handler = createMonthlyExportCleanupHandler({
    secret: "monthly-export-cron-secret",
    listExpired: async () => [
      {
        ...cleanupRecord(1),
        storagePath: `capsules/${capsuleId}/cover.png`,
      },
    ],
    removeArtifacts: async () => {
      removals += 1;
    },
    deleteRecords: async () => undefined,
  });
  const response = await handler(
    new Request("https://journal-chip.test/api/internal/monthly-export-cleanup", {
      headers: { authorization: "Bearer monthly-export-cron-secret" },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(removals, 0);
});

test("artifact cleanup identity never authorizes a registry row from another capsule", () => {
  const artifactId = cleanupRecord(1).artifactId;
  const otherCapsuleId = "44444444-4444-4444-8444-444444444444";
  assert.equal(
    monthlyExportArtifactRecordMatchesIdentity(
      {
        artifactId,
        capsuleId: otherCapsuleId,
        storagePath:
          `capsules/${otherCapsuleId}/exports/monthly/${artifactId}.png`,
        registryStoragePath:
          `_system/monthly-export-artifacts/${otherCapsuleId}-${artifactId}.json`,
      },
      capsuleId,
      artifactId,
    ),
    false,
  );
});

test("monthly export body parsing stops when an incomplete request is aborted", async () => {
  const controller = new AbortController();
  const request = new Request(
    "https://journal-chip.test/api/export/monthly-sheet",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode("{"));
        },
      }),
      duplex: "half",
      signal: controller.signal,
    },
  );
  const responsePromise = createHandler()(request);
  setTimeout(
    () => controller.abort(new DOMException("client closed", "AbortError")),
    5,
  );
  const response = await Promise.race([
    responsePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("aborted body stayed pending")), 250),
    ),
  ]);
  assert.equal(response.status, 400);
});

test("monthly export route rejects oversized, duplicate, out-of-month, and over-cap selections", async () => {
  const handler = createHandler();
  const empty = await handler(
    requestFor({ capsuleId, monthKey: "2026-07", stamps: [] }),
  );
  assert.equal(empty.status, 422);
  assert.equal((await empty.json()).code, "NO_STAMPS");

  const oversized = await handler(
    requestFor(
      JSON.stringify({
        capsuleId,
        monthKey: "2026-07",
        stamps: [selectedStamp(1)],
        padding: "x".repeat(9_000),
      }),
    ),
  );
  assert.equal(oversized.status, 413);

  const duplicate = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1), selectedStamp(2, 1)],
    }),
  );
  assert.equal(duplicate.status, 400);

  const wrongMonth = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [{ ...selectedStamp(1), dateKey: "2026-08-01" }],
    }),
  );
  assert.equal(wrongMonth.status, 400);

  const invalidTimeZone = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      timeZone: "Not/A_Timezone",
      stamps: [selectedStamp(1)],
    }),
  );
  assert.equal(invalidTimeZone.status, 400);

  for (const dateKey of ["2026-07-00", "2026-07-32", "2026-02-30"]) {
    const impossibleDate = await handler(
      requestFor({
        capsuleId,
        monthKey: dateKey.slice(0, 7),
        stamps: [{ ...selectedStamp(1), dateKey }],
      }),
    );
    assert.equal(impossibleDate.status, 400);
  }

  const duplicateDate = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1), { ...selectedStamp(2), dateKey: "2026-07-01" }],
    }),
  );
  assert.equal(duplicateDate.status, 400);

  const overCap = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: Array.from({ length: 32 }, (_, index) =>
        selectedStamp((index % 31) + 1, index + 1),
      ),
    }),
  );
  assert.equal(overCap.status, 422);
});

test("production monthly export route rejects an unauthenticated request before storage access", async () => {
  const { POST } = await import(
    "../app/api/export/monthly-sheet/route.ts"
  );
  const response = await POST(
    requestFor(
      {
        capsuleId,
        monthKey: "2026-07",
        stamps: [selectedStamp(1)],
      },
      { authorization: "" },
    ),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "AUTH_REQUIRED",
  });
});

test("production artifact capacity applies a durable per-capsule outstanding quota", async () => {
  const { assertMonthlyArtifactCapacity } = await import(
    "../app/api/export/monthly-sheet/route.ts"
  );
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  let requestBody;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json(
      Array.from({ length: 8 }, (_, index) => ({
        name:
          `${capsuleId}-` +
          `33333333-3333-4333-8333-${String(index).padStart(12, "0")}.json`,
      })),
    );
  };
  try {
    await assert.rejects(
      assertMonthlyArtifactCapacity(
        capsuleId,
        Date.now() + 1_000,
        new AbortController().signal,
      ),
      (error) =>
        error instanceof MonthlyExportRouteError &&
        error.code === "EXPORT_LIMIT" &&
        error.status === 429,
    );
    assert.equal(
      requestBody.prefix,
      "_system/monthly-export-artifacts",
    );
    assert.equal(requestBody.search, `${capsuleId}-`);
    assert.equal(requestBody.limit, 9);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  }
});

test("production admission storage serializes exports and exposes a retry window", async () => {
  const { claimMonthlyExportAdmission } = await import(
    "../app/api/export/monthly-sheet/route.ts"
  );
  const objects = new Map();
  const storage = {
    upload: async (storagePath, body, options) => {
      if (objects.has(storagePath) && !options.upsert) {
        return { data: null, error: { message: "already exists" } };
      }
      objects.set(storagePath, {
        body: Buffer.from(body),
        createdAt:
          objects.get(storagePath)?.createdAt ?? new Date().toISOString(),
      });
      return { data: { path: storagePath }, error: null };
    },
    list: async (directory) => ({
      data: [...objects.entries()]
        .filter(([storagePath]) => storagePath.startsWith(`${directory}/`))
        .map(([storagePath, value]) => ({
          name: storagePath.slice(directory.length + 1),
          created_at: value.createdAt,
          updated_at: value.createdAt,
        }))
        .sort((left, right) => left.created_at.localeCompare(right.created_at)),
      error: null,
    }),
    download: async (storagePath, _options, { signal }) => {
      signal.throwIfAborted();
      const value = objects.get(storagePath);
      return value
        ? { data: new Blob([value.body]), error: null }
        : { data: null, error: { message: "not found" } };
    },
    remove: async (paths) => {
      paths.forEach((storagePath) => objects.delete(storagePath));
      return { data: paths, error: null };
    },
    update: async (storagePath, body) => {
      objects.set(storagePath, {
        body: Buffer.from(body),
        createdAt:
          objects.get(storagePath)?.createdAt ?? new Date().toISOString(),
      });
      return { data: { path: storagePath }, error: null };
    },
  };
  const admin = { storage: { from: () => storage } };
  const mutations = {
    uploadJson: async (storagePath) => {
      const result = await storage.upload(
        storagePath,
        Buffer.from("{}"),
        { upsert: false },
      );
      if (result.error) throw new Error(result.error.message);
    },
    remove: async (storagePaths) => {
      const result = await storage.remove(storagePaths);
      if (result.error) throw new Error(result.error.message);
    },
  };
  const claim = (requestedCapsuleId) =>
    claimMonthlyExportAdmission(
      admin,
      requestedCapsuleId,
      Date.now() + 10_000,
      new AbortController().signal,
      mutations,
    );
  const lease = await claim(capsuleId);
  await assert.rejects(
    claim(capsuleId),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "EXPORT_BUSY" &&
      error.status === 429 &&
      error.retryAfterSeconds >= 1,
  );
  await lease.release();
  await assert.rejects(
    claim(capsuleId),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "EXPORT_BUSY" &&
      error.status === 429,
  );

  const competingCapsuleId = "abcdefab-cdef-4abc-8def-abcdefabcdef";
  const competingLease = await claim(competingCapsuleId);
  await assert.rejects(
    claim(competingCapsuleId.toUpperCase()),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "EXPORT_BUSY" &&
      error.status === 429,
  );
  await competingLease.release();
});

test("429 route errors include a standards-compatible Retry-After header", async () => {
  const handler = createHandler({
    authorize: async () => {
      throw new MonthlyExportRouteError("EXPORT_BUSY", 429, "busy", 7);
    },
  });
  const response = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1)],
    }),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "7");
});

test("monthly export route enforces auth and passes the exact selected stamp set", async () => {
  let renderedSelection;
  const stamps = [selectedStamp(31), selectedStamp(1)];
  const handler = createHandler({
    authorize: async (request) => {
      if (!request.headers.get("authorization")) {
        throw new MonthlyExportRouteError("AUTH_REQUIRED", 401);
      }
    },
    render: async (selection) => {
      renderedSelection = selection;
      return Buffer.from("png");
    },
  });

  const unauthenticated = await handler(
    requestFor(
      { capsuleId, monthKey: "2026-07", stamps },
      { authorization: "" },
    ),
  );
  assert.equal(unauthenticated.status, 401);

  const response = await handler(
    requestFor({ capsuleId, monthKey: "2026-07", stamps }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(renderedSelection, {
    capsuleId,
    monthKey: "2026-07",
    timeZone: "UTC",
    stamps,
  });
});

test("monthly export canonicalizes UUID casing before auth, locking, and rendering", async () => {
  let authorizedCapsuleId;
  let renderedSelection;
  const canonicalCapsuleId = "abcdefab-cdef-4abc-8def-abcdefabcdef";
  const canonicalStampId = "fedcbafe-dcba-4fed-8cba-fedcbafedcba";
  const handler = createHandler({
    authorize: async (_request, requestedCapsuleId) => {
      authorizedCapsuleId = requestedCapsuleId;
    },
    render: async (selection) => {
      renderedSelection = selection;
      return Buffer.from("png");
    },
  });
  const response = await handler(
    requestFor({
      capsuleId: canonicalCapsuleId.toUpperCase(),
      monthKey: "2026-07",
      stamps: [
        {
          id: canonicalStampId.toUpperCase(),
          dateKey: "2026-07-01",
        },
      ],
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(authorizedCapsuleId, canonicalCapsuleId);
  assert.equal(renderedSelection.capsuleId, canonicalCapsuleId);
  assert.equal(renderedSelection.stamps[0].id, canonicalStampId);
});

test("production data loader preserves the exact selected order, local dates, and fallback tiles", async () => {
  const stamps = [selectedStamp(31), selectedStamp(1)];
  const observed = { capsuleId: "", selectedIds: [] };
  const loader = createMonthlyExportDataLoader({
    coverConcurrency: 2,
    renderReserveMs: 100,
    loadCapsule: async (requestedCapsuleId) => {
      observed.capsuleId = requestedCapsuleId;
      return {
        journalTitle: "Behavior Journal",
        themeId: "theme-1",
      };
    },
    loadMemories: async (_capsuleId, selectedIds) => {
      observed.selectedIds = selectedIds;
      return [
        {
          id: stamps[1].id,
          localDate: null,
          occurredAt: "2026-07-01T12:00:00.000Z",
        },
        {
          id: stamps[0].id,
          localDate: stamps[0].dateKey,
          occurredAt: "2026-07-31T12:00:00.000Z",
        },
      ];
    },
    loadFirstCovers: async () =>
      new Map([
        [stamps[0].id, { source: "day-31" }],
        [stamps[1].id, { source: "day-1-corrupt" }],
      ]),
    loadTheme: async () => defaultJournalTheme,
    prepareCover: async (cover) => {
      if (cover.source.includes("corrupt")) throw new Error("corrupt");
      return Buffer.from(cover.source);
    },
    loadTexture: async () => Buffer.from("texture"),
    loadLogo: async () => Buffer.from("logo"),
  });
  const result = await loader(
    { capsuleId, monthKey: "2026-07", timeZone: "UTC", stamps },
    Date.now() + 10_000,
  );

  assert.equal(observed.capsuleId, capsuleId);
  assert.deepEqual(observed.selectedIds, stamps.map((stamp) => stamp.id));
  assert.equal(result.journalTitle, "Behavior Journal");
  assert.deepEqual(
    result.stamps.map((stamp) => ({
      dayLabel: stamp.dayLabel,
      input: stamp.input?.toString(),
    })),
    [
      { dayLabel: "31", input: "day-31" },
      { dayLabel: "1", input: undefined },
    ],
  );
  assert.equal(result.texture?.toString(), "texture");
  assert.equal(result.logo?.toString(), "logo");
});

test("production data loader rejects missing and mismatched selected records", async () => {
  const stamps = [selectedStamp(1), selectedStamp(2)];
  const dependencies = {
    loadCapsule: async () => ({ journalTitle: "Journal", themeId: null }),
    loadMemories: async () => [],
    loadFirstCovers: async () => new Map(),
    loadTheme: async () => defaultJournalTheme,
    prepareCover: async () => undefined,
    loadTexture: async () => undefined,
    loadLogo: async () => undefined,
  };
  const selection = {
    capsuleId,
    monthKey: "2026-07",
    timeZone: "UTC",
    stamps,
  };

  await assert.rejects(
    createMonthlyExportDataLoader(dependencies)(
      selection,
      Date.now() + 10_000,
    ),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "SELECTION_STALE",
  );

  await assert.rejects(
    createMonthlyExportDataLoader({
      ...dependencies,
      loadMemories: async () => [
        {
          id: stamps[0].id,
          localDate: "2026-07-03",
          occurredAt: "2026-07-01T12:00:00.000Z",
        },
        {
          id: stamps[1].id,
          localDate: stamps[1].dateKey,
          occurredAt: "2026-07-02T12:00:00.000Z",
        },
      ],
    })(selection, Date.now() + 10_000),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "SELECTION_STALE",
  );
});

test("monthly export route never returns an artifact above its safe response ceiling", async () => {
  const handler = createHandler({
    render: async () =>
      Buffer.alloc(MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES + 1),
  });
  const response = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1)],
    }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "EXPORT_TOO_LARGE",
  });
});

test("oversized true-color exports use private signed delivery below the hard artifact cap", async () => {
  const oversized = Buffer.alloc(
    MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES + 1,
    7,
  );
  let storedSelection;
  const handler = createHandler({
    render: async () => oversized,
    storeOversized: async (selection, png) => {
      storedSelection = selection;
      assert.equal(png, oversized);
      return {
        artifactId: "55555555-5555-4555-8555-555555555555",
        url: "https://private-storage.test/signed-artifact",
        expiresAt: "2026-07-23T12:02:00.000Z",
      };
    },
  });
  const response = await handler(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1)],
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  const body = await response.json();
  assert.equal(body.delivery, "signed-url");
  assert.equal(body.artifactId, "55555555-5555-4555-8555-555555555555");
  assert.equal(body.url, "https://private-storage.test/signed-artifact");
  assert.equal(storedSelection.timeZone, "UTC");

  const tooLarge = createHandler({
    render: async () => Buffer.alloc(MONTHLY_EXPORT_MAX_STORED_PNG_BYTES + 1),
    storeOversized: async () => {
      throw new Error("must not store");
    },
  });
  const rejected = await tooLarge(
    requestFor({
      capsuleId,
      monthKey: "2026-07",
      stamps: [selectedStamp(1)],
    }),
  );
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).code, "EXPORT_TOO_LARGE");
});

test("route releases its durable admission lease after success and failure", async () => {
  let releases = 0;
  const lease = {
    release: async () => {
      releases += 1;
    },
  };
  const success = createHandler({ authorize: async () => lease });
  assert.equal(
    (
      await success(
        requestFor({
          capsuleId,
          monthKey: "2026-07",
          stamps: [selectedStamp(1)],
        }),
      )
    ).status,
    200,
  );
  const failure = createHandler({
    authorize: async () => lease,
    render: async () => {
      throw new Error("render failed");
    },
  });
  assert.equal(
    (
      await failure(
        requestFor({
          capsuleId,
          monthKey: "2026-07",
          stamps: [selectedStamp(1)],
        }),
      )
    ).status,
    503,
  );
  assert.equal(releases, 2);
});

test("bounded concurrency preserves order, limits active work, and times out", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency(
    Array.from({ length: 12 }, (_, index) => index),
    3,
    async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 4));
      active -= 1;
      return value * 2;
    },
  );
  assert.deepEqual(
    result,
    Array.from({ length: 12 }, (_, index) => index * 2),
  );
  assert.ok(peak <= 3);

  await assert.rejects(
    withTimeout(
      new Promise((resolve) => setTimeout(resolve, 50)),
      5,
      "deadline",
    ),
    /deadline/,
  );

  let aborted = false;
  await assert.rejects(
    withAbortTimeout(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        }),
      5,
      "abort deadline",
    ),
    /abort deadline/,
  );
  assert.equal(aborted, true);

  await assert.rejects(
    withAbortTimeout(
      () => new Promise(() => undefined),
      5,
      "ignored abort deadline",
    ),
    /ignored abort deadline/,
  );
});

test("generation gate aborts superseded work and rejects stale completions", () => {
  const gate = createMonthlyExportGenerationGate();
  const first = gate.begin();
  assert.equal(gate.isCurrent(first), true);

  const second = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);

  gate.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(gate.isCurrent(second), false);
});

test("legacy boundary stamps keep the browser-selected local month and date", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const stamps = monthlyMemoryEditionRequestStamps({
      monthKey: "2026-07",
      stamps: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Boundary stamp",
          capturedAt: "2026-08-01T00:30:00.000Z",
          createdAt: "2026-08-01T00:31:00.000Z",
          photoCount: 0,
          voiceMemoCount: 0,
        },
      ],
    });
    assert.deepEqual(stamps, [
      {
        id: "33333333-3333-4333-8333-333333333333",
        dateKey: "2026-07-31",
      },
    ]);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("server independently verifies legacy boundary stamps in the requested IANA timezone", async () => {
  assert.equal(
    localDateKeyInTimeZone(
      "2026-08-01T00:30:00.000Z",
      "America/Los_Angeles",
    ),
    "2026-07-31",
  );
  const stamp = selectedStamp(31);
  const loader = createMonthlyExportDataLoader({
    loadCapsule: async () => ({ journalTitle: "Legacy", themeId: null }),
    loadMemories: async () => [
      {
        id: stamp.id,
        localDate: null,
        occurredAt: "2026-08-01T00:30:00.000Z",
      },
    ],
    loadFirstCovers: async () => new Map(),
    loadTheme: async () => defaultJournalTheme,
    prepareCover: async () => undefined,
    loadTexture: async () => undefined,
    loadLogo: async () => undefined,
  });
  const result = await loader(
    {
      capsuleId,
      monthKey: "2026-07",
      timeZone: "America/Los_Angeles",
      stamps: [stamp],
    },
    Date.now() + 10_000,
  );
  assert.equal(result.stamps[0].dayLabel, "31");

  await assert.rejects(
    loader(
      {
        capsuleId,
        monthKey: "2026-07",
        timeZone: "UTC",
        stamps: [stamp],
      },
      Date.now() + 10_000,
    ),
    (error) =>
      error instanceof MonthlyExportRouteError &&
      error.code === "SELECTION_STALE",
  );
});

test("monthly share behavior reports unsupported without invoking native share", async () => {
  let shareCalls = 0;
  const result = await shareMonthlyMemoryEditionBlob(
    new Blob(["png"], { type: "image/png" }),
    "2026-07-memory-edition.png",
    "July 2026 Edition",
    {
      canShare: () => false,
      share: async () => {
        shareCalls += 1;
      },
    },
  );
  assert.deepEqual(result, { shared: false, reason: "unsupported" });
  assert.equal(shareCalls, 0);
});

test("server cover preparation applies saved crop pixels before resizing", async () => {
  const input = await sharp(
    Buffer.from([
      255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255,
      255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255,
    ]),
    { raw: { width: 4, height: 2, channels: 3 } },
  )
    .png()
    .toBuffer();
  const output = await prepareServerMonthlyCoverPhoto(input, {
    kind: "cover-scrap",
    aspectRatio: 1,
    x: 0.5,
    y: 0,
    width: 0.5,
    height: 1,
    imageWidth: 4,
    imageHeight: 2,
    createdAt: "2026-07-23T12:00:00.000Z",
  });
  const pixel = await sharp(output)
    .extract({ left: 146, top: 146, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(pixel[2] > 240);
  assert.ok(pixel[0] < 15);
});

test("production cover loader falls back from corrupt thumbnail and honors abort", async () => {
  const { prepareCoverPhoto } = await import(
    "../app/api/export/monthly-sheet/route.ts"
  );
  const validDisplay = await sharp({
    create: {
      width: 40,
      height: 40,
      channels: 3,
      background: "#2a8f52",
    },
  })
    .png()
    .toBuffer();
  const calls = [];
  const admin = {
    storage: {
      from: () => ({
        download: async (storagePath, _options, { signal }) => {
          signal.throwIfAborted();
          calls.push(storagePath);
          return {
            data: new Blob([
              storagePath === "thumb-corrupt"
                ? Buffer.from("not-an-image")
                : validDisplay,
            ]),
            error: null,
          };
        },
      }),
    },
  };
  const photo = {
    memory_id: selectedStamp(1).id,
    storage_path: "display-valid",
    thumbnail_storage_path: "thumb-corrupt",
    order_index: 0,
    crop_metadata: null,
  };
  const prepared = await prepareCoverPhoto({
    admin,
    photo,
    budget: { usedBytes: 0, maxBytes: 2 * 1024 * 1024 },
    deadline: Date.now() + 10_000,
    runDecode: async (operation) => operation(),
  });
  assert.deepEqual(calls, ["thumb-corrupt", "display-valid"]);
  assert.equal((await sharp(prepared).metadata()).width, 292);

  const controller = new AbortController();
  controller.abort(new DOMException("closed", "AbortError"));
  await assert.rejects(
    prepareCoverPhoto({
      admin,
      photo,
      budget: { usedBytes: 0, maxBytes: 2 * 1024 * 1024 },
      deadline: Date.now() + 10_000,
      signal: controller.signal,
      runDecode: async (operation) => operation(),
    }),
    { name: "AbortError" },
  );
});

test("public-only theme textures resolve only from the configured Supabase asset bucket", async () => {
  const { journalThemeTextureStoragePath } = await import(
    "../app/api/export/monthly-sheet/route.ts"
  );
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    assert.equal(
      journalThemeTextureStoragePath({
        ...defaultJournalTheme,
        textureStoragePath: undefined,
        texturePublicUrl:
          "https://project.supabase.co/storage/v1/object/public/" +
          "journal-theme-assets/leather/ruby%20grain.png",
      }),
      "leather/ruby grain.png",
    );
    assert.equal(
      journalThemeTextureStoragePath({
        ...defaultJournalTheme,
        textureStoragePath: undefined,
        texturePublicUrl: "https://attacker.test/private.png",
      }),
      undefined,
    );
    assert.equal(
      journalThemeTextureStoragePath({
        ...defaultJournalTheme,
        textureStoragePath: undefined,
        texturePublicUrl:
          "https://project.supabase.co/storage/v1/object/public/" +
          "journal-theme-assets/%2e%2e/secret.png",
      }),
      undefined,
    );
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  }
});

test("server renderer always layers full-height texture, grain, and sheen", async () => {
  const texture = await sharp({
    create: {
      width: 1080,
      height: 950,
      channels: 3,
      background: "#336699",
    },
  })
    .png()
    .toBuffer();
  const png = await renderServerMonthlyMemoryEditionPng({
    journalTitle: "Texture parity",
    monthKey: "2026-07",
    theme: defaultJournalTheme,
    stamps: [{ dayLabel: "1" }],
    texture,
  });
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const offset = (y * info.width + x) * info.channels;
    return Array.from(data.subarray(offset, offset + 3));
  };
  const bottom = pixel(20, info.height - 12);
  assert.ok(bottom[2] > bottom[0], "uploaded blue texture reaches the footer");
  const grainSamples = new Set();
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      grainSamples.add(pixel(x, y).join(","));
    }
  }
  assert.ok(grainSamples.size >= 3, "grain and sheen remain above texture");
});

test("server renderer rejects an aborted request before starting Sharp work", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("closed", "AbortError"));
  await assert.rejects(
    renderServerMonthlyMemoryEditionPng(
      {
        journalTitle: "Aborted",
        monthKey: "2026-07",
        stamps: [{ dayLabel: "1" }],
      },
      { signal: controller.signal },
    ),
    { name: "AbortError" },
  );
});

test("server renderer fits maximum-length wide and mixed-script journal titles", async () => {
  for (const journalTitle of [
    "W".repeat(200),
    Array.from({ length: 100 }, () => "A界").join(""),
  ]) {
    const png = await renderServerMonthlyMemoryEditionPng({
      journalTitle,
      monthKey: "2026-07",
      theme: defaultJournalTheme,
      stamps: [{ dayLabel: "1" }],
    });
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 1080);
    assert.equal(metadata.height, 950);
  }
});

test("server renderer preserves visibly distinct light and dark theme variants", async () => {
  const render = (theme) =>
    renderServerMonthlyMemoryEditionPng({
      journalTitle: "Theme variant",
      monthKey: "2026-07",
      theme,
      stamps: [{ dayLabel: "1" }],
    });
  const [dark, light] = await Promise.all([
    render(defaultJournalTheme),
    render(creamJournalTheme),
  ]);
  assert.notDeepEqual(dark, light);

  const darkPixel = await sharp(dark)
    .extract({ left: 10, top: 10, width: 1, height: 1 })
    .raw()
    .toBuffer();
  const lightPixel = await sharp(light)
    .extract({ left: 10, top: 10, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.notDeepEqual(darkPixel, lightPixel);
});

test("31-stamp renderer keeps all tiles and labels with row 11 centered", async () => {
  const positions = monthlyMemoryEditionStampPositions(31);
  assert.equal(positions.length, 31);
  assert.equal(positions.at(-1)?.x, 394);
  assert.equal(positions.at(-1)?.row, 10);

  const tile = await sharp({
    create: {
      width: 292,
      height: 292,
      channels: 3,
      background: "#24364d",
    },
  })
    .png()
    .toBuffer();
  const png = await renderServerMonthlyMemoryEditionPng({
    journalTitle: "Thirty one complete days",
    monthKey: "2026-07",
    theme: defaultJournalTheme,
    stamps: Array.from({ length: 31 }, (_, index) => ({
      dayLabel: String(index + 1),
      input: tile,
    })),
  });
  const image = sharp(png);
  for (const position of positions) {
    const stats = await image
      .clone()
      .extract({
        left: position.x + 8,
        top: position.y + 8,
        width: 58,
        height: 48,
      })
      .greyscale()
      .stats();
    assert.ok(
      stats.channels[0].max > 175,
      `date label ${position.row + 1} is rendered`,
    );
  }
});

test("seeded high-entropy 31-cover PNG with a hostile title stays within render and artifact budgets", async () => {
  const stamps = [];
  for (let index = 0; index < 31; index += 1) {
    const input = await sharp(seededBytes(292 * 292 * 3, index + 1), {
      raw: { width: 292, height: 292, channels: 3 },
    })
      .png()
      .toBuffer();
    stamps.push({ dayLabel: String(index + 1), input });
  }
  const texture = await sharp(seededBytes(1080 * 4050 * 3, 31_337), {
    raw: { width: 1080, height: 4050, channels: 3 },
  })
    .png()
    .toBuffer();
  const startedAt = Date.now();
  const png = await renderServerMonthlyMemoryEditionPng({
    journalTitle: Array.from({ length: 100 }, () => "A界").join(""),
    monthKey: "2026-07",
    theme: defaultJournalTheme,
    stamps,
    texture,
  });
  assert.ok(png.byteLength > MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES);
  assert.ok(png.byteLength <= MONTHLY_EXPORT_MAX_STORED_PNG_BYTES);
  assert.ok(Date.now() - startedAt < 20_000);
});
