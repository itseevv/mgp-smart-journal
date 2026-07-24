"use client";

import type { CSSProperties } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "@/components/memory/memory-icons";
import { journalThemeStyle } from "@/data/journal-themes";

import { monthlyExportPlaygroundTheme } from "./monthly-export-artifact";
import styles from "./monthly-export-v1.module.css";

const spriteUrl = "/images/design-scrap-day-v2/month-sheet-demo-sprite.svg";
const tilePositions = [
  "0% 0%",
  "50% 0%",
  "100% 0%",
  "0% 33.333%",
  "50% 33.333%",
  "100% 33.333%",
  "0% 66.667%",
  "50% 66.667%",
  "100% 66.667%",
] as const;

export type MonthlyExportEntryId = "quiet-header-download";

type MonthlyExportJourneyProps = {
  monthLabel: string;
  onOpenPreview: (entryId: MonthlyExportEntryId) => void;
};

function journeyTileStyle(index: number) {
  return {
    backgroundImage: `url("${spriteUrl}")`,
    backgroundPosition: tilePositions[index],
    backgroundSize: "300% 400%",
  } satisfies CSSProperties;
}

export function MonthlyExportJourney({
  monthLabel,
  onOpenPreview,
}: MonthlyExportJourneyProps) {
  return (
    <section
      className={styles.journeySection}
      aria-labelledby="monthly-export-journey-title"
      data-monthly-export-journey="playground-only"
      data-monthly-export-production-wiring="none"
      data-monthly-export-selected-direction="quiet-header-download"
    >
      <header className={styles.journeyHeading}>
        <div>
          <p className={styles.sectionEyebrow}>Selected entry direction</p>
          <h2 id="monthly-export-journey-title">
            Quiet header download
          </h2>
        </div>
        <p>
          Solution A, refined with a Download icon. It remains visible beside
          month navigation without becoming a second primary action.
        </p>
      </header>

      <div className={styles.selectedEntryLayout}>
        <article className={styles.selectedEntryCard}>
          <p className={styles.selectedDirectionLabel}>
            Solution A · Final Playground proposal
          </p>

          <div
            className={styles.phoneSurface}
            style={journalThemeStyle(monthlyExportPlaygroundTheme)}
            data-monthly-export-theme-source="production-journal-theme-style"
          >
            <header className={styles.phoneJournalHeader}>
              <span aria-hidden="true" />
              <p>Margot&apos;s Journal</p>
              <span aria-hidden="true">•••</span>
            </header>

            <div className={styles.phoneSheetInsert}>
              <div className={styles.phoneMonthHeader}>
                <h3>{monthLabel}</h3>
                <div
                  className={styles.phoneMonthControls}
                  aria-label="Month navigation and export"
                >
                  <span aria-hidden="true">
                    <ChevronLeftIcon />
                  </span>
                  <span aria-hidden="true">
                    <ChevronRightIcon />
                  </span>
                  <span className={styles.phoneControlDivider} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.headerIconEntry}
                    onClick={() => onOpenPreview("quiet-header-download")}
                    aria-label={`Preview ${monthLabel} Memory Edition`}
                    title={`Preview ${monthLabel} Memory Edition`}
                    data-monthly-export-entry="quiet-header-download"
                  >
                    <DownloadIcon />
                  </button>
                </div>
              </div>

              <div className={styles.quietLinkRow} aria-hidden="true">
                <span>Export sheet</span>
              </div>

              <div
                className={styles.phoneStampGrid}
                aria-label="Illustrative three-column Monthly Sheet viewport"
              >
                {tilePositions.map((_, index) => (
                  <span
                    key={`selected-monthly-entry-tile-${index + 1}`}
                    className={styles.phoneStamp}
                    style={journeyTileStyle(index)}
                  >
                    <span>{index + 1}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className={styles.selectedEntryReasoning}>
          <p className={styles.sectionEyebrow}>Why this direction</p>
          <h3>Visible when needed, quiet when browsing.</h3>
          <ul>
            <li>
              The Download icon matches the user&apos;s immediate intent more
              precisely than Share.
            </li>
            <li>
              A subtle divider separates export from previous and next month
              controls.
            </li>
            <li>
              The 44px touch target remains accessible without introducing a
              large pill or a new content row.
            </li>
          </ul>

          <div className={styles.journeyFlow} aria-label="Proposed Monthly export flow">
            <span>Monthly Sheet</span>
            <span aria-hidden="true">→</span>
            <span>Download icon</span>
            <span aria-hidden="true">→</span>
            <span>Your month Memory Edition</span>
            <span aria-hidden="true">→</span>
            <span>Save or share</span>
          </div>
        </div>
      </div>
    </section>
  );
}
