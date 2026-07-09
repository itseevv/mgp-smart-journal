# Scrap Day Phase 7R.4 Daily Detail Visual System In Production

## Scope

Phase 7R.4 applies the selected Month Sheet visual direction to Daily Memory Stamp Detail.

In scope:

- `/c/[publicToken]/m/[memoryId]` Daily Memory Stamp Detail
- `/journal/demo?screen=detail`
- Daily Detail photo grid treatment
- Source guards and QA script expectations for the detail route

Out of scope:

- Month Sheet redesign beyond regression preservation
- Create/Edit flow
- Dedicated Scrap Finder
- Save/Share modal internals
- Export canvas generation
- Monthly export
- Admin, auth, lock/recovery, database, migrations, Supabase policies
- Texture upload/storage model, crop semantics, local_date/duplicate-day logic
- One-day-one-stamp rule, 9-image cap, and hidden voice memo state

## Product Direction Applied

- Daily Detail now uses the same brand-guided leather system as the accepted Month Sheet.
- The detail hierarchy is quiet and photo-first: back action, date, title, large adaptive photo grid, then small actions.
- Date and title use theme-aware journal tokens instead of generic black/white text.
- The photo grid is borderless and square, with tight gaps and no StampFrame, perforation, mat, panel border, or tile shadow.
- Cover Scrap remains first and continues to use crop metadata.
- Additional moments remain square object-cover images.
- Fullscreen viewing still opens the original photo viewer with contain-fit imagery.
- Save / Share and Edit stamp remain text-level actions.

## Files Changed

- `app/globals.css`
- `components/stamp/daily-memory-stamp.tsx`
- `components/stamp/stamp-grid.tsx`
- `scripts/qa-journal-mobile-browser.mjs`
- `scripts/qa-journal-route.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_4_DAILY_DETAIL_PRODUCTION.md`

## Runtime Notes

- The detail article still receives `journalThemeStyle(theme)` and keeps `data-journal-detail-background="themed-leather"`.
- The outer desktop page remains a neutral/fallback app shell; no global texture stretch was added.
- The previous `PaperPanel` wrapper was removed from Daily Detail photos.
- A lightweight `daily-detail-content-surface` uses the accepted home overlay tokens with no border or shadow.
- `StampGrid` keeps `PhotoViewer`, crop metadata markers, first-photo crop rendering, and the 9-photo cap behavior intact.

## Tests Added/Updated

- Daily Detail contract guards for the Phase 7R.4 markers.
- Brand-token typography guards for date and title.
- Borderless photo grid guards for Daily Detail.
- Guards that old `editorial-photo-frame`, `data-stamp-photo-frame`, `data-stamp-edge`, and `data-stamp-frame-fit` markers are not used by Daily Detail.
- Month Sheet regression guards remain in place.
- QA scripts now expect Daily Detail borderless tiles instead of old perforated stamp-frame tiles.

## Commands Run And Results

- `npm test` - passed, 89 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.

## Deferred Work

- Phase 7R.5 Apply visual system to Create/Edit and dedicated Scrap Finder
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 6.5 Vercel Preview
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
