"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BottomRitualAction } from "@/components/journal/bottom-ritual-action";
import { MonthlyStampSheet } from "@/components/journal/monthly-stamp-sheet";
import { JournalIdentityHeader } from "@/components/journal/journal-identity-header";
import { useMonthQueryState } from "@/components/journal/use-month-query-state";
import { CompletedState } from "@/components/memory/completed-state";
import { MemoryForm } from "@/components/memory/memory-form";
import { ScrapTable } from "@/components/scrap/scrap-table";
import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  JOURNAL_YEAR_PHOTO_CAPACITY,
} from "@/data/journal-product";
import {
  findStampForLocalDate,
  memoryMonthKey,
  monthlyStampArchive,
} from "@/data/journal-stamps";
import { defaultJournalTheme, journalThemeStyle } from "@/data/journal-themes";
import {
  createEmptyMemory,
  memoryMediaConfig,
  type MemoryDraft,
  type MemoryPhoto,
  type MemoryVoiceMemo,
  type PersistentMemoryEntry,
} from "@/data/memory-demo";
import { centerSquareCropMetadata } from "@/lib/scrap/crop-math";

type JournalDemoFlowProps = {
  initialScreen?: "home" | "create" | "crop" | "sealed" | "detail";
  detailPhotoCount?: number;
  createPhotoCount?: number;
  scenario?: "duplicate-today" | "backfill-may";
  initialMonth?: string;
};

const DEMO_NOW_ISO = "2026-08-31T16:00:00.000Z";
const DEMO_NOW = new Date(DEMO_NOW_ISO);

type DemoPersistentStamp = PersistentMemoryEntry & {
  createdAt?: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function copyDraft(memory: DemoPersistentStamp): MemoryDraft {
  return {
    capturedAt: memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    title: memory.title,
    photos: memory.photos.map((photo) => ({ ...photo })),
    voiceMemos: [],
  };
}

function stampSummary(memory: DemoPersistentStamp) {
  const firstPhoto = memory.photos[0];
  return {
    id: memory.id,
    title: memory.title,
    capturedAt: memory.capturedAt,
    createdAt: memory.createdAt ?? memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    photoCount: Math.min(memory.photos.length, DAILY_MEMORY_STAMP_MAX_PHOTOS),
    voiceMemoCount: 0,
    firstPhotoStoragePath: firstPhoto?.storagePath,
    firstPhotoWidth: firstPhoto?.width,
    firstPhotoHeight: firstPhoto?.height,
    firstThumbnailStoragePath: firstPhoto?.thumbnailStoragePath,
    thumbnailWidth: firstPhoto?.thumbnailWidth ?? firstPhoto?.width,
    thumbnailHeight: firstPhoto?.thumbnailHeight ?? firstPhoto?.height,
    coverCropMetadata: firstPhoto?.cropMetadata,
  };
}

function demoImageShape(index: number) {
  return [
    { width: 1400, height: 900 },
    { width: 900, height: 1300 },
    { width: 1100, height: 1100 },
    { width: 1500, height: 950 },
    { width: 850, height: 1250 },
    { width: 1200, height: 900 },
    { width: 980, height: 1320 },
    { width: 1500, height: 1000 },
    { width: 1000, height: 1000 },
  ][index % 9];
}

const demoImageUrlCache = new Map<number, string>();

function demoImageUrl(index: number) {
  const cacheKey = index % 9;
  const cached = demoImageUrlCache.get(cacheKey);
  if (cached) return cached;

  const { width, height } = demoImageShape(cacheKey);
  const palette = [
    ["#7c3438", "#f1dfbf"],
    ["#2f5c57", "#e8c98d"],
    ["#5d4d8c", "#f5e7d1"],
    ["#9a6b3b", "#d9efe7"],
    ["#344d6b", "#f2d2c4"],
    ["#7b5947", "#d8caa7"],
    ["#6d2f4c", "#ede0cf"],
    ["#4a5d38", "#f6e8bd"],
    ["#243c4f", "#d9edf1"],
  ][cacheKey];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><circle cx="${Math.round(width * 0.32) + cacheKey * 10}" cy="${Math.round(height * 0.28) + cacheKey * 12}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="rgba(255,255,255,.18)"/><path d="M${Math.round(width * 0.12)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.34)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.56)} ${Math.round(height * 0.82)}, ${Math.round(width * 0.86)} ${Math.round(height * 0.56)}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="${Math.round(Math.min(width, height) * 0.05)}" stroke-linecap="round"/></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  demoImageUrlCache.set(cacheKey, url);
  return url;
}

