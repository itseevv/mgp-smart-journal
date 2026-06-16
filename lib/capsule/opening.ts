export const CAPSULE_OPEN_TIMEOUT_MS = 12_000;

export type CapsuleOpenStage = "auth" | "inspect";

export class CapsuleOpenError extends Error {
  code:
    | "AUTH_FAILED"
    | "AUTH_TIMEOUT"
    | "INSPECT_FAILED"
    | "INSPECT_TIMEOUT"
    | "NETWORK_OR_CORS";
  stage: CapsuleOpenStage;

  constructor(
    code: CapsuleOpenError["code"],
    stage: CapsuleOpenStage,
    message: string,
  ) {
    super(message);
    this.name = "CapsuleOpenError";
    this.code = code;
    this.stage = stage;
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

  if (name === "FunctionsFetchError") {
    return new CapsuleOpenError(
      "NETWORK_OR_CORS",
      "inspect",
      "The capsule could not be opened from this connection. Check the link, network, or origin configuration and retry.",
    );
  }

  if (name === "FunctionsHttpError") {
    return new CapsuleOpenError(
      "INSPECT_FAILED",
      "inspect",
      "The capsule service returned an unexpected response. Please retry.",
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
