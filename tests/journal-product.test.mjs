import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS,
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS,
  DEFAULT_STAMP_FRAME_ASPECT_RATIO,
  JOURNAL_VOICE_MEMOS_ENABLED,
  JOURNAL_YEAR_DAYS,
  JOURNAL_YEAR_PHOTO_CAPACITY,
  STAMP_FRAME_RATIO_MODE,
} from "../data/journal-product.ts";
import {
  activeMonthKey,
  findDuplicateStampForLocalDate,
  findStampForLocalDate,
  findStampForLocalDateKey,
  groupStampsByMonth,
  localMonthKeyFromDateKey,
  memoryLocalDateKey,
  sortStampsBySemanticDay,
  toLocalDateKeyFromDate,
} from "../data/journal-stamps.ts";
import {
  buildStampFrameRows,
  getStampFrameAspectRatio,
  getStampLayout,
} from "../data/stamp-layouts.ts";

const stamp = (input) => ({
  id: input.id,
  title: input.id,
  capturedAt: input.capturedAt,
  createdAt: input.createdAt ?? input.capturedAt,
  localDate: input.localDate,
  localTimezone: input.localTimezone,
  photoCount: input.photoCount ?? 1,
  voiceMemoCount: input.voiceMemoCount ?? 0,
  firstThumbnailStoragePath: input.firstThumbnailStoragePath,
});

test("journal product constants describe one 9-image daily stamp", () => {
  assert.equal(DAILY_MEMORY_STAMP_MAX_PHOTOS, 9);
  assert.equal(DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS, 1);
  assert.equal(DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS, 8);
  assert.equal(JOURNAL_YEAR_DAYS, 365);
  assert.equal(JOURNAL_YEAR_PHOTO_CAPACITY, 3285);
  assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, false);
  assert.equal(STAMP_FRAME_RATIO_MODE, "square");
  assert.equal(DEFAULT_STAMP_FRAME_ASPECT_RATIO, 1);
});

test("finds today's stamp by capturedAt local date before creating another", () => {
  const memories = [
    stamp({
      id: "yesterday",
      capturedAt: "2026-06-29T12:00:00.000Z",
    }),
    stamp({
      id: "today",
      capturedAt: "2026-06-30T12:00:00.000Z",
    }),
  ];

  assert.equal(
    findStampForLocalDate(memories, new Date("2026-06-30T18:00:00.000Z"))?.id,
    "today",
  );
});

test("preserves semantic local date keys without UTC shifting", () => {
  const localDate = new Date(2026, 4, 8, 0, 30, 0);

  assert.equal(toLocalDateKeyFromDate(localDate), "2026-05-08");
  assert.equal(localMonthKeyFromDateKey("2026-05-08"), "2026-05");
});

test("uses localDate before capturedAt or createdAt for stamp identity", () => {
  const backfilled = stamp({
    id: "backfilled",
    localDate: "2026-05-08",
    capturedAt: "2026-06-20T12:00:00.000Z",
    createdAt: "2026-06-20T12:10:00.000Z",
  });
  const fallback = stamp({
    id: "fallback",
    capturedAt: "",
    createdAt: "2026-06-10T12:00:00.000Z",
  });

  assert.equal(memoryLocalDateKey(backfilled), "2026-05-08");
  assert.equal(memoryLocalDateKey(fallback), "2026-06-10");
});

test("detects duplicate local dates while allowing the same memory during edit", () => {
  const memories = [
    stamp({
      id: "may-8",
      localDate: "2026-05-08",
      capturedAt: "2026-06-20T12:00:00.000Z",
      createdAt: "2026-06-20T12:10:00.000Z",
    }),
    stamp({
      id: "may-9",
      localDate: "2026-05-09",
      capturedAt: "2026-05-09T12:00:00.000Z",
    }),
  ];

  assert.equal(findStampForLocalDateKey(memories, "2026-05-08")?.id, "may-8");
  assert.equal(
    findDuplicateStampForLocalDate(memories, "2026-05-08")?.id,
    "may-8",
  );
  assert.equal(
    findDuplicateStampForLocalDate(memories, "2026-05-08", "may-8"),
    undefined,
  );
  assert.equal(
    findDuplicateStampForLocalDate(memories, "2026-05-09", "may-8")?.id,
    "may-9",
  );
});

