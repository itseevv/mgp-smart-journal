"use client";

import { type CSSProperties } from "react";

import {
  CloseIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";

type ExportTheme = {
  id: "wine" | "ivory";
  label: string;
  textureUrl: string;
  background: string;
  text: string;
  muted: string;
  overlay: string;
  overlayGradient: string;
  control: string;
  controlText: string;
};

type ModalState = "ready" | "loading";

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

const displayFont =
  '"Cormorant Garamond", "Bodoni Moda", "DM Serif Display", Georgia, serif';
const utilityFont = 'Inter, Aptos, "Source Sans 3", system-ui, sans-serif';
const spriteUrl = "/images/design-scrap-day-v2/month-sheet-demo-sprite.svg";
const mgpLogoUrl =
  "/images/design-scrap-day-v2/mgp-full-logo-transparent-playground.png";

const themes: ExportTheme[] = [
  {
    id: "wine",
    label: "Wine leather",
    textureUrl: "/images/textures/wine-red-leather-texture-9x16.png",
    background: "#4b1f29",
    text: "#fbefe8",
    muted: "rgba(251, 239, 232, 0.68)",
    overlay: "rgba(178, 140, 123, 0.16)",
    overlayGradient:
      "linear-gradient(180deg, rgba(232, 219, 204, 0.1), rgba(228, 180, 143, 0.07))",
    control: "rgba(232, 219, 204, 0.9)",
    controlText: "#421819",
  },
  {
    id: "ivory",
    label: "Ivory leather",
    textureUrl: "/images/textures/ivory-leather-texture-9x16.png",
    background: "#d9ccb3",
    text: "#2e2921",
    muted: "rgba(46, 41, 33, 0.68)",
    overlay: "rgba(255, 251, 240, 0.42)",
    overlayGradient:
      "linear-gradient(180deg, rgba(255, 251, 240, 0.26), rgba(98, 69, 58, 0.08))",
    control: "#421819",
    controlText: "#E8DBCC",
  },
];

const themeIds = ["wine", "ivory"] as const;
const photoCases = [1, 2, 5, 9] as const;

function rgbaFromHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function themeById(id: (typeof themeIds)[number]) {
  const theme = themes.find((candidate) => candidate.id === id);
  if (!theme) throw new Error(`Missing daily export playground theme: ${id}`);
  return theme;
}

function isLightTheme(theme: ExportTheme) {
  return theme.id === "ivory";
}

function artifactShellStyle(theme: ExportTheme) {
  return {
    backgroundColor: theme.background,
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.14)), url("${theme.textureUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    color: theme.text,
  } satisfies CSSProperties;
}

function overlayStyle(theme: ExportTheme) {
  return {
    backgroundColor: theme.overlay,
    backgroundImage: theme.overlayGradient,
    backdropFilter: "blur(1.5px)",
    WebkitBackdropFilter: "blur(1.5px)",
  } satisfies CSSProperties;
}

function modalSurfaceStyle() {
  return {
    backgroundColor: rgbaFromHex(brand.warmIvory, 0.9),
    backgroundImage: `linear-gradient(180deg, ${rgbaFromHex(
      brand.champagnePeach,
      0.12,
    )}, ${rgbaFromHex(brand.cocoaTaupe, 0.06)})`,
    border: `1px solid ${rgbaFromHex(brand.deepBurgundy, 0.12)}`,
    boxShadow: `0 16px 38px ${rgbaFromHex(brand.deepBurgundy, 0.22)}`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: brand.deepBurgundy,
  } satisfies CSSProperties;
}

