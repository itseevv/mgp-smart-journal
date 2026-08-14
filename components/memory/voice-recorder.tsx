"use client";

import { useEffect, useRef, useState } from "react";

import {
  MicrophoneIcon,
  PlusIcon,
  StopIcon,
} from "@/components/memory/memory-icons";
import { JournalVoiceNotePlayer } from "@/components/memory/journal-voice-note-player";
import {
  formatDuration,
  VoiceMemoCard,
} from "@/components/memory/voice-memo";
import {
  fallbackVoiceMemoTitle,
  totalVoiceDuration,
  type MemoryMediaConfig,
  type MemoryVoiceMemo,
} from "@/data/memory-demo";
import { JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND } from "@/data/journal-product";
import { measureRecordingElapsed } from "@/data/journal";

export type RecorderStatus =
  | "idle"
  | "requestingPermission"
  | "recording"
  | "processing"
  | "ready"
  | "permissionDenied"
  | "unsupported"
  | "error";

type VoiceRecorderProps = {
  config: MemoryMediaConfig;
  voiceMemos: MemoryVoiceMemo[];
  onChange: (voiceMemos: MemoryVoiceMemo[]) => void;
  registerObjectUrl: (url: string) => void;
  onRecordingChange: (isBusy: boolean) => void;
  resolveVoiceMemoUrl?: (
    memo: MemoryVoiceMemo,
    forceRefresh?: boolean,
  ) => Promise<string>;
  journalMode?: boolean;
  onConfirmationChange?: (confirmed: boolean) => void;
};

const PERMISSION_TIMEOUT_MS = 12000;
const MEDIA_DURATION_TIMEOUT_MS = 5000;
// Ask MediaRecorder to stop just before the product boundary. Browsers may
// deliver the timer late or add a small amount of container/encoder padding,
// so attachment accepts at most one additional second and stores 300 max.
const RECORDING_AUTO_STOP_LEAD_SECONDS = 0.25;
const RECORDING_DURATION_GRACE_SECONDS = 1;

function monotonicNow() {
  return performance.now();
}

async function readBlobMediaDurationSeconds(blob: Blob) {
  if (typeof Audio === "undefined") return undefined;
  const objectUrl = URL.createObjectURL(blob);
  return new Promise<number | undefined>((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (duration?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      resolve(
        duration !== undefined && Number.isFinite(duration) && duration > 0
          ? duration
          : undefined,
      );
    };
    const timeout = window.setTimeout(
      () => finish(),
      MEDIA_DURATION_TIMEOUT_MS,
    );
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish();
    audio.src = objectUrl;
    audio.load();
  });
}

function preferredMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function createMediaRecorder(stream: MediaStream, mimeType?: string) {
  const mimeOptions = mimeType ? { mimeType } : {};
  try {
    return new MediaRecorder(stream, {
      ...mimeOptions,
      audioBitsPerSecond: JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND,
    });
  } catch {
    // Older Safari versions may reject the bitrate option. Keep audio/mp4
    // recording available; the byte ceiling below remains authoritative.
    return new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
  }
}

export function getAvailableRecordingSeconds(
  config: MemoryMediaConfig,
  voiceMemos: MemoryVoiceMemo[],
  replacementId?: string,
) {
  const replacement = voiceMemos.find(
    (voiceMemo) => voiceMemo.id === replacementId,
  );
  return Math.max(
    0,
    config.maxTotalVoiceDurationSeconds -
      totalVoiceDuration(voiceMemos) +
      (replacement?.durationSeconds ?? 0),
  );
}

