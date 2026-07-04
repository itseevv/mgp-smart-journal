# Scrap the Day Implementation Patch 1E

## Summary

Patch 1E removes automatic crop behavior from the journal customer photo display.

Saved Daily Memory Stamp detail now renders an aspect-preserving editorial photo sheet instead of forcing uploaded images into fixed square/grid cells. Journal create/edit previews also preserve image aspect ratio for the Cover Scrap and optional additional moments.

The patch keeps the existing upload, save, edit, signed URL, route, storage, and backend media behavior intact.

## Root Cause

Patch 1D replaced the fixed 3 by 3 stamp with adaptive grid variants, but the renderer still used fixed frames and `object-cover`. That meant landscape, portrait, and other non-square uploaded images could be visually cropped or forced into unnatural cells.

This violated the product principle: user-uploaded photos must not be automatically cropped, stretched, or forced into another aspect ratio. The only acceptable crop should come later from a user-authorized Scrap Table / Finder Tool cropper.

## Files Changed

- `data/stamp-layouts.ts`
- `components/stamp/stamp-grid.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/journal/journal-demo-flow.tsx`
- `tests/journal-product.test.mjs`
- `tests/journal-form-regression.test.mjs`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`

## New Image Display Principle

For journal customer create/edit and saved Daily Memory Stamp display:

- Resizing is allowed.
- Cropping is not allowed.
- Stretching is not allowed.
- `object-cover` is not used.
- Images render with `object-contain` inside frames whose aspect ratio comes from image metadata when available.
- If dimensions are missing, the fallback ratio is `4 / 3`; the image is still contained, not cropped.

The future Scrap Table / Finder Tool cropper remains the place where a user-authorized cropped output can be created.

## Layout Rules

The saved stamp now renders rows instead of filler-based grid cells:

- 1 photo: `[1]`, variant `single`
- 2 photos: `[1, 1]`, variant `stacked-duo`
- 3 photos: `[1, 2]`, variant `cover-plus-two`
- 4 photos: `[2, 2]`, variant `balanced-four`
- 5 photos: `[1, 2, 2]`, variant `cover-plus-four`
- 6 photos: `[1, 2, 3]`, variant `cover-two-three`
- 7 photos: `[1, 3, 3]`, variant `cover-three-three`
- 8 photos: `[2, 3, 3]`, variant `two-three-three`
- 9 photos: `[3, 3, 3]`, variant `three-three-three`

More than 9 backend images are not deleted or truncated. The polished stamp displays the first 9 only and still does not expose customer-facing overflow UI.

## How Aspect Ratios Are Preserved

`data/stamp-layouts.ts` now provides:

- `getStampLayout(photoCount)`
- `buildAspectPreservingStampRows(items)`
- `getPhotoAspectRatio(photo)`

`StampGrid` renders each row as a flex row. Each photo frame uses:

- `aspectRatio: getPhotoAspectRatio(photo)`
- `flex` proportional to that aspect ratio
- image class `object-contain`

This gives each row a shared row height while preserving each image's own ratio.

Journal create/edit previews now use the same ratio helper:

- Cover Scrap preview uses metadata ratio plus `object-contain`.
- Additional moments pass `preserveAspectRatio` into `SortablePhotoGrid`.
- Non-journal/default sortable thumbnails keep their previous square thumbnail behavior.

## Search Classification

Remaining `object-cover` / `aspect-square` occurrences are intentionally outside the Patch 1E journal customer saved-detail display path:

- `components/memory/photo-collection.tsx`: non-journal completed memory display.
- `components/memory/sortable-photo-grid.tsx`: default non-journal sortable thumbnail path; journal passes `preserveAspectRatio`.
- `components/journal/memory-card.tsx`: older/small list thumbnail surface.
- `components/journal/stamp-tile.tsx`: Month Sheet thumbnail tile.
- tests and QA scripts: guard strings that fail if crop behavior returns to journal create/detail.

`components/stamp/stamp-grid.tsx` and `components/memory/journal-photo-picker.tsx` are guarded against `object-cover`.

## Demo Updates

`/journal/demo` now uses mixed-orientation demo images with width/height metadata:

- landscape
- portrait
- square-ish

QA URLs remain:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=create&photos=1`
- `/journal/demo?screen=create&photos=2`
- `/journal/demo?screen=detail&photos=1` through `photos=9`

`/memory/demo` continues to redirect to `/journal/demo`.

## Intentionally Not Implemented

- No cropper.
- No Scrap Table / Finder Tool.
- No punch/cut animation.
- No crop metadata.
- No true cover-first crop flow.
- No share/export.
- No database local-date uniqueness.
- No DB theme persistence.
- No route changes.
- No Supabase storage path changes.
- No backend voice memo deletion.
- No full visual redesign.

## Verification Results

- `npm run lint`: passed.
- `npm test`: passed, 41 tests.
- `npm run build`: passed after rerunning outside the sandbox. The sandboxed build still fails with the known Turbopack worker permission error: `creating new process / binding to a port / Operation not permitted`.
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qa-journal-route.mjs http://127.0.0.1:3000`: passed.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000`: passed.

Mobile browser QA checked widths 375, 390, and 430 for:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=create&photos=1`
- `/journal/demo?screen=create&photos=2`
- `/journal/demo?screen=detail&photos=1` through `photos=9`

It confirmed:

- Create Cover Scrap preview uses computed `object-fit: contain`.
- Create additional moment preview uses computed `object-fit: contain`.
- Saved detail images use computed `object-fit: contain`.
- Every detail route has the expected row layout marker.
- No detail route has filler markers.
- No old memory/storage copy.
- No visible `SD` mark.
- No horizontal overflow.
- No console errors.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

Create/edit page:

- Open `/journal/demo?screen=create`.
- Open `/journal/demo?screen=create&photos=1`.
- Confirm the Cover Scrap preview shows the full landscape demo image.
- Confirm it is not cropped into square or portrait.
- Confirm it is not stretched.
- Open `/journal/demo?screen=create&photos=2`.
- Confirm the optional moment preview preserves its portrait ratio.
- Confirm no voice memo UI.
- Confirm no 30-photo UI.

Detail page:

- Open `/journal/demo?screen=detail&photos=1`; confirm one image displays full-width with original ratio and no fillers.
- Open `/journal/demo?screen=detail&photos=2`; confirm both images display fully and no fillers.
- Open `/journal/demo?screen=detail&photos=3`; confirm cover is full-width on top and two images below preserve ratio.
- Open `/journal/demo?screen=detail&photos=4`; confirm two rows of two.
- Open `/journal/demo?screen=detail&photos=5`; confirm cover full-width plus two rows of two.
- Open `/journal/demo?screen=detail&photos=6`; confirm cover full-width plus row of two plus row of three.
- Open `/journal/demo?screen=detail&photos=7`; confirm cover full-width plus two rows of three.
- Open `/journal/demo?screen=detail&photos=8`; confirm row of two plus two rows of three.
- Open `/journal/demo?screen=detail&photos=9`; confirm three rows of three.
- Confirm no visible Cover Scrap badge in polished saved detail.
- Confirm no `SD` mark.
- Confirm no image is visibly cropped.

## Recommended Next Patch

The next product patch should be Cover-first + Scrap Table / Finder Tool cropper, where any crop becomes explicit, user-authorized output rather than automatic display behavior.
