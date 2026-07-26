"use client";

import { useEffect, useRef, useState } from "react";

import { PauseIcon, PlayIcon } from "@/components/memory/memory-icons";
import { formatDuration } from "@/components/memory/voice-memo";
import type { MemoryVoiceMemo } from "@/data/memory-demo";

export type JournalVoiceNoteState = "review" | "saved" | "viewer";

type JournalVoiceNotePlayerProps = {
  voiceMemo: MemoryVoiceMemo;
  state?: JournalVoiceNoteState;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onRemove?: () => void;
  onSave?: () => void;
  disabled?: boolean;
  resolveUrl?: (
    memo: MemoryVoiceMemo,
    forceRefresh?: boolean,
  ) => Promise<string>;
};

export function JournalVoiceNotePlayer({
  voiceMemo,
  state = "viewer",
  activeId,
  onActiveChange,
  onRemove,
  onSave,
  disabled = false,
  resolveUrl,
}: JournalVoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingPlayRef = useRef(false);
  const refreshingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState(voiceMemo.objectUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  useEffect(() => {
    if (activeId !== voiceMemo.id && !audioRef.current?.paused) {
      audioRef.current?.pause();
    }
  }, [activeId, voiceMemo.id]);

  useEffect(() => {
    if (!resolvedUrl || !pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    void audio
      .play()
      .catch(() => {
        setPlaybackError("This voice note could not be played. Try again.");
      })
      .finally(() => setIsLoading(false));
  }, [resolvedUrl]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    onActiveChange(voiceMemo.id);
    setPlaybackError("");
    if (!resolvedUrl && resolveUrl) {
      setIsLoading(true);
      try {
        pendingPlayRef.current = true;
        setResolvedUrl(await resolveUrl(voiceMemo));
      } catch {
        pendingPlayRef.current = false;
        setIsLoading(false);
        setPlaybackError("This voice note could not be loaded. Try again.");
      }
      return;
    }

    await audio.play().catch(() => {
      setPlaybackError("This voice note could not be played. Try again.");
    });
  };

  const progress =
    voiceMemo.durationSeconds > 0
      ? Math.min(100, (elapsed / voiceMemo.durationSeconds) * 100)
      : 0;

  return (
    <article className="journal-voice-note-card" aria-label="Voice note">
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          if (activeId === voiceMemo.id) onActiveChange(null);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setElapsed(0);
          onActiveChange(null);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onError={() => {
          if (!resolveUrl || refreshingRef.current) return;
          refreshingRef.current = true;
          setIsLoading(true);
          pendingPlayRef.current = true;
          void resolveUrl(voiceMemo, true)
            .then((url) => setResolvedUrl(url))
            .catch(() => {
              pendingPlayRef.current = false;
              setPlaybackError(
                "This voice note could not be refreshed. Try again.",
              );
            })
            .finally(() => {
              refreshingRef.current = false;
              setIsLoading(false);
            });
        }}
      />

      <div className="journal-voice-note-card__player">
        <button
          type="button"
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
          onClick={() => void togglePlayback()}
          disabled={disabled || isLoading}
          className="journal-voice-note-card__play"
        >
          {isLoading ? (
            <span aria-hidden="true">…</span>
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <div className="journal-voice-note-card__track">
          <div
            className="journal-voice-note-waveform"
            data-playing={isPlaying ? "true" : "false"}
            aria-hidden="true"
          >
            {Array.from({ length: 28 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <span
            className="journal-voice-note-card__progress"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
          <span className="journal-voice-note-card__duration">
            {formatDuration(voiceMemo.durationSeconds)}
          </span>
        </div>
      </div>

      {playbackError ? (
        <p className="journal-voice-note-card__error" role="alert">
          {playbackError}
        </p>
      ) : null}

      {state === "review" ? (
        <div className="journal-voice-note-card__actions">
          <button type="button" onClick={onRemove} disabled={disabled}>
            Remove
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="journal-voice-note-card__save"
          >
            Save
          </button>
        </div>
      ) : state === "saved" ? (
        <div className="journal-voice-note-card__saved">
          <span>
            <span aria-hidden="true">✓</span> Saved
          </span>
          <button type="button" onClick={onRemove} disabled={disabled}>
            Remove
          </button>
        </div>
      ) : null}
    </article>
  );
}
