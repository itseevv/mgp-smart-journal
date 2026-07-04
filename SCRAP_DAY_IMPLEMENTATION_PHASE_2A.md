# Scrap the Day Implementation Phase 2A

## Summary

Phase 2A turns the accepted cover-first crop flow into a more physical Scrap the Day ritual:

- Scrap Table now sits in a centered mobile-width shell instead of feeling like a desktop editor.
- The header is directly above the finder area with minimal copy: `Find today's scrap` and `Move the photo under the finder.`
- The visible tool is now a CSS-built physical finder / punch plate with a square transparent aperture.
- The aperture uses a stronger postage-stamp perforated edge.
- Cover previews, additional moment previews, and saved Memory Stamp frames use subtle perforated stamp edges.
- `Use this scrap` triggers a short punch/cut feedback animation and guarded haptic vibration.
- Existing no-distortion Scrap Table photo behavior remains intact.

## Root Cause

Patch 2A already opened the Scrap Table and preserved the uploaded photo ratio, but the UI still read as a generic cropper:

- The header and controls were visually detached from the mobile working area.
- The finder was mostly a square crop aperture rather than a tactile tool.
- Stamp-edge treatment did not carry through the aperture, cover preview, saved detail frames, and additional moment previews consistently.
- Confirmation feedback existed in code but did not have a clear punch/cut visual state on the aperture.

## Files Changed

- `app/globals.css`
- `components/scrap/scrap-table.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/stamp/stamp-grid.tsx`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_2A.md`

## Mobile Layout

The Scrap Table now renders as one focused mobile screen:

- centered shell: `data-scrap-mobile-shell="true"`
- fixed immersive dialog: `data-scrap-table="true"`
- header inside the same shell as the finder
- close button inside the shell
- finder directly below the header
- bottom zoom and actions remain reachable
- QA covers 375px, 390px, and 430px widths with no horizontal overflow

The photo stage now aligns the finder near the header instead of vertically centering it away from the copy.

## Physical Finder / Punch Frame

The Scrap Table now uses a CSS-built physical finder:

- `data-finder-tool="physical-frame"`
- muted blue-gray tool plate
- subtle handle/notch details
- transparent square aperture
- aperture marker: `data-scrap-aperture="stamp-window"`
- square frame marker: `data-scrap-frame="square"`
- perforated edge marker: `data-stamp-edge="perforated"`

The interaction model remains fixed-finder: the user pans and zooms the photo underneath the tool. The finder itself is not draggable.

## Stamp Edge Treatment

A reusable CSS stamp-edge treatment was added in `app/globals.css`:

- `.stamp-edge`
- `.stamp-edge--aperture`
- `.stamp-edge--preview`
- `.stamp-edge--subtle`

It is now used on:

- Scrap Table aperture, with the strongest treatment
- Cover Scrap preview on the sealing page
- additional moment preview tiles
- saved Daily Memory Stamp frames

The polished saved detail still does not show a visible `Cover Scrap` badge or `SD` mark.

## Punch / Cut Feedback

`Use this scrap` now triggers:

- `data-punch-feedback="enabled"`
- `data-scrap-punch-feedback="pressed"` during confirm
- `.scrap-table-punch` on the finder plate
- a short aperture press animation
- a brief perforation flash overlay
- optional `navigator.vibrate(10)` when supported

No confetti, celebratory animation, or external audio was added.

## Photo Distortion

The existing no-distortion behavior was preserved:

- Scrap Table image uses natural dimensions from metadata or `naturalWidth` / `naturalHeight`
- pan/zoom uses uniform scale
- rendered image width and height are explicitly computed from the same scale
- `maxWidth: "none"` and `maxHeight: "none"` prevent global CSS compression
- QA verifies rendered ratio against the natural image ratio

The selected Cover Scrap remains a non-destructive display crop. Fullscreen saved photo viewing still uses the original image with contain-fit.

## Intentionally Not Implemented

- Additional moments manual Scrap Table adjustment
- Share/export
- Year in Stamps
- Database `local_date` uniqueness
- Full final visual polish
- Real sound asset
- Draggable finder frame
- Crop math rebuild

## Verification

- `npm run lint` passed.
- `npm test` passed: 48 tests.
- `npm run build` passed after rerunning outside the sandbox because Turbopack's internal process/port binding was blocked in sandbox.
- `node scripts/qa-journal-route.mjs http://127.0.0.1:3002` passed.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3002` passed.

The mobile browser QA checked 375px, 390px, and 430px. It verified:

- no horizontal overflow
- no old memory/storage/voice memo/30-photo copy
- one-line field visible before cover selection
- Scrap Table is not inline on initial create
- physical finder plate marker exists
- stamp aperture marker exists
- perforated stamp-edge marker exists
- punch feedback marker exists
- Scrap Table photo is not distorted
- header is close to the finder
- cover preview has stamp edge
- additional moment preview has stamp edge
- saved detail frames have stamp edge for 1-9 photos
- fullscreen viewer remains contain-fit and closable

## QA URLs

Local server used for verification:

- `http://127.0.0.1:3002/journal/demo?screen=create`
- `http://127.0.0.1:3002/journal/demo?screen=crop`
- `http://127.0.0.1:3002/journal/demo?screen=detail&photos=1`
- `http://127.0.0.1:3002/journal/demo?screen=detail&photos=9`

## Manual QA Checklist

Use mobile viewport 375px, 390px or 393px, and 430px.

Create / sealing page:

1. Open `/journal/demo?screen=create`.
2. Confirm `One line to keep` is visible before cover selection.
3. Confirm Cover Scrap empty state is visible.
4. Select a cover photo.
5. Confirm Scrap Table opens.

Scrap Table:

1. Confirm the whole Scrap Table is within a mobile-width shell.
2. Confirm header is directly above the finder area.
3. Confirm only `Find today's scrap` is the main header.
4. Confirm it does not look like a desktop editor.
5. Confirm the selected photo is not distorted.
6. Confirm there is a visible physical finder / punch-style frame.
7. Confirm the aperture has a postage-stamp/perforated edge.
8. Confirm the finder remains visible while moving/zooming.
9. Confirm controls are reachable on mobile.
10. Tap `Use this scrap`.
11. Confirm there is subtle punch/cut feedback.
12. Confirm the page returns to the sealing page.

Sealing page after scrap:

1. Confirm title typed before crop remains.
2. Confirm Cover Scrap preview shows selected crop.
3. Confirm Cover Scrap preview has stamp-edge frame.
4. Confirm Add more moments optional is still below.
5. Confirm Seal this day works.

Saved detail:

1. Open `/journal/demo?screen=detail&photos=1`.
2. Confirm photo frame has subtle stamp edge.
3. Open `/journal/demo?screen=detail&photos=9`.
4. Confirm all 9 frames have subtle stamp edges without becoming too noisy.
5. Confirm no SD mark.
6. Confirm no visible Cover Scrap badge.
7. Tap image and confirm fullscreen viewer still shows the original.

## Known Limitations

- Additional moments are still auto-scrapped by default; optional `Adjust scrap` for additional moments is Phase 2B.
- The finder/punch is CSS-only and intentionally lightweight.
- The zoom control is a slider; custom pinch-to-zoom is not implemented.
- No customer-facing crop metadata controls are exposed yet.

## Recommended Next Patch

Phase 2B: allow optional `Adjust scrap` for additional moments using the same Scrap Table while keeping cover-first as the primary ritual.

Alternate next priority: database-level one-day-one-stamp `local_date` integrity if product risk outweighs visual polish.
