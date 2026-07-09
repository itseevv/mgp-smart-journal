# Scrap Day Phase 7R.5C Borderless Photo Surface Cleanup

## Scope

Phase 7R.5C is a production fix for customer-facing photo and scrap surfaces.

In scope:

- Month Sheet cover-scrap tiles
- Daily Memory Stamp detail cover scrap and moment photos
- Create/Edit page Cover Scrap preview
- Create/Edit page additional moment thumbnails
- Fullscreen photo viewer image presentation
- Shared photo/scrap styling primitives used by the surfaces above

Out of scope:

- Scrap Finder layout redesign
- Month Sheet layout redesign
- Daily Detail layout redesign
- CTA placement
- Copy deck changes
- Export canvas changes
- Save/Share modal internals
- Database, auth, tokens, and persistence logic

## Root Causes

- The shared `editorial-photo-frame` CSS still carried an inset 1px stroke and soft shadow that could be reused by photo surfaces.
- Scrap Finder's aperture still had subtle 1px finder/window/boundary edges from the prior visual pass.
- Daily Detail photo buttons used a focus outline around the image tile, which could read as a frame during keyboard navigation.
- Create/Edit additional moment thumbnails kept rounded corners, and the sortable handle still used ring focus styles that read as a thumbnail frame.
- Fullscreen viewer images had explicit padding, creating an intentional black mat around the actual photograph.

## Surfaces Affected

- Month Sheet cover-scrap tiles now remain edge-free and use a borderless focus treatment.
- Daily Memory Stamp detail photo tiles keep their grid spacing but remove visible outlines/strokes around the photo blocks.
- Create/Edit Cover Scrap preview remains borderless.
- Create/Edit additional moment thumbnails no longer use rounded journal thumbnail corners or sortable ring focus styling.
- Fullscreen photo viewer now presents the actual image without extra padding.
- Scrap Finder aperture/window styling is borderless without changing crop math or layout.

## Files Changed

- `app/globals.css`
- `components/journal/month-tile.tsx`
- `components/memory/photo-viewer.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5C_BORDERLESS_PHOTO_SURFACES.md`

## Regression Coverage

- Added a Phase 7R.5C guard for all customer-facing photo/scrap surfaces.
- Guarded Month Sheet photo tiles against border/ring/outline/shadow source classes and CSS strokes.
- Guarded Daily Detail photo tiles against border/ring/outline/shadow source classes and CSS strokes.
- Guarded Create/Edit Cover Scrap and additional moments against frame/stamp/ring regressions.
- Guarded fullscreen viewer against reintroducing padded image presentation.
- Guarded shared `editorial-photo-frame` and Scrap Finder aperture CSS against 1px/inset edge regressions.

## Intentionally Not Changed

Crop math, ordering logic, exports, database, auth, and layout direction were intentionally not changed.

The Track B tactile press exploration is playground-only and is not included in this production fix.

## Commands Run And Results

- `npm test` - passed, 93 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.
