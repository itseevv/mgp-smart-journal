# Scrap Day Phase 7R.3 Direction B Month Sheet Implementation

## Scope

Phase 7R.3 implements the selected Direction B — Tactile Journal Insert visual language on production Journal Home / Month Sheet only.

In scope:

- `/c/[publicToken]` journal home
- `/journal/demo?screen=home`
- shared Month Sheet components used by those routes

Out of scope:

- Daily Memory Stamp Detail
- Create/Edit flow
- Scrap Finder
- Save/Share modal
- Daily export canvas
- Monthly export
- Admin pages
- database, auth, local_date, duplicate-day logic, texture upload/storage, Supabase policies, admin theme data model, migrations, crop metadata, one-day-one-stamp logic, and 9-image cap

## Selected Direction B Summary

Direction B treats the Month Sheet as a tactile but refined journal insert: a soft paper sheet placed over the selected leather texture. Photos remain the hero, the paper/leather contrast is comfortable, and the surface must not become a heavy cream card or childish scrapbook object.

## Files Changed

- `app/globals.css`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-identity-header.tsx`
- `components/journal/month-sheet-grid.tsx`
- `components/journal/month-tile.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_PHASE_7R_2_DIRECTION_SELECTION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_3_DIRECTION_B_MONTH_SHEET.md`

## Components Created/Refined

No new production component was created.

Refined:

- `MonthlyStampSheet`: applies Direction B tactile insert markers and styling class.
- `MonthSheetGrid`: tightens app grid gaps and marks sealed-days-only rendering.
- `MonthTile`: uses a Month Sheet-specific clean photo tile treatment instead of the shared editorial photo frame shadow/edge.
- `JournalIdentityHeader`: marks Seal Today as a small header pill.

## Month Sheet Production Changes

- Kept the 3-column mobile app grid.
- Kept sealed days only.
- Kept date captions below images.
- Kept month navigation quiet.
- Kept Month Sheet inside a soft paper insert over selected leather.

## Header/Action Changes

- Seal Today remains a small upper-right pill action.
- Rename / Lock remain inside the settings menu rather than main header content.
- Demo duplicate-day copy was shortened to "Today is sealed." so explanatory copy does not dominate the visual surface.

## Photo Treatment Changes

- Month Sheet tiles now use `month-sheet-photo-tile`.
- Removed the shared `editorial-photo-frame` treatment from Month Sheet tiles to avoid decorative inset borders/shadows.
- Cover Scrap images still use existing `CroppedStampImage` and crop metadata rendering.
- Date captions remain outside and below photos.

## Paper/Leather Material Changes

- Added `month-sheet-tactile-insert` for Direction B paper.
- The insert uses theme-aware paper tokens, gentle translucency, a low-contrast edge, and a soft shadow.
- Leather texture remains on the mobile journal shell, not stretched across the desktop outer page.

## Theme Compatibility Notes

- Paper and ink controls use existing journal paper tokens.
- Header controls use existing leather-safe translucent tokens.
- No hardcoded blue was introduced.
- The treatment is token-driven for dark brown, black, wine/burgundy/magenta, ivory, teal, and green themes.

## Tests Added/Updated

- Updated source regression guards for Direction B selection docs.
- Added/updated guards for:
  - 3-column Month Sheet app grid
  - sealed-days-only Month Sheet rendering
  - no empty placeholder capacity loop
  - date captions below photos
  - no date overlays
  - no `StampFrame` / perforated tile usage
  - no decorative Month Sheet photo border/shadow class
  - Seal Today as a header pill
  - Rename / Lock hidden in settings menu
  - local_date ordering preserved
  - duplicate-day behavior preserved
  - texture applied through `JournalMobileShell` / journal theme background
  - `/journal/demo?screen=home` continuing through shared Month Sheet components

## Commands Run And Results

- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/journal-form-regression.test.mjs` - passed, 7 tests.
- `npm test` - passed, 87 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - sandboxed run failed with the known Turbopack internal port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox.
- `git diff --check` - passed.
- `curl -I 'http://localhost:3000/journal/demo?screen=home'` - returned `HTTP/1.1 200 OK`.
- Rendered HTML smoke check confirmed `data-month-sheet-surface="direction-b-tactile-insert"`, `data-seal-today-treatment="header-pill"`, and `data-month-sheet-photo-treatment="clean-cover-scrap"`.

## Deferred Work

- Apply Direction B system to Daily Memory Stamp Detail.
- Apply Direction B system to Create/Edit flow.
- Restore/refine dedicated Scrap Finder screen.
- Phase 7.2 Daily Export Redesign.
- Phase 7.3 Save/Share modal polish.
- Phase 6.5 Vercel Preview.
- Phase 8 Monthly Export.
- Phase 2B Additional Moments Optional Adjust Scrap.
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`.