function modalPrimaryActionStyle(theme: ExportTheme) {
  return {
    backgroundColor: theme.background,
    color: theme.text,
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function modalSecondaryActionStyle(theme: ExportTheme) {
  return {
    backgroundColor: theme.control,
    color: theme.controlText,
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function titleStyle(theme: ExportTheme) {
  return {
    color: isLightTheme(theme) ? brand.deepBurgundy : brand.warmIvory,
    fontFamily: displayFont,
  } satisfies CSSProperties;
}

function utilityTextStyle(theme: ExportTheme) {
  return {
    color: isLightTheme(theme)
      ? rgbaFromHex(brand.cocoaTaupe, 0.76)
      : rgbaFromHex(brand.champagnePeach, 0.78),
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function makerMarkStyle() {
  return {
    height: "auto",
    opacity: 0.78,
    width: "4.85rem",
  } satisfies CSSProperties;
}

function ivoryMakerMarkStyle() {
  return {
    aspectRatio: "1224 / 1224",
    backgroundColor: brand.deepBurgundy,
    maskImage: `url("${mgpLogoUrl}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    opacity: 0.72,
    WebkitMaskImage: `url("${mgpLogoUrl}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    width: "4.85rem",
  } satisfies CSSProperties;
}

function photoBackgroundStyle(index: number) {
  const positions = [
    "0% 0%",
    "50% 0%",
    "100% 0%",
    "0% 33.333%",
    "50% 33.333%",
    "100% 33.333%",
    "0% 66.667%",
    "50% 66.667%",
    "100% 66.667%",
  ];

  return {
    backgroundImage: `url("${spriteUrl}")`,
    backgroundPosition: positions[index % positions.length],
    backgroundSize: "300% 400%",
  } satisfies CSSProperties;
}

function photoGridColumns(photoCount: number) {
  if (photoCount <= 1) return 1;
  if (photoCount <= 4) return 2;
  return 3;
}

const gridColumnClassName: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

function ExportPhotoGrid({
  photoCount,
  compact = false,
}: {
  photoCount: number;
  compact?: boolean;
}) {
  const columns = photoGridColumns(photoCount);
  const singlePhoto = columns === 1;

  return (
    <div
      className={`grid ${gridColumnClassName[columns]} ${
        compact ? "gap-1" : "gap-1.5 sm:gap-2"
      } ${singlePhoto ? "mx-auto w-full max-w-[15rem]" : ""}`}
      aria-label={`${photoCount} photo export grid`}
      data-export-photo-count={photoCount}
      data-export-photo-grid-columns={columns}
      data-export-photo-grid-treatment="borderless-square"
    >
      {Array.from({ length: photoCount }, (_, index) => (
        <span
          key={`daily-export-v2-photo-${photoCount}-${index}`}
          aria-hidden="true"
          className="block aspect-square min-w-0 overflow-hidden bg-[#d8cec0]"
          style={photoBackgroundStyle(index)}
        />
      ))}
    </div>
  );
}

function ExportArtifactPreview({
  theme,
  photoCount,
  compact = false,
}: {
  theme: ExportTheme;
  photoCount: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[9/16] overflow-hidden ${
        compact ? "p-3" : "p-4 sm:p-5"
      }`}
      aria-label={`${theme.label} daily export artifact with ${photoCount} photos`}
      data-export-artifact-source="daily-memory-stamp-view"
      data-export-artifact-theme={theme.id}
      data-export-photo-count={photoCount}
      style={artifactShellStyle(theme)}
    >
      <div className="relative flex h-full flex-col">
        <header
          className="grid min-h-10 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center"
          data-export-artifact-journal-header="shell-title-only"
        >
          <span aria-hidden="true" />
          <p
            className={`truncate text-center leading-none ${
              compact ? "text-[0.8rem]" : "text-[1.02rem]"
            }`}
            style={{
              ...titleStyle(theme),
              color: isLightTheme(theme)
                ? brand.deepBurgundy
                : rgbaFromHex(brand.champagnePeach, 0.86),
            }}
          >
            Margot&apos;s Journal
          </p>
          <span aria-hidden="true" />
        </header>

        <section
          className={`mt-3 min-h-0 p-2.5 ${
            compact ? "flex-1" : "flex flex-col"
          }`}
          data-export-artifact-overlay="translucent-daily-detail-layer"
          style={overlayStyle(theme)}
        >
          <time
            dateTime="2026-08-31"
            className="block font-sans text-[0.58rem] font-semibold uppercase"
            style={utilityTextStyle(theme)}
          >
            August 31, 2026
          </time>
          <h2
            className={`mt-2 max-w-full leading-none ${
              compact ? "text-[1.08rem]" : "text-[1.48rem]"
            }`}
            style={titleStyle(theme)}
          >
            Coffee before the rain
          </h2>
          <div className={compact ? "mt-3" : "mt-4"}>
            <ExportPhotoGrid photoCount={photoCount} compact={compact} />
          </div>
        </section>

        <footer
          className={`mt-auto flex justify-center ${compact ? "pt-3" : "pb-1 pt-5"}`}
          data-export-artifact-maker-mark-position="bottom"
        >
          <span
            aria-hidden="true"
            data-export-artifact-logo="full-transparent-mgp-lockup"
            data-export-artifact-logo-color={
              isLightTheme(theme) ? "deep-burgundy-journal-title" : "source-peach"
            }
            data-export-artifact-logo-source="desktop-provided-transparent-png"
          >
            {isLightTheme(theme) ? (
              <span className="block" style={ivoryMakerMarkStyle()} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mgpLogoUrl}
                alt=""
                className="block"
                style={makerMarkStyle()}
              />
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}

function LoadingArtifactPreview({ theme }: { theme: ExportTheme }) {
  return (
    <div
      className="grid aspect-[9/16] place-items-center overflow-hidden p-4 text-center"
      aria-busy="true"
      data-export-artifact-loading-state="creating-image"
      data-export-artifact-loading-treatment="quiet-leather-only"
      style={artifactShellStyle(theme)}
    >
      <p
        className="whitespace-nowrap text-[0.78rem] leading-none"
        style={{
          color: isLightTheme(theme)
            ? brand.deepBurgundy
            : rgbaFromHex(brand.champagnePeach, 0.86),
          fontFamily: displayFont,
        }}
      >
        Creating image...
      </p>
    </div>
  );
}

function ScaledArtifactPreview({
  theme,
  photoCount,
}: {
  theme: ExportTheme;
  photoCount: number;
}) {
  return (
    <div
      className="relative mx-auto aspect-[9/16] w-[9.5rem] max-w-full overflow-hidden"
      data-save-share-modal-preview-scale="proportional-artifact"
      data-save-share-modal-preview-scale-source="full-artifact"
    >
      <div className="absolute left-1/2 top-0 w-[18rem] origin-top -translate-x-1/2 scale-[0.527777]">
        <ExportArtifactPreview theme={theme} photoCount={photoCount} />
      </div>
    </div>
  );
}

function SaveShareModalConcept({
  theme,
  state,
}: {
  theme: ExportTheme;
  state: ModalState;
}) {
  const isLoading = state === "loading";

  return (
    <div
      className="mx-auto w-full max-w-[330px]"
      data-save-share-modal-chrome="utility-action-surface"
      data-save-share-modal-state={state}
      data-save-share-modal-production-wiring="none"
    >
      <div
        className="relative aspect-[9/16] overflow-hidden shadow-[0_20px_52px_rgba(35,24,18,0.2)]"
        style={artifactShellStyle(theme)}
      >
        <div className="absolute inset-0 bg-black/30" />
        <section
          aria-labelledby={`daily-export-v2-modal-${state}`}
          className="absolute inset-x-3 bottom-3 max-h-[84%] overflow-hidden rounded-md p-3"
          data-save-share-modal-surface="edit-stamp-beige-overlay"
          role="dialog"
          aria-modal="true"
          style={modalSurfaceStyle()}
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id={`daily-export-v2-modal-${state}`}
              className="text-[1.18rem] leading-tight"
              data-save-share-modal-title="simple"
              style={{ fontFamily: displayFont }}
            >
              Save or share
            </h2>
            <button
              type="button"
              aria-label="Close save and share preview"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: rgbaFromHex(brand.deepBurgundy, 0.08),
              }}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div
            className="mx-auto mt-3 w-full max-w-[9.5rem]"
            data-save-share-modal-preview="daily-export-artifact"
          >
            {isLoading ? (
              <LoadingArtifactPreview theme={theme} />
            ) : (
              <ScaledArtifactPreview theme={theme} photoCount={5} />
            )}
          </div>

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold"
              data-save-share-modal-primary-color="journal-theme"
              data-save-share-modal-primary-action="save-image"
              style={modalPrimaryActionStyle(theme)}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Save Image
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold"
              data-save-share-modal-secondary-color="previous-primary-control"
              data-save-share-modal-secondary-action="share"
              style={modalSecondaryActionStyle(theme)}
            >
              <ShareIcon className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function DailyExportV2Playground() {
  const selectedThemes = themeIds.map(themeById);
  const primaryTheme = themeById("wine");

  return (
    <main
      className="min-h-screen bg-[#f2ece4] px-4 py-8 text-[#28231e] sm:px-6 lg:px-8"
      data-daily-export-v2-playground="true"
      data-daily-export-v2-non-production="true"
      style={{ fontFamily: utilityFont }}
    >
      <div className="mx-auto max-w-7xl">
        <section className="max-w-3xl pb-8">
          <p className="text-sm font-semibold text-[#746c61]">
            Phase 7.2A playground-only review
          </p>
          <h1
            className="mt-2 text-4xl leading-none text-[#28231e] sm:text-5xl"
            style={{ fontFamily: displayFont }}
          >
            Save or share export artifact
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5d574f]">
            A focused review surface for the utility modal chrome and the 9:16
            image generated from a daily journal entry. This route is isolated
            from the production modal and renderer.
          </p>
        </section>

        <section
          aria-labelledby="daily-export-v2-modal-title"
          className="border-t border-[#ded8cf] py-8"
        >
          <div className="mb-6 max-w-3xl">
            <h2
              id="daily-export-v2-modal-title"
              className="text-2xl leading-tight"
              style={{ fontFamily: displayFont }}
            >
              Save / Share modal chrome
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5d574f]">
              The modal stays an action surface: simple title, close control,
              export preview, and two clear actions.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-[#4f4941]">
                Ready state
              </p>
              <SaveShareModalConcept theme={primaryTheme} state="ready" />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-[#4f4941]">
                Loading state
              </p>
              <SaveShareModalConcept theme={primaryTheme} state="loading" />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="daily-export-v2-artifact-title"
          className="border-t border-[#ded8cf] py-8"
        >
          <div className="mb-6 max-w-3xl">
            <h2
              id="daily-export-v2-artifact-title"
              className="text-2xl leading-tight"
              style={{ fontFamily: displayFont }}
            >
              9:16 export artifact
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5d574f]">
              Artifact-only views for the required photo-count cases across a
              dark leather theme and the light ivory theme.
            </p>
          </div>

          <div className="grid gap-8">
            {selectedThemes.map((theme) => (
              <div key={theme.id} data-export-theme-case={theme.id}>
                <h3
                  className="mb-4 text-lg leading-tight text-[#3c352d]"
                  style={{ fontFamily: displayFont }}
                >
                  {theme.label}
                </h3>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {photoCases.map((photoCount) => (
                    <figure
                      key={`${theme.id}-${photoCount}`}
                      className="rounded-lg bg-white/54 p-3"
                      data-export-artifact-case={`${theme.id}-${photoCount}`}
                    >
                      <ExportArtifactPreview
                        theme={theme}
                        photoCount={photoCount}
                      />
                      <figcaption className="mt-3 text-sm leading-5 text-[#5d574f]">
                        {photoCount} photo{photoCount === 1 ? "" : "s"}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
