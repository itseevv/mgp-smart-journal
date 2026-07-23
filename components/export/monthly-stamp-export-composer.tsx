"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CloseIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";
import type { JournalMemorySummary } from "@/data/journal";
import { resolvedLocalTimezone } from "@/data/local-date";
import {
  journalThemeStyle,
  resolveJournalTheme,
  type JournalTheme,
} from "@/data/journal-themes";
import { renderMonthlyMemorySheetExport } from "@/lib/export/monthly-memory-sheet-client";
import {
  monthlyMemoryEditionFilename,
  monthlyMemoryEditionModel,
  monthlyMemoryEditionRequestStamps,
  saveMonthlyMemoryEditionBlob,
  shareMonthlyMemoryEditionBlob,
} from "@/lib/export/monthly-memory-sheet-export";
import { createMonthlyExportGenerationGate } from "@/lib/export/monthly-memory-sheet-lifecycle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./monthly-stamp-export-composer.module.css";

type MonthlyStampExportComposerProps = {
  open: boolean;
  capsuleId?: string;
  journalTitle: string;
  monthKey: string;
  stamps: JournalMemorySummary[];
  thumbnailUrls: Record<string, string>;
  theme?: JournalTheme;
  onClose: () => void;
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

const exportErrorMessage =
  "Couldn’t create your Monthly Memory Edition. Please try again.";

async function renderPersistedMonthlyMemoryEdition({
  capsuleId,
  monthKey,
  stamps,
  signal,
}: {
  capsuleId: string;
  monthKey: string;
  stamps: JournalMemorySummary[];
  signal?: AbortSignal;
}) {
  const client = getSupabaseBrowserClient();
  const sessionResult = await client.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  if (sessionResult.error || !accessToken) {
    throw new Error("Monthly export requires an active journal session.");
  }
  const response = await fetch("/api/export/monthly-sheet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      capsuleId,
      monthKey,
      timeZone: resolvedLocalTimezone() ?? "UTC",
      stamps: monthlyMemoryEditionRequestStamps({ monthKey, stamps }),
    }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => undefined)) as
      | { code?: unknown }
      | undefined;
    const code =
      typeof detail?.code === "string" ? detail.code : `HTTP_${response.status}`;
    throw new Error(`Monthly sheet server export failed: ${code}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  let blob: Blob;
  if (contentType === "image/png") {
    blob = await response.blob();
  } else if (contentType === "application/json") {
    const delivery = (await response.json()) as unknown;
    if (
      !delivery ||
      typeof delivery !== "object" ||
      !("delivery" in delivery) ||
      delivery.delivery !== "signed-url" ||
      !("artifactId" in delivery) ||
      typeof delivery.artifactId !== "string" ||
      !("url" in delivery) ||
      typeof delivery.url !== "string"
    ) {
      throw new Error("Monthly sheet server export returned invalid delivery.");
    }
    const artifactUrl = new URL(delivery.url);
    const configuredStorageOrigin = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local",
    ).origin;
    if (
      artifactUrl.protocol !== "https:" ||
      artifactUrl.origin !== configuredStorageOrigin
    ) {
      throw new Error("Monthly sheet server export returned invalid delivery.");
    }
    const artifactResponse = await fetch(artifactUrl, {
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    if (
      !artifactResponse.ok ||
      artifactResponse.headers.get("content-type")?.split(";")[0] !==
        "image/png"
    ) {
      throw new Error("Monthly sheet artifact delivery failed.");
    }
    blob = await artifactResponse.blob();
    void fetch("/api/export/monthly-sheet", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capsuleId,
        artifactId: delivery.artifactId,
      }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  } else {
    throw new Error("Monthly sheet server export returned an invalid image.");
  }
  if (!blob.size) {
    throw new Error("Monthly sheet server export returned an empty image.");
  }
  return blob;
}

export function MonthlyStampExportComposer({
  open,
  capsuleId,
  journalTitle,
  monthKey,
  stamps,
  thumbnailUrls,
  theme,
  onClose,
}: MonthlyStampExportComposerProps) {
  const [composerState, setComposerState] = useState<ComposerState>({
    status: "idle",
  });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const generationGateRef = useRef(createMonthlyExportGenerationGate());
  const shareGenerationRef = useRef(0);
  const resolvedTheme = useMemo(() => resolveJournalTheme(theme), [theme]);
  const model = useMemo(
    () => monthlyMemoryEditionModel({ journalTitle, monthKey, stamps }),
    [journalTitle, monthKey, stamps],
  );
  const filename = monthlyMemoryEditionFilename(monthKey);
  const isBusy = composerState.status === "generating";
  const loadingFrameStyle = {
    aspectRatio: `${model.width} / ${model.height}`,
  } satisfies CSSProperties;

  const revokePreview = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = undefined;
  }, []);

  const renderExportBlob = useCallback(
    (signal: AbortSignal) =>
      capsuleId
        ? renderPersistedMonthlyMemoryEdition({
            capsuleId,
            monthKey,
            stamps,
            signal,
          })
        : renderMonthlyMemorySheetExport({
            journalTitle,
            monthKey,
            stamps,
            thumbnailUrls,
            theme: resolvedTheme,
            signal,
          }),
    [
      capsuleId,
      journalTitle,
      monthKey,
      resolvedTheme,
      stamps,
      thumbnailUrls,
    ],
  );

  const createPreview = useCallback(async () => {
    shareGenerationRef.current += 1;
    const generation = generationGateRef.current.begin();
    revokePreview();
    setComposerState({
      status: "generating",
      message: `Preparing your ${model.monthName} Memory Edition...`,
    });
    try {
      const blob = await renderExportBlob(generation.signal);
      if (!generationGateRef.current.isCurrent(generation)) return undefined;
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setComposerState({
        status: "ready",
        blob,
        previewUrl,
        message: `Your ${model.monthName} Memory Edition is ready.`,
      });
      return blob;
    } catch (error) {
      if (!generationGateRef.current.isCurrent(generation)) return undefined;
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        return undefined;
      }
      console.error("Monthly sheet export failed.", error);
      revokePreview();
      setComposerState({ status: "error", message: exportErrorMessage });
      return undefined;
    } finally {
      generationGateRef.current.finish(generation);
    }
  }, [model.monthName, renderExportBlob, revokePreview]);

  const closeComposer = useCallback(() => {
    shareGenerationRef.current += 1;
    generationGateRef.current.cancel();
    revokePreview();
    setComposerState({ status: "idle" });
    onClose();
  }, [onClose, revokePreview]);

  useEffect(
    () => {
      const generationGate = generationGateRef.current;
      return () => {
        shareGenerationRef.current += 1;
        generationGate.cancel();
        revokePreview();
      };
    },
    [revokePreview],
  );

  useEffect(() => {
    if (!open) return;
    const generationGate = generationGateRef.current;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousDocumentOverscroll =
      documentElement.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "contain";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComposer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previewTimer = window.setTimeout(() => void createPreview(), 0);

    return () => {
      window.clearTimeout(previewTimer);
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      documentElement.style.overflow = previousDocumentOverflow;
      documentElement.style.overscrollBehavior = previousDocumentOverscroll;
      generationGate.cancel();
      revokePreview();
      previousActiveElement?.focus();
    };
  }, [closeComposer, createPreview, open, revokePreview]);

  if (!open) return null;

  const ensureExportBlob = async () => {
    if (composerState.status === "ready") return composerState.blob;
    return createPreview();
  };

  const saveImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    saveMonthlyMemoryEditionBlob(blob, filename);
  };

  const shareImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    const shareGeneration = ++shareGenerationRef.current;
    try {
      const result = await shareMonthlyMemoryEditionBlob(
        blob,
        filename,
        model.editionTitle,
      );
      if (shareGeneration !== shareGenerationRef.current) return;
      if (!result.shared) {
        saveMonthlyMemoryEditionBlob(blob, filename);
        setComposerState((current) =>
          current.status === "ready"
            ? {
                ...current,
                message:
                  "Sharing isn’t supported here. The image was saved instead.",
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
      if (shareGeneration !== shareGenerationRef.current) return;
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
                  : "The image couldn’t be shared. You can save it instead.",
            }
          : current,
      );
    }
  };

  const frameMessage =
    composerState.status === "error"
      ? exportErrorMessage
      : `Preparing your ${model.monthName} Memory Edition...`;
  const statusMessage = composerState.message ?? "";

  return (
    <div
      className={styles.overlay}
      role="presentation"
      data-monthly-stamp-export-composer="true"
      data-monthly-stamp-export-state={composerState.status}
      data-monthly-stamp-export-production-wiring="enabled"
      style={journalThemeStyle(resolvedTheme)}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-stamp-export-title"
      >
        <header className={styles.header}>
          <h2 id="monthly-stamp-export-title">
            Your {model.monthName} Memory Edition
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={closeComposer}
            aria-label="Close Monthly Memory Edition preview"
          >
            <CloseIcon />
          </button>
        </header>

        <div
          className={styles.artifactViewport}
          data-monthly-export-modal-preview="proportional-full-artifact"
        >
          {composerState.status === "ready" ? (
            <div className={styles.artifactFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={composerState.previewUrl}
                alt={`${model.editionTitle} complete monthly export preview`}
                width={model.width}
                height={model.height}
                data-monthly-stamp-export-preview="ready"
                data-monthly-stamp-export-preview-source="generated-blob"
              />
            </div>
          ) : (
            <div
              className={styles.loadingFrame}
              style={loadingFrameStyle}
              aria-busy={isBusy}
              data-monthly-stamp-export-loading-state={
                composerState.status === "error" ? "error" : "preparing-image"
              }
              data-monthly-export-theme-source="production-journal-theme-style"
            >
              <p>{frameMessage}</p>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() =>
              void (composerState.status === "error"
                ? createPreview()
                : saveImage())
            }
            disabled={isBusy}
          >
            <DownloadIcon />
            {composerState.status === "error" ? "Retry" : "Save"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void shareImage()}
            disabled={isBusy}
          >
            <ShareIcon />
            Share
          </button>
        </div>

        <p
          className={styles.status}
          role={composerState.status === "error" ? "alert" : "status"}
          aria-live={composerState.status === "error" ? "assertive" : "polite"}
        >
          {statusMessage}
        </p>
      </section>
    </div>
  );
}
