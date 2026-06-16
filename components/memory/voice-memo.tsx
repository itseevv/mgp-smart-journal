"use client";

import { useEffect, useRef, useState } from "react";

import { PauseIcon, PlayIcon } from "@/components/memory/memory-icons";
import {
  fallbackVoiceMemoTitle,
  type MemoryVoiceMemo,
} from "@/data/memory-demo";

export function formatDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

type VoiceMemoCardProps = {
  voiceMemo: MemoryVoiceMemo;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  editable?: boolean;
  onTitleChange?: (title: string) => void;
  onDelete?: () => void;
  onReplace?: () => void;
  disabled?: boolean;
  resolveUrl?: (
    memo: MemoryVoiceMemo,
    forceRefresh?: boolean,
  ) => Promise<string>;
};

export function VoiceMemoCard({
  voiceMemo,
  activeId,
  onActiveChange,
  editable = false,
  onTitleChange,
  onDelete,
  onReplace,
  disabled = false,
  resolveUrl,
}: VoiceMemoCardProps) {
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
    void audio.play().catch(() => {
      setPlaybackError("This voice memo could not be played. Try again.");
    }).finally(() => setIsLoading(false));
  }, [resolvedUrl]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
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
          setPlaybackError("This voice memo could not be loaded. Try again.");
        }
        return;
      }
      await audio.play().catch(() => {
        setPlaybackError("This voice memo could not be played. Try again.");
      });
    } else {
      audio.pause();
    }
  };

  const progress =
    voiceMemo.durationSeconds > 0
      ? Math.min(100, (elapsed / voiceMemo.durationSeconds) * 100)
      : 0;
  const titleId = `voice-memo-title-${voiceMemo.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-sm border border-rule bg-paper-deep/35 p-4"
    >
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
              setPlaybackError("This voice memo could not be refreshed. Try again.");
            })
            .finally(() => {
              refreshingRef.current = false;
              setIsLoading(false);
            });
        }}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`${isPlaying ? "Pause" : "Play"} ${voiceMemo.title}`}
          onClick={togglePlayback}
          disabled={disabled || isLoading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-oxblood text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isLoading ? (
            <span className="text-[0.6rem] font-semibold">...</span>
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            {editable ? (
              <input
                id={titleId}
                aria-label={`Title for voice memo ${voiceMemo.order + 1}`}
                value={voiceMemo.title}
                disabled={disabled}
                onChange={(event) => onTitleChange?.(event.target.value)}
                onBlur={() => {
                  if (!voiceMemo.title.trim()) {
                    onTitleChange?.(
                      fallbackVoiceMemoTitle(voiceMemo.order),
                    );
                  }
                }}
                className="min-w-0 flex-1 border-0 border-b border-rule bg-transparent px-0 pb-1 font-sans text-sm font-semibold outline-none focus:border-oxblood"
              />
            ) : (
              <h3
                id={titleId}
                className="min-w-0 truncate font-sans text-sm font-semibold tracking-[0.01em]"
              >
                {voiceMemo.title}
              </h3>
            )}
            <span className="shrink-0 font-sans text-[0.65rem] tracking-[0.08em] text-ink-soft">
              {formatDuration(voiceMemo.durationSeconds)}
            </span>
          </div>
          <div className="relative h-0.5 bg-ink/15" aria-hidden="true">
            <div
              className="absolute inset-y-0 left-0 bg-oxblood/80"
              style={{ width: `${progress}%` }}
            />
            <span
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oxblood"
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-sans text-[0.6rem] tracking-[0.08em] text-ink-soft">
            <span>{formatDuration(elapsed)}</span>
            <span>
              {new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(voiceMemo.createdAt))}
            </span>
          </div>
        </div>
      </div>
      {playbackError ? (
        <p className="mt-3 font-sans text-xs text-oxblood" role="alert">
          {playbackError}
        </p>
      ) : null}
      {editable ? (
        <div className="mt-3 flex justify-end gap-4 border-t border-rule pt-3">
          <button
            type="button"
            onClick={onReplace}
            disabled={disabled}
            className="font-sans text-xs font-semibold text-oxblood underline decoration-oxblood/30 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Replace recording
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="font-sans text-xs font-semibold text-oxblood disabled:cursor-not-allowed disabled:opacity-45"
          >
            Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}
