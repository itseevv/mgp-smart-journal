import {
  journalConfig,
  type JournalMemorySummary,
} from "../../data/journal.ts";
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
export const MONTHLY_MEMORY_EDITION_SAFE_PNG_BYTES = 2_500_000;
export const monthlyMemoryEditionVisualSpec = {
  subheader: "The whole month, kept together",
  subheaderTrackingEm: 0.035,
  fallbackSurfaceLayerOpacity: 0.8,
  grain: {
    patternWidth: 8,
    patternHeight: 9,
    lightDot: { x: 1.5, y: 2.5, radius: 0.55, color: "#ffffff", alpha: 0.06 },
    darkDot: { x: 6.5, y: 6.5, radius: 0.65, color: "#140a0c", alpha: 0.18 },
    sheenStartAlpha: 0.055,
    sheenEndAlpha: 0.13,
  },
} as const;

export function monthlyMemoryEditionSurfaceLayerOpacity(
  hasRenderedTexture: boolean,
) {
  return hasRenderedTexture
    ? 1
    : monthlyMemoryEditionVisualSpec.fallbackSurfaceLayerOpacity;
}

function cssRgba(hex: string, alpha: number) {
  const value = hex.replace(/^#/u, "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((character) => character.repeat(2))
          .join("")
      : value;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function monthlyMemoryEditionArtifactTextureStyle() {
  const grain = monthlyMemoryEditionVisualSpec.grain;
  const grainSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${grain.patternWidth}" height="${grain.patternHeight}">` +
      `<circle cx="${grain.lightDot.x}" cy="${grain.lightDot.y}" r="${grain.lightDot.radius}" fill="${grain.lightDot.color}" fill-opacity="${grain.lightDot.alpha}"/>` +
      `<circle cx="${grain.darkDot.x}" cy="${grain.darkDot.y}" r="${grain.darkDot.radius}" fill="${grain.darkDot.color}" fill-opacity="${grain.darkDot.alpha}"/>` +
      "</svg>",
  );
  return {
    "--monthly-export-grain": `url("data:image/svg+xml,${grainSvg}")`,
    "--monthly-export-sheen": `linear-gradient(135deg, ${cssRgba("#ffffff", grain.sheenStartAlpha)}, transparent 38%, ${cssRgba("#000000", grain.sheenEndAlpha)})`,
  } as const;
}

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
  editionTitle: string;
  subheader: typeof monthlyMemoryEditionVisualSpec.subheader;
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

export function monthlyMemoryEditionTitle(monthKey: string) {
  return `${monthTitle(monthKey)} Edition`;
}

export function monthlyMemoryEditionJournalTitle(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim() || journalConfig.defaultTitle;
  return normalized.slice(0, journalConfig.maxTitleLength);
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
    journalTitle: monthlyMemoryEditionJournalTitle(journalTitle),
    monthKey: normalizedMonthKey,
    monthName: monthlyMemoryEditionMonthName(normalizedMonthKey),
    editionTitle: monthlyMemoryEditionTitle(normalizedMonthKey),
    subheader: monthlyMemoryEditionVisualSpec.subheader,
    columns: MONTHLY_MEMORY_EDITION_COLUMNS,
    rows: monthlyMemoryEditionRows(editionStamps.length),
    width: MONTHLY_MEMORY_EDITION_WIDTH,
    height: monthlyMemoryEditionHeight(editionStamps.length),
    stamps: editionStamps,
  };
}

export function monthlyMemoryEditionRequestStamps({
  monthKey,
  stamps,
}: {
  monthKey: string;
  stamps: JournalMemorySummary[];
}) {
  const normalizedMonthKey = normalizeLocalMonthKey(monthKey);
  if (!normalizedMonthKey) {
    throw new Error("A valid selected month is required.");
  }
  if (!stamps.length) {
    throw new Error("A Monthly Memory Edition needs a stamp.");
  }
  if (stamps.length > MONTHLY_MEMORY_EDITION_MAX_STAMPS) {
    throw new Error("A Monthly Memory Edition supports at most 31 stamps.");
  }

  return [...stamps].sort(sortStampsBySemanticDay).map((memory) => {
    const dateKey = memoryLocalDateKey(memory);
    if (!dateKey || dateKey.slice(0, 7) !== normalizedMonthKey) {
      throw new Error("Every selected stamp must belong to the selected month.");
    }
    return { id: memory.id, dateKey };
  });
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
