# Scrap Day Phase 7R.5G Journal Shell Consistency + CTA Action Tray Playground

## 1. Scope

Phase 7R.5G has two separated tracks.

Track A production fix:

- Add the accepted journal identity shell header to Daily Memory Stamp View only.
- Keep Month Sheet and Daily Detail in the same shell rhythm.

Track B playground-only exploration:

- Test a more balanced journal-name/month-title hierarchy.
- Test a single `Seal the Day` CTA that opens a compact action tray.
- Test empty Month states with the tray concept.

Out of scope:

- Phase 7R.6A Copy Inventory
- Daily Export Redesign
- Monthly Export
- production CTA behavior changes
- production typography hierarchy changes
- production empty-state behavior or copy changes
- database, auth, local_date, duplicate-day, one-day-one-stamp, texture upload/storage, Supabase policies, admin theme model, migrations, crop math, crop metadata semantics, 9-image cap, and export canvas

## 2. Production Fix Applied

Daily Memory Stamp View now renders the shared `JournalIdentityHeader` above the translucent Daily Detail overlay.

The production route now passes the journal title from `loadJournalMemoryContext` through `JournalMemoryPage`, `PersistentMemoryFlow`, `CompletedState`, and into `DailyMemoryStamp`.

## 3. Daily Detail shell header consistency

Daily Detail now uses the same shell header component as Journal Home / Month Sheet.

Changes:

- `DailyMemoryStamp` renders `JournalIdentityHeader`.
- `DailyMemoryStamp` uses `data-daily-detail-shell="journal-identity"`.
- The outer detail shell uses the same `journal-home-surface--mobile-density` and `px-3 py-2 sm:px-4` rhythm as production Journal Home.
- The translucent detail overlay keeps `month-sheet-mobile-density`.
- The old loose `Lock journal` row is hidden for journal view mode so it does not compete with the shell header.

Preserved:

- back link
- date/title
- adaptive borderless photo grid
- quiet action row
- fullscreen viewer
- Save/Share
- Edit stamp

## 4. Surfaces intentionally excluded from shell header

The journal identity shell header remains excluded from:

- Create/Edit form
- Scrap Finder / Scrap Table
- Save/Share modal chrome
- fullscreen photo viewer

Those surfaces remain task/action utilities.

## 5. Save/Share modal clarification

The Save/Share modal chrome was not changed. It does not receive `JournalIdentityHeader`.

The modal remains a utility/action surface with its existing header and close/action UI.

## 6. Future export artifact clarification

Future Phase 7.2 should put the journal name inside the generated 9:16 export image/canvas artifact and its preview composition.

This phase does not change:

- export canvas
- export renderer
- export modal chrome
- export copy

## 7. Playground Typography Variants

`/design/scrap-day-v2` now explores:

- Variant A - Current accepted production reference
- Variant B - Balanced Journal Identity
- Variant C - Slightly Stronger Journal Identity

The playground header uses a centerline grid so the journal name and top-right More control stay aligned.

Production typography hierarchy was not changed.

## 8. Playground CTA Tray / Backfill Variants

`/design/scrap-day-v2` now explores:

- Variant A - Current behavior reference
- Variant B - `Seal the Day` tray
- Variant C - `Seal the Day` tray with lighter secondary option

The tray model keeps one default bottom CTA and shows the two choices only in the contextual tray preview:

- `Today's Stamp` or `Seal Today`
- `Seal Another Day`

Production CTA behavior remains unchanged.

## 9. Playground Empty-State Variants

The playground empty Month state previews remain quiet and brand-toned, and now coexist with:

- current CTA reference
- `Seal the Day` tray
- today already sealed / today open states where shown

Production empty-state copy and behavior were not changed.

## 10. Files Changed

- `components/journal/journal-identity-header.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/memory/completed-state.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/journal-demo-flow.tsx`
- `data/journal.ts`
- `lib/capsule/api.ts`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5G_JOURNAL_SHELL_AND_CTA_PLAYGROUND.md`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`

## 11. Tests Added / Updated

Added a Phase 7R.5G source-contract regression guard covering:

- Month Sheet keeps `JournalIdentityHeader`.
- Daily Memory Stamp View renders `JournalIdentityHeader`.
- Daily Detail shell header renders before the translucent overlay.
- Daily Detail receives the journal title from the real journal context.
- Create/Edit, Scrap Finder, Save/Share modal chrome, and fullscreen viewer do not render the shell header.
- Daily Detail adaptive borderless grid remains unchanged.
- Save/Share and Edit actions remain present.
- Export renderer remains untouched.
- Playground-only balanced hierarchy and `Seal the Day` tray variants do not leak into production routes.

Updated the Phase 7R.5F guard so it no longer requires superseded `journal-identity-primary` and plus/add-day playground variants.

## 12. Commands Run And Results

Passed:

- `npm test` - passed, 97 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - passed after rerunning outside the sandbox. The first sandboxed attempt failed because Next/Turbopack could not create a local process/port for CSS processing (`Operation not permitted`).
- `git diff --check` - passed.

Local review smoke checks:

- `http://localhost:3002/design/scrap-day-v2` - returned 200 OK.
- `http://localhost:3002/journal/demo?screen=detail&photos=5` - returned 200 OK.

Note: the dev server selected port 3002 because port 3000 was reported as already in use by pid 30998.

## 13. What Was Intentionally Not Shipped To Production

- No production `Seal the Day` CTA
- No production CTA tray
- No production `Seal Another Day` fixed CTA
- No production balanced typography hierarchy
- No production empty-state behavior or copy change
- No journal identity shell header on Create/Edit
- No journal identity shell header on Scrap Finder
- No journal identity shell header on Save/Share modal chrome
- No journal identity shell header on fullscreen viewer
- No export canvas or modal redesign

## 14. Next Decision Points

- Decide whether Balanced Journal Identity or Slightly Stronger Journal Identity should move toward production.
- Decide whether `Seal the Day` tray should become the production backfill entry model.
- Decide the empty-state action path before production behavior changes.
- Proceed to Phase 7R.6A Copy Inventory before global copy changes.
