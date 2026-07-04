"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MonthlyStampSheet } from "@/components/journal/monthly-stamp-sheet";
import { CompletedState } from "@/components/memory/completed-state";
import { MemoryForm } from "@/components/memory/memory-form";
import { ScrapTable } from "@/components/scrap/scrap-table";
import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  JOURNAL_YEAR_PHOTO_CAPACITY,
} from "@/data/journal-product";
import {
  activeMonthlyStampSheet,
  findStampForLocalDate,
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
};

const DEMO_NOW_ISO = "2026-07-04T16:00:00.000Z";
const DEMO_NOW = new Date(DEMO_NOW_ISO);

function copyDraft(memory: PersistentMemoryEntry): MemoryDraft {
  return {
    capturedAt: memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    title: memory.title,
    photos: memory.photos.map((photo) => ({ ...photo })),
    voiceMemos: [],
  };
}

function stampSummary(memory: PersistentMemoryEntry) {
  return {
    id: memory.id,
    title: memory.title,
    capturedAt: memory.capturedAt,
    createdAt: memory.capturedAt,
    localDate: memory.localDate,
    localTimezone: memory.localTimezone,
    photoCount: Math.min(memory.photos.length, DAILY_MEMORY_STAMP_MAX_PHOTOS),
    voiceMemoCount: 0,
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

function demoImageUrl(index: number) {
  const { width, height } = demoImageShape(index);
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
  ][index % 9];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><circle cx="${Math.round(width * 0.32) + index * 10}" cy="${Math.round(height * 0.28) + index * 12}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="rgba(255,255,255,.18)"/><path d="M${Math.round(width * 0.12)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.34)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.56)} ${Math.round(height * 0.82)}, ${Math.round(width * 0.86)} ${Math.round(height * 0.56)}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="${Math.round(Math.min(width, height) * 0.05)}" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  overrides: Partial<PersistentMemoryEntry> = {},
): PersistentMemoryEntry {
  return {
    id: "journal-demo-stamp",
    capsuleId: "journal-demo",
    capturedAt: DEMO_NOW_ISO,
    localDate: "2026-07-04",
    localTimezone: "Europe/London",
    title: "Coffee before the rain",
    photos: Array.from({ length: photoCount }, (_, index) =>
      demoPhoto(index, index === 0),
    ),
    voiceMemos: [],
    ...overrides,
  };
}