function demoPhoto(index: number, withCoverCrop = false): MemoryPhoto {
  const { width, height } = demoImageShape(index);
  const objectUrl = demoImageUrl(index);
  return {
    id: `journal-demo-photo-${index + 1}`,
    name: `Demo moment ${index + 1}`,
    objectUrl,
    thumbnailObjectUrl: objectUrl,
    sizeBytes: 0,
    mimeType: "image/svg+xml",
    originalSizeBytes: 0,
    width,
    height,
    thumbnailWidth: width,
    thumbnailHeight: height,
    cropMetadata:
      withCoverCrop && index === 0
        ? centerSquareCropMetadata({
            imageWidth: width,
            imageHeight: height,
            createdAt: "2026-07-03T12:00:00.000Z",
          })
        : undefined,
    status: "persisted",
  };
}

function createDemoStamp(
  photoCount: number,
  overrides: Partial<DemoPersistentStamp> = {},
): DemoPersistentStamp {
  const id = overrides.id ?? "journal-demo-stamp";
  return {
    id,
    capsuleId: "journal-demo",
    capturedAt: DEMO_NOW_ISO,
    createdAt: DEMO_NOW_ISO,
    localDate: "2026-08-31",
    localTimezone: "Europe/London",
    title: "Coffee before the rain",
    photos: Array.from({ length: photoCount }, (_, index) =>
      ({
        ...demoPhoto(index, index === 0),
        id: `${id}-photo-${index + 1}`,
      }),
    ),
    voiceMemos: [],
    ...overrides,
  };
}

function createBackfillDemoStamp(photoCount: number) {
  return createDemoStamp(photoCount, {
    id: "journal-demo-backfill-may-8",
    capturedAt: "2026-06-20T16:00:00.000Z",
    createdAt: "2026-07-02T09:00:00.000Z",
    localDate: "2026-05-08",
    localTimezone: "Europe/London",
    title: "A quiet May morning",
  });
}

const archiveTitles = [
  "Market flowers",
  "Blue hour walk",
  "Peaches on the sill",
  "Late light on the bus",
  "First iced coffee",
  "Window rain",
  "Paper bag cherries",
  "Train platform light",
  "Corner shop receipt",
  "Kitchen radio",
  "Warm sidewalk",
  "Little green bowl",
  "Postcard morning",
  "After-dinner sky",
  "Tea at the window",
  "Tiny silver moon",
  "Bus stop roses",
  "Pocket notebook",
  "Clouds over the library",
  "One quiet pear",
  "Bakery paper",
  "Long shadow walk",
  "Desk lamp glow",
  "Last slice of melon",
  "Fresh page",
  "Soft thunder",
  "Blue mug",
  "Key ring shine",
  "Laundry sun",
  "Doorstep mint",
  "Night market",
];

function createArchiveStamp(
  monthKey: string,
  day: number,
  index: number,
): DemoPersistentStamp {
  const dayLabel = pad2(day);
  const localDate = `${monthKey}-${dayLabel}`;
  const title = archiveTitles[index % archiveTitles.length];
  return createDemoStamp((index % 4) + 1, {
    id: `journal-demo-${monthKey}-${dayLabel}`,
    capturedAt: `${localDate}T${pad2(8 + (index % 12))}:20:00.000Z`,
    createdAt: `${localDate}T${pad2(8 + (index % 12))}:42:00.000Z`,
    localDate,
    title,
  });
}

