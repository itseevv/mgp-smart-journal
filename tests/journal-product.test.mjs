import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS,
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS,
  DEFAULT_STAMP_FRAME_ASPECT_RATIO,
  JOURNAL_VOICE_MEMOS_ENABLED,
  STAMP_FRAME_RATIO_MODE,
} from "../data/journal-product.ts";
import {
  activeMonthKey,
  availableStampedMonthKeys,
  currentMonthKey,
  findDuplicateStampForLocalDate,
  findStampForLocalDate,
  findStampForLocalDateKey,
  groupStampsByMonth,
  localMonthKeyFromDateKey,
  memoryLocalDateKey,
  monthSheetStampPositions,
  MONTH_SHEET_CAPACITY,
  MONTH_SHEET_COLUMNS,
  MONTH_SHEET_ROWS,
  monthlyStampArchive,
  nextLocalMonthKey,
  normalizeLocalMonthKey,
  previousLocalMonthKey,
  resolveSelectedMonthKey,
  sortStampsBySemanticDay,
  stampsForMonth,
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
  firstPhotoStoragePath: input.firstPhotoStoragePath,
  firstPhotoWidth: input.firstPhotoWidth,
  firstPhotoHeight: input.firstPhotoHeight,
  firstThumbnailStoragePath: input.firstThumbnailStoragePath,
  thumbnailWidth: input.thumbnailWidth,
  thumbnailHeight: input.thumbnailHeight,
  coverCropMetadata: input.coverCropMetadata,
});

