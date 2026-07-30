const DEFAULT_ARTIFACT_RETRY_DELAYS_MS = [250, 750, 1_500, 3_000] as const;
const MAX_BUSY_RETRY_AFTER_SECONDS = 20;

type FetchLike = typeof fetch;

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

async function waitForRetry(delayMs: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const finish = (callback: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => {
      finish(() => reject(abortError()));
    };
    const timer = setTimeout(() => finish(resolve), delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export async function fetchMonthlyExportResponse({
  url,
  init,
  signal,
  fetchImpl = fetch,
  waitImpl = waitForRetry,
}: {
  url: string;
  init: RequestInit;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  waitImpl?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}) {
  const request = () => fetchImpl(url, { ...init, signal });
  const response = await request();
  if (response.status !== 429) return response;

  const detail = (await response.clone().json().catch(() => undefined)) as
    | { code?: unknown }
    | undefined;
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  if (
    detail?.code !== "EXPORT_BUSY" ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds < 1 ||
    retryAfterSeconds > MAX_BUSY_RETRY_AFTER_SECONDS
  ) {
    return response;
  }
  await waitImpl(retryAfterSeconds * 1_000 + 100, signal);
  return request();
}

export function monthlyArtifactAllowedOrigins(configuredStorageUrl: string) {
  const configured = new URL(configuredStorageUrl);
  const origins = new Set([configured.origin]);
  if (/^[a-z0-9-]+\.supabase\.(?:co|in|red)$/iu.test(configured.hostname)) {
    const dedicatedStorage = new URL(configured.origin);
    dedicatedStorage.hostname = configured.hostname.replace(
      ".supabase.",
      ".storage.supabase.",
    );
    origins.add(dedicatedStorage.origin);
  }
  return origins;
}

function isRetryableArtifactResponse(response: Response) {
  return (
    response.status === 404 ||
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  );
}

export async function fetchMonthlyArtifactBlob({
  url,
  configuredStorageUrl,
  signal,
  fetchImpl = fetch,
  retryDelaysMs = DEFAULT_ARTIFACT_RETRY_DELAYS_MS,
}: {
  url: string;
  configuredStorageUrl: string;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  retryDelaysMs?: readonly number[];
}) {
  const artifactUrl = new URL(url);
  if (
    artifactUrl.protocol !== "https:" ||
    !monthlyArtifactAllowedOrigins(configuredStorageUrl).has(artifactUrl.origin)
  ) {
    throw new Error("Monthly sheet server export returned invalid delivery.");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    signal?.throwIfAborted();
    let response: Response | undefined;
    try {
      response = await fetchImpl(artifactUrl, {
        cache: "no-store",
        credentials: "omit",
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw abortError();
      lastError = error;
    }
    if (response) {
      const contentType = response.headers.get("content-type")?.split(";")[0];
      if (response.ok && contentType === "image/png") {
        try {
          const blob = await response.blob();
          if (blob.size) return blob;
          lastError = new Error("Monthly sheet artifact delivery was empty.");
        } catch (error) {
          if (signal?.aborted) throw abortError();
          lastError = error;
        }
      } else {
        lastError = new Error("Monthly sheet artifact delivery failed.");
        if (!isRetryableArtifactResponse(response)) throw lastError;
      }
    }

    const retryDelay = retryDelaysMs[attempt];
    if (retryDelay === undefined) break;
    await waitForRetry(retryDelay, signal);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Monthly sheet artifact delivery failed.");
}
