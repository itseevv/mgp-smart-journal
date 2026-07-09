# Scrap Day Phase 7R.5I.1 Final Polish

## 1. Scope

Phase 7R.5I.1 keeps two tracks separate.

Track A production fix:

- Align the production Month Sheet bottom `Seal the Day` CTA button with the approved playground button proportions.
- Preserve the accepted CTA and contextual tray behavior.

Track B playground-only cleanup:

- Polish the Daily Memory Stamp Detail candidate by removing status/settings clutter.
- Keep the content-only overlay direction as a design playground candidate only.

Out of scope:

- Phase 7R.6A Copy Inventory
- Daily Export Redesign
- Monthly Export
- production Daily Detail layout changes
- Create/Edit changes
- Scrap Finder changes
- Save/Share modal changes
- fullscreen viewer changes
- export canvas changes
- database, auth, local_date, duplicate-day, one-day-one-stamp, texture upload/storage, Supabase policies, admin theme model, migrations, crop math, crop metadata semantics, and 9-image cap

## 2. Production Bottom CTA Visual Parity Fix

The production `Seal the Day` main button now has an explicit Home bottom CTA visual path:

- `data-seal-the-day-cta-visual="approved-playground-button"`
- `min-height: 3rem`
- `padding: 0.75rem 1rem`
- `font-size: 0.875rem`
- `font-weight: 600`
- full pill radius
- existing Home CTA background, text, and shadow tokens

This fixes the earlier cascade issue where the generic `.editorial-ritual-button` sizing could make the Home bottom CTA feel too thin compared with the playground `min-h-12 text-sm font-semibold` button.

## 3. CTA Behavior And Tray Logic Unchanged

The accepted interaction model remains unchanged:

- default bottom CTA shows only `Seal the Day`
- tapping opens the contextual tray
- tray is hidden by default
- tray can be dismissed with outside tap, Escape, selecting an option, or tapping the CTA again
- today sealed still shows `Today's Stamp` and `Seal Another Day`
- today open still shows `Seal Today` and `Seal Another Day`
- routing and duplicate-day/local_date protections remain unchanged

The Phase 7R.5I tray visual alignment also remains intact.

## 4. Daily Detail Playground Cleanup

The Daily Detail playground now has a cleaner final candidate:

- Variant A remains the current production reference
- Variant B is the final clean shell candidate
- candidate shell top row has icon-only back arrow, centered journal name, and an invisible right spacer
- no visible top-right settings/more button appears in the candidate
- no `Saved in this journal.` status line appears in the candidate
- overlay remains date/title/photo-grid content with a small icon-only edit pencil
- edit keeps `aria-label="Edit stamp"`
- bottom `Save / Share` primary CTA remains on the shell layer

The playground still shows 1-photo, 5-photo, and 9-photo states across wine/dark and ivory/light leather.

## 5. Not Shipped To Production

No Track B Daily Detail cleanup shipped to production.

Production Daily Detail still keeps:

- existing journal identity shell header on view
- leather background
- translucent overlay
- adaptive borderless photo grid
- current visible action layout
- true fullscreen viewer behavior

No production Save/Share modal, export canvas, Create/Edit, or Scrap Finder code changed for Track B.

## 6. Save/Share Behavior Note

The intended future production behavior is unchanged:

- tapping `Save / Share` should open the existing Save/Share modal/composer
- modal chrome remains utility/action UI
- no journal identity shell header should appear on modal chrome
- export canvas and image generation remain unchanged until Phase 7.2

The playground includes this behavior note next to the Daily Detail candidate.

## 7. Files Changed

- `components/journal/bottom-ritual-action.tsx`
- `app/globals.css`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5I_1_FINAL_POLISH.md`

## 8. Tests Added / Updated

Updated source-contract tests for:

- production bottom CTA visual parity path
- explicit CTA sizing that matches the playground button proportions
- accepted CTA behavior and tray logic remaining unchanged
- Daily Detail final candidate using an invisible spacer instead of a settings button
- Daily Detail final candidate retaining the edit pencil and bottom Save / Share CTA
- Daily Detail final candidate removing saved status
- Track B markers remaining absent from production Daily Detail, Create/Edit, and export code

## 9. Commands Run And Results

- `npm test` - passed, 100 tests
- `npm run lint` - passed
- `npm run build` - passed after rerun outside the sandbox; the first sandboxed attempt failed because Turbopack could not bind to its helper port
- `git diff --check` - passed

## 10. Next Decision Points

- Product owner reviews the production `Seal the Day` button proportion on localhost.
- Product owner reviews the final clean Daily Detail playground candidate.
- If accepted later, implement the Daily Detail shell/action layout in production as a separate gated phase.
- Copy remains deferred to Phase 7R.6A Copy Inventory.
- Export artifact redesign remains Phase 7.2.
