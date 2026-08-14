export type ArchiveStorageStatus = "NORMAL" | "WARNING" | "FULL";
export type ArchiveQuotaNoticeLevel = "NONE" | "EIGHTY" | "NINETY_FIVE" | "FULL";

export type ArchiveQuotaSummary = {
  archiveId: string;
  grantedBytes: number;
  usedBytes: number;
  percentage: number;
  storageStatus: ArchiveStorageStatus;
  linkedChipCount: number;
  storedOptimisedPhotoBytes: number;
  storedThumbnailBytes: number;
  storedVoiceNoteBytes: number;
};

const ARCHIVE_WARNING_RATIO = 0.8;
const ARCHIVE_NEARLY_FULL_RATIO = 0.95;

export function archiveQuotaNoticeLevel(
  quota: ArchiveQuotaSummary,
): ArchiveQuotaNoticeLevel {
  if (
    !Number.isFinite(quota.grantedBytes) ||
    quota.grantedBytes <= 0 ||
    !Number.isFinite(quota.usedBytes)
  ) {
    return "NONE";
  }

  const ratio = quota.usedBytes / quota.grantedBytes;
  if (ratio >= 1) return "FULL";
  if (ratio >= ARCHIVE_NEARLY_FULL_RATIO) return "NINETY_FIVE";
  if (ratio >= ARCHIVE_WARNING_RATIO) return "EIGHTY";
  return "NONE";
}

export function isArchiveQuotaWarning(quota: ArchiveQuotaSummary) {
  return archiveQuotaNoticeLevel(quota) !== "NONE";
}

export function getArchiveExpansionUrl(
  configuredUrl =
    process.env.NEXT_PUBLIC_MOMENTO_EXPAND_ARCHIVE_URL ??
    process.env.NEXT_PUBLIC_ARCHIVE_EXPANSION_URL,
) {
  const trimmed = configuredUrl?.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

type FormatArchiveCapacityOptions = {
  unit?: "auto" | "GB";
  maximumFractionDigits?: number;
};

export function formatArchiveCapacity(
  bytes: number,
  options: FormatArchiveCapacityOptions = {},
) {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const unit = options.unit === "GB"
    ? { divisor: 1_000_000_000, suffix: "GB" }
    : safeBytes >= 1_000_000_000
      ? { divisor: 1_000_000_000, suffix: "GB" }
      : safeBytes >= 1_000_000
        ? { divisor: 1_000_000, suffix: "MB" }
        : safeBytes >= 1_000
          ? { divisor: 1_000, suffix: "KB" }
          : { divisor: 1, suffix: "B" };
  const value = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(safeBytes / unit.divisor);
  return `${value} ${unit.suffix}`;
}
