export const CAPSULE_OPEN_TIMEOUT_MS = 12_000;
export const CAPSULE_OPEN_RETRY_DELAY_MS = 300;

export type CapsuleOpenStage = "auth" | "inspect";

export class CapsuleOpenError extends Error {
  code:
    | "AUTH_FAILED"
    | "AUTH_TIMEOUT"
    | "INSPECT_FAILED"
    | "INSPECT_TIMEOUT"
    | "NETWORK_OR_CORS";
  stage: CapsuleOpenStage;
  httpStatus?: number;
  retryable: boolean;

  constructor(
    code: CapsuleOpenError["code"],
    stage: CapsuleOpenStage,
    message: string,
    options: { httpStatus?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "CapsuleOpenError";
    this.code = code;
    this.stage = stage;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createError: () => Error,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(createError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function mapCapsuleAccessInvokeError(error: unknown) {
  const name =
    typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  const context =
    typeof error === "object" && error && "context" in error
      ? error.context
      : undefined;
  const httpStatus =
    typeof context === "object" &&
    context &&
    "status" in context &&
    typeof context.status === "number"
      ? context.status
      : undefined;

  if (name === "FunctionsFetchError") {
    return new CapsuleOpenError(
      "NETWORK_OR_CORS",
      "inspect",
      "The capsule could not be opened from this connection. Check the link, network, or origin configuration and retry.",
      { retryable: true },
    );
  }

  if (name === "FunctionsHttpError" || name === "FunctionsRelayError") {
    const retryable =
      name === "FunctionsRelayError" ||
      httpStatus === undefined ||
      httpStatus === 401 ||
      httpStatus === 408 ||
      httpStatus === 425 ||
      httpStatus === 429 ||
      httpStatus >= 500;
    return new CapsuleOpenError(
      "INSPECT_FAILED",
      "inspect",
      "The capsule service returned an unexpected response. Please retry.",
      { httpStatus, retryable },
    );
  }

  if (message) {
    return new CapsuleOpenError("INSPECT_FAILED", "inspect", message);
  }

  return new CapsuleOpenError(
    "INSPECT_FAILED",
    "inspect",
    "The capsule could not be opened. Please retry.",
  );
}

export function isRetryableCapsuleOpenError(error: unknown) {
  return error instanceof CapsuleOpenError && error.retryable;
}

export async function withCapsuleOpenRetry<T>(
  operation: (remainingMs: number) => Promise<T>,
  {
    timeoutMs,
    maxAttempts = 2,
    retryDelayMs = CAPSULE_OPEN_RETRY_DELAY_MS,
  }: {
    timeoutMs: number;
    maxAttempts?: number;
    retryDelayMs?: number;
  },
) {
  const startedAt = Date.now();
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const remainingMs = Math.max(timeoutMs - (Date.now() - startedAt), 1);
    try {
      return await operation(remainingMs);
    } catch (error) {
      const budgetAfterAttempt = timeoutMs - (Date.now() - startedAt);
      if (
        attempt >= attempts ||
        !isRetryableCapsuleOpenError(error) ||
        budgetAfterAttempt <= retryDelayMs
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error("Capsule open retry loop ended unexpectedly.");
}

export function logCapsuleOpenDiagnostic(input: {
  stage: CapsuleOpenStage;
  code: string;
  origin?: string;
  message: string;
  memoryRoute: boolean;
}) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[capsule-open]", {
    stage: input.stage,
    code: input.code,
    origin: input.origin,
    memoryRoute: input.memoryRoute,
    message: input.message,
  });
}
