# Scrap the Day Implementation Patch 1F

## Summary

Patch 1F revises the Patch 1E image display rule into a two-layer photo model:

- Memory Stamp artifact view uses normalized square photo frames for a cleaner stamp artifact.
- Fullscreen photo viewer preserves the original photo with no crop, stretch, or distortion.

This keeps mixed portrait, landscape, and square uploads visually aligned in the saved stamp while still letting the user tap any stamp image to see the full original photo.

## Why Patch 1E Was Revised

Patch 1E removed fixed frames and `object-cover` from the saved Memory Stamp detail so uploaded photos were never display-cropped. That protected the original aspect ratio, but mixed-orientation 9-photo stamps stopped feeling like a designed stamp artifact. The photo sheet became visually uneven instead of journal-level and collectible.

Patch 1F restores a curated artifact presentation without changing the underlying upload, storage, or image data.

## New Image Principle

- Stamp artifact: normalized display crop is allowed.
- Fullscreen viewer: original image must be fully visible.
- Display crop is non-destructive CSS only.
- Stored images, upload processing, signed URL behavior, and storage paths are unchanged.
- User-authorized crop metadata is intentionally deferred to the future Scrap Table / Finder Tool.

## Stamp Frame Ratio

Default frame ratio is square:

- `STAMP_FRAME_RATIO_MODE = "square"`
- `DEFAULT_STAMP_FRAME_ASPECT_RATIO = 1`

The helper is structured so a future cover-ratio mode can be added, but this patch does not expose ratio controls to customers.

## Layout Rules

Each row uses the full available card width. Each visible photo frame is square. The full photo sheet remains variable-height rather than being forced into one outer square canvas.

- 1 photo: `[1]`
- 2 photos: `[2]`
- 3 photos: `[1, 2]`
- 4 photos: `[2, 2]`
- 5 photos: `[1, 2, 2]`
- 6 photos: `[3, 3]`
- 7 photos: `[1, 3, 3]`
- 8 photos: `[2, 3, 3]`
- 9 photos: `[3, 3, 3]`

More than 9 backend photos are not deleted or truncated, but the journal stamp artifact displays the first 9 only.

## Fullscreen Viewer

Tapping a photo in the saved Memory Stamp opens the existing private photo viewer. The viewer:

- uses existing private signed URL resolution and caching behavior
- displays the image with `object-fit: contain`
- preserves the full original image shape
- includes close, Escape, swipe, and next/previous affordances already present in the viewer
- does not expose raw storage paths

## Files Changed

- `data/journal-product.ts`
- `data/stamp-layouts.ts`
- `components/stamp/stamp-grid.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `tests/journal-product.test.mjs`
- `tests/journal-form-regression.test.mjs`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`

## Intentionally Not Implemented

- Scrap Table / Finder Tool cropper
- punch/cut animation
- crop metadata
- share/export
- database local-date uniqueness
- Year in Stamps
- full visual redesign
- real leather texture polish

## Verification

- `npm run lint` passed.
- `npm test` passed: 41 tests.
- `npm run build` passed.
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qa-journal-route.mjs http://127.0.0.1:3000` passed.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000` passed.

The mobile QA script checked 375px, 390px, and 430px viewports. It verified square stamp frames, expected row groupings, no filler markers, no visible `SD`, no old create/edit copy, no horizontal overflow, stamp image `object-fit: cover`, and fullscreen viewer `object-fit: contain`.

## Manual QA Checklist

Use a 390px or 393px mobile viewport.

Stamp layout:

- Open `/journal/demo?screen=detail&photos=1`; confirm one large square stamp frame.
- Tap the image; confirm fullscreen viewer shows the full original photo without crop or stretch.
- Open `/journal/demo?screen=detail&photos=2`; confirm two aligned square frames.
- Open `/journal/demo?screen=detail&photos=3`; confirm cover top plus two frames below.
- Open `/journal/demo?screen=detail&photos=4`; confirm clean 2x2 square grid.
- Open `/journal/demo?screen=detail&photos=5`; confirm cover top plus 2x2 below.
- Open `/journal/demo?screen=detail&photos=6`; confirm clean 3x2 grid.
- Open `/journal/demo?screen=detail&photos=7`; confirm cover top plus two rows of 3.
- Open `/journal/demo?screen=detail&photos=8`; confirm row of 2 plus two rows of 3.
- Open `/journal/demo?screen=detail&photos=9`; confirm clean 3x3 square grid.
- Confirm mixed landscape/portrait images align cleanly.
- Confirm no `SD` mark.
- Confirm no visible Cover Scrap badge in saved detail.
- Confirm no voice memo UI.
- Confirm edit stamp remains available.

Create/edit preview:

- Open `/journal/demo?screen=create`.
- Add/select a landscape cover image.
- Confirm the preview uses the same square stamp frame treatment.
- Add a portrait additional image.
- Confirm preview remains visually consistent.
- Confirm no 30-photo UI.
- Confirm no voice memo UI.

Fullscreen viewer:

- Tap an image from a saved stamp.
- Confirm the full original photo is visible.
- Confirm the image is not stretched.
- Confirm the close button works.
- Confirm Escape works on desktop.

## Recommended Next Patch

Implement the cover-first Scrap Table / Finder Tool cropper so the user can intentionally choose the visible stamp crop instead of relying on centered CSS display crop.
