# Scrap the Day Phase 7.1.2 Create/Edit + Scrap Finder Acceptance Fix

## Scope

Phase 7.1.2 is a narrow localhost QC acceptance fix for Create/Edit scrolling, Date contrast, and Scrap Finder standalone presentation.

This pass does not start Phase 6.5 Vercel preview, does not start Phase 7.2 export redesign, does not run another audit, does not redesign Month Sheet, and does not change database, auth, local_date, duplicate-day logic, texture upload/storage, Supabase policies, admin theme data model, export canvas generation, one-day-one-stamp logic, the 9-image cap, or crop metadata semantics.

## Product-Owner QC Blockers

1. Create/Edit page content could not reliably scroll after the Cover Scrap preview, blocking access to Add more moments and the save action.
2. The journal date value on the Edit/Create paper surface could inherit leather/shell text color, making values such as "August 1, 2026" too light on paper.
3. Scrap Finder still did not feel like a true standalone screen and could read as part of a long page flow.

## Root Cause Of Create/Edit Scrolling Issue

- The customer journal shell carried `journal-themed-background`, whose shared background class used `overflow: hidden`.
- The desktop mobile preview used a 9:16 shell without an explicit internal vertical scroll contract.
- The journal memory flow surface and `memory-entry` paper card also used hidden overflow, which could clip the Create/Edit form and sticky save area.

## Root Cause Of Date Contrast Issue

- The journal Create/Edit form was rendered inside a themed leather context, so unscoped form text could inherit `--journal-text`.
- The Date value had no explicit paper-surface text token, causing light/white shell text to appear on the light paper card.

## Root Cause Of Scrap Finder Inline/Long-Page Issue

- Phase 7.1.1 moved Scrap Finder through a portal, but the overlay still used full browser viewport sizing directly.
- On desktop preview, this did not clearly read as a mobile app screen and did not fully lock background document scrolling.

## Fixes Applied

- Made `JournalMobileShell` the vertical scroll container with `overflow-y: auto`, stable scrollbar gutter, touch momentum scrolling, and desktop max-height constraints.
- Added a `journal-memory-flow-surface` overflow override so journal create/edit content can extend naturally inside the scrollable shell.
- Added a `journal-create-edit-form` contract that keeps the paper form overflow visible and adds bottom padding for the sticky save controls.
- Changed the journal date label/value/icon row to use `--journal-paper-muted-text`, `--journal-paper-text`, and paper-safe edge tokens.
- Kept `local_date`, duplicate-day checks, and date input behavior unchanged.
- Converted Scrap Finder into a full fixed overlay with a centered `scrap-table-screen` mobile surface on desktop and full mobile height on phones.
- Locked `document.body` scrolling while Scrap Finder is open and restored the previous overflow value on close.
- Preserved existing finder pan/zoom/crop math, confirm/cancel flow, and metadata shape.
- Kept the blue plastic finder and old postage/perforated edges out of the app surfaces.

## Files Changed

- `app/globals.css`
- `components/capsule/persistent-memory-flow.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/memory-form.tsx`
- `components/scrap/scrap-table.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7_1_2_CREATE_EDIT_SCRAP_FINDER_FIX.md`

## Tests Added Or Updated

- Updated `tests/journal-form-regression.test.mjs` to guard:
  - mobile shell vertical scrolling;
  - create/edit paper form overflow visibility;
  - sticky action reachability padding;
  - paper-token date value contrast;
  - Scrap Finder body portal marker;
  - standalone overlay/screen classes;
  - body scroll lock while Scrap Finder is open;
  - no inline `<ScrapTable>` return inside the form body;
  - preservation of existing crop/finder markers and removal of old frame/finder treatments.

## Commands Run And Results

- `node --test tests/journal-form-regression.test.mjs` - first run failed on the new guards, then passed after implementation.
- `npm test` - passed, 86 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - sandboxed run failed because Turbopack attempted to bind an internal local process port while processing CSS.
- `npm run build` - passed when rerun with approved escalation outside the sandbox.
- `git diff --check` - passed.

## Remaining Deferred Work

- Phase 6.5 Vercel preview.
- Phase 7.2 Daily export redesign.
- Phase 7.3 Save / Share modal polish.
- Phase 8 Monthly export.
- Phase 2B Additional Moments Optional Adjust Scrap.
- Copy registry/runtime migration beyond `SCRAP_DAY_COPY_DECK.md`.
