# Scrap the Day Implementation Phase 4.2

## Summary

Phase 4.2 fixes the Month Sheet cover mismatch and removes the bottom Sheets list from the MVP archive UI.

Month Sheet tiles now render the same cropped Cover Scrap used by the Daily Memory Stamp detail. The visible Month Sheet UI remains focused on the selected month, previous/next navigation, Back to this month, Seal Today, and the 4 x 8 stamp grid.

## Files Changed

- `components/stamp/cropped-stamp-image.tsx`
- `components/stamp/stamp-grid.tsx`
- `components/journal/stamp-tile.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-demo-flow.tsx`
- `data/journal.ts`
- `lib/capsule/api.ts`
- `supabase/migrations/202607050001_scrap_day_phase_4_2_month_sheet_cover_crop.sql`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `tests/journal-product.test.mjs`
- `SCRAP_DAY_BACKLOG_VISUAL_SYSTEM_REDESIGN.md`

## Root Cause

Daily Memory Stamp detail used crop metadata from the first photo and converted it to a crop-aware image style.

Month Sheet tiles only used the resolved thumbnail URL with plain `object-cover`, so the tile showed the thumbnail's default center crop instead of the user's adjusted Cover Scrap crop.

## Crop Metadata Path

`JournalMemorySummary` now includes the cover fields needed by Month Sheet tiles:

- `firstPhotoStoragePath`
- `firstPhotoWidth`
- `firstPhotoHeight`
- `firstThumbnailStoragePath`
- `thumbnailWidth`
- `thumbnailHeight`
- `coverCropMetadata`

`loadJournalHome` defensively parses those fields from `get_journal_home`. The new Phase 4.2 migration extends the RPC JSON payload with the first photo storage path, dimensions, thumbnail path/dimensions, and `crop_metadata`.

Deployment note: `supabase/migrations/202607050001_scrap_day_phase_4_2_month_sheet_cover_crop.sql` must be applied before deploying app code if real journal home routes should show cropped Month Sheet covers. It was not applied to production or staging in this patch.

## Shared Crop Renderer

Added `components/stamp/cropped-stamp-image.tsx`.

Daily detail now uses `CroppedPrivateStampImage` for the cover photo. Month Sheet tiles use `CroppedStampImage`. Both use `stampCropRender`, which:

- uses valid cover crop metadata first,
- falls back to center square crop metadata when dimensions exist,
- falls back to normal object-cover only when neither metadata nor dimensions are available.

Month Sheet uses thumbnail URLs when available because the crop style is percentage-based and thumbnails preserve the same aspect ratio. If a thumbnail is missing, the journal home URL resolver falls back to the display storage path.

## Sheets Section Removed

The visible bottom `Sheets` section and month-row list were removed from `MonthlyStampSheet`.

Preserved:

- previous month control,
- next month control,
- Back to this month,
- URL month query state,
- Seal Today,
- 4 x 8 fixed Month Sheet grid,
- day markers.

## Month Navigation

Month navigation remains driven by the existing Phase 4 query-state helpers:

- `/journal/demo?screen=home&month=2026-07`
- `/journal/demo?screen=home&month=2026-06`
- `/journal/demo?screen=home&month=2026-04`
- `/c/[publicToken]?month=YYYY-MM`

Invalid month query values still fall back through the existing resolver.

## local_date and Phase 3 Integrity

Phase 4.2 does not change local-date grouping, duplicate-day guards, direct route guards, or the one-day-one-stamp integrity model.

Backfilled stamps still group by `local_date` first, then captured time, then created time fallback for old/dev data.

## Design Backlog

Created `SCRAP_DAY_BACKLOG_VISUAL_SYSTEM_REDESIGN.md` for the future visual system redesign, including journal leather/background themes, admin theme selection, shared app/export components, MGP logo placement, material polish, typography, and export visuals.

## Intentionally Not Implemented

- Daily export.
- Monthly export.
- Full visual redesign.
- Admin theme selection.
- Phase 2B Additional Moments Optional Adjust Scrap.
- Year in Stamps.
- Cropper interaction changes.
- Storage path changes.
- Production or staging migration application.

## Verification

- `npm test` passed: 60 tests.
- `npm run lint` passed.
- `npm run build` passed outside the sandbox. The first sandbox run hit the known Turbopack `Operation not permitted` port-binding issue.
- `npm run qa:journal:smoke` passed outside the sandbox.
- `npm run qa:journal:mobile:smoke` passed at 390px using bundled Playwright modules and an existing local Chromium executable.
- `git diff --check` passed.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

1. Open `/journal/demo?screen=home&month=2026-07`.
2. Confirm the Month Sheet title is July 2026.
3. Confirm the 4 x 8 grid remains.
4. Confirm Month Sheet tile images render cropped Cover Scraps.
5. Confirm no visible `Sheets` section appears below the Month Sheet.
6. Confirm previous and next month controls still work.
7. Confirm Back to this month still appears on past months.
8. Confirm Seal Today remains primary.
9. Confirm no headlines under Month Sheet tiles.
10. Confirm day markers remain two-digit.
11. Confirm no storage/photo quota/voice memo copy appears.
12. Open a Daily Memory Stamp detail.
13. Adjust or zoom the cover scrap.
14. Save and return to Month Sheet.
15. Confirm the Month Sheet tile shows the adjusted crop rather than the uncropped original.

## Known Limitations

- Real route Month Sheet crop rendering depends on applying the Phase 4.2 RPC migration before app deployment.
- Existing records without crop metadata use center square fallback.
- Month Sheet still loads all journal memory summaries for the archive MVP. Once a journal approaches 365 stamps, add month-specific or cover-only summary pagination.
- This patch does not improve the overall visual system; it only documents the future redesign backlog.

## Recommended Next Patch

Phase 5A: Daily Memory Stamp 9:16 export.