function createArchiveMonthStamps(monthKey: string, days: number[], offset = 0) {
  return days.map((day, index) =>
    createArchiveStamp(monthKey, day, offset + index),
  );
}

function createArchiveDemoStamps(): DemoPersistentStamp[] {
  return [
    ...createArchiveMonthStamps("2026-08", Array.from({ length: 31 }, (_, index) => index + 1), 0),
    ...createArchiveMonthStamps("2026-07", [1, 2, 4, 7, 8, 11, 13, 16, 18, 21, 24, 29], 8),
    ...createArchiveMonthStamps("2026-06", [7, 8, 15, 22], 20),
    createBackfillDemoStamp(1),
    ...createArchiveMonthStamps("2026-05", [21], 28),
  ];
}

function createDemoDraft(
  initialScreen: JournalDemoFlowProps["initialScreen"],
  createPhotoCount: number,
  scenario?: JournalDemoFlowProps["scenario"],
) {
  const draft = {
    ...createEmptyMemory(DEMO_NOW_ISO),
    title: initialScreen === "sealed" ? "Coffee before the rain" : "",
    photos:
      initialScreen === "sealed"
        ? [demoPhoto(0, true)]
        : initialScreen === "create" && createPhotoCount > 0
          ? Array.from({ length: createPhotoCount }, (_, index) =>
              demoPhoto(index, index === 0),
            )
          : [],
  };

  if (scenario === "backfill-may") {
    return {
      ...draft,
      capturedAt: "2026-06-20T16:00:00.000Z",
      localDate: "2026-05-08",
      localTimezone: "Europe/London",
      title: draft.title,
    };
  }

  return draft;
}

function createDemoBackfillDraft() {
  return {
    ...createEmptyMemory(DEMO_NOW_ISO),
    localDate: "",
    localTimezone: "Europe/London",
  };
}

