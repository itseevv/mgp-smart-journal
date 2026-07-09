# Scrap Day Phase 7R.5B Dedicated Scrap Finder Visual Refinement

## Scope

Phase 7R.5B is a focused production acceptance fix for the dedicated Scrap Finder.

In scope:

- Scrap Finder / Scrap Table screen
- `/journal/demo?screen=crop`
- Create/Edit overlay preflight only
- Scrap Finder-specific theme tokens, CSS, and QA guards

Out of scope:

- Month Sheet redesign
- Daily Memory Stamp Detail redesign
- Create/Edit redesign beyond the theme-aware overlay preflight
- Save/Share modal internals
- Daily export canvas
- Monthly export
- Admin pages, database, auth, local date logic, duplicate-day logic, texture upload/storage, Supabase policies, and migrations
- Crop metadata semantics, one-day-one-stamp rules, 9-image cap, and voice memo UI

## Create/Edit Overlay Preflight

Create/Edit already used a translucent form overlay, but the gradient still referenced fixed warm MGP colors. Phase 7R.5B moved the overlay onto `--journal-form-overlay` and `--journal-form-overlay-gradient`, both produced by `journalThemeStyle(theme)`.

That keeps the accepted Create/Edit structure while making the overlay theme-aware across dark leather, wine/burgundy, teal/green, black, and ivory themes.

## Scrap Finder Visual Direction

The Scrap Finder remains a dedicated ritual screen. It is not rendered inline with the Create/Edit form, and the previous form should not be visible behind or above the finder.

The production finder now uses:

- selected journal leather theme background
- title copy: `Find today's scrap`
- helper copy: `Move the photo under the finder.`
- fixed square finder aperture
- photo-dominant pan/zoom interaction
- theme-derived finder surface, aperture, edge, zoom, and button tokens
- primary action: `Use this scrap`
- quieter secondary actions: `Choose another`, `Reset`, `Cancel`, `Close`

The finder intentionally avoids blue plastic, postage edges, perforation, StampFrame wrappers, white mats, chunky handles, and technical image dimensions.

## Behavior Preserved

- Crop math and metadata were not changed.
- Existing pan, drag, zoom, reset, choose another, cancel, close, and confirm behavior were preserved.
- The image still uses natural dimensions internally for crop calculations without showing dimensions in the UI.
- Month Sheet, Daily Detail, Create/Edit in-flow actions, and fullscreen viewer acceptance contracts remain guarded.

## Files Changed

- `app/globals.css`
- `components/scrap/scrap-table.tsx`
- `data/journal-themes.ts`
- `scripts/qa-journal-mobile-browser.mjs`
- `scripts/qa-journal-route.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5B_SCRAP_FINDER_VISUAL_REFINEMENT.md`

## Tests Added / Updated

- Added a Phase 7R.5B regression guard for the dedicated Scrap Finder visual refinement.
- Added theme-token guards for Create/Edit overlay and Scrap Finder.
- Added guards against StampFrame, perforated edges, physical-frame/stamp-window selectors, old blue cropper colors, and technical cropper copy.
- Updated QA script selectors from the old physical stamp finder to the editorial finder.
- Preserved regression guards for accepted Month Sheet, Daily Detail, Create/Edit, and fullscreen viewer surfaces.

## Commands Run And Results

- `npm test` - passed, 91 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.

## Known Issues / Deferred Work

- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 6.5 Vercel Preview
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
