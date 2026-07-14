"use client";

import { type CSSProperties } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  MoreIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";

type ThemeOption = {
  id: string;
  label: string;
  textureUrl: string;
  background: string;
  text: string;
  muted: string;
  overlay: string;
};

type Scrap = {
  day: string;
  label: string;
};

type FinderVariantId = "base-current" | "bottom-press" | "whisper-lip";

type FinderVariant = {
  id: FinderVariantId;
  label: string;
  note: string;
  role: "reference" | "recommended" | "comparison";
};

type HomeHierarchyVariantId =
  | "current-accepted"
  | "balanced-journal-identity"
  | "stronger-journal-identity";

type HomeHierarchyVariant = {
  id: HomeHierarchyVariantId;
  label: string;
  note: string;
};

type CtaVariantId =
  | "current-reference"
  | "seal-the-day-tray"
  | "seal-the-day-light-secondary";

type CtaVariant = {
  id: CtaVariantId;
  label: string;
  note: string;
};

type DetailActionVariantId =
  | "detail-current-reference"
  | "detail-clean-shell-bottom-save";

type DetailActionVariant = {
  id: DetailActionVariantId;
  label: string;
  note: string;
};

type DetailSpacingVariantId =
  | "spacing-baseline-clean"
  | "spacing-airier-grid-start"
  | "spacing-optical-center";

type DetailSpacingVariant = {
  id: DetailSpacingVariantId;
  label: string;
  note: string;
  contentClassName: string;
  titleClassName: string;
  gridClassName: string;
};

type SaveShareVariantId =
  | "save-share-current-reference"
  | "save-share-preview-led-sheet"
  | "save-share-action-dock";

type SaveShareVariant = {
  id: SaveShareVariantId;
  label: string;
  note: string;
  role: "reference" | "recommended" | "comparison";
};

type ExportPosterVariantId =
  | "export-current-reference"
  | "export-editorial-archive"
  | "export-photo-led-poster";

type ExportPosterVariant = {
  id: ExportPosterVariantId;
  label: string;
  note: string;
  role: "reference" | "recommended" | "comparison";
};

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

const themes: ThemeOption[] = [
  {
    id: "wine",
    label: "Wine red leather",
    textureUrl: "/images/textures/wine-red-leather-texture-9x16.png",
    background: "#4b1f29",
    text: "#fbefe8",
    muted: "rgba(251, 239, 232, 0.7)",
    overlay: "rgba(34, 7, 14, 0.22)",
  },
  {
    id: "dark-brown",
    label: "Dark brown leather",
    textureUrl: "/images/textures/dark-brown-leather-texture-9x16.png",
    background: "#2b211d",
    text: "#f3eadf",
    muted: "rgba(243, 234, 223, 0.7)",
    overlay: "rgba(18, 9, 6, 0.22)",
  },
  {
    id: "burgundy",
    label: "Burgundy leather",
    textureUrl: "/images/textures/magenta-burgundy-leather-texture-9x16.png",
    background: "#57213d",
    text: "#fbecf1",
    muted: "rgba(251, 236, 241, 0.68)",
    overlay: "rgba(43, 5, 27, 0.18)",
  },
  {
    id: "black",
    label: "Black leather",
    textureUrl: "/images/textures/black-leather-texture-9x16.png",
    background: "#151312",
    text: "#f4efe7",
    muted: "rgba(244, 239, 231, 0.66)",
    overlay: "rgba(0, 0, 0, 0.18)",
  },
  {
    id: "teal",
    label: "Teal leather",
    textureUrl: "/images/textures/teal-leather-texture-9x16.png",
    background: "#183a3e",
    text: "#edf6f3",
    muted: "rgba(237, 246, 243, 0.7)",
    overlay: "rgba(5, 28, 31, 0.18)",
  },
  {
    id: "ivory",
    label: "Ivory leather",
    textureUrl: "/images/textures/ivory-leather-texture-9x16.png",
    background: "#d9ccb3",
    text: "#2e2921",
    muted: "rgba(46, 41, 33, 0.68)",
    overlay: "rgba(255, 251, 240, 0.18)",
  },
];

const comparisonThemeIds = ["wine", "black", "teal", "ivory"];
const finderThemeIds = ["wine", "ivory"];
const hierarchyThemeIds = ["wine", "dark-brown", "ivory"];
const ctaThemeIds = ["wine"];
const detailThemeIds = ["wine", "ivory"];
const detailPhotoCounts = [1, 5, 9];
const saveShareThemeIds = ["wine"];
const exportThemeIds = ["wine", "ivory"];

const scraps: Scrap[] = [
  { day: "01", label: "Rain on cafe glass" },
  { day: "02", label: "Morning linen by the window" },
  { day: "03", label: "Market flowers in paper wrap" },
  { day: "04", label: "Train window through green fields" },
  { day: "05", label: "Low tide after breakfast" },
  { day: "06", label: "Desk notes and a warm mug" },
  { day: "07", label: "Dinner candle at the corner table" },
  { day: "08", label: "Gallery wall in late afternoon" },
  { day: "09", label: "Park path after summer rain" },
  { day: "10", label: "Quiet mirror and folded towel" },
  { day: "11", label: "City dusk from the bridge" },
  { day: "12", label: "Book and coffee before bed" },
];

const spriteUrl = "/images/design-scrap-day-v2/month-sheet-demo-sprite.svg";
const goddessIconMaskUrl =
  "/images/design-scrap-day-v2/mgp-goddess-icon-mask-playground.png";

const finderVariants: FinderVariant[] = [
  {
    id: "base-current",
    label: "Base current finder",
    role: "reference",
    note: "Reference only: clean square finder, no tactile cue.",
  },
  {
    id: "bottom-press",
    label: "Subtle bottom press detail",
    role: "recommended",
    note: "Preferred playground candidate: a tiny centered underside press, tuned to feel like ritual tooling rather than hardware.",
  },
  {
    id: "whisper-lip",
    label: "Even lighter whisper lip",
    role: "comparison",
    note: "A near-invisible underside cue for cases where the press detail still feels too present.",
  },
];

const finderVariantRoleLabel: Record<FinderVariant["role"], string> = {
  reference: "Reference",
  recommended: "Preferred candidate",
  comparison: "Comparison only",
};

const homeHierarchyVariants: HomeHierarchyVariant[] = [
  {
    id: "current-accepted",
    label: "Variant A — Current accepted production reference",
    note: "Month title remains the primary page identity; journal name stays quiet.",
  },
  {
    id: "balanced-journal-identity",
    label: "Variant B — Balanced Journal Identity",
    note: "Journal name gains presence without overpowering the month archive title.",
  },
  {
    id: "stronger-journal-identity",
    label: "Variant C — Slightly Stronger Journal Identity",
    note: "Journal name is a little stronger while the month title remains substantial.",
  },
];

const ctaVariants: CtaVariant[] = [
  {
    id: "current-reference",
    label: "Variant A — Current behavior reference",
    note: "Single bottom CTA: Seal Today when today is open, Today's Stamp when today is already sealed.",
  },
  {
    id: "seal-the-day-tray",
    label: "Variant B — Seal the Day tray",
    note: "One default CTA opens a compact contextual tray for today's route and another date.",
  },
  {
    id: "seal-the-day-light-secondary",
    label: "Variant C — Seal the Day tray with lighter secondary option",
    note: "Same tray model, with Seal Another Day present but visually lighter.",
  },
];