export function JournalDemoFlow({
  initialScreen = "home",
  detailPhotoCount = 1,
  createPhotoCount = 0,
  scenario,
  initialMonth,
}: JournalDemoFlowProps) {
  const objectUrlsRef = useRef(new Set<string>());
  const [requestedMonth, selectMonth] = useMonthQueryState(initialMonth);
  const initialStamps = useMemo(
    () => {
      if (initialScreen === "home") {
        return createArchiveDemoStamps();
      }
      if (initialScreen === "detail") {
        return [
          scenario === "backfill-may"
            ? createBackfillDemoStamp(detailPhotoCount)
            : createDemoStamp(detailPhotoCount),
        ];
      }
      if (scenario === "duplicate-today") {
        return [createDemoStamp(Math.max(detailPhotoCount, 1))];
      }
      if (scenario === "backfill-may") {
        return [createBackfillDemoStamp(Math.max(detailPhotoCount, 1))];
      }
      return [];
    },
    [detailPhotoCount, initialScreen, scenario],
  );
  const [savedStamps, setSavedStamps] =
    useState<DemoPersistentStamp[]>(initialStamps);
  const [activeStampId, setActiveStampId] = useState(
    initialStamps[0]?.id ?? "",
  );
  const activeStamp = savedStamps.find((stamp) => stamp.id === activeStampId);
  const [draft, setDraft] = useState<MemoryDraft>(() =>
    activeStamp && initialScreen === "detail"
      ? copyDraft(activeStamp)
      : createDemoDraft(initialScreen, createPhotoCount, scenario),
  );
  const [mode, setMode] = useState<"home" | "create" | "crop" | "view" | "edit">(
    initialScreen === "detail"
      ? "view"
      : initialScreen === "sealed"
        ? "create"
        : initialScreen,
  );
  const [titleDraft, setTitleDraft] = useState("My Journal");
  const demoConfig = useMemo(
    () => ({
      ...memoryMediaConfig,
      maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS,
    }),
    [],
  );

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const registerObjectUrl = (url: string) => {
    objectUrlsRef.current.add(url);
  };

  const revokeObjectUrl = (url?: string) => {
    if (!url || !objectUrlsRef.current.delete(url)) return;
    URL.revokeObjectURL(url);
  };

  const removePhoto = (photo: MemoryPhoto) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((candidate) => candidate.id !== photo.id),
    }));
    const belongsToSavedStamp = activeStamp?.photos.some(
      (candidate) => candidate.id === photo.id,
    );
    if (!belongsToSavedStamp) revokeObjectUrl(photo.objectUrl);
  };

  const startNewStamp = () => {
    setActiveStampId("");
    setDraft(createDemoDraft("create", 0, undefined));
    setMode("create");
  };

  const sealAnotherDay = () => {
    if (isAtJournalLimit) return;
    setActiveStampId("");
    setDraft(createDemoBackfillDraft());
    setMode("create");
  };

  const sealToday = () => {
    const existingToday = findStampForLocalDate(
      savedStamps.map(stampSummary),
      DEMO_NOW,
    );
    if (existingToday) {
      const stamp = savedStamps.find((item) => item.id === existingToday.id);
      if (stamp) {
        setActiveStampId(stamp.id);
        setDraft(copyDraft(stamp));
      }
      setMode("view");
      return;
    }

    startNewStamp();
  };

  const saveStamp = () => {
    const existingStamp = mode === "edit" ? activeStamp : undefined;
    const nextStamp: DemoPersistentStamp = {
      id: existingStamp?.id ?? crypto.randomUUID(),
      capsuleId: "journal-demo",
      capturedAt: draft.capturedAt,
      createdAt: existingStamp?.createdAt ?? new Date().toISOString(),
      localDate: draft.localDate,
      localTimezone: draft.localTimezone,
      title: draft.title.trim(),
      photos: draft.photos.slice(0, DAILY_MEMORY_STAMP_MAX_PHOTOS),
      voiceMemos: [],
    };

    setSavedStamps((current) => {
      const existingIndex = current.findIndex(
        (stamp) => stamp.id === nextStamp.id,
      );
      if (existingIndex < 0) return [...current, nextStamp];
      return current.map((stamp) =>
        stamp.id === nextStamp.id ? nextStamp : stamp,
      );
    });
    setActiveStampId(nextStamp.id);
    setDraft(copyDraft(nextStamp));
    setMode("view");
  };

  const cancel = () => {
    if (mode === "edit" && activeStamp) {
      const savedObjectUrls = new Set(
        activeStamp.photos.flatMap((photo) =>
          photo.objectUrl ? [photo.objectUrl] : [],
        ),
      );
      draft.photos.forEach((photo) => {
        if (photo.objectUrl && !savedObjectUrls.has(photo.objectUrl)) {
          revokeObjectUrl(photo.objectUrl);
        }
      });
      setDraft(copyDraft(activeStamp));
      setMode("view");
      return;
    }

    draft.photos.forEach((photo) => revokeObjectUrl(photo.objectUrl));
    setDraft(createDemoDraft("home", 0, undefined));
    setMode("home");
  };

  const summaries = useMemo(() => savedStamps.map(stampSummary), [savedStamps]);
  const returnToMonthSheet = (stamp: DemoPersistentStamp) => {
    const monthKey = memoryMonthKey(stampSummary(stamp));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", "home");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    if (monthKey) selectMonth(monthKey);
    setMode("home");
  };

  const openJournalStamp = (memoryId: string) => {
    const stamp = savedStamps.find((item) => item.id === memoryId);
    if (!stamp) return;
    setActiveStampId(stamp.id);
    setDraft(copyDraft(stamp));
    setMode("view");
  };
  const archive = useMemo(
    () => monthlyStampArchive(summaries, requestedMonth, DEMO_NOW),
    [requestedMonth, summaries],
  );
  const existingToday = findStampForLocalDate(summaries, DEMO_NOW);
  const isAtJournalLimit =
    summaries.reduce((total, item) => total + item.photoCount, 0) >=
    JOURNAL_YEAR_PHOTO_CAPACITY;
  const thumbnailUrls = useMemo(
    () =>
      Object.fromEntries(
        savedStamps.flatMap((stamp) => {
          const firstPhoto = stamp.photos[0];
          const url = firstPhoto?.thumbnailObjectUrl ?? firstPhoto?.objectUrl;
          return url ? [[stamp.id, url]] : [];
        }),
      ),
    [savedStamps],
  );

  return (
    <div style={journalThemeStyle(defaultJournalTheme)}>
      {mode !== "home" && mode !== "view" ? (
        <div className="mb-3 flex justify-end">
          <span className="font-sans text-[0.68rem] font-semibold text-paper/80">
            Local journal demo
          </span>
        </div>
      ) : null}

      {mode === "home" ? (
        <article
          className="journal-home-surface journal-home-surface--mobile-density journal-leather-surface px-3 py-2 sm:px-4"
          aria-labelledby="journal-title"
        >
          <JournalIdentityHeader
            title="My Journal"
            typography="home-variant-c"
            titleDraft={titleDraft}
            isEditingTitle={false}
            titleBusy={false}
            titleError=""
            onTitleDraftChange={setTitleDraft}
            onSaveTitle={() => undefined}
            onCancelTitle={() => setTitleDraft("My Journal")}
            onBeginRename={() => undefined}
            onLock={() => undefined}
          />

          <MonthlyStampSheet
            archive={archive}
            thumbnailUrls={thumbnailUrls}
            onOpen={(memory) => openJournalStamp(memory.id)}
            onSelectMonth={selectMonth}
          />

          <BottomRitualAction
            todaySealed={Boolean(existingToday)}
            todayActionDisabled={isAtJournalLimit && !existingToday}
            backfillDisabled={isAtJournalLimit}
            onTodayAction={sealToday}
            onBackfillAction={sealAnotherDay}
          />
        </article>
      ) : null}

      {mode === "view" && activeStamp ? (
        <CompletedState
          memory={activeStamp}
          journalMode
          journalTitle="My Journal"
          onLock={() => undefined}
          theme={defaultJournalTheme}
          onEdit={() => {
            setDraft(copyDraft(activeStamp));
            setMode("edit");
          }}
          onBackToMonthSheet={() => returnToMonthSheet(activeStamp)}
        />
      ) : null}

      {mode === "crop" ? (
        <ScrapTable
          photo={demoPhoto(0)}
          onConfirmCrop={(cropMetadata) => {
            setDraft({
              ...createEmptyMemory(DEMO_NOW_ISO),
              photos: [{ ...demoPhoto(0), cropMetadata }],
            });
            setMode("create");
          }}
          onCancel={() => setMode("create")}
          theme={defaultJournalTheme}
        />
      ) : null}

      {mode === "create" || mode === "edit" ? (
        <MemoryForm
          config={demoConfig}
          draft={draft}
          isEditing={mode === "edit"}
          productMode="journal"
          onDraftChange={setDraft}
          onRemovePhoto={removePhoto}
          onVoiceMemosChange={(voiceMemos: MemoryVoiceMemo[]) =>
            setDraft((current) => ({ ...current, voiceMemos }))
          }
          onSave={saveStamp}
          onCancel={cancel}
          showCancel
          registerObjectUrl={registerObjectUrl}
          currentMemoryId={mode === "edit" ? activeStamp?.id : undefined}
          journalStamps={summaries}
          onOpenJournalStamp={openJournalStamp}
          theme={defaultJournalTheme}
        />
      ) : null}
    </div>
  );
}
