# Scrap Day Phase 7R.5H Home CTA And Detail Playground

## 1. Scope

Phase 7R.5H has two separated tracks.

Track A production implementation:

- Move Journal Home / Month Sheet typography to the selected Variant C direction.
- Replace the changing bottom CTA label with one default `Seal the Day` entry point.
- Add a compact bottom CTA tray for today's action and backfill.

Track B playground-only exploration:

- Add Daily Memory Stamp Detail action-layout variants where the overlay can become content-only and actions can move to the leather shell layer.

Out of scope:

- Phase 7R.6A Copy Inventory
- Daily Export Redesign
- Monthly Export
- Daily Detail production action-layout changes
- Create/Edit redesign
- Scrap Finder production changes
- Save/Share modal changes
- fullscreen viewer changes
- export canvas changes
- database, auth, local_date, duplicate-day, one-day-one-stamp, texture upload/storage, Supabase policies, admin theme model, migrations, crop math, crop metadata semantics, and 9-image cap

## 2. Production Typography Hierarchy Implementation

Journal Home now uses the selected Variant C typography balance:

- `JournalIdentityHeader` accepts `typography="home-variant-c"`.
- Journal Home and the local demo pass the Home-only Variant C typography prop.
- Daily Detail keeps the default quiet header treatment.
- Month Sheet title uses `data-month-sheet-title-hierarchy="home-variant-c"`.
- Month title is reduced from the earlier very-large production state but remains substantial and readable.
- Journal name remains aligned with the top-right settings button through the existing centerline grid.

## 3. Production Seal The Day CTA Tray Implementation

`BottomRitualAction` now renders one default bottom CTA label:

- `Seal the Day`

The tray is hidden by default. Tapping the CTA toggles a compact contextual menu near the bottom button.

The tray includes:

- `Today's Stamp` when today is already sealed, or `Seal Today` when today is open
- `Seal Another Day`

The tray can be dismissed by:

- tapping the main CTA again
- selecting an option
- tapping outside
- pressing Escape

The Home bottom padding was increased so the opened tray does not make final grid content unreachable.

## 4. Behavior Semantics

`Today's Stamp` opens today's existing Daily Memory Stamp.

`Seal Today` starts the existing create flow for today when today is not already sealed.

`Seal Another Day` opens the existing create flow with date selection available. The production route uses `?create=backfill` to bypass the today-only preflight block, while the form still uses the existing date picker and duplicate-day guard.

No backend, local_date, duplicate-day, or one-day-one-stamp persistence rules changed.

## 5. Tests Added / Updated

Updated source-contract tests to reflect the 7R.5H decision that `Seal the Day` is now production-approved for Journal Home.

Added a Phase 7R.5H regression guard covering:

- selected Variant C typography in production Home
- Home-only journal header typography modifier
- Month title production hierarchy marker
- default bottom CTA label `Seal the Day`
- tray hidden/open state source path
- today sealed/open option labels
- `Seal Another Day` backfill route intent
- backfill create intent propagation through the production route
- existing date picker and duplicate guard remain in `MemoryForm`
- production Daily Detail action layout remains unchanged
- Daily Detail content-only action-layout variants remain playground-only
- export renderer remains unchanged

## 6. Playground Daily Detail Variants

`/design/scrap-day-v2` now includes Daily Detail action-layout variants:

- Variant A - Current production reference
- Variant B - Content-only overlay, shell actions
- Variant C - Content-only overlay with bottom action dock

The playground shows 1-photo, 5-photo, and 9-photo states across wine and ivory leather.

These variants are static visual/product exploration only.

## 7. What Was Intentionally Not Shipped To Production

- No production Daily Detail content-only overlay
- No production Daily Detail shell action row
- No production Daily Detail bottom action dock
- No Save/Share modal redesign
- No fullscreen viewer redesign
- No export canvas redesign
- No database or local_date behavior change
- No duplicate-day rule change
- No global copy inventory
- No Monthly Export work

## 8. Files Changed

- `components/journal/bottom-ritual-action.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-identity-header.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `app/c/[publicToken]/m/[memoryId]/page.tsx`
- `components/capsule/capsule-page.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `app/globals.css`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5H_HOME_CTA_AND_DETAIL_PLAYGROUND.md`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`

## 9. Commands Run And Results

Passed:

- `npm test` - passed, 98 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - passed after rerunning outside the sandbox. The first sandboxed attempt failed because Next/Turbopack could not create a local process/port for CSS processing (`Operation not permitted`).
- `git diff --check` - passed.

Local review smoke checks:

- `http://localhost:3002/journal/demo?screen=home` - returned 200 OK.
- `http://localhost:3002/design/scrap-day-v2` - returned 200 OK.

## 10. Next Decision Points

- Review the production Home typography balance on mobile.
- Review whether the `Seal the Day` tray feels compact enough when opened.
- Decide whether Daily Detail Variant B or C should move toward production.
- Proceed to Phase 7R.6A Copy Inventory before broad copy changes.