export function VoiceRecorder({
  config,
  voiceMemos,
  onChange,
  registerObjectUrl,
  onRecordingChange,
  resolveVoiceMemoUrl,
  journalMode = false,
  onConfirmationChange,
}: VoiceRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestTokenRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const disposedRef = useRef(false);
  const replacementIdRef = useRef<string | undefined>(undefined);
  const recordingLimitRef = useRef(0);
  const recordingFailedRef = useRef(false);
  const recordedBytesRef = useRef(0);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [retryReplacementId, setRetryReplacementId] = useState<
    string | undefined
  >(undefined);
  const [recordingLimit, setRecordingLimit] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [journalOpen, setJournalOpen] = useState(voiceMemos.length > 0);
  const [journalNoteConfirmed, setJournalNoteConfirmed] = useState(true);

  const totalUsed = totalVoiceDuration(voiceMemos);
  const remaining = Math.max(
    0,
    config.maxTotalVoiceDurationSeconds - totalUsed,
  );
  const isBusy = status === "recording" || status === "processing";

  useEffect(() => {
    onRecordingChange(isBusy);
  }, [isBusy, onRecordingChange]);

  useEffect(() => {
    if (!journalMode) return;
    onConfirmationChange?.(journalNoteConfirmed);
  }, [journalMode, journalNoteConfirmed, onConfirmationChange]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const clearPermissionTimer = () => {
    if (permissionTimerRef.current) clearTimeout(permissionTimerRef.current);
    permissionTimerRef.current = null;
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      setStatus("processing");
      recorder.stop();
    }
  };

  const cancelPermissionRequest = () => {
    requestTokenRef.current += 1;
    clearPermissionTimer();
    setStatus("idle");
    setStatusMessage("");
    if (journalMode && voiceMemos.length === 0) {
      setJournalNoteConfirmed(true);
    }
  };

  useEffect(() => {
    disposedRef.current = false;

    return () => {
      disposedRef.current = true;
      requestTokenRef.current += 1;
      clearTimer();
      clearPermissionTimer();
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      recorderRef.current = null;
      stopTracks();
    };
  }, []);

  const startRecording = async (replacementId?: string) => {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("unsupported");
      setRetryReplacementId(replacementId);
      if (journalMode && voiceMemos.length === 0) {
        setJournalNoteConfirmed(true);
      }
      return;
    }

    const availableSeconds = getAvailableRecordingSeconds(
      config,
      voiceMemos,
      replacementId,
    );
    if (availableSeconds <= 0) {
      setStatus("ready");
      setStatusMessage("The five-minute voice memo limit has been reached.");
      return;
    }

    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    replacementIdRef.current = replacementId;
    setRetryReplacementId(replacementId);
    setActiveMemoId(null);
    setStatusMessage("");
    setStatus("requestingPermission");
    if (journalMode) {
      setJournalOpen(true);
      setJournalNoteConfirmed(false);
    }
    clearPermissionTimer();
    permissionTimerRef.current = setTimeout(() => {
      if (requestTokenRef.current !== requestToken) return;
      requestTokenRef.current += 1;
      setStatus("error");
      setStatusMessage(
        "The microphone did not respond. Check your browser permission and try again.",
      );
    }, PERMISSION_TIMEOUT_MS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      clearPermissionTimer();
      if (
        disposedRef.current ||
        requestTokenRef.current !== requestToken
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      recordingFailedRef.current = false;
      recordedBytesRef.current = 0;
      recordingStartedAtRef.current = 0;
      recordingLimitRef.current = availableSeconds;
      setRecordingLimit(availableSeconds);
      setElapsedSeconds(0);

      const mimeType = preferredMimeType();
      const recorder = createMediaRecorder(stream, mimeType);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size <= 0) return;
        chunksRef.current.push(event.data);
        recordedBytesRef.current += event.data.size;
        if (
          recordedBytesRef.current > config.maxVoiceMemoFileSizeBytes &&
          recorder.state === "recording"
        ) {
          stopRecording();
        }
      };
      recorder.onerror = () => {
        recordingFailedRef.current = true;
        clearTimer();
        stopTracks();
        recorderRef.current = null;
        setStatus("error");
        setStatusMessage(
          "The recording could not be completed. Your existing voice memos are unchanged.",
        );
        if (journalMode && voiceMemos.length === 0) {
          setJournalNoteConfirmed(true);
        }
      };
      recorder.onstop = async () => {
        clearTimer();
        stopTracks();
        if (disposedRef.current) return;
        if (recordingFailedRef.current) {
          recorderRef.current = null;
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        recorderRef.current = null;
        if (blob.size === 0) {
          setStatus("error");
          setStatusMessage(
            "No audio was captured. Your existing voice memos are unchanged.",
          );
          if (journalMode && voiceMemos.length === 0) {
            setJournalNoteConfirmed(true);
          }
          return;
        }
        if (blob.size > config.maxVoiceMemoFileSizeBytes) {
          setStatus("error");
          setStatusMessage(
            `This recording is larger than ${Math.floor(config.maxVoiceMemoFileSizeBytes / (1024 * 1024))} MiB and was not attached. Your existing voice memo is unchanged.`,
          );
          if (journalMode && voiceMemos.length === 0) {
            setJournalNoteConfirmed(true);
          }
          return;
        }

        const monotonicElapsed = measureRecordingElapsed(
          recordingStartedAtRef.current,
          monotonicNow(),
          recordingLimitRef.current,
        );
        const mediaDurationSeconds =
          await readBlobMediaDurationSeconds(blob);
        if (disposedRef.current) return;
        const observedDurationSeconds =
          mediaDurationSeconds ?? monotonicElapsed.actualSeconds;
        if (
          observedDurationSeconds >
          recordingLimitRef.current + RECORDING_DURATION_GRACE_SECONDS
        ) {
          setStatus("error");
          setStatusMessage(
            "This recording exceeds the five-minute limit and was not attached. Your existing voice memo is unchanged.",
          );
          if (journalMode && voiceMemos.length === 0) {
            setJournalNoteConfirmed(true);
          }
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        registerObjectUrl(objectUrl);
        const durationSeconds = Math.max(
          1,
          Math.min(
            recordingLimitRef.current,
            Math.ceil(observedDurationSeconds),
          ),
        );
        const replacementId = replacementIdRef.current;
        let nextVoiceMemos: MemoryVoiceMemo[];

        if (replacementId) {
          nextVoiceMemos = voiceMemos.map((voiceMemo) =>
            voiceMemo.id === replacementId
              ? {
                  ...voiceMemo,
                  blob,
                  objectUrl,
                  durationSeconds,
                  mimeType: blob.type,
                  sizeBytes: blob.size,
                  previousStoragePath:
                    voiceMemo.previousStoragePath ?? voiceMemo.storagePath,
                  storagePath: undefined,
                  createdAt: new Date().toISOString(),
                  status: "replacement",
                  error: undefined,
                }
              : voiceMemo,
          );
        } else {
          const order = voiceMemos.length;
          nextVoiceMemos = [
            ...voiceMemos,
            {
              id: crypto.randomUUID(),
              title: fallbackVoiceMemoTitle(order),
              blob,
              objectUrl,
              durationSeconds,
              mimeType: blob.type,
              sizeBytes: blob.size,
              createdAt: new Date().toISOString(),
              order,
              status: "new",
            },
          ];
        }

        onChange(
          nextVoiceMemos.map((voiceMemo, index) => ({
            ...voiceMemo,
            order: index,
          })),
        );
        replacementIdRef.current = undefined;
        setRetryReplacementId(undefined);
        setStatus("ready");
        if (journalMode) {
          setJournalNoteConfirmed(false);
          setStatusMessage("");
        } else {
          setStatusMessage(
            durationSeconds >= recordingLimitRef.current
              ? "Recording saved. The available voice memo time has been used."
              : "Recording saved.",
          );
        }
      };

      recordingStartedAtRef.current = monotonicNow();
      recorder.start(250);
      setStatus("recording");
      timerRef.current = setInterval(() => {
        const elapsed = measureRecordingElapsed(
          recordingStartedAtRef.current,
          monotonicNow(),
          recordingLimitRef.current,
        );
        setElapsedSeconds(elapsed.displaySeconds);
        if (
          elapsed.actualSeconds >=
          Math.max(
            0,
            recordingLimitRef.current - RECORDING_AUTO_STOP_LEAD_SECONDS,
          )
        ) {
          stopRecording();
        }
      }, 250);
    } catch (error) {
      clearPermissionTimer();
      stopTracks();
      if (
        disposedRef.current ||
        requestTokenRef.current !== requestToken
      ) {
        return;
      }
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError")
      ) {
        setStatus("permissionDenied");
        setStatusMessage(
          "Microphone access was not allowed. You can retry after changing your browser permission.",
        );
      } else {
        setStatus("error");
        setStatusMessage(
          "The microphone could not be started. Your existing voice memos are unchanged.",
        );
      }
      if (journalMode && voiceMemos.length === 0) {
        setJournalNoteConfirmed(true);
      }
    }
  };

  const normalizeTitles = (nextVoiceMemos: MemoryVoiceMemo[]) =>
    nextVoiceMemos.map((voiceMemo, index) => ({
      ...voiceMemo,
      title:
        voiceMemo.title.trim() || fallbackVoiceMemoTitle(index),
      order: index,
    }));

  const recordingRemaining = Math.max(
    0,
    recordingLimit - elapsedSeconds,
  );
  const journalMemo = voiceMemos[0];
  const journalProgress =
    recordingLimit > 0
      ? Math.min(100, (elapsedSeconds / recordingLimit) * 100)
      : 0;

  if (journalMode) {
    const journalMediaBusy =
      status === "requestingPermission" ||
      status === "recording" ||
      status === "processing";
    const journalDisclosureBusy =
      journalMediaBusy || !journalNoteConfirmed;
    const removeJournalNote = () => {
      onChange([]);
      setJournalNoteConfirmed(true);
      setStatus("idle");
      setStatusMessage("");
      setActiveMemoId(null);
    };

    return (
      <section
        className="journal-voice-note-field"
        aria-labelledby="journal-voice-note-title"
      >
        <button
          type="button"
          className="journal-voice-note-disclosure"
          aria-expanded={journalOpen}
          aria-controls="journal-voice-note-panel"
          disabled={journalDisclosureBusy}
          onClick={() => setJournalOpen((open) => !open)}
        >
          <span className="journal-voice-note-disclosure__label">
            <span id="journal-voice-note-title">A whisper from today</span>
            <small>Optional</small>
          </span>
          <PlusIcon
            className={`h-4 w-4 text-oxblood transition-transform ${
              journalOpen ? "rotate-45" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {journalOpen ? (
          <div
            id="journal-voice-note-panel"
            className="journal-voice-note-panel"
          >
            <p className="journal-voice-note-intro">
              Let today linger in your voice before it is sealed.
            </p>

            {status === "requestingPermission" ? (
              <div className="journal-voice-note-status" role="status">
                <span>Waiting for microphone…</span>
                <button type="button" onClick={cancelPermissionRequest}>
                  Cancel
                </button>
              </div>
            ) : status === "recording" ? (
              <div className="journal-voice-note-recording" role="status">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="journal-voice-note-recording__stop"
                  aria-label="Stop recording"
                >
                  <StopIcon />
                </button>
                <div className="journal-voice-note-recording__track">
                  <div
                    className="journal-voice-note-waveform"
                    data-recording="true"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 28 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </div>
                  <span
                    className="journal-voice-note-recording__progress"
                    style={{ width: `${journalProgress}%` }}
                    aria-hidden="true"
                  />
                  <span className="journal-voice-note-recording__times">
                    <span>{formatDuration(elapsedSeconds)}</span>
                    <span>{formatDuration(config.maxTotalVoiceDurationSeconds)}</span>
                  </span>
                </div>
              </div>
            ) : status === "processing" ? (
              <div className="journal-voice-note-status" role="status">
                Saving recording…
              </div>
            ) : journalMemo ? (
              <JournalVoiceNotePlayer
                voiceMemo={journalMemo}
                state={journalNoteConfirmed ? "saved" : "review"}
                activeId={activeMemoId}
                onActiveChange={setActiveMemoId}
                onRemove={removeJournalNote}
                onSave={() => {
                  setJournalNoteConfirmed(true);
                  setStatusMessage("");
                }}
                disabled={journalMediaBusy}
                resolveUrl={resolveVoiceMemoUrl}
              />
            ) : status === "permissionDenied" || status === "error" ? null
            : status === "unsupported" ? (
              <p className="journal-voice-note-error" role="alert">
                Voice recording is not supported in this browser.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="journal-voice-note-record"
                aria-label="Record a voice note"
              >
                <span className="journal-voice-note-record__icon">
                  <MicrophoneIcon />
                </span>
                <span className="journal-voice-note-record__track">
                  <span
                    className="journal-voice-note-waveform"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 28 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </span>
                  <span className="journal-voice-note-record__times">
                    <span>0:00</span>
                    <span>
                      {formatDuration(config.maxTotalVoiceDurationSeconds)}
                    </span>
                  </span>
                </span>
              </button>
            )}

            {statusMessage ? (
              <p
                className="journal-voice-note-error"
                role={
                  status === "permissionDenied" || status === "error"
                    ? "alert"
                    : "status"
                }
              >
                {statusMessage}
              </p>
            ) : null}

            {status === "permissionDenied" || status === "error" ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="journal-voice-note-retry"
              >
                Retry microphone
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="voice-recorder-title"
      className="border-t border-rule pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="voice-recorder-title" className="font-sans text-sm font-semibold">
          {voiceMemos.length === 1 ? "Voice memo" : "Voice memos"}
        </h2>
        <span className="font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-soft">
          Optional
        </span>
      </div>
      <div className="mt-2 flex justify-between gap-4 font-sans text-xs text-ink-soft">
        <span>
          {formatDuration(totalUsed)} of{" "}
          {formatDuration(config.maxTotalVoiceDurationSeconds)} used
        </span>
        <span>{formatDuration(remaining)} remaining</span>
      </div>

      {voiceMemos.length > 0 ? (
        <div className="mt-4 space-y-3">
          {voiceMemos.map((voiceMemo) => (
            <VoiceMemoCard
              key={`${voiceMemo.id}-${voiceMemo.objectUrl}`}
              voiceMemo={voiceMemo}
              activeId={activeMemoId}
              onActiveChange={setActiveMemoId}
              resolveUrl={resolveVoiceMemoUrl}
              editable
              disabled={
                status === "requestingPermission" ||
                status === "recording" ||
                status === "processing"
              }
              onTitleChange={(title) =>
                onChange(
                  voiceMemos.map((candidate) =>
                    candidate.id === voiceMemo.id
                      ? { ...candidate, title }
                      : candidate,
                  ),
                )
              }
              onReplace={() => startRecording(voiceMemo.id)}
              onDelete={() =>
                onChange(
                  normalizeTitles(
                    voiceMemos.filter(
                      (candidate) => candidate.id !== voiceMemo.id,
                    ),
                  ),
                )
              }
            />
          ))}
        </div>
      ) : null}

      {status === "requestingPermission" ? (
        <div className="mt-4 rounded-sm border border-rule bg-paper-deep/35 p-4">
          <p className="font-sans text-sm font-semibold">
            Waiting for microphone…
          </p>
          <button
            type="button"
            onClick={cancelPermissionRequest}
            className="mt-3 font-sans text-xs font-semibold text-oxblood underline decoration-oxblood/30 underline-offset-4"
          >
            Cancel request
          </button>
        </div>
      ) : status === "recording" ? (
        <div className="mt-4 rounded-sm border border-oxblood/30 bg-paper-deep/35 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm font-semibold text-oxblood">
                Recording
              </p>
              <p className="mt-1 font-sans text-2xl tabular-nums">
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-oxblood text-paper"
              aria-label="Stop recording"
            >
              <StopIcon />
            </button>
          </div>
          <p
            className="mt-3 min-h-5 font-sans text-xs font-semibold text-oxblood"
            role="status"
          >
            {recordingRemaining <= 10
              ? `Recording will stop in ${recordingRemaining} ${recordingRemaining === 1 ? "second" : "seconds"}`
              : `${formatDuration(recordingRemaining)} available for this recording`}
          </p>
        </div>
      ) : status === "processing" ? (
        <p
          className="mt-4 rounded-sm border border-rule bg-paper-deep/35 p-4 font-sans text-sm font-semibold"
          role="status"
        >
          Saving recording…
        </p>
      ) : status === "idle" || status === "ready" ? (
        <button
          type="button"
          onClick={() => startRecording()}
          disabled={remaining <= 0}
          aria-describedby={remaining <= 0 ? "voice-limit-message" : undefined}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-sm bg-oxblood px-5 py-4 font-sans text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:bg-ink-soft/45"
        >
          <MicrophoneIcon />
          {voiceMemos.length === 0
            ? "Record a voice memo"
            : "Record another"}
        </button>
      ) : null}

      {remaining <= 0 ? (
        <p
          id="voice-limit-message"
          className="mt-3 font-sans text-xs leading-relaxed text-ink-soft"
          role="status"
        >
          The five-minute total voice memo limit has been reached. Delete or
          replace a memo to make time available.
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className={`mt-3 font-sans text-xs leading-relaxed ${
            status === "permissionDenied" || status === "error"
              ? "text-oxblood"
              : "text-ink-soft"
          }`}
          role={status === "permissionDenied" || status === "error" ? "alert" : "status"}
        >
          {statusMessage}
        </p>
      ) : null}

      {status === "permissionDenied" || status === "error" ? (
        <button
          type="button"
          onClick={() => startRecording(retryReplacementId)}
          className="mt-3 font-sans text-xs font-semibold text-oxblood underline decoration-oxblood/30 underline-offset-4"
        >
          Retry microphone
        </button>
      ) : null}

      {status === "unsupported" ? (
        <p className="mt-3 font-sans text-xs leading-relaxed text-oxblood" role="alert">
          Voice recording is not supported in this browser. You can still save
          the memory with photographs.
        </p>
      ) : null}
    </section>
  );
}
