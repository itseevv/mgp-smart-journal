# Scrap Day Phase 7R.5F Final Mobile Visual Refinement + Backfill CTA Playground

## 1. Scope

Phase 7R.5F is a narrow final mobile refinement pass plus a playground-only product interaction exploration.

Production scope:

- Daily Detail mobile overlay width / horizontal density parity with Month Sheet
- Scrap Finder zoom control vertical grouping
- Month Sheet empty-state brand color styling
- focused regression guards

Playground-only scope:

- Journal Identity Primary homepage hierarchy comparison
- bottom CTA / backfill action models
- empty Month state visual variants tied to CTA models

Out of scope:

- Phase 7R.6A Copy Inventory
- Daily Export Redesign
- Monthly Export
- database, auth, local_date, duplicate-day, one-day-one-stamp, texture upload/storage, Supabase policies, admin theme model, migrations, crop math, crop metadata semantics, 9-image cap, and export canvas
- production backfill CTA behavior changes
- production homepage typography hierarchy changes
- production copy changes

## 2. Production Fixes Applied

Track A production fixes were applied only to existing customer-facing surfaces.

- Daily Detail now shares the accepted mobile horizontal density tokens used by Month Sheet.
- Scrap Finder zoom now renders in the finder/photo stage above the action row.
- Month Sheet empty state now uses brand/theme-aware color classes.

## 3. Daily Detail overlay width parity

`components/stamp/daily-memory-stamp.tsx` now uses:

- `journal-home-surface--mobile-density` on the leather detail surface
- `month-sheet-mobile-density` on the translucent detail overlay
- `data-daily-detail-mobile-width="wide-overlay"`

This aligns Daily Detail's left/right relationship to the leather shell with Month Sheet on mobile.

Preserved:

- content-driven Daily Detail height
- no Month Sheet stable min-height on detail
- leather background
- translucent overlay
- date/title above the photo grid
- adaptive borderless photo grid
- quiet action row
- fullscreen viewer

## 4. Scrap Finder zoom vertical grouping

`components/scrap/scrap-table.tsx` now renders the Zoom label and slider inside the photo/finder stage with `data-scrap-zoom-group="finder-photo"`.

The action buttons remain below in a separate `data-scrap-controls="action-row"` footer.

Preserved:

- centered `scrap-finder-zoom-safe-zone`
- safe-width slider sizing
- browser edge-swipe safety
- crop drag interaction
- zoom state and `setClampedView`
- crop metadata generation
- brand-aligned slider accent
- no image dimensions
- no blue plastic or postage-edge treatment

## 5. Empty state brand-color styling

`components/journal/monthly-stamp-sheet.tsx` now marks the empty Month Sheet state with:

- `data-month-sheet-empty-state="brand-toned"`
- `month-sheet-empty-title`
- `month-sheet-empty-body`

`app/globals.css` maps those classes to theme/brand tokens:

- title: `--journal-home-month-title`
- body: `--journal-month-return-link`
- display font: `--mgp-display-font`

The copy is unchanged in this phase.

## 6. Playground Explorations Added

`app/design/scrap-day-v2/scrap-day-v2-playground.tsx` gained two new playground-only tracks:

- `data-playground-track="homepage-hierarchy-exploration"`
- `data-playground-track="bottom-cta-backfill-exploration"`

These are static design/product interaction explorations and are not wired into production behavior.

## 7. Homepage Typography Hierarchy Variants

Added side-by-side comparison of:

1. Current accepted hierarchy
2. Journal Identity Primary

The Journal Identity Primary variant makes the journal name the largest identity text and reduces the month title to a secondary role.

Shown across:

- wine red leather
- dark brown leather
- ivory leather

Production homepage typography was not changed.

## 8. Bottom CTA / Backfill Action Variants

Added playground-only CTA models:

- Variant A - Current behavior reference
- Variant B - Bottom action tray
- Variant C - Plus / add-day affordance

Documented semantics in the playground:

- `Today's Stamp` opens today's existing stamp.
- `Seal Today` starts creation for today when today is not sealed.
- `Seal Another Day` opens create/edit with date selection available for backfill.

Production `BottomRitualAction`, `JournalHome`, and `JournalDemoFlow` still use the current single CTA behavior.

## 9. Empty State Variants

The CTA exploration includes empty Month state previews. They use brand colors, keep provisional copy, and show how the empty page coexists with each bottom action model.

No production copy or empty-state behavior changed.

## 10. Files Changed

- `components/stamp/daily-memory-stamp.tsx`
- `components/scrap/scrap-table.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `app/globals.css`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5F_FINAL_MOBILE_REFINEMENT.md`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`

## 11. Tests Added / Updated

Added a Phase 7R.5F source-contract regression test covering:

- Daily Detail mobile density parity
- Daily Detail not adopting Month Sheet stable min-height
- borderless Daily Detail photo grid preservation
- Scrap Finder zoom grouping above actions
- Scrap Finder zoom safe-zone and zoom behavior source contract
- empty Month state brand-token classes
- playground-only hierarchy and backfill CTA variants
- production boundary checks for `Seal Another Day`, action tray, plus affordance, and journal-identity-primary

Updated the superseded Phase 7R.5E guard that previously prevented Daily Detail from sharing the Month Sheet mobile density token.

## 12. Commands Run And Results

Final verification:

- Pass: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/journal-form-regression.test.mjs`
- Pass: `npm test` (96/96 tests)
- Pass: `npm run lint`
- Pass: `npm run build`
  - The first sandboxed build failed because Turbopack could not bind an internal port (`Operation not permitted`).
  - The same `npm run build` command was rerun outside the sandbox and passed.
- Pass: `git diff --check`

Local route smoke:

- Pass: `http://localhost:3002/design/scrap-day-v2` returned 200.
- Pass: `http://localhost:3002/journal/demo?screen=detail&photos=5` returned 200.
- Pass: `http://localhost:3002/journal/demo?screen=crop` returned 200.

Dev server note:

- A Next dev server was already registered for this repo at `http://localhost:3002`.
- Attempting to start a second server on 3003 was blocked by the existing Next dev lock for PID 30843, so the existing server was used for route smoke checks.

## 13. What was intentionally not shipped to production

- No production `Seal Another Day` CTA
- No production bottom action tray
- No production plus/add-day affordance
- No production Journal Identity Primary typography hierarchy
- No production empty-state copy changes
- No production backfill behavior changes
- No database, local_date, duplicate-day, crop, export, or theme model changes

## 14. Next Recommended Decision Points

- Decide whether Journal Identity Primary should replace the current Month title primary hierarchy.
- Decide whether the backfill entry point should be current single CTA, action tray, or plus/add-day affordance.
- Decide the empty Month state action path before production behavior changes.
- Proceed to Phase 7R.6A Copy Inventory before changing copy globally.
