# Scrap the Day Implementation Phase 4.1

## Summary

Phase 4.1 replaces the Month Sheet's two-column feed-like layout with a fixed 4 x 8 monthly stamp sheet structure.

The Month Sheet now behaves like a compact visual stamp board: saved stamps are placed sequentially in ascending semantic local-date order, each visible tile shows only a two-digit day marker, and visible tile headlines/full dates are removed from the sheet. Month navigation, URL month state, `Seal Today`, and Phase 3 local-date-first grouping remain intact.

## Files Changed

- `components/journal/month-sheet-grid.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/stamp-tile.tsx`
- `components/journal/journal-demo-flow.tsx`
- `data/journal-stamps.ts`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `tests/journal-product.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_4_1.md`

## Month Sheet Layout Decision

- App Month Sheet: 4 columns x 8 rows.
- Future Monthly Export: also 4 columns x 8 rows.
- Total visual capacity: 32 positions.

The app renders saved stamps only. It does not render visible empty day cells or calendar-position gaps. Quiet paper space may remain after the last stamp, but no missing-day boxes are drawn.

## Stamp Placement

Stamps are sorted by semantic local date ascending, then `createdAt`, then id. They are then compacted into visual positions 1 through 32.

Example: stamps from the 7th, 8th, 15th, and 22nd occupy positions 1, 2, 3, and 4 rather than calendar positions 7, 8, 15, and 22.

## Day Markers

Each Month Sheet tile shows a small two-digit day marker such as `07`, `08`, `15`, or `31`.

The marker is derived from the stamp's local-date identity. The sheet does not show full `YYYY-MM-DD` dates.

## Hidden Headlines

Daily Memory Stamp titles remain available for accessibility labels and detail pages, but they are not visibly rendered on Month Sheet tiles. The Month Sheet tile no longer renders text below the image.

## Month Navigation Preservation

Preserved:

- `/c/[publicToken]?month=YYYY-MM`
- `/journal/demo?screen=home&month=YYYY-MM`
- previous / next month controls
- current-month shortcut
- invalid month query fallback
- `Seal Today` targeting today rather than the selected archive month
- detail return to the selected stamp's local-date month

## Local Date Preservation

Phase 4.1 continues to use the Phase 3 local-date-first helpers. Backfilled stamps are grouped and placed according to `localDate` first, with `capturedAt` and `createdAt` only as fallbacks.

## Demo Routes

Updated `/journal/demo` with density-specific Month Sheet data:

- `/journal/demo?screen=home&month=2026-06` - sparse, 4 stamps.
- `/journal/demo?screen=home&month=2026-07` - medium, 12 stamps.
- `/journal/demo?screen=home&month=2026-08` - dense, 31 stamps.
- `/journal/demo?screen=home&month=2026-04` - empty state.

Existing routes remain supported:

- `/journal/demo?screen=create`
- `/journal/demo?screen=crop`
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=9`
- `/memory/demo`

## Export-Ready Structure

`MonthSheetGrid` accepts `variant="app"` and is shaped to allow a future `variant="export"`. Export is not implemented in this patch.

Future Monthly Export should reuse the same 4 x 8 structure and add export-specific framing, 9:16 sizing, a small MGP logo mark, and theme handling.

## Future Theme Note

The current visual theme and background are placeholders.

Deferred requirement:

- There will be around 10 journal leather/background designs.
- Before activation, admin should be able to select the journal's leather/background theme.
- The selected theme should control the user-facing journal background after NFC scan.
- Export layouts should use the same theme source.

No admin UI, theme migration, or background asset upload was added in this patch.

## Intentionally Not Implemented

- export/download UI
- monthly export
- daily export
- Phase 2B Additional Moments Optional Adjust Scrap
- Year in Stamps
- admin theme/background selection
- final visual redesign
- local-date database changes beyond Phase 3
- cropper changes
- Live Photo, AI, OCR, video, or social features

## Verification

- `npm test` - passed, 59 tests.
- `npm run lint` - passed.
- `npm run build` - passed outside the sandbox; the sandboxed attempt hit the known Turbopack process/port permission error.
- `npm run qa:journal:smoke` - passed with local loopback access.
- `npm run qa:journal:mobile:smoke` - passed at 390px with stable dev server bound to `127.0.0.1`.
- `git diff --check` - passed.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

Month Sheet:

1. Open `/journal/demo?screen=home&month=2026-06`.
2. Confirm sparse month appears as compact 4-column collection sheet.
3. Confirm no headlines are visible under tiles.
4. Confirm day markers show two-digit date numbers only.
5. Confirm no waterfall/feed feeling.
6. Open `/journal/demo?screen=home&month=2026-07`.
7. Confirm medium month still uses the 4-column sheet.
8. Confirm no infinite long card feed.
9. Open `/journal/demo?screen=home&month=2026-08`.
10. Confirm dense month fits into the 4 x 8 structure.
11. Confirm it feels like a monthly stamp board.
12. Open `/journal/demo?screen=home&month=2026-04`.
13. Confirm gentle empty state.
14. Confirm no missing-day pressure.

Navigation:

1. Use previous / next controls.
2. Confirm URL month query updates.
3. Confirm `Back to this month` works.
4. Confirm `Seal Today` still works.
5. Confirm stamp tile opens Daily Memory Stamp detail.

Regression:

1. Confirm no photo count or storage quota.
2. Confirm no voice memo count.
3. Confirm no streak or missed-day copy.
4. Confirm local-date-first grouping still works.

## Known Limitations

- Full mobile QA was not run; only mobile smoke was run.
- Real Supabase-backed `/c/[publicToken]?month=...` manual QA was not run from this workspace.
- The 4 x 8 export structure is prepared, but no export canvas/download exists yet.
- The theme/background system is still placeholder-only.

## Recommended Next Patch

- Phase 5A: Daily Memory Stamp 9:16 export.
- Phase 5B later: Monthly Sheet 9:16 export using this 4 x 8 structure.
