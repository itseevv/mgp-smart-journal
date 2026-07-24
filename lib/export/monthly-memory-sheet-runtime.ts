export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  message = "Monthly export operation timed out.",
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(message);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number,
  message = "Monthly export operation timed out.",
  parentSignal?: AbortSignal,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(message);
  }

  const controller = new AbortController();
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason ?? new Error(message)),
      { once: true },
    );
  });
  const abortFromParent = () =>
    controller.abort(
      parentSignal?.reason ??
        new DOMException("Monthly export aborted.", "AbortError"),
    );
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error(message)),
    timeoutMs,
  );
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      aborted,
    ]);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Monthly export concurrency must be a positive integer.");
  }
  if (!values.length) return [];

  const output = new Array<Output>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        output[index] = await mapper(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return output;
}

export function createConcurrencyLimiter(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Monthly export concurrency must be a positive integer.");
  }
  let active = 0;
  const queue: Array<() => void> = [];
  const drain = () => {
    while (active < concurrency && queue.length) {
      active += 1;
      queue.shift()?.();
    }
  };

  return async function runLimited<T>(
    operation: () => Promise<T>,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      drain();
    });
    try {
      signal?.throwIfAborted();
      return await operation();
    } finally {
      active -= 1;
      drain();
    }
  };
}

export function remainingDeadlineMs(
  deadline: number,
  operationLimitMs: number,
) {
  return Math.max(0, Math.min(operationLimitMs, deadline - Date.now()));
}
