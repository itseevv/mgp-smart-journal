"use client";

import { useRef, useState } from "react";

import {
  MONTHLY_EXPORT_ARTIFACT_HEIGHT,
  MONTHLY_EXPORT_ARTIFACT_WIDTH,
  MONTHLY_EXPORT_COLUMNS,
  MONTHLY_EXPORT_ROWS,
  MONTHLY_EXPORT_STAMP_COUNT,
  MonthlyExportArtifact,
} from "./monthly-export-artifact";
import {
  MonthlyExportJourney,
  type MonthlyExportEntryId,
} from "./monthly-export-journey";
import { MonthlyExportSaveSharePreview } from "./monthly-export-save-share-preview";
import styles from "./monthly-export-v1.module.css";

type PreviewMode = "fit" | "full";

const selectedMonthName = "July";
const selectedMonthLabel = "July 2026";

const facts = [
  ["Width", `${MONTHLY_EXPORT_ARTIFACT_WIDTH}px`],
  ["Height", `${MONTHLY_EXPORT_ARTIFACT_HEIGHT}px`],
  ["Columns", String(MONTHLY_EXPORT_COLUMNS)],
  ["Rows", String(MONTHLY_EXPORT_ROWS)],
  ["Stamps", String(MONTHLY_EXPORT_STAMP_COUNT)],
] as const;

export function MonthlyExportV1Playground() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("fit");
  const [previewEntry, setPreviewEntry] =
    useState<MonthlyExportEntryId | null>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);

  const openPreviewFromMonthlySheet = (entryId: MonthlyExportEntryId) => {
    setPreviewEntry(entryId);
  };

  const inspectFinalRow = () => {
    setPreviewMode("full");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const viewport = previewViewportRef.current;
        viewport?.scrollTo({
          top: viewport.scrollHeight,
          left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2),
          behavior: "smooth",
        });
      });
    });
  };

  return (
    <main
      className={styles.playground}
      data-monthly-export-v1-non-production="true"
      data-monthly-export-v1-playground="true"
    >
      <div className={styles.pageShell}>
        <header className={styles.pageHeader}>
          <p className={styles.playgroundLabel}>
            <span aria-hidden="true" />
            Playground-only proposal
          </p>
          <h1>Monthly Sheet Export</h1>
          <p className={styles.pageIntro}>
            One complete, high-resolution month—composed independently from
            the mobile viewport and presented here for product-owner review.
          </p>
        </header>

        <section className={styles.specPanel} aria-labelledby="artifact-spec-title">
          <div className={styles.specHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Proposed artifact</p>
              <h2 id="artifact-spec-title">Content-driven long image</h2>
            </div>
            <p className={styles.specNote}>
              31 of 31 sealed stamps · no viewport capture
            </p>
          </div>
          <dl className={styles.factGrid}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <MonthlyExportJourney
          monthLabel={selectedMonthLabel}
          onOpenPreview={openPreviewFromMonthlySheet}
        />

        <section
          className={styles.reviewSection}
          aria-labelledby="review-title"
          data-monthly-export-review-surface="complete-artifact"
        >
          <div className={styles.reviewHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Review surface</p>
              <h2 id="review-title">Inspect the complete artifact</h2>
              <p>
                Fit shows the full composition. Full size keeps the artifact at
                its proposed 1080px width inside a scrollable viewport.
              </p>
            </div>
            <div className={styles.reviewActions}>
              <div className={styles.segmentedControl} aria-label="Preview scale">
                <button
                  type="button"
                  aria-pressed={previewMode === "fit"}
                  onClick={() => setPreviewMode("fit")}
                >
                  Fit complete sheet
                </button>
                <button
                  type="button"
                  aria-pressed={previewMode === "full"}
                  onClick={() => setPreviewMode("full")}
                >
                  Full size · 1:1
                </button>
              </div>
              <button
                type="button"
                className={styles.finalRowButton}
                onClick={inspectFinalRow}
              >
                Inspect row 11
              </button>
            </div>
          </div>

          <figure className={styles.previewFigure}>
            <div
              ref={previewViewportRef}
              className={`${styles.previewViewport} ${
                previewMode === "full" ? styles.previewViewportFull : ""
              }`}
              data-monthly-export-preview-mode={previewMode}
            >
              <div
                className={`${styles.artifactFrame} ${
                  previewMode === "full" ? styles.artifactFrameFull : ""
                }`}
              >
                <MonthlyExportArtifact />
              </div>
            </div>
            <figcaption>
              {previewMode === "fit"
                ? "Scaled full-artifact preview · all 11 rows visible in one composition"
                : "Full-size scrollable preview · artifact remains a single 1080 × 4050px composition"}
            </figcaption>
          </figure>
        </section>

        <aside className={styles.decisionPanel} aria-labelledby="decision-title">
          <p className={styles.sectionEyebrow}>Approval gate</p>
          <h2 id="decision-title">Decisions held for review</h2>
          <p>
            Confirm the 1080px width, row density, centered final stamp, and
            quiet footer branding before any production export action, PNG
            renderer, Save and Share flow, or Monthly Sheet integration begins.
          </p>
        </aside>
      </div>

      <MonthlyExportSaveSharePreview
        key={previewEntry ?? "closed"}
        entryId={previewEntry}
        monthName={selectedMonthName}
        onClose={() => setPreviewEntry(null)}
      />
    </main>
  );
}
