# Scrap Day Phase 7R.5A Create/Edit + Photo Viewer Acceptance Fix

## Scope

Phase 7R.5A is a focused acceptance fix for Create/Edit and the fullscreen photo viewer.

In scope:

- Create/Edit Daily Memory Stamp form
- Fullscreen original photo viewer
- `/journal/demo?screen=create`
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=5`
- `/journal/demo?screen=detail&photos=9`
- Shared form/photo preview/viewer components touched by those surfaces

Out of scope:

- Month Sheet redesign
- Daily Detail grid/title redesign
- Dedicated Scrap Finder visual redesign
- Save/Share modal internals
- Daily export canvas
- Monthly export
- Admin pages, database, auth, local_date logic, duplicate-day logic, texture upload/storage, Supabase policies, and migrations
- Crop metadata semantics, one-day-one-stamp rules, 9-image cap, and voice memo UI

## Product-owner QC issues

- Create/Edit Save stamp and Cancel actions were sticky/fixed to the viewport and floated over content while scrolling.
- Photo viewer was constrained by the journal shell and read as a black panel inside the journal instead of an immersive fullscreen media view.
- Create/Edit still felt like the old heavy cream paper card rather than the accepted translucent overlay system.

## Save/Cancel layout fix

- Journal Create/Edit actions now render as a normal in-flow form footer.
- The action footer appears after Date, One line to keep, Cover Scrap, Add more moments, and additional moment thumbnails.
- The journal action footer no longer uses sticky/fixed positioning, bottom offsets, z-index layering, or floating shadows.
- Bottom padding is limited to safe-area comfort.

## Photo viewer fullscreen fix

- `PhotoViewer` now renders through a `document.body` portal.
- The viewer uses a `100vw` by `100dvh` fullscreen shell and is not constrained by the journal mobile shell width or overflow.
- The image remains `object-contain` and uses the original display image source path, not the cropped stamp render.
- Close, previous, next, keyboard, swipe, focus return, and photo count behavior are preserved.
- The dominant visible caption is now `Photograph N` instead of the raw filename.

## Create/Edit material/overlay update

- Journal Create/Edit now uses a dedicated `journal-create-edit-form` translucent form overlay instead of the heavy `memory-entry` card.
- The form overlay uses brand-guided warm ivory, vintage blush, and journal paper tokens with enough opacity for readable inputs.
- Date, title, labels, action buttons, and helper text use journal paper/form tokens.
- Cover Scrap and additional moment thumbnails use clean borderless editorial photo previews with no StampFrame, perforation, decorative border, mat, or tile shadow.

## Files changed

- `app/globals.css`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/photo-viewer.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5A_CREATE_EDIT_VIEWER_FIX.md`

## Tests added/updated

- Create/Edit action footer source guard for normal in-flow rendering after the photo picker.
- Create/Edit guard that journal actions do not use sticky/fixed/bottom/z-index floating positioning.
- Create/Edit translucent overlay CSS guards.
- Cover Scrap and additional moment borderless preview guards.
- Photo viewer body portal and fullscreen viewport guards.
- Photo viewer original-image/object-contain and simple-caption guards.
- Month Sheet and Daily Detail regression guards remain in place.

## Commands run and results

- `npm test` - passed, 90 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.

## Known issues / deferred work

- Phase 7R.5B Dedicated Scrap Finder visual refinement
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 6.5 Vercel Preview
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
