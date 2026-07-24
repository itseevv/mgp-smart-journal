"use client";

import { useEffect, useRef, useState } from "react";

import {
  CloseIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";
import { journalThemeStyle } from "@/data/journal-themes";

import {
  MonthlyExportArtifact,
  monthlyExportPlaygroundTheme,
} from "./monthly-export-artifact";
import type { MonthlyExportEntryId } from "./monthly-export-journey";
import styles from "./monthly-export-v1.module.css";

type MonthlyExportSaveSharePreviewProps = {
  entryId: MonthlyExportEntryId | null;
  monthName: string;
  onClose: () => void;
};

export function MonthlyExportSaveSharePreview({
  entryId,
  monthName,
  onClose,
}: MonthlyExportSaveSharePreviewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [playgroundMessage, setPlaygroundMessage] = useState("");
  const [previewState, setPreviewState] = useState<"preparing" | "ready">(
    "preparing",
  );

  useEffect(() => {
    if (!entryId) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [entryId, onClose]);

  useEffect(() => {
    if (!entryId) return;
    const timer = window.setTimeout(() => {
      setPreviewState("ready");
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [entryId]);

  if (!entryId) return null;
  const isPreparing = previewState === "preparing";

  const explainPlaygroundBoundary = () => {
    setPlaygroundMessage(
      "Playground only. Save and Share will be connected after design approval.",
    );
  };

  return (
    <div
      className={styles.saveShareOverlay}
      role="presentation"
      data-monthly-export-save-share-preview="true"
      data-monthly-export-preview-entry={entryId}
      data-monthly-export-preview-state={previewState}
      data-monthly-export-production-wiring="none"
      style={journalThemeStyle(monthlyExportPlaygroundTheme)}
    >
      <section
        className={styles.saveShareDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-export-preview-title"
      >
        <header className={styles.saveShareHeader}>
          <h2 id="monthly-export-preview-title">
            Your {monthName} Memory Edition
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close Monthly Sheet preview"
          >
            <CloseIcon />
          </button>
        </header>

        <div
          className={styles.saveShareArtifactViewport}
          data-monthly-export-modal-preview="proportional-full-artifact"
        >
          {isPreparing ? (
            <div
              className={styles.saveShareLoadingFrame}
              aria-busy="true"
              data-monthly-export-loading-state="preparing-image"
              data-monthly-export-theme-source="production-journal-theme-style"
            >
              <p>Preparing your {monthName} Memory Edition...</p>
            </div>
          ) : (
            <div className={styles.saveShareArtifactFrame}>
              <MonthlyExportArtifact />
            </div>
          )}
        </div>

        <div className={styles.saveShareActions}>
          <button
            type="button"
            className={styles.saveSharePrimary}
            onClick={explainPlaygroundBoundary}
            disabled={isPreparing}
          >
            <DownloadIcon />
            Save
          </button>
          <button
            type="button"
            className={styles.saveShareSecondary}
            onClick={explainPlaygroundBoundary}
            disabled={isPreparing}
          >
            <ShareIcon />
            Share
          </button>
        </div>

        <p className={styles.saveSharePlaygroundNote} role="status">
          {playgroundMessage ||
            (isPreparing
              ? "Playground loading-state preview"
              : "Playground preview · actions intentionally not connected")}
        </p>
      </section>
    </div>
  );
}
