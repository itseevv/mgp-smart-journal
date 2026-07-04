import type { JournalMemorySummary } from "./journal";
import {
  localDateKeyFromValue,
  localMonthKeyFromDateKey,
  toLocalDateKeyFromDate,
} from "./local-date.ts";

export type MonthlyStampSheet = {
  key: string;
  title: string;
  stamps: JournalMemorySummary[];
};

function validDate(value?: string | Date) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export {
  localDateKeyFromValue as localDateKey,
  localMonthKeyFromDateKey,
  toLocalDateKeyFromDate,
};

export function semanticStampDate(memory: JournalMemorySummary) {
  return validDate(memory.capturedAt) ?? validDate(memory.createdAt);
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

export function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "Month Sheet";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
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

export function activeMonthKey(
  memories: JournalMemorySummary[],
  currentDate = new Date(),
) {
  const groups = groupStampsByMonth(memories);
  const currentKey = localMonthKey(currentDate);
  if (groups.some((group) => group.key === currentKey)) return currentKey;
  return groups.at(-1)?.key ?? currentKey;
}

export function activeMonthlyStampSheet(
  memories: JournalMemorySummary[],
  currentDate = new Date(),
) {
  const groups = groupStampsByMonth(memories);
  const key = activeMonthKey(memories, currentDate);
  return (
    groups.find((group) => group.key === key) ?? {
      key,
      title: monthTitle(key),
      stamps: [],
    }
  );
}
