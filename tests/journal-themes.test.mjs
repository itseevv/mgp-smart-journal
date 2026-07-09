import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultJournalTheme,
  journalThemeStyle,
  resolveJournalTheme,
} from "../data/journal-themes.ts";

test("journal theme resolver falls back to the default dynamic theme", () => {
  const theme = resolveJournalTheme();

  assert.equal(theme.slug, defaultJournalTheme.slug);
  assert.equal(theme.name, defaultJournalTheme.name);
  assert.equal(theme.fallbackBackgroundColor, defaultJournalTheme.fallbackBackgroundColor);
  assert.equal(theme.journalBackground, defaultJournalTheme.fallbackBackgroundColor);
  assert.equal(theme.textOnJournal, defaultJournalTheme.textPrimary);
  assert.equal(theme.paperSurface, defaultJournalTheme.paperSurface);
  assert.equal(theme.focusX, 0.5);
  assert.equal(theme.focusY, 0.5);
  assert.equal(theme.zoom, 1);
  assert.equal(theme.overlayColor, undefined);
  assert.equal(theme.overlayOpacity, 0);
});

test("journal theme resolver merges API tokens into legacy visual aliases", () => {
  const theme = resolveJournalTheme({
    id: "theme-id",
    slug: "teal",
    name: "Teal leather",
    status: "active",
    texturePublicUrl: "https://example.com/texture.webp",
    textureStoragePath: "journal-themes/teal/texture.webp",
    textureWidth: 2160,
    textureHeight: 3840,
    textureMimeType: "image/webp",
    focusX: 0.25,
    focusY: 0.75,
    zoom: 1.3,
    overlayColor: "#001a1a",
    overlayOpacity: 0.18,
    fallbackBackgroundColor: "#0f4c4b",
    textPrimary: "#fff7e8",
    textSecondary: "#d6c6aa",
    paperSurface: "#f3ead8",
    paperSurfaceMuted: "#e5d5b8",
    stampBorder: "#2f6761",
    accentColor: "#d6aa72",
    logoVariant: "dark",
  });

  assert.equal(theme.id, "theme-id");
  assert.equal(theme.slug, "teal");
  assert.equal(theme.key, "teal");
  assert.equal(theme.textureUrl, "https://example.com/texture.webp");
  assert.equal(theme.texturePublicUrl, "https://example.com/texture.webp");
  assert.equal(theme.journalBackground, "#0f4c4b");
  assert.equal(theme.textOnJournal, "#fff7e8");
  assert.equal(theme.mutedTextOnJournal, "#d6c6aa");
  assert.equal(theme.accentMetal, "#d6aa72");
});

test("journal theme style uses uploaded texture at full opacity", () => {
  const theme = resolveJournalTheme({
    slug: "ruby-upload",
    name: "Ruby upload",
    texturePublicUrl: "https://example.com/high-res-texture.png",
  });
  const style = journalThemeStyle(theme);

  assert.equal(
    style["--journal-texture-url"],
    'url("https://example.com/high-res-texture.png")',
  );
  assert.equal(style["--journal-texture-opacity"], 1);
  assert.equal(style["--journal-texture-size"], "cover");
  assert.equal(style["--journal-texture-position"], "50% 50%");
  assert.equal(style["--journal-texture-zoom"], 1);
  assert.equal(
    style["--journal-mobile-background-image"],
    'url("https://example.com/high-res-texture.png")',
  );
  assert.equal(style["--journal-mobile-background-size"], "cover");
  assert.equal(style["--journal-mobile-background-position"], "50% 50%");
  assert.equal(style["--journal-overlay-color"], "transparent");
  assert.equal(style["--journal-overlay-opacity"], 0);
});

test("journal theme resolver clamps unsafe numeric rendering values", () => {
  const theme = resolveJournalTheme({
    slug: "wild",
    name: "Wild",
    focusX: -4,
    focusY: 2,
    zoom: 9,
    overlayOpacity: 4,
  });

  assert.equal(theme.focusX, 0);
  assert.equal(theme.focusY, 1);
  assert.equal(theme.zoom, 3);
  assert.equal(theme.overlayOpacity, 1);
});
