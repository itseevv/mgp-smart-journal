import type { CSSProperties } from "react";

export type JournalThemeStatus = "draft" | "active" | "archived";

export type JournalTheme = {
  id?: string;
  slug: string;
  key: string;
  name: string;
  status?: JournalThemeStatus | string;
  textureUrl?: string;
  texturePublicUrl?: string;
  textureStoragePath?: string;
  textureWidth?: number;
  textureHeight?: number;
  textureMimeType?: string;
  focusX: number;
  focusY: number;
  zoom: number;
  overlayColor?: string;
  overlayOpacity: number;
  fallbackBackgroundColor: string;
  textPrimary: string;
  textSecondary: string;
  accentColor: string;
  logoVariant: "light" | "dark" | string;
  journalBackground: string;
  leatherTextureOverlay?: string;
  textOnJournal: string;
  mutedTextOnJournal: string;
  paperSurface: string;
  paperSurfaceMuted: string;
  textOnPaper: string;
  mutedTextOnPaper: string;
  stampBorder: string;
  accentMetal: string;
  logoMarkColor: string;
  fillerSurfaceA: string;
  fillerSurfaceB: string;
};

export const rubyJournalTheme: JournalTheme = {
  slug: "ruby-red",
  key: "ruby-red",
  name: "Ruby leather",
  status: "active",
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  overlayOpacity: 0,
  fallbackBackgroundColor: "#4b2028",
  textPrimary: "#f7efe2",
  textSecondary: "rgba(247, 239, 226, 0.72)",
  accentColor: "#b89a62",
  logoVariant: "light",
  journalBackground: "#4b2028",
  leatherTextureOverlay:
    "radial-gradient(circle at 20% 25%, rgba(255,255,255,0.075) 0 0.7px, transparent 0.8px), radial-gradient(circle at 70% 65%, rgba(20,10,12,0.22) 0 0.9px, transparent 1px)",
  textOnJournal: "#f7efe2",
  mutedTextOnJournal: "rgba(247, 239, 226, 0.72)",
  paperSurface: "#f1e7d2",
  paperSurfaceMuted: "#e1d4bb",
  textOnPaper: "#2d2921",
  mutedTextOnPaper: "#716854",
  stampBorder: "rgba(75, 32, 40, 0.3)",
  accentMetal: "#b89a62",
  logoMarkColor: "rgba(75, 32, 40, 0.38)",
  fillerSurfaceA: "#eadcc3",
  fillerSurfaceB: "#d8c4a5",
};

export const defaultJournalTheme = rubyJournalTheme;

