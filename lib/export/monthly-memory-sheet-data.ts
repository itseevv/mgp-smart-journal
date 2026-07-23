import {
  defaultJournalTheme,
  type JournalTheme,
} from "../../data/journal-themes.ts";
import { monthlyMemoryEditionJournalTitle } from "./monthly-memory-sheet-export.ts";
import {
  MonthlyExportRouteError,
  type MonthlyExportSelection,
} from "./monthly-memory-sheet-route-core.ts";
import { mapWithConcurrency } from "./monthly-memory-sheet-runtime.ts";
import type {
  ServerMonthlyMemoryEditionRenderInput,
  ServerMonthlyMemoryEditionStamp,
} from "./monthly-memory-sheet-server.ts";

export type MonthlyExportCapsuleRecord = {
  journalTitle: string | null;
  themeId: string | null;
};

export type MonthlyExportMemoryRecord = {
  id: string;
  localDate: string | null;
  occurredAt: string;
};

export type MonthlyExportDataLoaderDependencies<CoverRecord> = {
  loadCapsule: (
    capsuleId: string,
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<MonthlyExportCapsuleRecord | null>;
  loadMemories: (
    capsuleId: string,
    selectedIds: string[],
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<MonthlyExportMemoryRecord[]>;
  loadFirstCovers: (
    selectedIds: string[],
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<Map<string, CoverRecord>>;
  loadTheme: (
    themeId: string,
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<JournalTheme | null>;
  prepareCover: (
    cover: CoverRecord,
    index: number,
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<Buffer | undefined>;
  loadTexture: (
    theme: JournalTheme,
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<Buffer | undefined>;
  loadLogo: (signal?: AbortSignal) => Promise<Buffer | undefined>;
  coverConcurrency?: number;
  renderReserveMs?: number;
};

export function localDateKeyInTimeZone(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = valueByType.get("year");
  const month = valueByType.get("month");
  const day = valueByType.get("day");
  return year && month && day ? `${year}-${month}-${day}` : undefined;
}

export function createMonthlyExportDataLoader<CoverRecord>({
  loadCapsule,
  loadMemories,
  loadFirstCovers,
  loadTheme,
  prepareCover,
  loadTexture,
  loadLogo,
  coverConcurrency = 8,
  renderReserveMs = 8_000,
}: MonthlyExportDataLoaderDependencies<CoverRecord>) {
  return async function loadMonthlyExportData(
    selection: MonthlyExportSelection,
    deadline: number,
    signal?: AbortSignal,
  ): Promise<ServerMonthlyMemoryEditionRenderInput> {
    signal?.throwIfAborted();
    const selectedIds = selection.stamps.map((stamp) => stamp.id);
    const [capsule, memories, firstCovers] = await Promise.all([
      loadCapsule(selection.capsuleId, deadline, signal),
      loadMemories(selection.capsuleId, selectedIds, deadline, signal),
      loadFirstCovers(selectedIds, deadline, signal),
    ]);
    if (!capsule) {
      throw new MonthlyExportRouteError("NOT_FOUND", 404);
    }
    if (memories.length !== selectedIds.length) {
      throw new MonthlyExportRouteError("SELECTION_STALE", 409);
    }

    const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
    for (const selected of selection.stamps) {
      const memory = memoryById.get(selected.id);
      if (!memory) {
        throw new MonthlyExportRouteError("SELECTION_STALE", 409);
      }
      const persistedLocalDate = memory.localDate?.slice(0, 10);
      const canonicalDate =
        persistedLocalDate ??
        localDateKeyInTimeZone(memory.occurredAt, selection.timeZone);
      if (!canonicalDate || canonicalDate !== selected.dateKey) {
        throw new MonthlyExportRouteError("SELECTION_STALE", 409);
      }
    }

    const theme = capsule.themeId
      ? (await loadTheme(capsule.themeId, deadline, signal)) ??
        defaultJournalTheme
      : defaultJournalTheme;
    const mediaDeadline = deadline - renderReserveMs;
    const coverWork = mapWithConcurrency(
      selection.stamps,
      coverConcurrency,
      async (selected, index): Promise<ServerMonthlyMemoryEditionStamp> => {
        signal?.throwIfAborted();
        const cover = firstCovers.get(selected.id);
        let input: Buffer | undefined;
        if (cover) {
          try {
            input = await prepareCover(
              cover,
              index,
              mediaDeadline,
              signal,
            );
          } catch {
            signal?.throwIfAborted();
          }
        }
        return {
          dayLabel: String(
            Number.parseInt(selected.dateKey.slice(-2), 10) || "",
          ),
          input,
        };
      },
    );
    const textureWork = loadTexture(
      theme,
      mediaDeadline,
      signal,
    ).catch(() => {
      signal?.throwIfAborted();
      return undefined;
    });
    const logoWork = loadLogo(signal).catch(() => {
      signal?.throwIfAborted();
      return undefined;
    });
    const [stamps, texture, logo] = await Promise.all([
      coverWork,
      textureWork,
      logoWork,
    ]);
    signal?.throwIfAborted();

    return {
      journalTitle: monthlyMemoryEditionJournalTitle(
        capsule.journalTitle ?? "My Journal",
      ),
      monthKey: selection.monthKey,
      theme,
      stamps,
      texture,
      logo,
    };
  };
}
