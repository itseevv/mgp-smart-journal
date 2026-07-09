# Scrap Day Phase 6B Implementation Report

## What changed

- Added admin texture upload for existing Journal Themes.
- Added a dedicated public Supabase Storage bucket migration for `journal-theme-assets`.
- Added server-side upload validation for JPEG, PNG, and WebP texture files.
- Added dimension and quality warnings for low-resolution, low-size, or non-9:16-ish assets.
- Replaced the Phase 6A.1 placeholder with upload/replace controls, texture status, warnings, sliders, and two 9:16 previews.
- Rendered assigned theme textures in the customer journal background.
- Rendered assigned theme textures in Daily Stamp 9:16 canvas export.

## Admin Workflow

The normal workflow is now:

- Create or edit theme details.
- Save the theme if it is new.
- Upload or replace a leather texture.
- Adjust focus X, focus Y, zoom, overlay color, and overlay opacity.
- Review Mobile App Preview and Daily Export Preview.
- Save theme.

## Storage

- Bucket: `journal-theme-assets`
- Path pattern: `journal-themes/{themeId}/texture-original.{ext}`
- Public read is enabled for theme assets.
- Browser/admin clients do not receive storage credentials.
- Uploads go through an admin-session-protected API route.

## Validation

The upload route validates:

- File is present.
- File is under 12MB.
- File content is JPEG, PNG, or WebP.
- Declared MIME type matches detected bytes.
- Dimensions can be read.

Warnings do not block upload when the asset is usable but imperfect.

## Rendering

- App CSS now uses `--journal-texture-url`, `--journal-texture-position`, `--journal-texture-zoom`, `--journal-overlay-color`, and `--journal-overlay-opacity`.
- Customer journal routes apply the assigned theme to the full mobile viewport.
- Existing fallback color tokens still render when no texture is present.
- Daily export loads the theme texture, computes object-fit cover crop with focus/zoom, draws overlay, and falls back safely if texture loading fails.

## Tests / Build

- `npm run lint`: passed
- `npm test`: passed
- `npm run build`: passed outside the sandbox after the known Turbopack local process/port sandbox failure
- `git diff --check`: passed
- `http://localhost:3000/admin/journal-themes/new`: returned 200 from the running dev server

## Manual QA Notes

Before end-to-end upload QA, apply the new Supabase migration so the `journal-theme-assets` bucket exists. Then use `/admin/journal-themes`, edit an existing theme, upload a leather texture, tune sliders, save, assign the theme to a journal capsule, and verify `/c/[publicToken]` plus Daily Stamp export.

## Recommended Next Patch

Polish QA for real leather assets: test several source images, tune default overlay/focus values per launch theme, and add any copy or visual refinements discovered during localhost review.
