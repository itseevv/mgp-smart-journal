export type MonthlyExportGeneration = {
  id: number;
  signal: AbortSignal;
};

export function createMonthlyExportGenerationGate() {
  let generation = 0;
  let controller: AbortController | undefined;

  return {
    begin(): MonthlyExportGeneration {
      controller?.abort();
      controller = new AbortController();
      generation += 1;
      return { id: generation, signal: controller.signal };
    },
    cancel() {
      generation += 1;
      controller?.abort();
      controller = undefined;
    },
    isCurrent(candidate: MonthlyExportGeneration) {
      return (
        candidate.id === generation &&
        controller?.signal === candidate.signal &&
        !candidate.signal.aborted
      );
    },
    finish(candidate: MonthlyExportGeneration) {
      if (
        candidate.id === generation &&
        controller?.signal === candidate.signal
      ) {
        controller = undefined;
      }
    },
  };
}
