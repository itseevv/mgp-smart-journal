import type { CSSProperties } from "react";

export type JournalTheme = {
  key: string;
  name: string;
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
  key: "ruby",
  name: "Ruby leather",
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

export const creamJournalTheme: JournalTheme = {
  key: "cream",
  name: "Cream leather",
  journalBackground: "#d8c9ab",
  leatherTextureOverlay:
    "radial-gradient(circle at 28% 32%, rgba(83,68,48,0.12) 0 0.7px, transparent 0.8px), radial-gradient(circle at 72% 70%, rgba(255,255,255,0.24) 0 0.8px, transparent 0.9px)",
  textOnJournal: "#2d2921",
  mutedTextOnJournal: "rgba(45, 41, 33, 0.68)",
  paperSurface: "#f5eddd",
  paperSurfaceMuted: "#e7dbc6",
  textOnPaper: "#29251f",
  mutedTextOnPaper: "#746b59",
  stampBorder: "rgba(74, 60, 42, 0.32)",
  accentMetal: "#8d6f37",
  logoMarkColor: "rgba(74, 60, 42, 0.35)",
  fillerSurfaceA: "#eee2cc",
  fillerSurfaceB: "#d9c8a9",
};

export const defaultJournalTheme = rubyJournalTheme;

export function journalThemeStyle(theme: JournalTheme) {
  return {
    "--journal-background": theme.journalBackground,
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
    "--journal-texture": theme.leatherTextureOverlay ?? "none",
  } as CSSProperties;
}
