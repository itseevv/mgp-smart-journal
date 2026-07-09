# Scrap Day Phase 7R.5J Strict Visual Parity And Detail Rebalance

## 1. Scope

This strict correction pass covers three bounded parts.

Part A production fixes:

- Restore Month Sheet typography hierarchy to the accepted Variant C relationship.
- Make Daily Detail View use the same journal shell header language as Month Sheet.
- Move Daily Detail actions to the accepted shell/action model.
- Align Scrap Finder `Use this scrap` with the accepted primary CTA family.
- Preserve existing CTA tray behavior while keeping the Phase 7R.5I tray visual treatment.

Part B playground only:

- Add a focused Daily Detail vertical spacing study for the top-heavy / bottom-empty feeling.

Part C token locking:

- Centralize the shell header title sizing and primary CTA proportions so the same visual rules are reused instead of being page-specific one-offs.

Out of scope:

- Copy Inventory
- Daily Export Redesign
- Monthly Export
- database, auth, crop logic, seal logic, date logic, upload logic, or modal behavior changes
- paper cards, stamp edges, photo borders, or blue Scrap Finder styling

## 2. Exact Production Fixes Applied

Month Sheet:

- Restored the accepted Variant C relationship from the playground.
- `JournalIdentityHeader` Variant C title now uses `1.42rem` / `line-height: 1`.
- Month Sheet title now uses the shared `.month-sheet-title--home-variant-c` token path at `1.36rem` / `line-height: 1.1`.
- Removed page-level Tailwind font-size overrides from the Month Sheet title.
- Journal name remains centered in the shell row and aligned to the settings button centerline.

Daily Detail View:

- Reuses `JournalIdentityHeader` with `typography="home-variant-c"`.
- Header structure is now left back icon, centered journal name, right invisible spacer.
- Removed the Daily Detail dot-menu.
- Removed visible `Back to month sheet` text from the overlay.
- Removed `Saved in this journal.` from production Daily Detail.
- Added an icon-only edit pencil in the overlay top-right with `aria-label="Edit stamp"`.
- Moved `Save / Share` to a bottom shell primary CTA.
- `Save / Share` still opens the existing `DailyStampExportComposer`.

Scrap Finder:

- `Use this scrap` now uses `tone="home"` plus the shared `journal-primary-bottom-cta` class.
- The CTA uses the same height, radius, padding, font sizing, weight, background, text, and shadow family as `Seal the Day`.
- Scrap Finder interaction, zoom behavior, and page structure were not changed.

CTA tray:

- Interaction remains unchanged.
- Existing Phase 7R.5I tray visual token path is preserved.

## 3. Exact Playground-Only Experiments

The Daily Detail playground still includes the current reference and clean shell candidate, and now adds a focused vertical spacing study:

- Spacing A - current clean candidate
- Spacing B - airier date/title/grid
- Spacing C - optically centered artifact

Each candidate preserves:

- shell back arrow
- centered journal name
- no dot-menu
- overlay edit pencil
- no saved status
- bottom Save / Share CTA
- 1-photo, 5-photo, and 9-photo states
- wine/dark and ivory/light leather themes

## 4. Token / Shared-Style Hardening

Added or strengthened shared style paths:

- `journal-identity-header--home-variant-c` locks the accepted shell journal title sizing.
- `month-sheet-title--home-variant-c` locks the accepted Month title sizing relationship.
- `journal-primary-bottom-cta` locks primary CTA height, radius, padding, text size, text weight, and width.
- `JournalIdentityHeader` now supports a left shell control and a right spacer, so Month Sheet and Daily Detail share one header system.
- `Daily Detail`, `Seal the Day`, and `Use this scrap` now reuse the primary CTA family instead of separate one-off sizing.

## 5. Files Changed

- `components/journal/journal-identity-header.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/bottom-ritual-action.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/scrap/scrap-table.tsx`
- `app/globals.css`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5J_STRICT_VISUAL_PARITY_AND_DETAIL_REBALANCE.md`

## 6. Visual Parity Checks Performed

Browser checks performed against `http://127.0.0.1:3002`:

- Month Sheet mobile: full Playwright mobile QA passed at 375, 390, and 430 widths. The app Month Sheet is locked to 3 render columns, 32 capacity, no export rows in app mode, no horizontal overflow, no visible full dates, no visible titles, and no bottom Sheets list.
- Daily Detail mobile: full Playwright mobile QA passed for 1-photo through 9-photo states at 375, 390, and 430 widths. Square frame ratios, expected row layouts, fullscreen viewer, no old stamp-edge markers, and no horizontal overflow passed.
- Scrap Finder mobile: full Playwright mobile QA passed at 375, 390, and 430 widths. Finder plate, aperture, natural photo surface, square frame, no old stamp-frame markers, and shared `journal-primary-bottom-cta` treatment for `Use this scrap` passed.
- Bottom CTA tray behavior: targeted Playwright check confirmed closed -> open -> Escape closed, `Today's Stamp` / `Seal Today` option plus `Seal Another Day`, accepted tray visual marker, and shared primary CTA class.
- Daily Detail Save / Share: targeted Playwright check confirmed the bottom `Save / Share` CTA opens the existing `DailyStampExportComposer` dialog titled `Save or share`; composer close also detached the dialog.

## 7. Test / Build / Lint Results

Verification commands:

- `npm test` - passed, 101 tests.
- `npm run lint` - passed.
- `npm run build` - passed after rerunning outside the sandbox because Turbopack's helper process needs local port binding.
- `git diff --check` - passed.
- `npm run qa:journal:mobile -- http://127.0.0.1:3002` - passed in full mode after syncing the QA script to the accepted 3-column app Month Sheet and current Scrap Finder `action-row` DOM.
- Targeted Playwright interaction check for bottom CTA tray and Daily Detail Save / Share composer - passed.

## 8. Interaction Confirmations

- Save / Share interaction logic is unchanged.
- Save / Share modal/composer flow is unchanged.
- CTA tray behavior is unchanged.
- Scrap Finder crop/zoom/confirm behavior is unchanged.
- Only visual/layout changes were made where requested.

## 9. Remaining Product Owner Decisions

- Preferred Daily Detail spacing candidate.
- Final confirmation that Month Sheet hierarchy now matches accepted Variant C closely enough across themes.
