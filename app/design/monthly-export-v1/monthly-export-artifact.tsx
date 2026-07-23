"use client";

import type { PhotoCropMetadata } from "@/data/memory-demo";
import {
  journalThemeStyle,
  resolveJournalTheme,
  rubyJournalTheme,
} from "@/data/journal-themes";
import { CroppedStampImage } from "@/components/stamp/cropped-stamp-image";

import styles from "./monthly-export-v1.module.css";

export const MONTHLY_EXPORT_ARTIFACT_WIDTH = 1080;
export const MONTHLY_EXPORT_COLUMNS = 3;
export const MONTHLY_EXPORT_ROWS = 11;
export const MONTHLY_EXPORT_STAMP_COUNT = 31;

const OUTER_TOP = 56;
const ARTIFACT_HEADER_HEIGHT = 112;
const ARTIFACT_HEADER_GAP = 28;
const SHEET_PADDING_TOP = 32;
const SHEET_HEADER_HEIGHT = 112;
const SHEET_HEADER_GAP = 28;
const STAMP_SIZE = 292;
const STAMP_GAP = 18;
const SHEET_PADDING_BOTTOM = 30;
const FOOTER_GAP = 32;
const FOOTER_HEIGHT = 180;
const OUTER_BOTTOM = 48;

export const MONTHLY_EXPORT_ARTIFACT_HEIGHT =
  OUTER_TOP +
  ARTIFACT_HEADER_HEIGHT +
  ARTIFACT_HEADER_GAP +
  SHEET_PADDING_TOP +
  SHEET_HEADER_HEIGHT +
  SHEET_HEADER_GAP +
  STAMP_SIZE * MONTHLY_EXPORT_ROWS +
  STAMP_GAP * (MONTHLY_EXPORT_ROWS - 1) +
  SHEET_PADDING_BOTTOM +
  FOOTER_GAP +
  FOOTER_HEIGHT +
  OUTER_BOTTOM;

export const monthlyExportPlaygroundTheme = resolveJournalTheme({
  ...rubyJournalTheme,
  name: "Wine leather",
  textureUrl: "/images/textures/wine-red-leather-texture-9x16.png",
});

const spriteUrl = "/images/design-scrap-day-v2/month-sheet-demo-sprite.svg";
const logoUrl = "/brand/mgp-full-logo-transparent.png";
const cropSizes = [850, 900, 820, 880, 840, 920] as const;
const cropOffsets = [
  [58, 76],
  [42, 54],
  [112, 84],
  [70, 96],
  [92, 48],
  [36, 72],
] as const;

function fixtureCrop(day: number): PhotoCropMetadata {
  const spriteIndex = (day - 1) % 12;
  const column = spriteIndex % 3;
  const row = Math.floor(spriteIndex / 3);
  const size = cropSizes[(day - 1) % cropSizes.length];
  const [offsetX, offsetY] = cropOffsets[(day - 1) % cropOffsets.length];

  return {
    kind: "cover-scrap",
    aspectRatio: 1,
    x: (column * 1000 + offsetX) / 3000,
    y: (row * 1000 + offsetY) / 4000,
    width: size / 3000,
    height: size / 4000,
    imageWidth: 3000,
    imageHeight: 4000,
    createdAt: `2026-07-${String(day).padStart(2, "0")}T12:00:00.000Z`,
  };
}

export function MonthlyExportArtifact() {
  const stamps = Array.from(
    { length: MONTHLY_EXPORT_STAMP_COUNT },
    (_, index) => index + 1,
  );

  return (
    <article
      className={styles.artifact}
      aria-labelledby="monthly-export-artifact-month"
      data-monthly-export-artifact="complete-long-image"
      data-monthly-export-artifact-height={MONTHLY_EXPORT_ARTIFACT_HEIGHT}
      data-monthly-export-artifact-width={MONTHLY_EXPORT_ARTIFACT_WIDTH}
      data-monthly-export-columns={MONTHLY_EXPORT_COLUMNS}
      data-monthly-export-completeness="31-of-31"
      data-monthly-export-rows={MONTHLY_EXPORT_ROWS}
      data-monthly-export-texture="single-cover-no-repeat"
      style={journalThemeStyle(monthlyExportPlaygroundTheme)}
    >
      <header className={styles.artifactHeader}>
        <p className={styles.journalTitle}>Margot&apos;s Journal</p>
      </header>

      <section
        className={styles.sheetInsert}
        aria-label="July 2026 monthly sheet with 31 sealed stamps"
      >
        <header className={styles.sheetHeader}>
          <h2 id="monthly-export-artifact-month" className={styles.monthTitle}>
            July 2026 Edition
          </h2>
          <p className={styles.monthSubheader}>
            The whole month, kept together
          </p>
        </header>

        <ol
          className={styles.stampGrid}
          aria-label="Dates 1 through 31 in a three-column monthly sheet"
          data-monthly-export-grid="3-columns-11-rows"
        >
          {stamps.map((day) => (
            <li
              key={day}
              id={day === MONTHLY_EXPORT_STAMP_COUNT ? "monthly-export-final-row" : undefined}
              className={styles.stamp}
              aria-label={`July ${day}, 2026 sealed stamp`}
              data-monthly-export-day={day}
              data-monthly-export-row={Math.ceil(day / MONTHLY_EXPORT_COLUMNS)}
              data-monthly-export-stamp="sealed"
            >
              <span className={styles.dateMarker}>{day}</span>
              <CroppedStampImage
                src={spriteUrl}
                alt=""
                sizes="(max-width: 767px) 30vw, 292px"
                loading="eager"
                cropMetadata={fixtureCrop(day)}
                width={3000}
                height={4000}
              />
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.artifactFooter}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Modern Goddess Patina" />
      </footer>
    </article>
  );
}
