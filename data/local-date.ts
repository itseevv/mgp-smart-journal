const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function validDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeLocalDateKey(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return LOCAL_DATE_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function toLocalDateKeyFromDate(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

export function localDateKeyFromValue(value?: string | Date | null) {
  if (typeof value === "string") {
    const explicitDate = normalizeLocalDateKey(value);
    if (explicitDate) return explicitDate;
  }

  const date = validDate(value);
  return date ? toLocalDateKeyFromDate(date) : "";
}

export function localMonthKeyFromDateKey(localDate?: string | null) {
  const dateKey = normalizeLocalDateKey(localDate);
  return dateKey ? dateKey.slice(0, 7) : "";
}

export function resolvedLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
