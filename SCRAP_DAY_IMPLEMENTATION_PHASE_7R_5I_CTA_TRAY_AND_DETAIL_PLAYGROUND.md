# Scrap Day Phase 7R.5I CTA Tray And Detail Playground

## 1. Scope

Phase 7R.5I keeps two tracks separate.

Track A production fix:

- Align the existing `Seal the Day` contextual tray visual styling to the approved `/design/scrap-day-v2` tray.
- Preserve the accepted one-button default interaction and state-aware tray options.

Track B playground-only exploration:

- Add Daily Memory Stamp Detail variants where the overlay is a content artifact and navigation/actions live on the journal shell layer.
- Do not ship the Daily Detail experiment to production.

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

## 2. Production CTA Tray Visual Fix

The production `BottomRitualAction` tray now follows the approved playground tray styling path:

- tray background uses `--journal-home-cta-tray-bg`
- tray shadow uses `--journal-home-cta-tray-shadow`
- light leather maps to warm ivory at 70 percent opacity
- dark leather maps to deep burgundy at 42 percent opacity
- blur, radius, padding, and compact option sizing match the playground tray
- both options use the same quiet secondary control styling so the tray reads as one contextual menu, not two permanent main CTAs

The production tray is marked with `data-seal-the-day-tray-visual="approved-playground"` for regression coverage.

## 3. CTA Tray Behavior Not Changed

The accepted behavior remains unchanged:

- default bottom CTA is still one button: `Seal the Day`
- tray is hidden by default
- tapping `Seal the Day` opens/closes the tray
- selecting an option closes the tray
- tapping outside closes the tray
- Escape closes the tray
- safe-area bottom placement remains in the existing fixed bottom CTA component

## 4. State-Aware CTA Options Preserved

The tray still renders the same state-aware options:

- today sealed: `Today's Stamp` and `Seal Another Day`
- today open: `Seal Today` and `Seal Another Day`

Routing semantics are unchanged:

- `Today's Stamp` opens today's existing stamp
- `Seal Today` starts today's create flow
- `Seal Another Day` opens the existing create flow with date selection available
- duplicate-day and local_date protections remain in the existing form/API path

## 5. Playground Daily Detail Variants

`/design/scrap-day-v2` now includes four Daily Detail action-layout variants:

- Variant A - Current production reference
- Variant B - Shell Navigation + Content Artifact + Bottom Save CTA
- Variant C - Same shell model, with Edit stamp inside the settings menu
- Variant D - Same as Variant B, with subtle saved status on the shell layer outside the overlay

The playground shows 1-photo, 5-photo, and 9-photo states across wine/dark and ivory/light leather.

The shell exploration includes:

- icon-only back arrow with `aria-label="Back to month sheet"`
- centered journal name
- right-side settings/more button
- content overlay with date, title, and borderless adaptive photo grid
- optional icon-only edit affordance with `aria-label="Edit stamp"`
- bottom `Save / Share` primary CTA using the accepted Month Sheet bottom CTA design language

## 6. Intentionally Not Shipped To Production

- No production Daily Detail shell navigation row
- No production Daily Detail content-only overlay
- No production Daily Detail bottom Save / Share CTA
- No production Daily Detail settings-menu edit relocation
- No Save/Share modal changes
- No fullscreen viewer changes
- No export canvas changes
- No Create/Edit or Scrap Finder changes
- No database or one-day-one-stamp behavior changes
- No global copy inventory

## 7. Files Changed

- `components/journal/bottom-ritual-action.tsx`
- `app/globals.css`
- `data/journal-themes.ts`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5I_CTA_TRAY_AND_DETAIL_PLAYGROUND.md`

## 8. Tests Added / Updated

Added Phase 7R.5I source-contract coverage for:

- approved production CTA tray visual token path
- default one-button `Seal the Day` CTA remains intact
- tray hidden/open state logic remains intact
- state-aware tray labels remain intact
- `Seal Another Day` backfill route remains intact
- Daily Detail production remains unchanged
- new Daily Detail shell-action variants are playground-only
- wine/ivory and 1/5/9-photo playground coverage remains present
- Save/Share modal and export canvas remain out of scope

## 9. Commands Run And Results

- `npm test` - passed, 99 tests
- `npm run lint` - passed
- `npm run build` - passed after rerun outside the sandbox; the first sandboxed attempt failed because Turbopack could not bind to its helper port
- `git diff --check` - passed

## 10. Next Decision Points

- Product owner reviews the production CTA tray on localhost and confirms the visual alignment.
- Product owner reviews Daily Detail playground variants B/C/D.
- Decide whether edit belongs as an overlay icon or inside settings.
- Decide whether saved status is needed outside the overlay.
- Copy remains deferred to Phase 7R.6A Copy Inventory.