const detailActionVariants: DetailActionVariant[] = [
  {
    id: "detail-current-reference",
    label: "Variant A — Current production reference",
    note: "Overlay keeps navigation, content, saved status, and actions together.",
  },
  {
    id: "detail-clean-shell-bottom-save",
    label: "Variant B — Final clean shell candidate",
    note: "Back arrow and journal name stay on the shell, the overlay stays content-only with a small edit pencil, and Save / Share becomes the bottom primary CTA.",
  },
];

const detailSpacingVariants: DetailSpacingVariant[] = [
  {
    id: "spacing-baseline-clean",
    label: "Spacing A — Current clean candidate",
    note: "Reference for the no-status, no-settings candidate before spacing changes.",
    contentClassName: "",
    titleClassName: "mt-2",
    gridClassName: "mt-3",
  },
  {
    id: "spacing-airier-grid-start",
    label: "Spacing B — Airier date/title/grid",
    note: "Adds a little room after the date and before photos so the first photo row starts less abruptly.",
    contentClassName: "pt-1",
    titleClassName: "mt-3",
    gridClassName: "mt-5",
  },
  {
    id: "spacing-optical-center",
    label: "Spacing C — Optically centered artifact",
    note: "Centers the content block a touch lower inside the overlay while keeping the same shell and bottom CTA.",
    contentClassName: "flex min-h-full flex-col justify-center pb-4",
    titleClassName: "mt-3",
    gridClassName: "mt-5",
  },
];

const saveShareVariants: SaveShareVariant[] = [
  {
    id: "save-share-current-reference",
    label: "Variant A — Current utility modal",
    note: "Reference only: functional preview, save, and share actions remain grouped in a plain utility sheet.",
    role: "reference",
  },
  {
    id: "save-share-preview-led-sheet",
    label: "Variant B — Preview-led bottom sheet",
    note: "Preferred playground candidate: the export preview becomes the hero, with Save Image as the primary action and Share as a quieter secondary action.",
    role: "recommended",
  },
  {
    id: "save-share-action-dock",
    label: "Variant C — Compact action dock",
    note: "Comparison candidate: keeps the preview large and moves actions into a compact bottom dock for faster repeated saving.",
    role: "comparison",
  },
];

const exportPosterVariants: ExportPosterVariant[] = [
  {
    id: "export-current-reference",
    label: "Variant A — Current export reference",
    note: "Reference only: the stamp stays small with generous negative space, matching the current technical export behavior.",
    role: "reference",
  },
  {
    id: "export-editorial-archive",
    label: "Variant B — Editorial archive poster",
    note: "Preferred playground candidate: larger photo artifact, clear journal/date hierarchy, and a restrained brand mark integrated into the leather field.",
    role: "recommended",
  },
  {
    id: "export-photo-led-poster",
    label: "Variant C — Photo-led keepsake",
    note: "Comparison candidate: a more immersive composition that gives the nine scraps the most visual weight.",
    role: "comparison",
  },
];

function rgbaFromHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function EditStampIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="m5 19 3.2-.7L18.1 8.4a2.1 2.1 0 0 0-3-3L5.2 15.3 5 19Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m13.7 6.8 3.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PlaygroundRoleBadge({
  role,
}: {
  role: "reference" | "recommended" | "comparison";
}) {
  return (
    <span
      className="inline-flex min-h-6 items-center px-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
      style={{
        backgroundColor:
          role === "recommended"
            ? rgbaFromHex(brand.deepBurgundy, 0.08)
            : "transparent",
        color: role === "recommended" ? brand.deepBurgundy : "#746c61",
        fontFamily: utilityFont,
      }}
    >
      {finderVariantRoleLabel[role]}
    </span>
  );
}

function tileBackgroundPosition(index: number) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x = column === 0 ? "0%" : column === 1 ? "50%" : "100%";
  const y =
    row === 0 ? "0%" : row === 1 ? "33.333%" : row === 2 ? "66.667%" : "100%";

  return `${x} ${y}`;
}

function isLightLeather(theme: ThemeOption) {
  return theme.id === "ivory";
}

function themeById(themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

function journalTitleStyle(theme: ThemeOption) {
  return {
    color: isLightLeather(theme)
      ? brand.deepBurgundy
      : rgbaFromHex(brand.champagnePeach, 0.78),
    fontFamily: displayFont,
  } satisfies CSSProperties;
}

function monthTitleStyle(theme: ThemeOption) {
  return {
    color: isLightLeather(theme) ? brand.deepBurgundy : brand.warmIvory,
    fontFamily: displayFont,
  } satisfies CSSProperties;
}

function overlayStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.vintageBlush, 0.14)
      : rgbaFromHex(brand.vintageBlush, 0.16),
    backgroundImage: lightLeather
      ? `linear-gradient(180deg, ${rgbaFromHex(brand.warmIvory, 0.16)}, ${rgbaFromHex(brand.cocoaTaupe, 0.08)})`
      : `linear-gradient(180deg, ${rgbaFromHex(brand.warmIvory, 0.1)}, ${rgbaFromHex(brand.champagnePeach, 0.07)})`,
    border: "none",
    boxShadow: "none",
    backdropFilter: "blur(1.5px)",
    WebkitBackdropFilter: "blur(1.5px)",
  } satisfies CSSProperties;
}

function navButtonStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.deepBurgundy, 0.08)
      : rgbaFromHex(brand.warmIvory, 0.13),
    border: "none",
    color: lightLeather ? brand.deepBurgundy : brand.warmIvory,
  } satisfies CSSProperties;
}

function ctaStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? brand.deepBurgundy
      : rgbaFromHex(brand.warmIvory, 0.92),
    color: lightLeather ? brand.warmIvory : brand.deepBurgundy,
    boxShadow: lightLeather
      ? `0 10px 24px ${rgbaFromHex(brand.cocoaTaupe, 0.16)}`
      : "0 10px 24px rgba(17, 6, 8, 0.18)",
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function ctaSecondaryStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.deepBurgundy, 0.07)
      : rgbaFromHex(brand.warmIvory, 0.14),
    color: lightLeather ? brand.deepBurgundy : brand.warmIvory,
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function ctaTrayStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.warmIvory, 0.7)
      : rgbaFromHex(brand.deepBurgundy, 0.42),
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: lightLeather
      ? `0 12px 28px ${rgbaFromHex(brand.cocoaTaupe, 0.15)}`
      : "0 14px 34px rgba(17, 6, 8, 0.2)",
  } satisfies CSSProperties;
}

function finderPanelStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.warmIvory, 0.54)
      : rgbaFromHex(brand.warmIvory, 0.28),
    backdropFilter: "blur(1.5px)",
    WebkitBackdropFilter: "blur(1.5px)",
  } satisfies CSSProperties;
}

function finderPhotoStyle() {
  return {
    backgroundImage: `url("${spriteUrl}")`,
    backgroundPosition: "50% 66.667%",
    backgroundSize: "300% 400%",
  } satisfies CSSProperties;
}

