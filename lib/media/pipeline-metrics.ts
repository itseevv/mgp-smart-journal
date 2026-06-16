export type MediaPipelineMetrics = {
  sourceBytes: number;
  preparationDurationMs: number;
  optimisedBytes: number;
  uploadDurationMs: number;
  metadataSaveDurationMs: number;
  maximumActiveUploadCount: number;
  uploadedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  individualUploads: Array<{
    kind: "photo" | "voice";
    durationMs: number;
    sizeBytes: number;
    method: "standard" | "tus";
    succeeded: boolean;
  }>;
};

export function createMediaPipelineMetrics(): MediaPipelineMetrics {
  return {
    sourceBytes: 0,
    preparationDurationMs: 0,
    optimisedBytes: 0,
    uploadDurationMs: 0,
    metadataSaveDurationMs: 0,
    maximumActiveUploadCount: 0,
    uploadedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    individualUploads: [],
  };
}

export function reportMediaPipelineMetrics(metrics: MediaPipelineMetrics) {
  if (process.env.NODE_ENV === "production") return;
  // Deliberately limited to timings, counts, MIME-independent byte totals, and
  // upload methods. Never add paths, URLs, auth data, or media contents here.
  console.info("[media-pipeline]", metrics);
}
