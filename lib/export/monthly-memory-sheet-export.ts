import type { JournalMemorySummary } from "../../data/journal.ts";
import {
  memoryLocalDateKey,
  monthTitle,
  normalizeLocalMonthKey,
  sortStampsBySemanticDay,
} from "../../data/journal-stamps.ts";

export const MONTHLY_MEMORY_EDITION_WIDTH = 1080;
export const MONTHLY_MEMORY_EDITION_COLUMNS = 3;
export const MONTHLY_MEMORY_EDITION_MIME_TYPE = "image/png";
export const MONTHLY_MEMORY_EDITION_MAX_STAMPS = 31;

export const monthlyMemoryEditionLayout = {
  outerPaddingX: 60,
  outerTop: 56,
  journalHeaderHeight: 112,
  journalHeaderGap: 28,
  sheetPaddingX: 24,
  sheetPaddingTop: 32,
  sheetHeaderHeight: 112,
  sheetHeaderGap: 28,
  stampSize: 292,
  stampGap: 18,
  sheetPaddingBottom: 30,
  footerGap: 32,
  footerHeight: 180,
  outerBottom: 48,
  journalTitleFontSize: 67.347692,
  journalTitleLineHeight: 75.429415,
  journalTitleMaxWidth: 960,
  monthTitleFontSize: 60.258462,
  monthSubheaderFontSize: 16,
  dateFontSize: 22,
  logoSize: 180,
} as const;

export type MonthlyMemoryEditionStamp = {
  day: number;
  dayLabel: string;
  memory: JournalMemorySummary;
};

export type MonthlyMemoryEditionModel = {
  journalTitle: string;
  monthKey: string;
  monthName: string;
  monthTitle: string;
  editionTitle: string;
  subheader: "The whole month, kept together";
  columns: 3;
  rows: number;
  width: 1080;
  height: number;
  stamps: MonthlyMemoryEditionStamp[];
};

type ShareNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

function safeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function monthlyMemoryEditionRows(stampCount: number) {
  return Math.max(
    1,
    Math.ceil(Math.max(0, stampCount) / MONTHLY_MEMORY_EDITION_COLUMNS),
  );
}

export function monthlyMemoryEditionHeight(stampCount: number) {
  const rows = monthlyMemoryEditionRows(stampCount);
  const layout = monthlyMemoryEditionLayout;
  return (
    layout.outerTop +
    layout.journalHeaderHeight +
    layout.journalHeaderGap +
    layout.sheetPaddingTop +
    layout.sheetHeaderHeight +
    layout.sheetHeaderGap +
    layout.stampSize * rows +
    layout.stampGap * Math.max(0, rows - 1) +
    layout.sheetPaddingBottom +
    layout.footerGap +
    layout.footerHeight +
    layout.outerBottom
  );
}

export function monthlyMemoryEditionMonthName(monthKey: string) {
  const label = monthTitle(monthKey);
  return label === "Month Sheet"
    ? "Monthly"
    : label.replace(/\s+\d{4}$/u, "");
}

export function monthlyMemoryEditionFilename(monthKey: string) {
  const normalized = normalizeLocalMonthKey(monthKey) || "undated-month";
  return `${safeFilenamePart(`${normalized}-memory-edition`)}.png`;
}

export function monthlyMemoryEditionModel({
  journalTitle,
  monthKey,
  stamps,
}: {
  journalTitle: string;
  monthKey: string;
  stamps: JournalMemorySummary[];
}): MonthlyMemoryEditionModel {
  const normalizedMonthKey = normalizeLocalMonthKey(monthKey) || monthKey;
  const selectedMonthTitle = monthTitle(normalizedMonthKey);
  const sortedStamps = [...stamps].sort(sortStampsBySemanticDay);

  const editionStamps = sortedStamps.map((memory) => {
    const dateKey = memoryLocalDateKey(memory);
    const parsedDay = Number.parseInt(dateKey.slice(-2), 10);
    const day = Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : 1;
    return {
      day,
      dayLabel: String(day),
      memory,
    };
  });

  return {
    journalTitle: journalTitle.replace(/\s+/gu, " ").trim() || "My Journal",
    monthKey: normalizedMonthKey,
    monthName: monthlyMemoryEditionMonthName(normalizedMonthKey),
    monthTitle: selectedMonthTitle,
    editionTitle: `${selectedMonthTitle} Edition`,
    subheader: "The whole month, kept together",
    columns: MONTHLY_MEMORY_EDITION_COLUMNS,
    rows: monthlyMemoryEditionRows(editionStamps.length),
    width: MONTHLY_MEMORY_EDITION_WIDTH,
    height: monthlyMemoryEditionHeight(editionStamps.length),
    stamps: editionStamps,
  };
}

export function createMonthlyMemoryEditionFile(blob: Blob, filename: string) {
  return new File([blob], filename, {
    type: MONTHLY_MEMORY_EDITION_MIME_TYPE,
  });
}

export function canShareMonthlyMemoryEdition(
  shareNavigator: ShareNavigator | undefined,
  file: File,
) {
  if (!shareNavigator?.share || !shareNavigator.canShare) return false;
  try {
    return shareNavigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareMonthlyMemoryEditionBlob(
  blob: Blob,
  filename: string,
  title: string,
  shareNavigator: ShareNavigator = navigator,
) {
  const file = createMonthlyMemoryEditionFile(blob, filename);
  if (!canShareMonthlyMemoryEdition(shareNavigator, file)) {
    return { shared: false as const, reason: "unsupported" as const };
  }
  await shareNavigator.share?.({ files: [file], title });
  return { shared: true as const };
}

export function saveMonthlyMemoryEditionBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  if ("download" in anchor) {
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
