# Scrap the Day Patch 1C

## Summary

Patch 1C makes the journal customer surfaces mobile-first and removes the unexplained `SD` placeholder mark from the private Daily Memory Stamp detail.

The work is deliberately scoped: no cropper, no share/export, no database uniqueness, and no full visual redesign.

## Files Changed

- `app/globals.css`
- `app/journal/demo/page.tsx`
- `components/capsule/capsule-page.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-mobile-shell.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/stamp/stamp-grid.tsx`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PATCH_1C.md`

## Mobile-First Shell

Added `JournalMobileShell` with `data-journal-mobile-shell="true"`.

The shell:

- caps customer journal width at `30rem` / 480px on desktop,
- uses full available width on phones,
- uses `100dvh`,
- applies safe-area top/bottom padding,
- hides horizontal overflow,
- is used by `/journal/demo` and real journal customer routes inside `CapsulePage`.

This means desktop QA now shows the journal as a centered mobile-width product experience instead of a 1000px+ paper dashboard.

## Layout Adjustments

Create/edit form:

- compacted journal title input sizing so placeholder copy fits better on phone widths,
- made journal date/time stack at narrow widths,
- kept actions single-column and sticky near the bottom for the journal flow,
- kept max 9 moments, no voice memo UI, and Scrap the Day copy.

Monthly Stamp Sheet:

- reduced paper padding,
- kept the sheet in a 2-column stamp tile grid,
- made `Seal Today` full-width and tap-friendly.

Daily Memory Stamp:

- reduced title and paper mat sizing for phone widths,
- kept the 3 by 3 stamp grid within the card,
- kept fillers subtle,
- removed the unexplained placeholder mark.

## SD Removal

The `SD` mark came from `components/stamp/daily-memory-stamp.tsx` as a hardcoded decorative span in the private stamp header.

It was removed and not replaced. The private in-app Daily Memory Stamp now has no unexplained brand or monogram mark.

Remaining `SD` string occurrences are only in QA guards that verify the mark is absent.

## QA Routes

Open:

- `http://127.0.0.1:3000/journal/demo`
- `http://127.0.0.1:3000/journal/demo?screen=create`
- `http://127.0.0.1:3000/journal/demo?screen=detail`

`/memory/demo` still redirects to `/journal/demo`.

## Intentionally Not Changed

- No cropper / Finder Tool.
- No share/export.
- No database-level local date uniqueness.
- No form-level duplicate date save guard.
- No full visual redesign.
- No final leather texture polish.
- No new brand assets or animation system.

## Verification

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm test` | Passed, 38 tests |
| `npm run build` | Passed outside sandbox; sandbox build still fails on Turbopack process/port permission |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qa-journal-route.mjs http://127.0.0.1:3000` | Passed |
| `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000` | Passed |

Browser mobile QA covered widths 375, 390, and 430 for:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=detail`

Results:

- no horizontal overflow,
- mobile shell present,
- no old memory copy,
- no 30-photo UI,
- no voice memo UI,
- no visible `SD`,
- no console errors.

Observed detail widths:

- 375px viewport: stamp width 351px, grid width 307px.
- 390px viewport: stamp width 366px, grid width 322px.
- 430px viewport: stamp width 406px, grid width 362px.

## Manual Mobile QA Checklist

Use browser devtools mobile emulation:

- iPhone SE width: 375px
- iPhone 14/15 width: 390px or 393px
- large phone width: 430px

Check:

- Open `/journal/demo`.
- Open `/journal/demo?screen=create`.
- Open `/journal/demo?screen=detail`.
- Open a real `/c/[publicToken]` route if a safe test token is available.
- Confirm there is no horizontal scrolling.
- Confirm the page is a mobile-width journal experience on desktop.
- Confirm no `SD` mark appears in detail.
- Confirm create form still says `New Daily Scrap`, `One line to keep`, `Moments`, and `Seal this day`.
- Confirm no voice memo UI appears.
- Confirm the form still blocks above 9 moments.
- Confirm the Daily Memory Stamp grid fits phone width.
- Confirm the CTA is reachable.

## Recommended Next Patch

Proceed only after product-owner acceptance of Patch 1C. The next logical patch is still backend/form-level one-stamp-per-local-day enforcement or the cover-first cropper/Finder Tool, depending on priority.
