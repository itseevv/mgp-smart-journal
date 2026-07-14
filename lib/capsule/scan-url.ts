type HeaderReader = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

export function capsuleScanUrlFromHeaders(
  headers: HeaderReader,
  pathname: string,
  searchParams: Record<string, string | undefined> = {},
) {
  const host =
    firstHeaderValue(headers.get("x-forwarded-host")) ||
    firstHeaderValue(headers.get("host"));
  if (!host) return null;

  const forwardedProto = firstHeaderValue(headers.get("x-forwarded-proto"));
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";

  try {
    const url = new URL(pathname, `${protocol}://${host}`);
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    return null;
  }
}
