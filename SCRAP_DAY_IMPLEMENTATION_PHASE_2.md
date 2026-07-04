# Scrap the Day Implementation Phase 2

## Summary

Phase 2 implements the cover-first creation ritual and the first Scrap Table / Finder Tool cropper for the journal product.

The journal create flow now starts with a required Cover Scrap. After choosing the cover image, the user is sent to the Scrap Table to position the image inside a square stamp frame. Confirming the crop stores normalized crop metadata and returns the user to the sealing form.

Saved Daily Memory Stamps use the stored crop metadata for the first image, while the fullscreen photo viewer still shows the full original image with `object-fit: contain`.

## Product Behavior Implemented

- Cover-first journal creation: one Cover Scrap must exist before the one-line title, optional moments, and save CTA appear.
- Scrap Table / Finder Tool: move the image under a fixed square frame, adjust zoom, reset, cancel, choose another image, or confirm with “Use this scrap.”
- Normalized crop metadata: persisted as stable coordinates relative to the original image dimensions.
- Saved stamp rendering: the first photo uses crop metadata when present; otherwise it falls back to centered square display crop.
- Fullscreen original viewer: tapping any stamp image opens the existing private photo viewer and preserves the original image shape.
- Journal create/edit remains image-only, capped at 9 images, and does not render voice memo UI.

## Database Migration

Added:

- `supabase/migrations/202607030001_scrap_day_phase_2_cover_crop.sql`

The migration adds a nullable `crop_metadata jsonb` column to `public.photos` and updates the memory commit RPC path to accept, validate lightly, store, and return photo crop metadata.

This migration does not add database-level local-date uniqueness and does not change storage paths.

## Crop Metadata Model

Crop metadata is stored on `MemoryPhoto.cropMetadata` as:

- `kind: "cover-scrap"`
- `aspectRatio: 1`
- normalized `x`, `y`, `width`, and `height`
- original `imageWidth` and `imageHeight`
- `createdAt`

The crop rectangle is normalized, stable across displayed image sizes, and non-destructive. The uploaded original photo remains unchanged.

## Rendering Model

- Create/edit cover preview: uses the square stamp frame and crop metadata when available.
- Saved stamp cover: applies the same normalized crop metadata in the stamp frame.
- Additional moments: remain square display crops for visual consistency.
- Fullscreen viewer: shows the full original photo with `object-fit: contain`.

The stamp artifact can crop for presentation, but the fullscreen viewer preserves the original.

## Files Changed

- `app/globals.css`
- `app/journal/demo/page.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/photo-collection.tsx`
- `components/scrap/scrap-table.tsx`
- `components/stamp/stamp-grid.tsx`
- `data/memory-demo.ts`
- `lib/capsule/api.ts`
- `lib/scrap/crop-math.ts`
- `scripts/qa-journal-mobile-browser.mjs`
- `scripts/qa-journal-route.mjs`
- `supabase/migrations/202607030001_scrap_day_phase_2_cover_crop.sql`
- `tests/journal-form-regression.test.mjs`
- `tests/scrap-crop-math.test.mjs`

## Demo / QA URLs

With the local server running at `http://127.0.0.1:3000`:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=crop`
- `/journal/demo?screen=sealed`
- `/journal/demo?screen=create&photos=1`
- `/journal/demo?screen=create&photos=2`
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=2`
- `/journal/demo?screen=detail&photos=3`
- `/journal/demo?screen=detail&photos=4`
- `/journal/demo?screen=detail&photos=5`
- `/journal/demo?screen=detail&photos=6`
- `/journal/demo?screen=detail&photos=7`
- `/journal/demo?screen=detail&photos=8`
- `/journal/demo?screen=detail&photos=9`

## Verification

- `npm run lint` passed.
- `npm test` passed: 48 tests.
- `npm run build` passed.
- `node scripts/qa-journal-route.mjs http://127.0.0.1:3000` passed.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000` passed.

The mobile QA script checked 375px, 390px, and 430px viewports. It verified:

- no old create/edit storage copy
- no voice memo UI
- no horizontal overflow
- Scrap Table square frame
- create/sealed cover preview has crop metadata
- saved detail layouts for 1-9 photos
- no filler markers
- no `SD` mark
- saved stamp cover has crop metadata
- fullscreen viewer uses `object-fit: contain`
- close affordance exists in the viewer

## Manual QA Checklist

Use a 390px or 393px mobile viewport.

Create flow:

- Open `/journal/demo?screen=create`.
- Confirm only Date and Cover Scrap appear before choosing a cover.
- Confirm one-line title, optional moments, and “Seal this day” are not visible before cover selection.
- Open `/journal/demo?screen=crop`.
- Confirm the Scrap Table appears with a square frame.
- Drag the image and adjust zoom.
- Confirm reset works.
- Confirm “Use this scrap” returns to the sealing form.
- Confirm `/journal/demo?screen=sealed` shows a cropped Cover Scrap preview with “Adjust scrap.”
- Confirm no 30-photo UI and no voice memo UI.

Saved stamp:

- Open `/journal/demo?screen=detail&photos=1` through `/journal/demo?screen=detail&photos=9`.
- Confirm the first photo uses the chosen square cover crop.
- Confirm the stamp frame layout matches the expected row groupings.
- Tap a stamp image and confirm the fullscreen viewer shows the full original image without crop or stretch.
- Confirm the viewer close button works.
- Confirm Escape closes the viewer on desktop.

Real journal route:

- Open `/c/[publicToken]`.
- Tap “Seal Today.”
- Choose a cover image.
- Confirm Scrap Table appears before the rest of the sealing fields.
- Confirm saving still uses the existing upload/storage pipeline.
- Reopen the saved stamp and confirm the cover crop is preserved.
- Edit the stamp and confirm “Adjust scrap” can reopen the cropper for the cover.

## Intentionally Not Implemented

- Custom pinch-to-zoom / pan physics.
- Crop controls for the 8 optional additional moments.
- Persisted crop ratio modes beyond the square Cover Scrap.
- Share/export.
- Year in Stamps.
- Database-level one-stamp-per-local-day uniqueness.
- Full visual redesign or real leather texture polish.

## Recommended Next Patch

Patch 3 should focus on production hardening around the new crop metadata path:

- apply and verify the Supabase migration in the target environment
- add database-level local-date uniqueness for journal Daily Memory Stamps
- decide whether optional moments need their own crop adjustment flow
- add targeted manual QA for real signed private media URLs after deployment
