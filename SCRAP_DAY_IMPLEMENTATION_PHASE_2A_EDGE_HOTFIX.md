# Scrap the Day Phase 2A.2 Edge Hotfix

## Summary

This hotfix strengthens the postage-stamp edge treatment across the journal photo frames without changing Phase 2A behavior, crop math, upload flow, routes, or saved Memory Stamp layouts.

The affected surfaces now use a clearer two-layer stamp frame:

- a visible paper rim and inner contrast line
- a perforated cutout layer with stronger teeth/dots

## Root Cause

The Phase 2A follow-up exposed the right `StampFrame` surfaces, but the actual visual edge was still too subtle:

- small frames used a 1px perforation at `0.58` opacity
- the edge was mostly a thin radial-gradient overlay, not a real paper rim
- small saved detail tiles, especially 9-photo stamps, lost the edge against photo content and gaps
- there was not enough contrast for both light and dark photos

## Files Changed

- `app/globals.css`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`

## Edge Implementation

The shared stamp frame CSS now uses:

- `::before` for the paper rim and inner contrast line
- `::after` for the perforation/cutout layer
- stronger CSS variables for rim width, rim color, cutout shadow, inner contrast, dot size, and opacity
- pointer-events disabled on decorative layers so frame interactions continue to work

The `Cover Scrap` label and thumbnail cover label were raised above the decorative frame layer so the stronger rim does not obscure edit/sealing labels.

## Variant Values

### `lg`

Used by the Scrap Table aperture.

- `--stamp-rim-width: 10px`
- `--stamp-edge-dot: 3.2px`
- `--stamp-edge-opacity: 1`
- strongest paper rim and darkest cutout shadow

### `md`

Used by Cover Scrap preview.

- `--stamp-rim-width: 7px`
- `--stamp-edge-dot: 2.35px`
- `--stamp-edge-opacity: 0.98`
- clear rim and oxblood contrast, still refined

### `sm`

Used by additional moment thumbnails and saved Memory Stamp tiles.

- `--stamp-rim-width: 4px`
- `--stamp-edge-dot: 1.55px`
- `--stamp-edge-opacity: 0.92`
- visible at 9-photo density without becoming noisy

## Surface Coverage

- Scrap Table aperture: `StampFrame variant="lg"`
- Cover Scrap preview: `StampFrame variant="md"`
- Additional moment thumbnails: `StampFrame variant="sm"`
- Saved Daily Memory Stamp photo tiles: `StampFrameButton variant="sm"`

## Preserved Behavior

- accepted Memory Stamp layout
- cover-first flow
- Scrap Table interaction
- non-distorted Scrap Table photo behavior
- crop metadata
- fullscreen original viewer
- Add more moments optional
- max 9 images
- no voice memo UI
- no 30-photo UI
- no SD mark

## Intentionally Not Implemented

- Phase 2B additional moments Adjust Scrap
- share/export
- Year in Stamps
- local_date uniqueness
- layout redesign
- crop math changes
- upload flow changes

## Verification

- `npm run lint` - passed
- `npm test` - passed, 48 tests
- `npm run build` - passed
- `node scripts/qa-journal-route.mjs http://127.0.0.1:3000` - passed
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules PLAYWRIGHT_CHROMIUM_EXECUTABLE=/Users/yi/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000` - passed

The mobile QA script now verifies actual computed stamp-frame tokens:

- `lg` rim at least `10px`, opacity at least `1`
- `md` rim at least `7px`, opacity at least `0.98`
- `sm` rim at least `4px`, opacity at least `0.92`
- `::before` and `::after` visual layers are present

## Manual QA Checklist

1. Open `/journal/demo?screen=create`.
2. Confirm Cover Scrap preview has a clearly visible postage-stamp edge.
3. Add additional moments.
4. Confirm thumbnails have subtle but visible postage-stamp edges.
5. Open `/journal/demo?screen=detail&photos=2`.
6. Confirm both saved tiles visibly have stamp edges.
7. Open `/journal/demo?screen=detail&photos=9`.
8. Confirm all 9 tiles visibly have stamp edges.
9. Open `/journal/demo?screen=crop`.
10. Confirm Scrap Table aperture has the strongest stamp edge.
11. Confirm the visual result is not too noisy or childish.
12. Confirm photo content is still readable.
13. Confirm interactions still work.

## QA URLs

- `http://127.0.0.1:3000/journal/demo?screen=create`
- `http://127.0.0.1:3000/journal/demo?screen=detail&photos=2`
- `http://127.0.0.1:3000/journal/demo?screen=detail&photos=9`
- `http://127.0.0.1:3000/journal/demo?screen=crop`

## Recommended Next Patch

Do product-owner QA on the four hotfix URLs above. If accepted, continue to the next planned Phase 2 item; do not treat this hotfix as approval to expand into Phase 2B scope.
