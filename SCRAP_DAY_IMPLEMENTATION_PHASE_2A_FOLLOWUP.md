# Scrap the Day Phase 2A Follow-up

## Summary

This follow-up fixes the Phase 2A acceptance issues around Scrap Table spacing and stamp-edge consistency. The create/crop flow now keeps the finder and actions visually connected on mobile, and the perforated stamp edge is implemented as a reusable frame system across the journal surfaces.

## What Was Wrong

- The Scrap Table aperture lived in a flexible stage that could push the zoom/actions footer too far down, creating a large dead gap on mobile.
- Perforated stamp edges were implemented ad hoc, so the Scrap Table aperture, create preview, additional moment thumbnails, and saved stamp detail did not share a consistent visual system.
- The mobile QA script depended on Playwright's default browser revision only, which made local verification brittle when an older cached Chromium was already available.

## Files Changed

- `app/globals.css`
- `components/scrap/scrap-table.tsx`
- `components/stamp/stamp-frame.tsx`
- `components/stamp/stamp-grid.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/photo-collection.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/journal/journal-demo-flow.tsx`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`

## Implementation Details

### Scrap Table Spacing

- The Scrap Table mobile shell now uses a tighter layout marker: `data-scrap-layout="tight-mobile"`.
- The finder stage no longer consumes the remaining vertical space before controls.
- The controls footer uses `data-scrap-controls="tight"` and sits close to the stamp aperture.
- Mobile QA measured the aperture-to-controls gap at about 24px at 375px width.

### Shared Stamp Edge System

Added `components/stamp/stamp-frame.tsx` with:

- `StampFrame`
- `StampFrameButton`
- `stampFrameClassName`
- `StampFrameVariant = "lg" | "md" | "sm"`

All shared frames expose:

- `data-stamp-edge="perforated"`
- `data-stamp-frame={variant}`

Variant usage:

- `lg`: Scrap Table aperture, stronger physical stamp teeth.
- `md`: cover preview in create/edit.
- `sm`: additional moment thumbnails and saved Daily Memory Stamp tiles.

### Surfaces Updated

- Scrap Table aperture now uses `StampFrame variant="lg"`.
- Cover preview now uses `StampFrame variant="md"`.
- Additional moments / reorder thumbnails now use `StampFrame variant="sm"`.
- Saved Memory Stamp image tiles now use `StampFrameButton variant="sm"`.

### Image Behavior Preserved

- Scrap Table still displays the source image without distortion while the user adjusts crop.
- Saved stamp tiles still use normalized square display frames.
- Fullscreen original photo viewer still uses contained full-image display.
- Existing crop metadata persistence and signed/private media behavior remain unchanged.

### Demo Stability

The journal demo now uses a stable demo timestamp so server-rendered and client-rendered date labels match during QA. This removes the hydration mismatch warning that was polluting mobile QA.

## Verification

- `npm run lint` - passed
- `npm test` - passed, 48 tests
- `npm run build` - passed
- `node scripts/qa-journal-route.mjs http://127.0.0.1:3000` - passed
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules PLAYWRIGHT_CHROMIUM_EXECUTABLE=/Users/yi/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000` - passed

The first sandboxed route QA and build attempts were blocked by local execution permissions; both passed when rerun with local host/process permissions. Mobile QA used an existing cached Chromium executable instead of installing a new browser.

## Manual QA Checklist

- Open `/journal/demo?screen=crop`.
- Confirm the Scrap Table finder is visible without a large dead gap before the zoom/actions.
- Confirm the aperture has the strongest stamp edge.
- Confirm the image is not distorted while adjusting crop.
- Open `/journal/demo?screen=create`.
- Confirm the initial form still has one-line-first, no voice memo UI, no 30-photo copy, and no inline Scrap Table.
- Open `/journal/demo?screen=create&photos=1`.
- Confirm the cover preview uses the medium stamp edge.
- Open `/journal/demo?screen=create&photos=2`.
- Confirm the additional moment thumbnail uses the small stamp edge.
- Open `/journal/demo?screen=detail&photos=2` and `/journal/demo?screen=detail&photos=9`.
- Confirm saved stamp photo tiles use the subtle small stamp edge.
- Tap a saved stamp photo and confirm the fullscreen viewer still shows the full original image with contain behavior.

## QA URLs

- `http://127.0.0.1:3000/journal/demo?screen=crop`
- `http://127.0.0.1:3000/journal/demo?screen=create`
- `http://127.0.0.1:3000/journal/demo?screen=create&photos=1`
- `http://127.0.0.1:3000/journal/demo?screen=create&photos=2`
- `http://127.0.0.1:3000/journal/demo?screen=detail&photos=2`
- `http://127.0.0.1:3000/journal/demo?screen=detail&photos=9`

## Intentionally Not Implemented

- Phase 2B
- Share/export
- Year in Stamps
- Database local-date uniqueness
- New crop math or crop metadata model changes
- Full visual redesign
- Leather texture polish

## Recommended Next Patch

Proceed with the next accepted Phase 2 item only after product-owner QA confirms:

- Scrap Table spacing feels tight enough on a 390px mobile viewport.
- Stamp-edge strength feels correctly scaled across `lg`, `md`, and `sm`.
- Create/edit and saved detail still feel like one coherent journal product.
