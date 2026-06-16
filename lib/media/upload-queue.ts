export type UploadQueueResult<T> = {
  completed: T[];
  failed: Array<{ item: T; error: unknown }>;
  maximumActiveCount: number;
};

export async function runUploadQueue<T>(
  items: T[],
  concurrency: number,
  upload: (item: T) => Promise<void>,
): Promise<UploadQueueResult<T>> {
  const completed: T[] = [];
  const failed: Array<{ item: T; error: unknown }> = [];
  let cursor = 0;
  let active = 0;
  let maximumActiveCount = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      active += 1;
      maximumActiveCount = Math.max(maximumActiveCount, active);
      try {
        await upload(item);
        completed.push(item);
      } catch (error) {
        failed.push({ item, error });
      } finally {
        active -= 1;
      }
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    Math.max(1, items.length),
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { completed, failed, maximumActiveCount };
}