test("journal product constants describe one 9-image daily stamp without a volume cap", () => {
  assert.equal(DAILY_MEMORY_STAMP_MAX_PHOTOS, 9);
  assert.equal(DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS, 1);
  assert.equal(DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS, 8);
  assert.equal(JOURNAL_VOICE_MEMOS_ENABLED, true);
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
  assert.equal(normalizeLocalMonthKey("2026-05"), "2026-05");
  assert.equal(normalizeLocalMonthKey("2026-13"), undefined);
  assert.equal(normalizeLocalMonthKey("not-a-month"), undefined);
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

test("month sheet stamp positions preserve cover crop summary fields", () => {
  const crop = {
    kind: "cover-scrap",
    aspectRatio: 1,
    x: 0.25,
    y: 0,
    width: 0.5,
    height: 1,
    imageWidth: 1600,
    imageHeight: 800,
    createdAt: "2026-07-03T12:00:00.000Z",
  };
  const positions = monthSheetStampPositions([
    stamp({
      id: "cropped-cover",
      localDate: "2026-07-03",
      capturedAt: "2026-07-03T12:00:00.000Z",
      firstPhotoStoragePath: "capsules/demo/display.webp",
      firstPhotoWidth: 1600,
      firstPhotoHeight: 800,
      firstThumbnailStoragePath: "capsules/demo/thumb.webp",
      thumbnailWidth: 480,
      thumbnailHeight: 240,
      coverCropMetadata: crop,
    }),
  ]);

  assert.equal(positions[0].memory.firstThumbnailStoragePath, "capsules/demo/thumb.webp");
  assert.equal(positions[0].memory.firstPhotoStoragePath, "capsules/demo/display.webp");
  assert.equal(positions[0].memory.coverCropMetadata, crop);
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

test("builds month archive selection from valid query months and local-date groups", () => {
  const memories = [
    stamp({
      id: "july-03",
      localDate: "2026-07-03",
      capturedAt: "2026-07-03T12:00:00.000Z",
      createdAt: "2026-07-03T12:10:00.000Z",
    }),
    stamp({
      id: "june-02",
      localDate: "2026-06-02",
      capturedAt: "2026-06-02T12:00:00.000Z",
    }),
    stamp({
      id: "backfilled-may-08",
      localDate: "2026-05-08",
      capturedAt: "2026-07-02T12:00:00.000Z",
      createdAt: "2026-07-02T12:10:00.000Z",
    }),
  ];

  const archive = monthlyStampArchive(
    memories,
    "2026-05",
    new Date("2026-07-04T12:00:00.000Z"),
  );

  assert.equal(currentMonthKey(new Date("2026-07-04T12:00:00.000Z")), "2026-07");
  assert.deepEqual(availableStampedMonthKeys(memories), [
    "2026-07",
    "2026-06",
    "2026-05",
  ]);
  assert.equal(archive.selectedMonthKey, "2026-05");
  assert.equal(archive.selectedSheet.title, "May 2026");
  assert.deepEqual(
    archive.selectedSheet.stamps.map((item) => item.id),
    ["backfilled-may-08"],
  );
  assert.equal(archive.previousMonthKey, "2026-04");
  assert.equal(archive.nextMonthKey, "2026-06");
  assert.equal(archive.canNavigateNext, true);
  assert.equal(archive.selectedMonthStatus, "past");
});

test("resolves selected month fallback and empty month sheets without calendar gaps", () => {
  const memories = [
    stamp({
      id: "may-08",
      localDate: "2026-05-08",
      capturedAt: "2026-05-08T12:00:00.000Z",
    }),
    stamp({
      id: "june-03",
      localDate: "2026-06-03",
      capturedAt: "2026-06-03T12:00:00.000Z",
    }),
  ];
  const currentDate = new Date("2026-07-04T12:00:00.000Z");

  assert.equal(resolveSelectedMonthKey(memories, "2026-04", currentDate), "2026-04");
  assert.equal(resolveSelectedMonthKey(memories, "bogus", currentDate), "2026-06");
  assert.equal(resolveSelectedMonthKey([], undefined, currentDate), "2026-07");

  const emptyPast = monthlyStampArchive(memories, "2026-04", currentDate);
  assert.equal(emptyPast.selectedSheet.key, "2026-04");
  assert.equal(emptyPast.selectedSheet.stamps.length, 0);
  assert.equal(emptyPast.selectedMonthStatus, "past");

  const emptyCurrent = monthlyStampArchive([], undefined, currentDate);
  assert.equal(emptyCurrent.selectedSheet.key, "2026-07");
  assert.equal(emptyCurrent.selectedSheet.stamps.length, 0);
  assert.equal(emptyCurrent.selectedMonthStatus, "current");
});

test("uses calendar previous and next month helpers independent of stamped months", () => {
  assert.equal(previousLocalMonthKey("2026-01"), "2025-12");
  assert.equal(nextLocalMonthKey("2026-12"), "2027-01");
  assert.equal(previousLocalMonthKey("invalid"), "");
  assert.equal(nextLocalMonthKey("invalid"), "");
});

test("returns selected month stamps sorted by local date then createdAt", () => {
  const memories = [
    stamp({
      id: "may-09",
      localDate: "2026-05-09",
      capturedAt: "2026-07-01T12:00:00.000Z",
      createdAt: "2026-07-01T12:05:00.000Z",
    }),
    stamp({
      id: "may-08-created-second",
      localDate: "2026-05-08",
      capturedAt: "2026-07-02T12:00:00.000Z",
      createdAt: "2026-07-02T12:10:00.000Z",
    }),
    stamp({
      id: "may-08-created-first",
      localDate: "2026-05-08",
      capturedAt: "2026-07-03T12:00:00.000Z",
      createdAt: "2026-07-02T12:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    stampsForMonth(memories, "2026-05").map((item) => item.id),
    ["may-08-created-first", "may-08-created-second", "may-09"],
  );
});

test("month sheet exposes a fixed 4 by 8 capacity", () => {
  assert.equal(MONTH_SHEET_COLUMNS, 4);
  assert.equal(MONTH_SHEET_ROWS, 8);
  assert.equal(MONTH_SHEET_CAPACITY, 32);

  const memories = Array.from({ length: 31 }, (_, index) =>
    stamp({
      id: `aug-${index + 1}`,
      localDate: `2026-08-${String(index + 1).padStart(2, "0")}`,
      capturedAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    }),
  );

  const positions = monthSheetStampPositions(memories);
  assert.equal(positions.length, 31);
  assert.equal(positions.at(-1).position, 31);
});

test("month sheet compacts stamps sequentially without calendar gaps", () => {
  const positions = monthSheetStampPositions([
    stamp({
      id: "day-22",
      localDate: "2026-06-22",
      capturedAt: "2026-06-22T12:00:00.000Z",
    }),
    stamp({
      id: "day-07",
      localDate: "2026-06-07",
      capturedAt: "2026-06-07T12:00:00.000Z",
    }),
    stamp({
      id: "day-15",
      localDate: "2026-06-15",
      capturedAt: "2026-06-15T12:00:00.000Z",
    }),
    stamp({
      id: "day-08",
      localDate: "2026-06-08",
      capturedAt: "2026-06-08T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    positions.map((slot) => [slot.position, slot.dayLabel, slot.memory.id]),
    [
      [1, "07", "day-07"],
      [2, "08", "day-08"],
      [3, "15", "day-15"],
      [4, "22", "day-22"],
    ],
  );
});

test("month sheet keeps saved records even when image paths look placeholder-like", () => {
  const positions = monthSheetStampPositions([
    stamp({
      id: "generated-looking-cover",
      localDate: "2026-06-09",
      capturedAt: "2026-06-09T12:00:00.000Z",
      firstPhotoStoragePath: "development/demo-placeholder-card.jpg",
      firstThumbnailStoragePath: "development/generated-placeholder-thumb.jpg",
    }),
    stamp({
      id: "real-camera-cover",
      localDate: "2026-06-10",
      capturedAt: "2026-06-10T12:00:00.000Z",
      firstPhotoStoragePath: "capsules/customer/photo.jpg",
    }),
  ]);

  assert.deepEqual(
    positions.map((slot) => slot.memory.id),
    ["generated-looking-cover", "real-camera-cover"],
  );
  assert.equal(
    positions[0].memory.firstThumbnailStoragePath,
    "development/generated-placeholder-thumb.jpg",
  );
});

test("month sheet caps visible positions at 32", () => {
  const memories = Array.from({ length: 35 }, (_, index) =>
    stamp({
      id: `stamp-${index + 1}`,
      localDate: `2026-08-${String((index % 31) + 1).padStart(2, "0")}`,
      capturedAt: `2026-08-${String((index % 31) + 1).padStart(2, "0")}T12:00:00.000Z`,
      createdAt: `2026-08-${String((index % 31) + 1).padStart(2, "0")}T12:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );

  const positions = monthSheetStampPositions(memories);
  assert.equal(positions.length, 32);
  assert.equal(positions.at(-1).position, 32);
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
