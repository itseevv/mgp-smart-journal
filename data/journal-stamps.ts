import type { JournalMemorySummary } from "./journal";
import {
  localDateKeyFromValue,
  localMonthKeyFromDateKey,
  nextLocalMonthKey,
  normalizeLocalMonthKey,
  previousLocalMonthKey,
  toLocalDateKeyFromDate,
  toLocalMonthKeyFromDate,
} from "./local-date.ts";

export type MonthlyStampSheet = {
  key: string;
  title: string;
  stamps: JournalMemorySummary[];
};

export type MonthlyStampArchive = {
  stampedSheets: MonthlyStampSheet[];
  availableMonthKeys: string[];
  selectedMonthKey: string;
  selectedSheet: MonthlyStampSheet;
  previousMonthKey: string;
  nextMonthKey: string;
  currentMonthKey: string;
  canNavigateNext: boolean;
  selectedMonthStatus: "past" | "current" | "future";
};

export const MONTH_SHEET_COLUMNS = 4;
export const MONTH_SHEET_ROWS = 8;
export const MONTH_SHEET_CAPACITY = MONTH_SHEET_COLUMNS * MONTH_SHEET_ROWS;

export type MonthSheetStampPosition = {
  position: number;
  dayLabel: string;
  memory: JournalMemorySummary;
};

function validDate(value?: string | Date) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function localDateFromKey(localDate?: string) {
  const key = localDateKeyFromValue(localDate);
  if (!key) return undefined;
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export {
  localDateKeyFromValue as localDateKey,
  localMonthKeyFromDateKey,
  nextLocalMonthKey,
  normalizeLocalMonthKey,
  previousLocalMonthKey,
  toLocalDateKeyFromDate,
  toLocalMonthKeyFromDate,
};

export function semanticStampDate(memory: JournalMemorySummary) {
  return (
    localDateFromKey(memory.localDate) ??
    validDate(memory.capturedAt) ??
    validDate(memory.createdAt)
  );
}

export function localMonthKey(value?: string | Date) {
  return localMonthKeyFromDateKey(localDateKeyFromValue(value));
}

export function memoryLocalDateKey(memory: JournalMemorySummary) {
  return (
    localDateKeyFromValue(memory.localDate) ||
    localDateKeyFromValue(memory.capturedAt) ||
    localDateKeyFromValue(memory.createdAt)
  );
}

export function memoryMonthKey(memory: JournalMemorySummary) {
  return localMonthKeyFromDateKey(memoryLocalDateKey(memory));
}

export function monthSheetDayLabel(memory: JournalMemorySummary) {
  const localDate = memoryLocalDateKey(memory);
  return localDate.length >= 10 ? localDate.slice(8, 10) : "";
}

export function monthSheetStampPositions(
  memories: JournalMemorySummary[],
  capacity = MONTH_SHEET_CAPACITY,
): MonthSheetStampPosition[] {
  return [...memories]
    .sort(sortStampsBySemanticDay)
    .slice(0, capacity)
    .map((memory, index) => ({
      position: index + 1,
      dayLabel: monthSheetDayLabel(memory),
      memory,
    }));
}

export function findStampForLocalDateKey(
  memories: JournalMemorySummary[],
  targetLocalDate: string,
) {
  if (!targetLocalDate) return undefined;
  return memories.find(
    (memory) => memoryLocalDateKey(memory) === targetLocalDate,
  );
}

export function findStampForLocalDate(
  memories: JournalMemorySummary[],
  targetDate: string | Date = new Date(),
) {
  return findStampForLocalDateKey(memories, localDateKeyFromValue(targetDate));
}

export function findDuplicateStampForLocalDate(
  memories: JournalMemorySummary[],
  targetLocalDate: string,
  currentMemoryId?: string,
) {
  if (!targetLocalDate) return undefined;
  return memories.find(
    (memory) =>
      memory.id !== currentMemoryId &&
      memoryLocalDateKey(memory) === targetLocalDate,
  );
}

export function sortStampsBySemanticDay(
  first: JournalMemorySummary,
  second: JournalMemorySummary,
) {
  const firstKey = memoryLocalDateKey(first);
  const secondKey = memoryLocalDateKey(second);
  if (firstKey !== secondKey) return firstKey.localeCompare(secondKey);

  const firstCreated = validDate(first.createdAt)?.getTime() ?? 0;
  const secondCreated = validDate(second.createdAt)?.getTime() ?? 0;
  if (firstCreated !== secondCreated) return firstCreated - secondCreated;

  return first.id.localeCompare(second.id);
}

export function currentMonthKey(currentDate = new Date()) {
  return toLocalMonthKeyFromDate(currentDate);
}

export function compareMonthKeys(first?: string, second?: string) {
  const firstKey = normalizeLocalMonthKey(first);
  const secondKey = normalizeLocalMonthKey(second);
  if (!firstKey || !secondKey) return 0;
  return firstKey.localeCompare(secondKey);
}

export function monthTitle(
  monthKey: string,
  options: { uppercase?: boolean } = {},
) {
  const normalizedMonthKey = normalizeLocalMonthKey(monthKey);
  if (!normalizedMonthKey) return "Month Sheet";
  const [year, month] = normalizedMonthKey.split("-").map(Number);
  if (!year || !month) return "Month Sheet";
  const title = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return options.uppercase ? title.toUpperCase() : title;
}

export function groupStampsByMonth(
  memories: JournalMemorySummary[],
): MonthlyStampSheet[] {
  const grouped = new Map<string, JournalMemorySummary[]>();
  memories.forEach((memory) => {
    const key = memoryMonthKey(memory);
    if (!key) return;
    const group = grouped.get(key) ?? [];
    group.push(memory);
    grouped.set(key, group);
  });

  return [...grouped.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, stamps]) => ({
      key,
      title: monthTitle(key),
      stamps: [...stamps].sort(sortStampsBySemanticDay),
    }));
}

