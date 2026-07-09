# Scrap Day Phase 6B.3 Texture Rendering Acceptance Fix

## Root Cause

Phase 6B.2 changed the copy and some defaults, but the actual rendering path still treated the uploaded asset like a repeatable/croppable leather texture in several places.

- Admin Mobile App Preview used `ThemeMobilePreview` in `components/admin/admin-journal-themes-page.tsx`, rendered as `.journal-leather-surface` with `style={journalThemeStyle(theme)}`. The image URL was the uploaded public `theme.textureUrl`, but it was applied through CSS as `background-image: var(--journal-texture-url)` with `background-size: cover`, focus-based `background-position`, and `transform: scale(var(--journal-texture-zoom))`. The preview frame also combined `aspect-[9/16]` with `max-h-[30rem]`, which could break the final displayed ratio.
- Admin Daily Export Preview had the same issue: `.journal-leather-surface`, uploaded public `theme.textureUrl` through CSS, `cover`, focus position, and zoom transform.
- Customer `/c/[publicToken]` rendered the outer `<main>` as fallback color, but the centered `JournalMobileShell` used `.journal-themed-background` with the same CSS texture path. Nested `.journal-leather-surface` journal/detail surfaces also inherited the uploaded texture variables and could repaint the full 2160 x 3840 image as cropped fragments on smaller panels.
- Daily export canvas loaded the high-resolution `theme.textureUrl`, not a thumbnail, but `drawLeatherBackground` still passed `theme.focusX`, `theme.focusY`, and `theme.zoom` into the shared background rect helper. Persisted non-default advanced values could still crop.

## Files Changed

- `lib/journal-theme-background.ts`
- `data/journal-themes.ts`
- `app/globals.css`
- `components/admin/admin-journal-themes-page.tsx`
- `lib/export/daily-memory-stamp-export.ts`
- `tests/journal-theme-assets.test.mjs`
- `tests/journal-theme-admin.test.mjs`
- `tests/journal-themes.test.mjs`
- `tests/daily-stamp-export.test.mjs`

## Rendering Chain After

### Admin Mobile App Preview

- Component: `ThemeMobilePreview`
- Image source: original uploaded `theme.textureUrl`
- Rendering: decorative `<img src={theme.textureUrl}>` inside a fixed 9:16 preview frame
- Fit: `object-contain`
- Focus/zoom: not applied
- Overlay: default opacity remains `0` unless an overlay color exists
- Fallback: theme color tokens when no texture exists

### Admin Daily Export Preview

- Component: `ThemeExportPreview`
- Image source: original uploaded `theme.textureUrl`
- Rendering: same full-frame 9:16 `<img>` path as Mobile App Preview
- Fit: `object-contain`
- Focus/zoom: not applied
- Fallback: theme color tokens when no texture exists

### Customer `/c/[publicToken]`

- Component/function: `CapsulePage` renders `JournalMobileShell`
- Image source: original uploaded `theme.textureUrl` via `journalThemeStyle(theme)`
- Placement: centered mobile shell only
- Outer desktop page: fallback journal background color, no uploaded texture
- Shell CSS: `--journal-mobile-background-image` with `background-size: contain`, centered, no transform
- Nested journal surfaces: no longer repaint the uploaded image as local cropped fragments inside the themed shell

### Daily Export Canvas

- Function: `drawLeatherBackground` in `lib/export/daily-memory-stamp-export.ts`
- Image source: high-resolution `theme.textureUrl`
- Rendering: `computePreparedPortraitFullFrameRect`
- Target: full 1080 x 1920 canvas
- Focus/zoom: not passed into the default export background draw
- Fallback: theme background color plus synthetic grain only when no uploaded texture exists

## Full 9:16 Confirmation

A 2160 x 3840 PNG is now treated as a prepared portrait background asset. The helper path returns the full source rectangle and draws it to the full 1080 x 1920 target without crop or zoom.

## Not Implemented

- No Phase 7 work
- No Vercel preview work
- No export redesign
- No monthly export changes
- No admin theme data model changes
- No new storage logic
- No capsule theme assignment changes

## Verification

- `npm test` passed: 85 tests
- `npm run lint` passed
- `npm run build` passed after rerunning outside the sandbox because local Turbopack needs to spawn a process and bind a local port
- `git diff --check` passed

## Manual QA Checklist

1. Upload a 2160 x 3840 PNG.
2. Open the admin theme edit page.
3. Confirm Mobile App Preview shows the full background, not a zoomed fragment.
4. Confirm Daily Export Preview shows the full background, not a zoomed fragment.
5. Assign the theme to a capsule.
6. Open `/c/[publicToken]` on desktop.
7. Confirm the desktop outer area does not stretch the leather texture across the full browser.
8. Confirm the centered mobile shell uses the uploaded texture.
9. Open the same route on mobile.
10. Confirm the texture looks clear and natural.
11. Export Daily Stamp.
12. Confirm the 9:16 export uses the uploaded texture cleanly.

## Remaining Limitations

- Advanced focus/zoom controls are retained in the admin and data model, but default prepared portrait rendering ignores them. A future visual control mode can re-enable them intentionally with an explicit advanced mode.
- I did not mutate dev data or upload a real 2160 x 3840 production-like asset during automated verification.

## Recommended Next Patch

Phase 6.5 Vercel Preview Deployment.
