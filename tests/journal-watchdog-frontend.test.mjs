import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  containedDialogFocusIndex,
  createRefreshRequestOrder,
  evictMissingMemoryCacheEntries,
  measureRecordingElapsed,
} from "../data/journal.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const applyOrderedRefresh = async (requestOrder, reason, request, applied) => {
  const capturedGeneration = requestOrder.begin(reason);
  try {
    const value = await request;
    if (!requestOrder.isCurrent(capturedGeneration)) return "stale";
    applied.push({ kind: "success", value });
    return "applied";
  } catch (error) {
    if (!requestOrder.isCurrent(capturedGeneration)) return "stale";
    applied.push({ kind: "error", error });
    return "applied";
  }
};

test("mobile Journal disclosure headings share the intended 0.875rem size", () => {
  const globals = readSource("app/globals.css");
  const photoPicker = readSource("components/memory/journal-photo-picker.tsx");

  assert.match(
    photoPicker,
    /className="[^"]*text-sm[^"]*"[\s\S]*<span>Add more moments<\/span>/,
  );
  assert.match(
    globals,
    /\.journal-voice-note-disclosure__label\s*\{[^}]*font-size:\s*0\.875rem;/,
  );
});

test("a missing specific memory evicts exact and matching default cache entries", () => {
  const cache = new Map([
    ["capsule:missing", { id: "missing" }],
    ["capsule:bookmark", { id: "missing" }],
    ["other:bookmark", { id: "other" }],
  ]);

  evictMissingMemoryCacheEntries(
    cache,
    "capsule:missing",
    "capsule:bookmark",
    "missing",
  );

  assert.equal(cache.has("capsule:missing"), false);
  assert.equal(cache.has("capsule:bookmark"), false);
  assert.deepEqual(cache.get("other:bookmark"), { id: "other" });

  const unrelatedDefault = new Map([
    ["capsule:missing", { id: "missing" }],
    ["capsule:bookmark", { id: "newer" }],
  ]);
  evictMissingMemoryCacheEntries(
    unrelatedDefault,
    "capsule:missing",
    "capsule:bookmark",
    "missing",
  );
  assert.deepEqual(unrelatedDefault.get("capsule:bookmark"), { id: "newer" });
});