function textToken(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalTextToken(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value: unknown) {
  const parsed = finiteNumber(value, 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = finiteNumber(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

export function resolveJournalTheme(
  themeFromApi?: Partial<JournalTheme> | null,
): JournalTheme {
  const source = themeFromApi ?? {};
  const slug = textToken(source.slug ?? source.key, defaultJournalTheme.slug);
  const textureUrl = optionalTextToken(
    source.textureUrl ?? source.texturePublicUrl,
  );
  const fallbackBackgroundColor = textToken(
    source.fallbackBackgroundColor ?? source.journalBackground,
    defaultJournalTheme.fallbackBackgroundColor,
  );
  const textPrimary = textToken(
    source.textPrimary ?? source.textOnJournal,
    defaultJournalTheme.textPrimary,
  );
  const textSecondary = textToken(
    source.textSecondary ?? source.mutedTextOnJournal,
    defaultJournalTheme.textSecondary,
  );
  const accentColor = textToken(
    source.accentColor ?? source.accentMetal,
    defaultJournalTheme.accentColor,
  );
  const paperSurface = textToken(
    source.paperSurface,
    defaultJournalTheme.paperSurface,
  );
  const paperSurfaceMuted = textToken(
    source.paperSurfaceMuted,
    defaultJournalTheme.paperSurfaceMuted,
  );
  const stampBorder = textToken(
    source.stampBorder,
    defaultJournalTheme.stampBorder,
  );
  const logoVariant = textToken(
    source.logoVariant,
    defaultJournalTheme.logoVariant,
  );

  return {
    id: optionalTextToken(source.id),
    slug,
    key: slug,
    name: textToken(source.name, defaultJournalTheme.name),
    status: textToken(source.status, defaultJournalTheme.status ?? "active"),
    textureUrl,
    texturePublicUrl: textureUrl,
    textureStoragePath: optionalTextToken(source.textureStoragePath),
    textureWidth: positiveInteger(source.textureWidth),
    textureHeight: positiveInteger(source.textureHeight),
    textureMimeType: optionalTextToken(source.textureMimeType),
    focusX: clamp(source.focusX, defaultJournalTheme.focusX, 0, 1),
    focusY: clamp(source.focusY, defaultJournalTheme.focusY, 0, 1),
    zoom: clamp(source.zoom, defaultJournalTheme.zoom, 1, 3),
    overlayColor: optionalTextToken(source.overlayColor),
    overlayOpacity: clamp(
      source.overlayOpacity,
      defaultJournalTheme.overlayOpacity,
      0,
      1,
    ),
    fallbackBackgroundColor,
    textPrimary,
    textSecondary,
    paperSurface,
    paperSurfaceMuted,
    stampBorder,
    accentColor,
    logoVariant,
    journalBackground: fallbackBackgroundColor,
    leatherTextureOverlay:
      optionalTextToken(source.leatherTextureOverlay) ??
      defaultJournalTheme.leatherTextureOverlay,
    textOnJournal: textPrimary,
    mutedTextOnJournal: textSecondary,
    textOnPaper: textToken(source.textOnPaper, defaultJournalTheme.textOnPaper),
    mutedTextOnPaper: textToken(
      source.mutedTextOnPaper,
      defaultJournalTheme.mutedTextOnPaper,
    ),
    accentMetal: accentColor,
    logoMarkColor: textToken(
      source.logoMarkColor,
      logoVariant === "dark"
        ? "rgba(45, 41, 33, 0.38)"
        : defaultJournalTheme.logoMarkColor,
    ),
    fillerSurfaceA: textToken(
      source.fillerSurfaceA,
      defaultJournalTheme.fillerSurfaceA,
    ),
    fillerSurfaceB: textToken(
      source.fillerSurfaceB,
      defaultJournalTheme.fillerSurfaceB,
    ),
  };
}

export const creamJournalTheme: JournalTheme = resolveJournalTheme({
  slug: "cream",
  key: "cream",
  name: "Cream leather",
  fallbackBackgroundColor: "#d8c9ab",
  leatherTextureOverlay:
    "radial-gradient(circle at 28% 32%, rgba(83,68,48,0.12) 0 0.7px, transparent 0.8px), radial-gradient(circle at 72% 70%, rgba(255,255,255,0.24) 0 0.8px, transparent 0.9px)",
  textPrimary: "#2d2921",
  textSecondary: "rgba(45, 41, 33, 0.68)",
  paperSurface: "#f5eddd",
  paperSurfaceMuted: "#e7dbc6",
  textOnPaper: "#29251f",
  mutedTextOnPaper: "#746b59",
  stampBorder: "rgba(74, 60, 42, 0.32)",
  accentColor: "#8d6f37",
  logoVariant: "dark",
  logoMarkColor: "rgba(74, 60, 42, 0.35)",
  fillerSurfaceA: "#eee2cc",
  fillerSurfaceB: "#d9c8a9",
});

const modernGoddessPatina = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  vintageBlush: "#B28C7B",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

function transparentMix(color: string, amount: number) {
  return `color-mix(in srgb, ${color} ${amount}%, transparent)`;
}

export function journalThemeStyle(theme: JournalTheme) {
  const textureUrl = theme.textureUrl ? `url("${theme.textureUrl}")` : "none";
  const overlayOpacity = theme.overlayColor ? theme.overlayOpacity : 0;
  const usesDarkText = theme.logoVariant === "dark";
  const homeTitle = usesDarkText
    ? modernGoddessPatina.deepBurgundy
    : transparentMix(modernGoddessPatina.champagnePeach, 78);
  const monthTitle = usesDarkText
    ? modernGoddessPatina.deepBurgundy
    : modernGoddessPatina.warmIvory;
  const homeOverlay = transparentMix(
    modernGoddessPatina.vintageBlush,
    usesDarkText ? 14 : 16,
  );
  const homeOverlayGradient = usesDarkText
    ? `linear-gradient(180deg, ${transparentMix(modernGoddessPatina.warmIvory, 16)}, ${transparentMix(modernGoddessPatina.cocoaTaupe, 8)})`
    : `linear-gradient(180deg, ${transparentMix(modernGoddessPatina.warmIvory, 10)}, ${transparentMix(modernGoddessPatina.champagnePeach, 7)})`;
  const homeCtaBackground = usesDarkText
    ? modernGoddessPatina.deepBurgundy
    : transparentMix(modernGoddessPatina.warmIvory, 92);
  const homeCtaText = usesDarkText
    ? modernGoddessPatina.warmIvory
    : modernGoddessPatina.deepBurgundy;
  const homeCtaTrayBackground = usesDarkText
    ? transparentMix(modernGoddessPatina.warmIvory, 70)
    : transparentMix(modernGoddessPatina.deepBurgundy, 42);
  const homeCtaTrayShadow = usesDarkText
    ? `0 12px 28px ${transparentMix(modernGoddessPatina.cocoaTaupe, 15)}`
    : "0 14px 34px rgba(17, 6, 8, 0.2)";
  const homeControlBackground = usesDarkText
    ? transparentMix(modernGoddessPatina.deepBurgundy, 8)
    : transparentMix(modernGoddessPatina.warmIvory, 13);
  const homeControlText = usesDarkText
    ? modernGoddessPatina.deepBurgundy
    : modernGoddessPatina.warmIvory;
  const monthReturnLink = usesDarkText
    ? transparentMix(modernGoddessPatina.cocoaTaupe, 72)
    : transparentMix(modernGoddessPatina.champagnePeach, 72);
  const monthReturnLinkDecoration = usesDarkText
    ? transparentMix(modernGoddessPatina.cocoaTaupe, 30)
    : transparentMix(modernGoddessPatina.champagnePeach, 30);
  const formOverlay = transparentMix(
    theme.paperSurface,
    usesDarkText ? 82 : 76,
  );
  const formOverlayGradient = usesDarkText
    ? `linear-gradient(180deg, ${transparentMix(theme.paperSurface, 52)}, ${transparentMix(theme.journalBackground, 10)})`
    : `linear-gradient(180deg, ${transparentMix(theme.paperSurface, 42)}, ${transparentMix(theme.accentMetal, 10)})`;
  const finderSurface = transparentMix(
    theme.paperSurface,
    usesDarkText ? 58 : 46,
  );
  const finderWindow = `color-mix(in srgb, ${theme.fillerSurfaceA} ${usesDarkText ? 78 : 72}%, ${theme.journalBackground})`;
  const finderEdge = `color-mix(in srgb, ${theme.accentMetal} ${usesDarkText ? 54 : 48}%, ${theme.textOnJournal})`;
  const finderMask = usesDarkText
    ? transparentMix(theme.textOnPaper, 4)
    : transparentMix(theme.textOnJournal, 5);
  const finderControlBackground = transparentMix(
    theme.textOnJournal,
    usesDarkText ? 8 : 13,
  );
  const finderControlBorder = transparentMix(
    theme.textOnJournal,
    usesDarkText ? 18 : 24,
  );
  const finderPrimaryBackground = usesDarkText
    ? modernGoddessPatina.deepBurgundy
    : `color-mix(in srgb, ${theme.paperSurface} 84%, ${theme.accentMetal})`;
  const finderPrimaryText = usesDarkText
    ? theme.paperSurface
    : modernGoddessPatina.deepBurgundy;

  return {
    "--journal-background": theme.journalBackground,
    "--journal-outer-background": theme.journalBackground,
    "--journal-text": theme.textOnJournal,
    "--journal-muted": theme.mutedTextOnJournal,
    "--journal-paper": theme.paperSurface,
    "--journal-paper-muted": theme.paperSurfaceMuted,
    "--journal-paper-text": theme.textOnPaper,
    "--journal-paper-muted-text": theme.mutedTextOnPaper,
    "--journal-stamp-border": theme.stampBorder,
    "--journal-accent-metal": theme.accentMetal,
    "--journal-logo-mark": theme.logoMarkColor,
    "--journal-filler-a": theme.fillerSurfaceA,
    "--journal-filler-b": theme.fillerSurfaceB,
    "--journal-paper-soft": theme.paperSurface,
    "--journal-photo-edge": `color-mix(in srgb, ${theme.textOnPaper} 10%, transparent)`,
    "--journal-paper-edge": `color-mix(in srgb, ${theme.textOnPaper} 9%, transparent)`,
    "--journal-control-on-leather": `color-mix(in srgb, ${theme.textOnJournal} 14%, transparent)`,
    "--journal-control-on-leather-border": `color-mix(in srgb, ${theme.textOnJournal} 24%, transparent)`,
    "--journal-control-on-leather-text": theme.textOnJournal,
    "--journal-home-title": homeTitle,
    "--journal-home-month-title": monthTitle,
    "--journal-home-overlay": homeOverlay,
    "--journal-home-overlay-gradient": homeOverlayGradient,
    "--journal-month-stage-min-height": "clamp(23.5rem, 56dvh, 33.5rem)",
    "--journal-month-return-link": monthReturnLink,
    "--journal-month-return-link-decoration": monthReturnLinkDecoration,
    "--journal-home-cta-bg": homeCtaBackground,
    "--journal-home-cta-text": homeCtaText,
    "--journal-home-cta-shadow": usesDarkText
      ? `0 10px 24px ${transparentMix(modernGoddessPatina.cocoaTaupe, 16)}`
      : "0 10px 24px rgba(17, 6, 8, 0.18)",
    "--journal-home-cta-tray-bg": homeCtaTrayBackground,
    "--journal-home-cta-tray-shadow": homeCtaTrayShadow,
    "--journal-home-control-bg": homeControlBackground,
    "--journal-home-control-text": homeControlText,
    "--journal-form-overlay": formOverlay,
    "--journal-form-overlay-gradient": formOverlayGradient,
    "--journal-finder-surface": finderSurface,
    "--journal-finder-window": finderWindow,
    "--journal-finder-edge": finderEdge,
    "--journal-finder-mask": finderMask,
    "--journal-finder-control-bg": finderControlBackground,
    "--journal-finder-control-border": finderControlBorder,
    "--journal-finder-primary-bg": finderPrimaryBackground,
    "--journal-finder-primary-text": finderPrimaryText,
    "--journal-soft-shadow": "0 10px 28px rgba(18, 11, 10, 0.11)",
    "--journal-texture": theme.leatherTextureOverlay ?? "none",
    "--journal-texture-url": textureUrl,
    "--journal-texture-opacity": theme.textureUrl ? 1 : 0.8,
    "--journal-texture-size": "cover",
    "--journal-texture-position": "50% 50%",
    "--journal-texture-zoom": 1,
    "--journal-mobile-background-image": textureUrl,
    "--journal-mobile-background-size": "cover",
    "--journal-mobile-background-position": "50% 50%",
    "--journal-mobile-background-opacity": theme.textureUrl ? 1 : 0.8,
    "--journal-overlay-color": theme.overlayColor ?? "transparent",
    "--journal-overlay-opacity": overlayOpacity,
  } as CSSProperties;
}