test("groups monthly sheets by localDate with capturedAt and createdAt fallback", () => {
  const groups = groupStampsByMonth([
    stamp({
      id: "backfilled-may",
      localDate: "2026-05-08",
      capturedAt: "2026-06-20T12:00:00.000Z",
      createdAt: "2026-06-20T12:00:00.000Z",
    }),
    stamp({
      id: "created-fallback",
      capturedAt: "",
      createdAt: "2026-06-10T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.key, group.stamps.map((item) => item.id)]),
    [
      ["2026-05", ["backfilled-may"]],
      ["2026-06", ["created-fallback"]],
    ],
  );
});

test("sorts stamps within a month by semantic local date then createdAt ascending", () => {
  const memories = [
    stamp({
      id: "later",
      capturedAt: "2026-06-12T12:00:00.000Z",
      createdAt: "2026-06-12T12:10:00.000Z",
    }),
    stamp({
      id: "earlier-created-second",
      capturedAt: "2026-06-10T12:00:00.000Z",
      createdAt: "2026-06-11T12:00:00.000Z",
    }),
    stamp({
      id: "earlier-created-first",
      capturedAt: "2026-06-10T12:00:00.000Z",
      createdAt: "2026-06-10T12:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    [...memories].sort(sortStampsBySemanticDay).map((item) => item.id),
    ["earlier-created-first", "earlier-created-second", "later"],
  );
});

test("uses current month when it has stamps, otherwise latest stamped month", () => {
  const memories = [
    stamp({
      id: "may",
      capturedAt: "2026-05-08T12:00:00.000Z",
    }),
    stamp({
      id: "june",
      capturedAt: "2026-06-03T12:00:00.000Z",
    }),
  ];

  assert.equal(
    activeMonthKey(memories, new Date("2026-06-30T12:00:00.000Z")),
    "2026-06",
  );
  assert.equal(
    activeMonthKey(memories, new Date("2026-07-01T12:00:00.000Z")),
    "2026-06",
  );
  assert.equal(
    activeMonthKey([], new Date("2026-07-01T12:00:00.000Z")),
    "2026-07",
  );
});

test("maps daily stamp image counts to normalized square frame rows", () => {
  const expectations = [
    [1, "single", [1]],
    [2, "two-up", [2]],
    [3, "cover-plus-two", [1, 2]],
    [4, "balanced-four", [2, 2]],
    [5, "cover-plus-four", [1, 2, 2]],
    [6, "six-grid", [3, 3]],
    [7, "cover-three-three", [1, 3, 3]],
    [8, "two-three-three", [2, 3, 3]],
    [9, "three-three-three", [3, 3, 3]],
  ];

  for (const [photoCount, variant, rowSizes] of expectations) {
    assert.deepEqual(getStampLayout(photoCount), {
      variant,
      visiblePhotoCount: photoCount,
      rowSizes,
    });
  }

  assert.deepEqual(getStampLayout(12), {
    variant: "three-three-three",
    visiblePhotoCount: 9,
    rowSizes: [3, 3, 3],
  });
});

test("builds first-nine normalized stamp frame rows", () => {
  const rows = buildStampFrameRows(
    Array.from({ length: 12 }, (_, index) => ({ id: `photo-${index + 1}` })),
  );

  assert.deepEqual(
    rows.map((row) => row.items.map((item) => item.id)),
    [
      ["photo-1", "photo-2", "photo-3"],
      ["photo-4", "photo-5", "photo-6"],
      ["photo-7", "photo-8", "photo-9"],
    ],
  );
});

test("stamp frame aspect ratio defaults to square", () => {
  assert.equal(getStampFrameAspectRatio(), 1);
});
