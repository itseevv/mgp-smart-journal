# Scrap Day Phase 7R.3.1 Month Sheet Acceptance Fix

## Scope

Phase 7R.3.1 is a narrow production acceptance fix for Journal Home / Month Sheet only.

In scope:

- `/c/[publicToken]` Journal Home / Month Sheet
- `/journal/demo?screen=home`
- Shared Journal Home / Month Sheet components used by those routes

Out of scope:

- Daily Memory Stamp Detail
- Create/Edit flow
- Scrap Finder / Scrap Table
- Save/Share modal
- Export canvas generation
- Database, auth, local_date logic, duplicate-day logic, texture upload/storage, admin theme data model, Supabase policies, migrations, crop metadata semantics, one-day-one-stamp rules, 9-image cap, and voice memo state

## Product-Owner QC Clarification

Generated-looking or demo-looking images can still be real saved stamp/photo records. They must remain visible on the Month Sheet.

The data rule is:

- Do not generate empty calendar slots for dates with no saved stamp.
- Do not render synthetic UI-only placeholders for unsealed days.
- Do render every actual saved stamp/memory tile, even if the image looks abstract or placeholder-like.
- Do not filter by filename, image URL, visual appearance, or placeholder-like aesthetics.

## Product-Owner QC Issues

- Journal title was slightly too high and too small relative to the settings button.
- Month Sheet photos appeared to have a light tile outline.
- Bottom CTA felt too short and less ritual-like than the accepted playground.
- Standalone "Today is sealed." status copy felt system-like and visually noisy.

## Fixes Applied

- Aligned journal title and settings button in one grid header row.
- Increased journal title size slightly while keeping it quieter than the month title.
- Explicitly removed visible tile border and shadow from Month Sheet photo tiles.
- Increased bottom CTA height and adjusted home bottom padding.
- Removed standalone sealed status copy.
- Made the bottom CTA label state-aware: `Seal Today` or `Today's Stamp`.

## Files Changed

- `app/globals.css`
- `components/journal/bottom-ritual-action.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-identity-header.tsx`
- `data/journal-themes.ts`
- `tests/journal-form-regression.test.mjs`
- `tests/journal-product.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_3_1_MONTH_SHEET_ACCEPTANCE_FIX.md`

## Header Alignment Changes

- `JournalIdentityHeader` now renders a three-column centerline row for left spacing, journal title, and settings.
- The title and settings button are vertically center-aligned.
- Long titles remain one line and truncate before colliding with the settings control.

## Photo Tile Border Removal Changes

- Month Sheet tile CSS sets `border: 0` and `box-shadow: none`.
- Month Sheet tile markup still avoids `StampFrame`, perforation, border, ring, outline, and shadow utility classes.
- Visual separation comes from grid gaps and the sheer overlay, not individual photo frames.

## Bottom CTA Changes

- Bottom CTA min-height increased to `4.25rem`.
- Journal Home bottom padding increased so the last grid row can scroll above the fixed CTA.
- CTA remains constrained to the mobile journal shell width and respects safe-area bottom.

## Copy/State-Label Changes

- Removed visible status-message rendering from `BottomRitualAction`.
- `JournalHome` and demo home pass a state-aware label:
  - `Seal Today` when today is not sealed.
  - `Today's Stamp` when today already has a saved stamp.
- Existing behavior is preserved: the sealed state opens today's stamp, and the unsealed state opens creation.

## Data/Tile Rendering Clarification

- Month Sheet rendering remains driven by saved memory/stamp data and local_date ordering.
- No filtering was added for image path, filename, URL, or generated-looking aesthetics.
- A regression test now verifies saved records with placeholder-like paths still appear in Month Sheet positions.

## Tests Added/Updated

- Header row and centerline alignment source guards.
- Photo tile no-border/no-outline/no-frame source guards.
- Bottom CTA height and content padding guards.
- State-aware CTA label guards.
- Guard that standalone "Today is sealed." copy is not rendered.
- Data test that placeholder-like saved image paths still produce Month Sheet tiles.

## Commands Run And Results

- `npm test` - passed, 88 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.

## Deferred Work

- Phase 7R.4 Apply visual system to Daily Memory Stamp Detail
- Phase 7R.5 Apply visual system to Create/Edit and dedicated Scrap Finder
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 6.5 Vercel Preview
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
