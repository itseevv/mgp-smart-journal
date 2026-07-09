# Scrap Day Phase 6B.2 Texture Rendering Hotfix

## Root Cause

Uploaded leather assets were being treated like crop/zoom texture sources instead
of prepared 9:16 portrait backgrounds. The customer page also applied the theme
background to the full desktop page, so a portrait texture could be scaled far
beyond the mobile journal surface and look blurry.

## Files Changed

- `lib/journal-theme-background.ts`
- `data/journal-themes.ts`
- `app/globals.css`
- `components/capsule/capsule-page.tsx`
- `components/journal/journal-mobile-shell.tsx`
- `components/admin/admin-journal-themes-page.tsx`
- `lib/export/daily-memory-stamp-export.ts`
- `lib/capsule/api.ts`
- `tests/journal-theme-assets.test.mjs`
- `tests/journal-theme-admin.test.mjs`
- `tests/journal-themes.test.mjs`
- `tests/daily-stamp-export.test.mjs`

## Updated Default Background Rendering

- Added Phase 6B.2 defaults: `focusX = 0.5`, `focusY = 0.5`, `zoom = 1`,
  `overlayOpacity = 0`.
- Added a full-asset background draw helper for prepared portrait backgrounds.
- A 9:16 image such as `1152 x 2048` now draws from the full source image into
  the `1080 x 1920` export canvas.
- Non-9:16 images preserve aspect ratio and are centered instead of being
  distorted or randomly cropped by default.
- Advanced crop/zoom behavior is still available when zoom is explicitly above
  `1`.

## Uploaded 9:16 Asset Behavior

Uploaded textures are now treated as ready-made portrait backgrounds by default.
The app and export use the high-resolution `textureUrl` directly, not a thumbnail
or generated preview variant.

## Admin UI Simplification

- The primary workflow remains name, slug, status, sort order, description,
  upload/replace background, previews, and save.
- Focus X, Focus Y, Zoom, Overlay opacity, and Overlay color moved into a
  collapsed `Advanced / Preview Settings` section.
- The advanced section explains that framing controls are usually unnecessary
  for prepared 9:16 backgrounds.
- The form shows detected dimensions and warns: "For best results, upload a 9:16
  portrait texture."

## Customer Background Behavior

- `/c/[publicToken]` still uses the assigned journal theme.
- The uploaded texture now renders on the centered mobile journal shell instead
  of stretching across the full desktop browser viewport.
- The desktop outer page uses the fallback theme background color.

## Daily Export Behavior

- Daily export loads the high-resolution uploaded `theme.textureUrl`.
- The 9:16 texture is drawn as the full background on the `1080 x 1920` canvas.
- Canvas image smoothing is explicitly set to high quality.
- Synthetic sheen/grain is used only for fallback color backgrounds without an
  uploaded texture.
- Theme overlay still exists for advanced settings, but defaults to opacity `0`.

## Intentionally Not Implemented

- Phase 7 visual redesign
- Admin theme asset generation
- AI outpainting
- Monthly export
- Database model changes
- Capsule theme assignment changes

## Verification Results

- `npm test` passed: 85 tests.
- `npm run lint` passed.
- `npm run build` passed after rerunning outside the sandbox. The first sandboxed
  build hit the known Turbopack local port permission failure.
- `git diff --check` passed.

## Manual QA Checklist

1. Upload a 9:16 leather background, for example `1152 x 2048` PNG.
2. Confirm admin preview is clear.
3. Confirm focus/zoom/overlay are not part of the normal workflow.
4. Confirm dimensions are detected.
5. Assign the theme to a capsule.
6. Open `/c/[publicToken]`.
7. Confirm the mobile shell background uses the uploaded texture clearly.
8. Confirm desktop does not stretch the texture across the whole browser.
9. Open Daily Stamp export.
10. Confirm the exported 9:16 image uses the uploaded texture cleanly.
11. Confirm fallback still works for themes without texture.

## Recommended Next Patch

Phase 6.5 Vercel Preview Deployment.