test("Journal cached detail routes are remotely validated and stale saves fail closed", () => {
  const api = readSource("lib/capsule/api.ts");
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");

  assert.match(
    api,
    /if \(!result\.data\) \{[\s\S]*evictMissingMemoryCacheEntries\([\s\S]*memoryCacheKey\(capsuleId, memoryId\)[\s\S]*memoryCacheKey\(capsuleId\)/,
  );
  assert.match(
    flow,
    /requiresCachedJournalValidation =[\s\S]*isJournalMode && Boolean\(memoryId\) && !initialMemory/,
  );
  assert.match(
    flow,
    /cachedMemory && !requiresCachedJournalValidation \? "view" : "loading"/,
  );
  assert.match(
    flow,
    /cachedMemory && !requiresCachedJournalValidation[\s\S]*window\.setTimeout\(\(\) => void refresh\("initial"\), 0\)/,
  );
  assert.match(api, /readonly code\?: PersistentMemoryCommitCode/);
  assert.match(
    api,
    /new MediaSaveError\([\s\S]*uploaded\.uploadedPaths,[\s\S]*commitResult\?\.code/,
  );
  assert.match(
    flow,
    /error\.code === "MEMORY_NOT_FOUND"[\s\S]*setMode\("unavailable"\)[\s\S]*processMediaCleanup\([\s\S]*staleUploadPaths/,
  );
  assert.match(
    flow,
    /error\.code === "MEMORY_NOT_FOUND"[\s\S]*return;[\s\S]*setDraft\(withoutPersistenceFields\(error\.draft\)\)/,
  );
});

test("monotonic recording time jumps after a suspended timer", () => {
  assert.deepEqual(measureRecordingElapsed(1_000, 1_250, 300), {
    actualSeconds: 0.25,
    displaySeconds: 0,
    shouldStop: false,
  });
  assert.deepEqual(measureRecordingElapsed(1_000, 306_000, 300), {
    actualSeconds: 305,
    displaySeconds: 300,
    shouldStop: true,
  });
});

test("Voice Note attachment validates media duration and has no synthetic clock", () => {
  const recorder = readSource("components/memory/voice-recorder.tsx");

  assert.doesNotMatch(recorder, /elapsedMillisecondsRef|\+= 250/);
  assert.match(recorder, /recordingStartedAtRef\.current = monotonicNow\(\)/);
  assert.match(
    recorder,
    /measureRecordingElapsed\([\s\S]*monotonicNow\(\)[\s\S]*recordingLimitRef\.current - RECORDING_AUTO_STOP_LEAD_SECONDS/,
  );
  assert.match(recorder, /readBlobMediaDurationSeconds\(blob\)/);
  assert.match(recorder, /audio\.onloadedmetadata = \(\) => finish\(audio\.duration\)/);
  assert.match(
    recorder,
    /observedDurationSeconds >[\s\S]*recordingLimitRef\.current \+ RECORDING_DURATION_GRACE_SECONDS/,
  );
  assert.match(
    recorder,
    /Math\.min\([\s\S]*recordingLimitRef\.current,[\s\S]*Math\.ceil\(observedDurationSeconds\)/,
  );
  assert.match(recorder, /exceeds the five-minute limit and was not attached/);
});

test("initial validation errors offer retry while background errors retain verified UI", () => {
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");

  assert.match(
    flow,
    /const refresh = async \(reason: PersistentMemoryRefreshReason\)[\s\S]*try \{[\s\S]*loadPersistentMemory/,
  );
  assert.match(
    flow,
    /hasVerifiedRemoteStateRef\.current = true;[\s\S]*setMode\("view"\)/,
  );
  assert.match(
    flow,
    /catch \{[\s\S]*reason !== "background" \|\| !hasVerifiedRemoteStateRef\.current[\s\S]*setMode\("validationError"\)/,
  );
  assert.match(
    flow,
    /retryValidation[\s\S]*retryReason\(\)[\s\S]*setMode\("loading"\);[\s\S]*void refresh\(retryReason\)/,
  );
  assert.match(flow, /window\.setTimeout\(\(\) => void refresh\("initial"\), 0\)/);
  assert.match(flow, /window\.setInterval\([\s\S]*void refresh\("background"\)/);
  assert.match(flow, /This Memory Day could not be verified\./);
  assert.match(flow, />\s*Retry\s*</);
  assert.match(flow, />\s*Back to journal\s*</);
});

test("post-commit reload fails closed and can recover through validation retry", () => {
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");

  assert.match(
    flow,
    /const refresh = async \(reason: PersistentMemoryRefreshReason\)/,
  );
  assert.match(
    flow,
    /await savePersistentMemory\([\s\S]*setMode\("loading"\);[\s\S]*await refresh\("postMutation"\)/,
  );
  assert.match(
    flow,
    /reason === "postMutation" && !memory[\s\S]*setMode\("validationError"\)/,
  );
  assert.match(
    flow,
    /catch \{[\s\S]*reason !== "background"[\s\S]*setMode\("validationError"\)/,
  );
  assert.match(
    flow,
    /retryValidation[\s\S]*retryReason\(\)[\s\S]*setMode\("loading"\);[\s\S]*refresh\(retryReason\)/,
  );
  assert.match(flow, /if \(memory\)[\s\S]*setMode\("view"\)/);
  assert.doesNotMatch(
    flow,
    /await savePersistentMemory\([\s\S]*await refresh\("background"\)/,
  );
});

test("postMutation invalidates superseded refresh success and catch results", async () => {
  const requestOrder = createRefreshRequestOrder();
  const applied = [];

  const staleSuccess = deferred();
  const staleSuccessRun = applyOrderedRefresh(
    requestOrder,
    "background",
    staleSuccess.promise,
    applied,
  );
  const currentSuccess = deferred();
  const currentSuccessRun = applyOrderedRefresh(
    requestOrder,
    "postMutation",
    currentSuccess.promise,
    applied,
  );

  currentSuccess.resolve("server-saved-b");
  assert.equal(await currentSuccessRun, "applied");
  staleSuccess.resolve("pre-save-a");
  assert.equal(await staleSuccessRun, "stale");
  assert.deepEqual(applied, [
    { kind: "success", value: "server-saved-b" },
  ]);

  const staleCatch = deferred();
  const staleCatchRun = applyOrderedRefresh(
    requestOrder,
    "background",
    staleCatch.promise,
    applied,
  );
  const nextCurrentSuccess = deferred();
  const nextCurrentSuccessRun = applyOrderedRefresh(
    requestOrder,
    "postMutation",
    nextCurrentSuccess.promise,
    applied,
  );

  nextCurrentSuccess.resolve("server-saved-c");
  assert.equal(await nextCurrentSuccessRun, "applied");
  staleCatch.reject(new Error("late pre-save failure"));
  assert.equal(await staleCatchRun, "stale");
  assert.deepEqual(applied, [
    { kind: "success", value: "server-saved-b" },
    { kind: "success", value: "server-saved-c" },
  ]);
});

test("postMutation retry origin survives repeated missing and errors for both products", async () => {
  const attemptValidation = async (requestOrder, reason, request) => {
    const capturedGeneration = requestOrder.begin(reason);
    try {
      const memory = await request;
      if (!requestOrder.isCurrent(capturedGeneration)) return "stale";
      if (reason === "postMutation" && !memory) {
        requestOrder.rememberValidationError("postMutation");
        return "validationError";
      }
      return memory ? "view" : "missing";
    } catch {
      if (!requestOrder.isCurrent(capturedGeneration)) return "stale";
      requestOrder.rememberValidationError(
        reason === "postMutation" ? "postMutation" : "initial",
      );
      return "validationError";
    }
  };

  for (const productMode of ["journal", "bookmark"]) {
    const requestOrder = createRefreshRequestOrder();

    const missing = deferred();
    const missingAttempt = attemptValidation(
      requestOrder,
      "postMutation",
      missing.promise,
    );
    missing.resolve(null);
    assert.equal(await missingAttempt, "validationError", productMode);
    assert.equal(requestOrder.retryReason(), "postMutation", productMode);

    const failedRetry = deferred();
    const failedRetryAttempt = attemptValidation(
      requestOrder,
      requestOrder.retryReason(),
      failedRetry.promise,
    );
    failedRetry.reject(new Error(`${productMode} retry failed`));
    assert.equal(await failedRetryAttempt, "validationError", productMode);
    assert.equal(requestOrder.retryReason(), "postMutation", productMode);

    const missingRetry = deferred();
    const missingRetryAttempt = attemptValidation(
      requestOrder,
      requestOrder.retryReason(),
      missingRetry.promise,
    );
    missingRetry.resolve(null);
    assert.equal(await missingRetryAttempt, "validationError", productMode);
    assert.equal(requestOrder.retryReason(), "postMutation", productMode);

    const successfulRetry = deferred();
    const successfulRetryAttempt = attemptValidation(
      requestOrder,
      requestOrder.retryReason(),
      successfulRetry.promise,
    );
    successfulRetry.resolve({ id: `${productMode}-saved` });
    assert.equal(await successfulRetryAttempt, "view", productMode);
  }

  const initialOrder = createRefreshRequestOrder();
  const initialFailure = deferred();
  const initialAttempt = attemptValidation(
    initialOrder,
    "initial",
    initialFailure.promise,
  );
  initialFailure.reject(new Error("initial validation failed"));
  assert.equal(await initialAttempt, "validationError");
  assert.equal(initialOrder.retryReason(), "initial");
});

test("component guards every async refresh settlement before mutation", () => {
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");
  const refreshStart = flow.indexOf("const refresh = async");
  const refreshEnd = flow.indexOf("const retryValidation", refreshStart);
  const refresh = flow.slice(refreshStart, refreshEnd);
  const load = refresh.indexOf("await loadPersistentMemory");
  const successGuard = refresh.indexOf(
    "if (!requestOrder.isCurrent(capturedGeneration)) return;",
    load,
  );
  const firstSuccessMutation = refresh.indexOf(
    "hasVerifiedRemoteStateRef.current = true",
  );
  const catchStart = refresh.indexOf("} catch {");
  const catchGuard = refresh.indexOf(
    "if (!requestOrder.isCurrent(capturedGeneration)) return;",
    catchStart,
  );
  const firstCatchMutation = refresh.indexOf(
    "requestOrder.rememberValidationError(",
    catchStart,
  );

  assert.ok(load >= 0 && successGuard > load);
  assert.ok(firstSuccessMutation > successGuard);
  assert.ok(catchStart > successGuard && catchGuard > catchStart);
  assert.ok(firstCatchMutation > catchGuard);
  assert.match(
    refresh,
    /reason === "postMutation" && !memory[\s\S]*rememberValidationError\("postMutation"\)[\s\S]*setMode\("validationError"\)/,
  );
  assert.match(
    refresh,
    /else if \(memory\)[\s\S]*reason === "postMutation"[\s\S]*postMutationValidationPendingRef\.current = false/,
  );
  const missingBranch = refresh.slice(
    refresh.indexOf('if (reason === "postMutation" && !memory)'),
    refresh.indexOf("} else if (memory)"),
  );
  const catchBranch = refresh.slice(catchStart);
  assert.doesNotMatch(
    missingBranch,
    /postMutationValidationPendingRef\.current = false/,
  );
  assert.doesNotMatch(
    catchBranch,
    /postMutationValidationPendingRef\.current = false/,
  );
  assert.match(
    flow,
    /retryReason === "postMutation"[\s\S]*postMutationValidationPendingRef\.current = true[\s\S]*refresh\(retryReason\)/,
  );
  assert.match(
    refresh,
    /reason === "background" &&[\s\S]*postMutationValidationPendingRef\.current[\s\S]*return/,
  );
});

test("Journal home has no active completion panel or lifecycle branch", () => {
  const home = readSource("components/journal/journal-home.tsx");
  assert.doesNotMatch(home, /JournalVolumeLifecyclePanel|FULL_REVIEW|COMPLETED|Complete this volume/);
  assert.match(home, /ArchiveQuotaWarning/);
});

test("dialog focus index wraps for Tab and Shift+Tab", () => {
  assert.equal(containedDialogFocusIndex("Enter", false, 0, 2), undefined);
  assert.equal(containedDialogFocusIndex("Tab", false, 0, 2), 1);
  assert.equal(containedDialogFocusIndex("Tab", false, 1, 2), 0);
  assert.equal(containedDialogFocusIndex("Tab", true, 0, 2), 1);
  assert.equal(containedDialogFocusIndex("Tab", true, -1, 2), 1);
  assert.equal(containedDialogFocusIndex("Tab", false, -1, 0), -1);
});

test("permanent action dialogs expose modal focus and restoration behavior", () => {
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");

  assert.match(flow, /role="alertdialog"[\s\S]*aria-modal="true"/);
  assert.match(flow, /keepStampRef\.current\?\.focus\(\)/);
  assert.match(flow, /event\.key === "Escape"[\s\S]*deleteState === "deleting"/);
  assert.match(flow, /containedDialogFocusIndex\(/);
  assert.match(flow, /deleteTriggerRef\.current\?\.focus\(\)/);
  assert.match(flow, /deleteState === "confirming" \|\| deleteState === "deleting"/);

});

test("Journal QA source checks current month-sheet structure and route CTA", () => {
  const qa = readSource("scripts/qa-journal-route.mjs");
  const sourceAssertions = qa.slice(
    qa.indexOf("assert.match(monthlyStampSheetSource"),
    qa.indexOf("assert.match(monthSheetGridSource"),
  );

  assert.doesNotMatch(sourceAssertions, /Seal Today/);
  assert.match(sourceAssertions, /Back to this month/);
  assert.match(sourceAssertions, /MonthSheetGrid/);
  assert.match(sourceAssertions, /data-monthly-stamp-export-action/);
  assert.doesNotMatch(qa, /Seal Today/);
  assert.match(qa, /assert\.match\(journalHomeText, \/Seal the Day\//);
});
