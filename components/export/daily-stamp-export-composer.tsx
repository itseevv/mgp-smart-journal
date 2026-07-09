"use client";

import { useEffect, useRef, useState } from "react";

import {
  CloseIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";
import type { JournalTheme } from "@/data/journal-themes";
import type { MemoryEntry, MemoryPhoto } from "@/data/memory-demo";
import {
  dailyStampExportArtifactModel,
  dailyStampExportFilename,
  renderDailyMemoryStampExport,
  saveDailyStampExportBlob,
  shareDailyStampExportBlob,
  type DailyStampExportBrandMark,
} from "@/lib/export/daily-memory-stamp-export";

type DailyStampExportComposerProps = {
  open: boolean;
  memory: MemoryEntry;
  onClose: () => void;
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
  theme?: JournalTheme;
  brandMark?: DailyStampExportBrandMark;
};

type ComposerState =
  | {
      status: "idle" | "generating";
      blob?: undefined;
      previewUrl?: undefined;
      message?: string;
    }
  | {
      status: "ready";
      blob: Blob;
      previewUrl: string;
      message?: string;
    }
  | {
      status: "error";
      blob?: undefined;
      previewUrl?: undefined;
      message: string;
    };

const exportErrorMessage = "Couldn’t create the image. Please try again.";

export function DailyStampExportComposer({
  open,
  memory,
  onClose,
  resolvePhotoUrl,
  theme,
  brandMark,
}: DailyStampExportComposerProps) {
  const [composerState, setComposerState] = useState<ComposerState>({
    status: "idle",
  });
  const previewUrlRef = useRef<string | undefined>(undefined);
  const titleId = "daily-stamp-export-title";
  const filename = dailyStampExportFilename(memory);
  const model = dailyStampExportArtifactModel({ memory, brandMark });
  const isBusy = composerState.status === "generating";

  const revokePreview = () => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = undefined;
  };

  useEffect(() => () => revokePreview(), []);

  useEffect(() => {
    if (!open) return;

    let active = true;

    const createPreview = async () => {
      revokePreview();
      setComposerState({ status: "generating", message: "Creating image…" });
      try {
        const blob = await renderDailyMemoryStampExport({
          memory,
          resolvePhotoUrl,
          theme,
          brandMark,
        });
        if (!active) return;
        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;
        setComposerState({
          status: "ready",
          blob,
          previewUrl,
          message: "Image ready.",
        });
      } catch (error) {
        if (!active) return;
        console.error("Daily stamp export failed.", error);
        revokePreview();
        setComposerState({
          status: "error",
          message: exportErrorMessage,
        });
      }
    };

    void createPreview();

    return () => {
      active = false;
    };
  }, [brandMark, memory, open, resolvePhotoUrl, theme]);

  if (!open) return null;

  const closeComposer = () => {
    revokePreview();
    setComposerState({ status: "idle" });
    onClose();
  };

  const ensureExportBlob = async () => {
    if (composerState.status === "ready") return composerState.blob;
    setComposerState({ status: "generating", message: "Creating image…" });
    try {
      const blob = await renderDailyMemoryStampExport({
        memory,
        resolvePhotoUrl,
        theme,
        brandMark,
      });
      revokePreview();
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setComposerState({
        status: "ready",
        blob,
        previewUrl,
        message: "Image ready.",
      });
      return blob;
    } catch (error) {
      console.error("Daily stamp export failed.", error);
      revokePreview();
      setComposerState({
        status: "error",
        message: exportErrorMessage,
      });
      return undefined;
    }
  };

  const saveImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    saveDailyStampExportBlob(blob, filename);
    setComposerState((current) =>
      current.status === "ready"
        ? { ...current, message: "Image ready." }
        : current,
    );
  };

  const shareImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    try {
      const result = await shareDailyStampExportBlob(
        blob,
        filename,
        model.title,
      );
      if (!result.shared) {
        setComposerState((current) =>
          current.status === "ready"
            ? {
                ...current,
                message:
                  "Sharing isn’t supported here. You can save the image instead.",
              }
            : current,
        );
        return;
      }
      setComposerState((current) =>
        current.status === "ready"
          ? { ...current, message: "Shared." }
          : current,
      );
    } catch (error) {
      const name =
        error && typeof error === "object" && "name" in error
          ? String(error.name)
          : "";
      setComposerState((current) =>
        current.status === "ready"
          ? {
              ...current,
              message:
                name === "AbortError"
                  ? "Share canceled."
                  : "Sharing isn’t supported here. You can save the image instead.",
            }
          : current,
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-dvh items-end justify-center bg-black/45 px-3 py-3 sm:items-center sm:px-4"
      role="presentation"
      data-daily-stamp-export-composer="true"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[30rem] flex-col overflow-hidden bg-[var(--journal-paper)] shadow-[0_24px_70px_rgba(10,6,5,0.42)]"
      >
        <header className="flex items-center justify-between border-b border-[var(--journal-stamp-border)] px-4 py-3 text-[var(--journal-paper-text)]">
          <h2 id={titleId} className="font-serif text-xl leading-tight">
            Save or share
          </h2>
          <button
            type="button"
            onClick={closeComposer}
            className="grid min-h-10 min-w-10 place-items-center text-[var(--journal-paper-muted-text)] hover:text-[var(--journal-paper-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--journal-accent-metal)]"
            aria-label="Close export composer"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto aspect-[9/16] max-h-[62dvh] w-full max-w-[min(68vw,18rem)] bg-[var(--journal-background)] shadow-[0_18px_48px_rgba(35,24,18,0.24)] sm:max-h-[65dvh]">
            {composerState.status === "ready" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={composerState.previewUrl}
                alt="9:16 preview of the saved Daily Memory Stamp export"
                className="h-full w-full object-contain"
                data-daily-stamp-export-preview="ready"
              />
            ) : (
              <div
                className="grid h-full place-items-center px-5 text-center font-sans text-sm text-[var(--journal-muted)]"
                aria-busy={isBusy}
                data-daily-stamp-export-preview={composerState.status}
              >
                {composerState.status === "error"
                  ? exportErrorMessage
                  : "Creating image…"}
              </div>
            )}
          </div>

          <p
            className="mt-3 min-h-5 text-center font-sans text-xs text-[var(--journal-paper-muted-text)]"
            role={composerState.status === "error" ? "alert" : "status"}
          >
            {composerState.message ?? ""}
          </p>
        </div>

        <footer className="space-y-2 border-t border-[var(--journal-stamp-border)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => void saveImage()}
            disabled={isBusy}
            className="flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--journal-background)] px-4 py-3 font-sans text-sm font-semibold text-[var(--journal-text)] disabled:cursor-wait disabled:opacity-55"
          >
            <DownloadIcon className="h-4 w-4" />
            <span>{isBusy ? "Preparing…" : "Save Image"}</span>
          </button>
          <button
            type="button"
            onClick={() => void shareImage()}
            disabled={isBusy}
            className="flex min-h-12 w-full items-center justify-center gap-2 border border-[var(--journal-stamp-border)] px-4 py-3 font-sans text-sm font-semibold text-[var(--journal-paper-text)] disabled:cursor-wait disabled:opacity-55"
          >
            <ShareIcon className="h-4 w-4" />
            <span>Share</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