function tactilePressStyle(theme: ThemeOption, variantId: FinderVariantId) {
  if (variantId === "base-current") return undefined;

  const lightLeather = isLightLeather(theme);
  const isWhisper = variantId === "whisper-lip";

  return {
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.cocoaTaupe, isWhisper ? 0.13 : 0.2)
      : rgbaFromHex(brand.champagnePeach, isWhisper ? 0.18 : 0.3),
    borderRadius: "0 0 999px 999px",
    bottom: isWhisper ? "-4px" : "-7px",
    height: isWhisper ? "2px" : "6px",
    left: "50%",
    opacity: isWhisper ? 0.68 : 0.82,
    pointerEvents: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    width: isWhisper ? "22%" : "32%",
  } satisfies CSSProperties;
}

function brandEmbossStyle(theme: ThemeOption) {
  const lightLeather = isLightLeather(theme);

  return {
    aspectRatio: "418 / 524",
    backgroundColor: lightLeather
      ? rgbaFromHex(brand.deepBurgundy, 0.14)
      : rgbaFromHex(brand.champagnePeach, 0.18),
    bottom: "4.95rem",
    filter: lightLeather
      ? `drop-shadow(0 1px 0 ${rgbaFromHex(brand.warmIvory, 0.32)}) drop-shadow(0 -1px 0 ${rgbaFromHex(brand.cocoaTaupe, 0.16)})`
      : "drop-shadow(0 1px 0 rgba(18, 6, 8, 0.22)) drop-shadow(0 -1px 0 rgba(255, 255, 255, 0.05))",
    left: "50%",
    maskImage: `url("${goddessIconMaskUrl}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    opacity: 0.68,
    pointerEvents: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    WebkitMaskImage: `url("${goddessIconMaskUrl}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    width: "2.75rem",
    zIndex: 8,
  } satisfies CSSProperties;
}

function phoneShellStyle(theme: ThemeOption) {
  return {
    backgroundColor: theme.background,
    backgroundImage: `linear-gradient(180deg, ${theme.overlay}, rgba(0, 0, 0, 0.1)), url("${theme.textureUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    color: theme.text,
  } satisfies CSSProperties;
}

function BrandEmbossMark({ theme }: { theme: ThemeOption }) {
  return (
    <span
      aria-hidden="true"
      data-playground-brand-emboss="goddess-icon-only"
      style={brandEmbossStyle(theme)}
    />
  );
}

function JournalHeader({
  theme,
  hierarchy,
}: {
  theme: ThemeOption;
  hierarchy: HomeHierarchyVariant;
}) {
  const titleClassName = {
    "current-accepted": "max-w-[190px] text-[1.02rem] leading-tight",
    "balanced-journal-identity": "max-w-[225px] text-[1.28rem] leading-[1.02]",
    "stronger-journal-identity": "max-w-[235px] text-[1.42rem] leading-none",
  }[hierarchy.id];

  return (
    <header
      className="grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center"
      data-playground-header-alignment="centerline"
    >
      <span aria-hidden="true" />
      <h3
        className={`justify-self-center truncate text-center ${titleClassName}`}
        style={journalTitleStyle(theme)}
      >
        Margot&apos;s Journal
      </h3>
      <button
        type="button"
        aria-label="Journal settings"
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: isLightLeather(theme)
            ? rgbaFromHex(brand.deepBurgundy, 0.08)
            : "rgba(255, 255, 255, 0.12)",
          border: "none",
          color: isLightLeather(theme) ? brand.deepBurgundy : brand.warmIvory,
        }}
      >
        <MoreIcon className="h-4 w-4" />
      </button>
    </header>
  );
}

function MonthBar({
  theme,
  hierarchy,
}: {
  theme: ThemeOption;
  hierarchy: HomeHierarchyVariant;
}) {
  const buttonStyle = navButtonStyle(theme);
  const monthTitleClassName = {
    "current-accepted": "text-[1.85rem] leading-[1.05]",
    "balanced-journal-identity": "text-[1.48rem] leading-[1.08]",
    "stronger-journal-identity": "text-[1.36rem] leading-[1.1]",
  }[hierarchy.id];

  return (
    <div className="flex items-center justify-between gap-3">
      <h4
        className={`min-w-0 truncate ${monthTitleClassName}`}
        style={monthTitleStyle(theme)}
      >
        August 2026
      </h4>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={buttonStyle}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={buttonStyle}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MonthTile({
  index,
  scrap,
  theme,
}: {
  index: number;
  scrap: Scrap;
  theme: ThemeOption;
}) {
  const photoStyle = {
    backgroundImage: `url("${spriteUrl}")`,
    backgroundPosition: tileBackgroundPosition(index),
    backgroundSize: "300% 400%",
  } satisfies CSSProperties;

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-label={`${scrap.day} ${scrap.label}`}
        className="block w-full text-left"
      >
        <span
          aria-hidden="true"
          className="relative block aspect-square overflow-hidden bg-[#d8cec0]"
          style={photoStyle}
        >
          <span
            className="absolute left-2 top-1.5 font-sans text-[10px] font-semibold leading-none tabular-nums"
            style={{
              color: brand.warmIvory,
              textShadow: `0 1px 4px ${rgbaFromHex(theme.background, 0.82)}`,
            }}
          >
            {Number.parseInt(scrap.day, 10)}
          </span>
        </span>
      </button>
    </li>
  );
}

function MonthEmptyPreview({ theme }: { theme: ThemeOption }) {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center"
      data-playground-empty-state="quiet-waiting"
    >
      <div>
        <p
          className="text-[1.24rem] leading-tight"
          style={monthTitleStyle(theme)}
        >
          No sealed days here.
        </p>
        <p
          className="mx-auto mt-2 max-w-[24ch] text-[0.78rem] leading-relaxed"
          style={{
            color: isLightLeather(theme)
              ? rgbaFromHex(brand.cocoaTaupe, 0.78)
              : rgbaFromHex(brand.champagnePeach, 0.76),
            fontFamily: utilityFont,
          }}
        >
          Choose a date to keep one.
        </p>
      </div>
    </div>
  );
}

function BottomCtaPreview({
  theme,
  variant,
  todaySealed,
}: {
  theme: ThemeOption;
  variant: CtaVariant;
  todaySealed: boolean;
}) {
  const primaryLabel = todaySealed ? "Today's Stamp" : "Seal Today";
  const trayPrimaryLabel = todaySealed ? "Today's Stamp" : "Seal Today";
  const secondaryStyle =
    variant.id === "seal-the-day-light-secondary"
      ? {
          ...ctaSecondaryStyle(theme),
          backgroundColor: "transparent",
          opacity: 0.78,
        }
      : ctaSecondaryStyle(theme);

  if (
    variant.id === "seal-the-day-tray" ||
    variant.id === "seal-the-day-light-secondary"
  ) {
    return (
      <div
        className="pointer-events-none absolute inset-x-3 bottom-3 z-10 grid gap-2"
        data-playground-cta-variant={variant.id}
        data-playground-cta-default-label="Seal the Day"
        data-playground-cta-tray-state="open-preview"
        data-playground-today-state={
          todaySealed ? "today-sealed" : "today-open"
        }
      >
        <div
          className="pointer-events-auto grid gap-1.5 rounded-[1.1rem] p-2"
          style={ctaTrayStyle(theme)}
          data-playground-cta-tray="contextual-menu"
        >
          <button
            type="button"
            className="flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-semibold"
            style={ctaSecondaryStyle(theme)}
          >
            {trayPrimaryLabel}
          </button>
          <button
            type="button"
            className="flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-semibold"
            style={secondaryStyle}
            data-playground-backfill-option={
              variant.id === "seal-the-day-light-secondary"
                ? "lighter-secondary"
                : "standard-secondary"
            }
          >
            Seal Another Day
          </button>
        </div>
        <button
          type="button"
          className="pointer-events-auto flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold"
          style={ctaStyle(theme)}
        >
          Seal the Day
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-3 bottom-3 z-10"
      data-playground-cta-variant={variant.id}
      data-playground-today-state={todaySealed ? "today-sealed" : "today-open"}
    >
      <button
        type="button"
        className="pointer-events-auto flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold"
        style={ctaStyle(theme)}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

function PhonePreview({
  theme,
  hierarchy = homeHierarchyVariants[0],
  ctaVariant = ctaVariants[0],
  todaySealed = false,
  empty = false,
  showBrandEmboss = false,
  tallShell = false,
  label,
}: {
  theme: ThemeOption;
  hierarchy?: HomeHierarchyVariant;
  ctaVariant?: CtaVariant;
  todaySealed?: boolean;
  empty?: boolean;
  showBrandEmboss?: boolean;
  tallShell?: boolean;
  label?: string;
}) {
  const hasTray =
    ctaVariant.id === "seal-the-day-tray" ||
    ctaVariant.id === "seal-the-day-light-secondary";
  const bottomPadding = hasTray ? "pb-[132px]" : "pb-[62px]";

  return (
    <div className="mx-auto w-full max-w-[370px]">
      <p
        className="mb-3 text-sm font-semibold text-[#4f4941]"
        style={{ fontFamily: utilityFont }}
      >
        {label ?? theme.label}
      </p>
      <div
        className={`relative overflow-hidden bg-[#30251f] shadow-[0_24px_70px_rgba(37,31,26,0.24)] ${
          tallShell ? "aspect-[9/19.25]" : "aspect-[9/16]"
        }`}
        data-playground-home-hierarchy={hierarchy.id}
        data-playground-month-state={empty ? "empty" : "filled"}
        data-playground-cta-model={ctaVariant.id}
        style={phoneShellStyle(theme)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,transparent,rgba(0,0,0,0.16))]" />
        <div className="relative flex h-full flex-col p-3">
          <JournalHeader theme={theme} hierarchy={hierarchy} />
          <div className="mt-3 min-h-0 flex-1 overflow-hidden" style={overlayStyle(theme)}>
            <div className={`flex h-full flex-col p-2 ${bottomPadding}`}>
              <MonthBar theme={theme} hierarchy={hierarchy} />
              {empty ? (
                <MonthEmptyPreview theme={theme} />
              ) : (
                <ol
                  aria-label={`${theme.label} brand-guided Month Sheet sample`}
                  className="mt-2 grid grid-cols-3 gap-1"
                >
                  {scraps.map((scrap, index) => (
                    <MonthTile
                      key={`${theme.id}-${scrap.day}`}
                      index={index}
                      scrap={scrap}
                      theme={theme}
                    />
                  ))}
                </ol>
              )}
            </div>
          </div>
          {showBrandEmboss && !hasTray ? (
            <BrandEmbossMark theme={theme} />
          ) : null}
          <BottomCtaPreview
            theme={theme}
            variant={ctaVariant}
            todaySealed={todaySealed}
          />
        </div>
      </div>
    </div>
  );
}

function detailPhotoStyle(index: number) {
  return {
    backgroundImage: `url("${spriteUrl}")`,
    backgroundPosition: tileBackgroundPosition(index),
    backgroundSize: "300% 400%",
  } satisfies CSSProperties;
}

function DetailPhotoGrid({
  photoCount,
  theme,
  gridClassName = "mt-3",
}: {
  photoCount: number;
  theme: ThemeOption;
  gridClassName?: string;
}) {
  const columns = photoCount <= 1 ? "grid-cols-1" : photoCount <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div
      className={`${gridClassName} grid ${columns} gap-1.5`}
      data-playground-detail-photo-count={photoCount}
      data-playground-detail-photo-grid="borderless-adaptive"
    >
      {Array.from({ length: photoCount }, (_, index) => (
        <span
          key={`detail-photo-${photoCount}-${index}`}
          className="block aspect-square overflow-hidden"
          style={{
            ...detailPhotoStyle(index),
            backgroundColor: isLightLeather(theme)
              ? rgbaFromHex(brand.vintageBlush, 0.24)
              : rgbaFromHex(brand.warmIvory, 0.18),
          }}
        />
      ))}
    </div>
  );
}

function DetailShellRow({ theme }: { theme: ThemeOption }) {
  const controlStyle = navButtonStyle(theme);

  return (
    <header
      className="grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center"
      data-playground-detail-shell-row="back-title-spacer"
    >
      <button
        type="button"
        aria-label="Back to month sheet"
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={controlStyle}
        data-playground-detail-back-placement="shell-icon"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <h3
        className="justify-self-center truncate text-center text-[1.42rem] leading-none"
        style={journalTitleStyle(theme)}
      >
        Margot&apos;s Journal
      </h3>
      <span
        aria-hidden="true"
        className="block h-11 w-11 justify-self-end"
        data-playground-detail-right-spacer="balance"
      />
    </header>
  );
}

function CurrentDetailActionRow({ theme }: { theme: ThemeOption }) {
  return (
    <div
      className="flex items-center justify-between gap-2"
      data-playground-detail-actions-placement="inside-overlay"
    >
      <button
        type="button"
        className="min-h-9 rounded-full px-3 text-xs font-semibold"
        style={ctaSecondaryStyle(theme)}
      >
        Save / Share
      </button>
      <button
        type="button"
        className="min-h-9 rounded-full px-3 text-xs font-semibold"
        style={{
          backgroundColor: "transparent",
          color: isLightLeather(theme) ? brand.deepBurgundy : brand.warmIvory,
          fontFamily: utilityFont,
        }}
      >
        Edit stamp
      </button>
    </div>
  );
}

function DetailBottomSaveCta({ theme }: { theme: ThemeOption }) {
  return (
    <div
      className="mt-3"
      data-playground-detail-actions-placement="shell-layer"
    >
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold"
        style={ctaStyle(theme)}
        data-playground-detail-bottom-cta="save-share"
      >
        Save / Share
      </button>
    </div>
  );
}

function ExportPhotoMosaic({
  theme,
  variant,
  compact = false,
}: {
  theme: ThemeOption;
  variant: ExportPosterVariant;
  compact?: boolean;
}) {
  const photoCount = variant.id === "export-current-reference" ? 4 : 9;
  const columns =
    variant.id === "export-current-reference"
      ? "grid-cols-2"
      : "grid-cols-3";
  const gap = compact ? "gap-[3px]" : "gap-1";

  return (
    <div
      className={`grid ${columns} ${gap}`}
      data-playground-export-photo-mosaic={variant.id}
    >
      {Array.from({ length: photoCount }, (_, index) => (
        <span
          key={`${variant.id}-poster-photo-${index}`}
          className="block aspect-square overflow-hidden"
          style={{
            ...detailPhotoStyle(index),
            backgroundColor: isLightLeather(theme)
              ? rgbaFromHex(brand.vintageBlush, 0.24)
              : rgbaFromHex(brand.warmIvory, 0.18),
          }}
        />
      ))}
    </div>
  );
}

function DailyExportPosterPreview({
  theme,
  variant,
  compact = false,
}: {
  theme: ThemeOption;
  variant: ExportPosterVariant;
  compact?: boolean;
}) {
  const lightLeather = isLightLeather(theme);
  const isReference = variant.id === "export-current-reference";
  const isPhotoLed = variant.id === "export-photo-led-poster";
  const posterPadding = compact ? "p-3" : "p-5";
  const artifactClassName = isReference
    ? "mx-auto mt-16 w-[64%] p-3"
    : isPhotoLed
      ? "mt-7 w-full p-3"
      : "mt-10 w-full p-3";
  const titleClassName = isReference
    ? "text-[1.05rem] leading-tight"
    : "text-[1.64rem] leading-none";

  return (
    <div
      className={`relative aspect-[9/16] overflow-hidden ${posterPadding}`}
      data-playground-daily-export-variant={variant.id}
      data-playground-export-redesign="playground-only"
      style={phoneShellStyle(theme)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_36%),linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />
      <div className="relative flex h-full flex-col">
        <header
          className={`grid grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-3 ${
            isReference ? "opacity-70" : ""
          }`}
        >
          <div className="min-w-0">
            <p
              className="truncate text-[0.92rem] leading-none"
              style={journalTitleStyle(theme)}
            >
              Margot&apos;s Journal
            </p>
            <p
              className="mt-2 text-[0.56rem] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: lightLeather
                  ? rgbaFromHex(brand.deepBurgundy, 0.66)
                  : rgbaFromHex(brand.champagnePeach, 0.76),
                fontFamily: utilityFont,
              }}
            >
              August 31, 2026
            </p>
          </div>
          <span
            aria-hidden="true"
            className="justify-self-end text-right text-[0.6rem] font-semibold leading-none"
            style={{
              color: lightLeather
                ? rgbaFromHex(brand.deepBurgundy, 0.4)
                : rgbaFromHex(brand.champagnePeach, 0.5),
              fontFamily: displayFont,
            }}
          >
            MGP
          </span>
        </header>

        {isPhotoLed ? (
          <div className="mt-5 aspect-[4/5] overflow-hidden">
            <span
              aria-hidden="true"
              className="block h-full w-full"
              style={detailPhotoStyle(3)}
            />
          </div>
        ) : null}

        <div
          className={artifactClassName}
          style={overlayStyle(theme)}
          data-playground-export-artifact-surface={
            isReference ? "current-small-stamp" : "large-editorial-artifact"
          }
        >
          <h3 className={titleClassName} style={monthTitleStyle(theme)}>
            Coffee before the rain
          </h3>
          <div className={isReference ? "mt-3" : "mt-5"}>
            <ExportPhotoMosaic
              theme={theme}
              variant={variant}
              compact={compact || isReference}
            />
          </div>
        </div>

        <footer className="mt-auto flex items-end justify-between gap-4 pt-5">
          <p
            className="max-w-[18ch] text-[0.56rem] font-semibold uppercase tracking-[0.14em]"
            style={{
              color: lightLeather
                ? rgbaFromHex(brand.cocoaTaupe, 0.58)
                : rgbaFromHex(brand.champagnePeach, 0.58),
              fontFamily: utilityFont,
            }}
          >
            Scrap the Day
          </p>
          <p
            className="text-right text-[0.56rem] leading-tight"
            style={{
              color: lightLeather
                ? rgbaFromHex(brand.cocoaTaupe, 0.62)
                : rgbaFromHex(brand.warmIvory, 0.62),
              fontFamily: utilityFont,
            }}
          >
            Modern Goddess Patina
          </p>
        </footer>
      </div>
    </div>
  );
}

function SaveShareModalPreview({
  theme,
  variant,
}: {
  theme: ThemeOption;
  variant: SaveShareVariant;
}) {
  const reference = variant.id === "save-share-current-reference";
  const actionDock = variant.id === "save-share-action-dock";
  const modalClassName = reference
    ? "absolute inset-x-4 bottom-4 max-h-[70%] overflow-hidden rounded-lg p-3"
    : actionDock
      ? "absolute inset-x-3 bottom-3 overflow-hidden rounded-lg p-3"
      : "absolute inset-x-3 bottom-3 max-h-[82%] overflow-hidden rounded-lg p-3";

  return (
    <div className="mx-auto w-full max-w-[330px]">
      <div
        className="relative aspect-[9/16] overflow-hidden bg-[#30251f] shadow-[0_22px_58px_rgba(37,31,26,0.2)]"
        style={phoneShellStyle(theme)}
        data-playground-save-share-modal={variant.id}
        data-playground-save-share-redesign="playground-only"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]" />
        <div className="relative flex h-full flex-col p-3">
          <DetailShellRow theme={theme} />
          <div
            className="mt-3 min-h-0 flex-1 overflow-hidden p-2.5"
            style={overlayStyle(theme)}
          >
            <DetailOverlayContent
              theme={theme}
              photoCount={5}
              editPlacement="overlay-icon"
            />
          </div>
          <DetailBottomSaveCta theme={theme} />
        </div>
        <div className="absolute inset-0 bg-black/28" />
        <section
          aria-label={`${variant.label} preview`}
          className={modalClassName}
          data-playground-save-share-sheet={variant.id}
          style={{
            backgroundColor: isLightLeather(theme)
              ? rgbaFromHex(brand.warmIvory, 0.92)
              : rgbaFromHex(brand.deepBurgundy, 0.78),
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: isLightLeather(theme) ? brand.deepBurgundy : brand.warmIvory,
          }}
        >
          <header className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[1.15rem] leading-tight" style={{ fontFamily: displayFont }}>
                Save or share
              </h3>
              <p
                className="mt-1 text-[0.62rem] leading-tight opacity-75"
                style={{ fontFamily: utilityFont }}
              >
                Daily 9:16 image
              </p>
            </div>
            <button
              type="button"
              aria-label="Close save and share preview"
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={ctaSecondaryStyle(theme)}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div
            className={`mt-3 grid gap-3 ${
              reference ? "" : actionDock ? "grid-cols-[5rem_minmax(0,1fr)]" : ""
            }`}
          >
            <div
              className={`mx-auto w-full ${
                actionDock ? "max-w-[5rem]" : "max-w-[9.5rem]"
              }`}
              data-playground-save-share-preview="daily-export"
            >
              <DailyExportPosterPreview
                theme={theme}
                variant={exportPosterVariants[1]}
                compact
              />
            </div>
            <div className={actionDock ? "self-end" : ""}>
              <div className="grid gap-2">
                <button
                  type="button"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold"
                  style={ctaStyle(theme)}
                  data-playground-save-share-primary="save-image"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Save Image
                </button>
                <button
                  type="button"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold"
                  style={ctaSecondaryStyle(theme)}
                  data-playground-save-share-secondary="share"
                >
                  <ShareIcon className="h-3.5 w-3.5" />
                  Share
                </button>
              </div>
              {!reference ? (
                <p
                  className="mt-2 text-center text-[0.58rem] leading-snug opacity-70"
                  style={{ fontFamily: utilityFont }}
                >
                  PNG preview, no runtime export changes.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <p
        className="mt-2 text-sm leading-6 text-[#5d574f]"
        style={{ fontFamily: utilityFont }}
      >
        {variant.note}
      </p>
    </div>
  );
}

function DetailOverlayContent({
  theme,
  photoCount,
  editPlacement = "none",
  spacingVariant = detailSpacingVariants[0],
}: {
  theme: ThemeOption;
  photoCount: number;
  editPlacement?: "none" | "overlay-icon";
  spacingVariant?: DetailSpacingVariant;
}) {
  return (
    <div
      className={spacingVariant.contentClassName}
      data-playground-detail-edit-placement={editPlacement}
      data-playground-detail-spacing={spacingVariant.id}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2">
        <div className="min-w-0">
          <p
            className="text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              color: isLightLeather(theme)
                ? rgbaFromHex(brand.deepBurgundy, 0.74)
                : rgbaFromHex(brand.champagnePeach, 0.82),
              fontFamily: utilityFont,
            }}
          >
            August 31, 2026
          </p>
          <h4
            className={`${spacingVariant.titleClassName} text-[1.48rem] leading-none`}
            style={monthTitleStyle(theme)}
          >
            Coffee before the rain
          </h4>
        </div>
        {editPlacement === "overlay-icon" ? (
          <button
            type="button"
            aria-label="Edit stamp"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={ctaSecondaryStyle(theme)}
            data-playground-detail-edit-placement="overlay-icon"
          >
            <EditStampIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <DetailPhotoGrid
        photoCount={photoCount}
        theme={theme}
        gridClassName={spacingVariant.gridClassName}
      />
    </div>
  );
}

function DailyDetailActionPreview({
  theme,
  variant,
  photoCount,
  spacingVariant = detailSpacingVariants[0],
}: {
  theme: ThemeOption;
  variant: DetailActionVariant;
  photoCount: number;
  spacingVariant?: DetailSpacingVariant;
}) {
  const currentReference = variant.id === "detail-current-reference";
  const overlayEdit = !currentReference;
  const effectiveSpacing = currentReference
    ? detailSpacingVariants[0]
    : spacingVariant;

  return (
    <div className="mx-auto w-full max-w-[330px]">
      <div
        className="relative aspect-[9/16] overflow-hidden bg-[#30251f] shadow-[0_22px_58px_rgba(37,31,26,0.2)]"
        style={phoneShellStyle(theme)}
        data-playground-detail-action-variant={variant.id}
        data-playground-detail-overlay={
          currentReference ? "current-action-container" : "content-only"
        }
        data-playground-detail-shell-actions={
          currentReference ? "inside-overlay" : "outside-overlay"
        }
        data-playground-detail-spacing-candidate={effectiveSpacing.id}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.16))]" />
        <div className="relative flex h-full flex-col p-3">
          {currentReference ? (
            <JournalHeader
              theme={theme}
              hierarchy={homeHierarchyVariants[0]}
            />
          ) : (
            <DetailShellRow theme={theme} />
          )}

          <div
            className="mt-3 min-h-0 flex-1 overflow-hidden p-2.5"
            style={overlayStyle(theme)}
            data-playground-detail-content-surface="sheer-overlay"
          >
            {currentReference ? (
              <button
                type="button"
                className="mb-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold"
                style={{
                  color: isLightLeather(theme)
                    ? brand.deepBurgundy
                    : rgbaFromHex(brand.champagnePeach, 0.82),
                  fontFamily: utilityFont,
                }}
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Back to month sheet
              </button>
            ) : null}

            <DetailOverlayContent
              theme={theme}
              photoCount={photoCount}
              editPlacement={overlayEdit ? "overlay-icon" : "none"}
              spacingVariant={effectiveSpacing}
            />

            {currentReference ? (
              <div className="mt-3 grid gap-2">
                <p
                  className="text-center text-[0.68rem]"
                  style={{
                    color: isLightLeather(theme)
                      ? rgbaFromHex(brand.cocoaTaupe, 0.72)
                      : rgbaFromHex(brand.champagnePeach, 0.72),
                    fontFamily: utilityFont,
                  }}
                >
                  Saved in this journal.
                </p>
                <CurrentDetailActionRow theme={theme} />
              </div>
            ) : null}
          </div>

          {!currentReference ? <DetailBottomSaveCta theme={theme} /> : null}
        </div>
      </div>
      <p
        className="mt-2 text-sm leading-6 text-[#5d574f]"
        style={{ fontFamily: utilityFont }}
      >
        {theme.label} / {photoCount} photo{photoCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ScrapFinderPlaygroundPreview({
  theme,
  variant,
}: {
  theme: ThemeOption;
  variant: FinderVariant;
}) {
  const pressStyle = tactilePressStyle(theme, variant.id);

  return (
    <div
      className="min-w-0"
      data-playground-finder-role={variant.role}
      data-playground-finder-primary={
        variant.role === "recommended" ? "subtle-bottom-press" : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p
          className="text-sm font-semibold text-[#4f4941]"
          style={{ fontFamily: utilityFont }}
        >
          {theme.label} / {variant.label}
        </p>
        <span
          className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
          style={{
            color:
              variant.role === "recommended"
                ? brand.deepBurgundy
                : "#746c61",
            fontFamily: utilityFont,
          }}
        >
          {finderVariantRoleLabel[variant.role]}
        </span>
      </div>
      <div
        className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden bg-[#30251f] shadow-[0_22px_58px_rgba(37,31,26,0.2)]"
        data-playground-scrap-finder="true"
        data-playground-finder-variant={variant.id}
        data-playground-finder-recommendation={variant.role}
        style={phoneShellStyle(theme)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,transparent,rgba(0,0,0,0.16))]" />
        <div className="relative flex h-full flex-col px-4 py-5">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h3
                className="text-[1.45rem] leading-none"
                style={monthTitleStyle(theme)}
              >
                Find today&apos;s scrap
              </h3>
              <p
                className="mt-2 text-xs leading-relaxed"
                style={{ color: theme.muted, fontFamily: utilityFont }}
              >
                Move the photo under the finder.
              </p>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: theme.muted, fontFamily: utilityFont }}
            >
              Close
            </span>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className="relative w-[82%] p-3"
              style={finderPanelStyle(theme)}
            >
              <div
                className="aspect-square overflow-hidden"
                style={finderPhotoStyle()}
              />
              {pressStyle ? (
                <span
                  aria-hidden="true"
                  data-playground-finder-press-detail={variant.id}
                  style={pressStyle}
                />
              ) : null}
            </div>
          </div>

          <footer className="pb-1">
            <p
              className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
              style={{ color: theme.muted, fontFamily: utilityFont }}
            >
              Zoom
            </p>
            <div
              className="h-1.5 w-full"
              style={{
                backgroundColor: isLightLeather(theme)
                  ? rgbaFromHex(brand.deepBurgundy, 0.14)
                  : rgbaFromHex(brand.warmIvory, 0.18),
              }}
            />
            <div
              className="mt-4 flex min-h-12 items-center justify-center rounded-full text-sm font-semibold"
              style={ctaStyle(theme)}
            >
              Use this scrap
            </div>
          </footer>
        </div>
      </div>
      <p
        className="mx-auto mt-3 max-w-[320px] text-sm leading-6 text-[#5d574f]"
        style={{ fontFamily: utilityFont }}
      >
        {variant.note}
      </p>
    </div>
  );
}

export function ScrapDayV2Playground() {
  const comparisonThemes = comparisonThemeIds.map(themeById);
  const finderThemes = finderThemeIds.map(themeById);
  const hierarchyThemes = hierarchyThemeIds.map(themeById);
  const ctaThemes = ctaThemeIds.map(themeById);
  const detailThemes = detailThemeIds.map(themeById);
  const saveShareThemes = saveShareThemeIds.map(themeById);
  const exportThemes = exportThemeIds.map(themeById);

  return (
    <main className="min-h-dvh bg-[#efede8] px-4 py-6 text-[#28231e] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="py-6">
          <p
            className="text-sm font-semibold text-[#766f65]"
            style={{ fontFamily: utilityFont }}
          >
            Phase 7R local design playground
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1
                className="max-w-3xl text-4xl leading-tight sm:text-5xl"
                style={{ fontFamily: displayFont }}
              >
                Brand-guided Month Sheet direction
              </h1>
              <p
                className="mt-4 max-w-2xl text-base leading-7 text-[#5d574f]"
                style={{ fontFamily: utilityFont }}
              >
                A focused playground-only pass on the preferred bottom CTA
                direction using the Modern Goddess Patina palette. Production
                customer routes are not modified by this playground.
              </p>
            </div>
            <a
              href="#brand-comparison"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#421819] px-5 text-sm font-semibold text-[#E8DBCC]"
              style={{ fontFamily: utilityFont }}
            >
              Compare leather views
            </a>
          </div>
        </header>

        <section
          aria-labelledby="brand-emboss-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="brand-emboss-placement"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Playground-only exploration
            </p>
            <h2
              id="brand-emboss-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Goddess icon blind emboss above the CTA
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Cropped from the Modern Goddess Patina lockup and tested as an
              icon-only leather emboss. This section is isolated to the design
              playground and does not change production.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <PhonePreview
              theme={themeById("wine")}
              hierarchy={homeHierarchyVariants[2]}
              tallShell
              label="Reference — no lower brand mark"
            />
            <PhonePreview
              theme={themeById("wine")}
              hierarchy={homeHierarchyVariants[2]}
              showBrandEmboss
              tallShell
              label="Recommended — subtle goddess icon emboss"
            />
          </div>
        </section>

        <section
          aria-labelledby="brand-comparison-title"
          className="border-t border-[#d8d2c8] py-8"
          id="brand-comparison"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Preferred direction
            </p>
            <h2
              id="brand-comparison-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Bottom sticky ritual CTA with quiet journal identity
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Fake leather deboss has been removed. The journal name is now a
              quiet editorial identity mark, the month title carries the main
              typographic hierarchy, and the sheer overlay/CTA use the brand
              palette across dark and light leather.
            </p>
          </div>

          <div className="grid gap-8 xl:grid-cols-2">
            {comparisonThemes.map((theme) => (
              <PhonePreview key={theme.id} theme={theme} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="hierarchy-exploration-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="homepage-hierarchy-exploration"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Production-selected reference
            </p>
            <h2
              id="hierarchy-exploration-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Homepage typography hierarchy
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Side-by-side comparison for testing a more balanced journal
              name/month title hierarchy after the previous identity-primary
              pass proved too strong. This does not change production
              typography.
            </p>
          </div>

          <div className="grid gap-10">
            {hierarchyThemes.map((theme) => (
              <div key={`hierarchy-${theme.id}`}>
                <h3
                  className="mb-4 text-base font-semibold text-[#4f4941]"
                  style={{ fontFamily: utilityFont }}
                >
                  {theme.label}
                </h3>
                <div className="grid gap-8 lg:grid-cols-3">
                  {homeHierarchyVariants.map((hierarchy) => (
                    <div
                      key={`${theme.id}-${hierarchy.id}`}
                      data-playground-hierarchy-variant={hierarchy.id}
                    >
                      <PhonePreview
                        theme={theme}
                        hierarchy={hierarchy}
                        label={hierarchy.label}
                      />
                      <p
                        className="mx-auto mt-3 max-w-[370px] text-sm leading-6 text-[#5d574f]"
                        style={{ fontFamily: utilityFont }}
                      >
                        {hierarchy.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="backfill-cta-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="bottom-cta-backfill-exploration"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Playground-only exploration
            </p>
            <h2
              id="backfill-cta-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Bottom CTA and backfill action models
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Static interaction models for testing a single default Seal the
              Day entry point that opens Today&apos;s Stamp / Seal Today and
              Seal Another Day from a compact tray. Backend, local_date, and
              duplicate-day rules remain unchanged.
            </p>
          </div>

          <div className="grid gap-10">
            {ctaVariants.map((variant) => (
              <div
                key={variant.id}
                className="border-t border-[#ded8cf] pt-7 first:border-t-0 first:pt-0"
                data-playground-cta-variant-card={variant.id}
              >
                <div className="mb-5 max-w-3xl">
                  <h3
                    className="text-xl leading-tight text-[#28231e]"
                    style={{ fontFamily: displayFont }}
                  >
                    {variant.label}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-6 text-[#5d574f]"
                    style={{ fontFamily: utilityFont }}
                  >
                    {variant.note}
                  </p>
                </div>
                <div className="grid gap-8 lg:grid-cols-2">
                  {ctaThemes.map((theme) => (
                    <PhonePreview
                      key={`${variant.id}-${theme.id}-sealed`}
                      theme={theme}
                      ctaVariant={variant}
                      todaySealed
                      label={`${theme.label} / normal month / today sealed`}
                    />
                  ))}
                  {ctaThemes.map((theme) => (
                    <PhonePreview
                      key={`${variant.id}-${theme.id}-empty`}
                      theme={theme}
                      ctaVariant={variant}
                      empty
                      label={`${theme.label} / empty month / today open`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-8 grid gap-3 border-t border-[#d8d2c8] pt-5 text-sm leading-6 text-[#5d574f] sm:grid-cols-3"
            style={{ fontFamily: utilityFont }}
          >
            <p>
              <strong className="text-[#421819]">Today&apos;s Stamp</strong>{" "}
              opens today&apos;s existing stamp.
            </p>
            <p>
              <strong className="text-[#421819]">Seal Today</strong> starts
              creation for today when today is not sealed.
            </p>
            <p>
              <strong className="text-[#421819]">Seal Another Day</strong>{" "}
              opens create/edit with date selection available for backfill.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="detail-action-layout-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="daily-detail-action-layout-exploration"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Playground-only exploration
            </p>
            <h2
              id="detail-action-layout-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Daily Detail content-only overlay
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Static layout models for reviewing the Daily Memory Stamp shell
              action structure and focused vertical spacing candidates. The
              production Save / Share action continues opening the existing
              Save / Share modal/composer while modal chrome and export canvas
              remain unchanged.
            </p>
          </div>

          <div className="grid gap-10">
            {detailActionVariants.map((variant) => (
              <div
                key={variant.id}
                className="border-t border-[#ded8cf] pt-7 first:border-t-0 first:pt-0"
                data-playground-detail-variant-card={variant.id}
              >
                <div className="mb-5 max-w-3xl">
                  <h3
                    className="text-xl leading-tight text-[#28231e]"
                    style={{ fontFamily: displayFont }}
                  >
                    {variant.label}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-6 text-[#5d574f]"
                    style={{ fontFamily: utilityFont }}
                  >
                    {variant.note}
                  </p>
                </div>
                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                  {detailThemes.flatMap((theme) =>
                    detailPhotoCounts.map((photoCount) => (
                      <DailyDetailActionPreview
                        key={`${variant.id}-${theme.id}-${photoCount}`}
                        theme={theme}
                        variant={variant}
                        photoCount={photoCount}
                      />
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-10 border-t border-[#ded8cf] pt-7"
            data-playground-track="daily-detail-vertical-rebalance-study"
          >
            <div className="mb-5 max-w-3xl">
              <h3
                className="text-xl leading-tight text-[#28231e]"
                style={{ fontFamily: displayFont }}
              >
                Daily Detail vertical spacing study
              </h3>
              <p
                className="mt-2 text-sm leading-6 text-[#5d574f]"
                style={{ fontFamily: utilityFont }}
              >
                Focused candidates for making the content feel less top-heavy
                while preserving the shell header, edit pencil, content-only
                overlay, and bottom Save / Share CTA.
              </p>
            </div>
            <div className="grid gap-10">
              {detailSpacingVariants.map((spacingVariant) => (
                <div
                  key={spacingVariant.id}
                  data-playground-detail-spacing-card={spacingVariant.id}
                >
                  <div className="mb-5 max-w-3xl">
                    <h4
                      className="text-lg leading-tight text-[#28231e]"
                      style={{ fontFamily: displayFont }}
                    >
                      {spacingVariant.label}
                    </h4>
                    <p
                      className="mt-2 text-sm leading-6 text-[#5d574f]"
                      style={{ fontFamily: utilityFont }}
                    >
                      {spacingVariant.note}
                    </p>
                  </div>
                  <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {detailThemes.flatMap((theme) =>
                      detailPhotoCounts.map((photoCount) => (
                        <DailyDetailActionPreview
                          key={`${spacingVariant.id}-${theme.id}-${photoCount}`}
                          theme={theme}
                          variant={detailActionVariants[1]}
                          photoCount={photoCount}
                          spacingVariant={spacingVariant}
                        />
                      )),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="phase-72a-save-share-export-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="phase-7-2a-save-share-daily-export"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Phase 7.2A playground-only exploration
            </p>
            <h2
              id="phase-72a-save-share-export-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Save / Share modal and Daily 9:16 export directions
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              Static review models for the next gated redesign. These
              candidates do not change the production Save / Share composer,
              export canvas, crop behavior, storage, database, auth, or
              local-date rules.
            </p>
          </div>

          <div className="grid gap-10">
            <div data-playground-phase-72a-surface="save-share-modal">
              <div className="mb-5 max-w-3xl">
                <h3
                  className="text-xl leading-tight text-[#28231e]"
                  style={{ fontFamily: displayFont }}
                >
                  Save / Share modal polish candidates
                </h3>
                <p
                  className="mt-2 text-sm leading-6 text-[#5d574f]"
                  style={{ fontFamily: utilityFont }}
                >
                  The modal studies keep the same two user outcomes: save an
                  image or invoke native share when available. The preferred
                  model makes the generated poster preview the primary visual
                  object.
                </p>
              </div>
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {saveShareVariants.flatMap((variant) =>
                  saveShareThemes.map((theme) => (
                    <div key={`${variant.id}-${theme.id}`}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h4
                          className="text-base font-semibold text-[#4f4941]"
                          style={{ fontFamily: utilityFont }}
                        >
                          {variant.label}
                        </h4>
                        <PlaygroundRoleBadge role={variant.role} />
                      </div>
                      <SaveShareModalPreview
                        theme={theme}
                        variant={variant}
                      />
                    </div>
                  )),
                )}
              </div>
            </div>

            <div
              className="border-t border-[#ded8cf] pt-8"
              data-playground-phase-72a-surface="daily-export-poster"
            >
              <div className="mb-5 max-w-3xl">
                <h3
                  className="text-xl leading-tight text-[#28231e]"
                  style={{ fontFamily: displayFont }}
                >
                  Daily export poster composition candidates
                </h3>
                <p
                  className="mt-2 text-sm leading-6 text-[#5d574f]"
                  style={{ fontFamily: utilityFont }}
                >
                  The poster studies compare the current small-stamp export
                  against larger, more editorial artifacts. The preferred
                  candidate keeps journal name, date, title, nine scraps, and a
                  quiet MGP mark in one mobile-first 9:16 composition.
                </p>
              </div>
              <div className="grid gap-10">
                {exportPosterVariants.map((variant) => (
                  <div
                    key={variant.id}
                    data-playground-export-variant-card={variant.id}
                  >
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h4
                        className="text-base font-semibold text-[#4f4941]"
                        style={{ fontFamily: utilityFont }}
                      >
                        {variant.label}
                      </h4>
                      <PlaygroundRoleBadge role={variant.role} />
                    </div>
                    <p
                      className="mb-5 max-w-3xl text-sm leading-6 text-[#5d574f]"
                      style={{ fontFamily: utilityFont }}
                    >
                      {variant.note}
                    </p>
                    <div className="grid gap-8 md:grid-cols-2">
                      {exportThemes.map((theme) => (
                        <div
                          key={`${variant.id}-${theme.id}`}
                          className="mx-auto w-full max-w-[300px]"
                        >
                          <DailyExportPosterPreview
                            theme={theme}
                            variant={variant}
                          />
                          <p
                            className="mt-2 text-sm leading-6 text-[#5d574f]"
                            style={{ fontFamily: utilityFont }}
                          >
                            {theme.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="scrap-finder-tactile-title"
          className="border-t border-[#d8d2c8] py-8"
          data-playground-track="scrap-finder-tactile-only"
        >
          <div className="mb-7 max-w-3xl">
            <p
              className="text-sm font-semibold text-[#746c61]"
              style={{ fontFamily: utilityFont }}
            >
              Playground-only exploration
            </p>
            <h2
              id="scrap-finder-tactile-title"
              className="mt-1 text-3xl leading-tight text-[#28231e]"
              style={{ fontFamily: displayFont }}
            >
              Scrap Finder tactile press detail
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-[#5d574f]"
              style={{ fontFamily: utilityFont }}
            >
              This keeps the current accepted finder as a reference, elevates
              the restrained bottom press as the preferred playground
              candidate, and keeps the whisper lip only as a comparison. The
              tactile cue should stay in the playground until reviewed against
              real crop photos and all leather themes.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {finderThemes.map((theme) => (
              <div key={theme.id} className="grid gap-6 xl:grid-cols-3">
                {finderVariants.map((variant) => (
                  <ScrapFinderPlaygroundPreview
                    key={`${theme.id}-${variant.id}`}
                    theme={theme}
                    variant={variant}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