function createBackfillDemoStamp(photoCount: number) {
  return createDemoStamp(photoCount, {
    id: "journal-demo-backfill-may-8",
    capturedAt: "2026-06-20T16:00:00.000Z",
    localDate: "2026-05-08",
    localTimezone: "Europe/London",
    title: "A quiet May morning",
  });
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

export function JournalDemoFlow({
  initialScreen = "home",
  detailPhotoCount = 1,
  createPhotoCount = 0,
  scenario,
}: JournalDemoFlowProps) {
  const objectUrlsRef = useRef(new Set<string>());
  const initialStamp = useMemo(
    () => {
      if (initialScreen === "detail") {
        return scenario === "backfill-may"
          ? createBackfillDemoStamp(detailPhotoCount)
          : createDemoStamp(detailPhotoCount);
      }
      if (scenario === "duplicate-today") {
        return createDemoStamp(Math.max(detailPhotoCount, 1));
      }
      if (scenario === "backfill-may") {
        return createBackfillDemoStamp(Math.max(detailPhotoCount, 1));
      }
      return undefined;
    },
    [detailPhotoCount, initialScreen, scenario],
  );
  const [savedStamp, setSavedStamp] = useState<PersistentMemoryEntry | undefined>(
    initialStamp,
  );
  const [draft, setDraft] = useState<MemoryDraft>(() =>
    initialStamp && initialScreen === "detail"
      ? copyDraft(initialStamp)
      : createDemoDraft(initialScreen, createPhotoCount, scenario),
  );
  const [mode, setMode] = useState<"home" | "create" | "crop" | "view" | "edit">(
    initialScreen === "detail"
      ? "view"
      : initialScreen === "sealed"
        ? "create"
        : initialScreen,
  );
  const [sealMessage, setSealMessage] = useState("");
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
    const belongsToSavedStamp = savedStamp?.photos.some(
      (candidate) => candidate.id === photo.id,
    );
    if (!belongsToSavedStamp) revokeObjectUrl(photo.objectUrl);
  };

  const startNewStamp = () => {
    setSealMessage("");
    setDraft(createDemoDraft("create", 0, undefined));
    setMode("create");
  };

  const sealToday = () => {
    if (savedStamp) {
      const existingToday = findStampForLocalDate(
        [stampSummary(savedStamp)],
        DEMO_NOW,
      );
      if (existingToday) {
        setSealMessage("Today is already sealed. You can revisit today's stamp.");
        setMode("view");
        return;
      }
    }

    startNewStamp();
  };

  const saveStamp = () => {
    const nextStamp: PersistentMemoryEntry = {
      id: savedStamp?.id ?? crypto.randomUUID(),
      capsuleId: "journal-demo",
      capturedAt: draft.capturedAt,
      localDate: draft.localDate,
      localTimezone: draft.localTimezone,
      title: draft.title.trim(),
      photos: draft.photos.slice(0, DAILY_MEMORY_STAMP_MAX_PHOTOS),
      voiceMemos: [],
    };

    setSavedStamp(nextStamp);
    setDraft(copyDraft(nextStamp));
    setMode("view");
  };

  const cancel = () => {
    if (mode === "edit" && savedStamp) {
      const savedObjectUrls = new Set(
        savedStamp.photos.flatMap((photo) => (photo.objectUrl ? [photo.objectUrl] : [])),
      );
      draft.photos.forEach((photo) => {
        if (photo.objectUrl && !savedObjectUrls.has(photo.objectUrl)) {
          revokeObjectUrl(photo.objectUrl);
        }
      });
      setDraft(copyDraft(savedStamp));
      setMode("view");
      return;
    }

    draft.photos.forEach((photo) => revokeObjectUrl(photo.objectUrl));
    setDraft(createDemoDraft("home", 0, undefined));
    setMode("home");
  };

  const summaries = savedStamp ? [stampSummary(savedStamp)] : [];
  const openJournalStamp = (memoryId: string) => {
    if (!savedStamp || savedStamp.id !== memoryId) return;
    setDraft(copyDraft(savedStamp));
    setMode("view");
  };
  const activeSheet = activeMonthlyStampSheet(summaries);
  const thumbnailUrls =
    savedStamp?.photos[0]?.thumbnailObjectUrl ?? savedStamp?.photos[0]?.objectUrl
      ? {
          [savedStamp.id]:
            savedStamp.photos[0].thumbnailObjectUrl ?? savedStamp.photos[0].objectUrl!,
        }
      : {};

  return (
    <div style={journalThemeStyle(defaultJournalTheme)}>
      <div className="mb-3 flex justify-end">
        <span className="font-sans text-[0.68rem] font-semibold text-paper/80">
          Local journal demo
        </span>
      </div>

      {mode === "home" ? (
        <article
          className="journal-leather-surface p-3 shadow-[0_22px_55px_rgba(18,11,10,0.28)] sm:p-4"
          aria-labelledby="journal-demo-title"
        >
          <header className="pb-5 text-[var(--journal-text)]">
            <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--journal-muted)]">
              Journal
            </p>
            <h1
              id="journal-demo-title"
              className="mt-3 font-serif text-[2.35rem] leading-none text-[var(--journal-text)]"
            >
              My Journal
            </h1>
          </header>

          <MonthlyStampSheet
            sheet={activeSheet}
            earlierSheets={[]}
            thumbnailUrls={thumbnailUrls}
            onOpen={() => setMode("view")}
            onSealToday={sealToday}
            sealBusy={false}
            sealMessage={sealMessage}
            limitReached={summaries.reduce((total, item) => total + item.photoCount, 0) >= JOURNAL_YEAR_PHOTO_CAPACITY}
          />
        </article>
      ) : null}

      {mode === "view" && savedStamp ? (
        <CompletedState
          memory={savedStamp}
          journalMode
          onEdit={() => {
            setDraft(copyDraft(savedStamp));
            setMode("edit");
          }}
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
          currentMemoryId={mode === "edit" ? savedStamp?.id : undefined}
          journalStamps={summaries}
          onOpenJournalStamp={openJournalStamp}
        />
      ) : null}
    </div>
  );
}