export function sortedMonthSheetsNewestFirst(
  memories: JournalMemorySummary[],
): MonthlyStampSheet[] {
  return [...groupStampsByMonth(memories)].reverse();
}

export function availableStampedMonthKeys(memories: JournalMemorySummary[]) {
  return sortedMonthSheetsNewestFirst(memories).map((sheet) => sheet.key);
}

export function activeMonthKey(
  memories: JournalMemorySummary[],
  currentDate = new Date(),
) {
  const groups = groupStampsByMonth(memories);
  const currentKey = currentMonthKey(currentDate);
  if (groups.some((group) => group.key === currentKey)) return currentKey;
  return groups.at(-1)?.key ?? currentKey;
}

export function resolveSelectedMonthKey(
  memories: JournalMemorySummary[],
  requestedMonthKey?: string | null,
  currentDate = new Date(),
) {
  return (
    normalizeLocalMonthKey(requestedMonthKey) ??
    activeMonthKey(memories, currentDate)
  );
}

export function stampsForMonth(
  memories: JournalMemorySummary[],
  monthKey: string,
) {
  const selectedMonthKey = normalizeLocalMonthKey(monthKey);
  if (!selectedMonthKey) return [];
  return groupStampsByMonth(memories).find(
    (sheet) => sheet.key === selectedMonthKey,
  )?.stamps ?? [];
}

export function monthlyStampSheetForMonth(
  memories: JournalMemorySummary[],
  monthKey: string,
): MonthlyStampSheet {
  const selectedMonthKey = normalizeLocalMonthKey(monthKey) ?? "";
  return {
    key: selectedMonthKey,
    title: monthTitle(selectedMonthKey),
    stamps: stampsForMonth(memories, selectedMonthKey),
  };
}

export function activeMonthlyStampSheet(
  memories: JournalMemorySummary[],
  currentDate = new Date(),
) {
  const key = activeMonthKey(memories, currentDate);
  return monthlyStampSheetForMonth(memories, key);
}

export function monthlyStampArchive(
  memories: JournalMemorySummary[],
  requestedMonthKey?: string | null,
  currentDate = new Date(),
): MonthlyStampArchive {
  const selectedMonthKey = resolveSelectedMonthKey(
    memories,
    requestedMonthKey,
    currentDate,
  );
  const stampedSheets = sortedMonthSheetsNewestFirst(memories);
  const currentKey = currentMonthKey(currentDate);
  const monthComparison = compareMonthKeys(selectedMonthKey, currentKey);

  return {
    stampedSheets,
    availableMonthKeys: stampedSheets.map((sheet) => sheet.key),
    selectedMonthKey,
    selectedSheet: monthlyStampSheetForMonth(memories, selectedMonthKey),
    previousMonthKey: previousLocalMonthKey(selectedMonthKey),
    nextMonthKey: nextLocalMonthKey(selectedMonthKey),
    currentMonthKey: currentKey,
    canNavigateNext:
      compareMonthKeys(nextLocalMonthKey(selectedMonthKey), currentKey) <= 0,
    selectedMonthStatus:
      monthComparison < 0
        ? "past"
        : monthComparison > 0
          ? "future"
          : "current",
  };
}
