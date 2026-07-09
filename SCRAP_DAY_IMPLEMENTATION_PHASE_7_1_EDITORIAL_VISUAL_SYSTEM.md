# Scrap the Day Phase 7.1 Editorial Visual System Vertical Slice

## Scope

Phase 7.1 implements a narrow customer-facing vertical slice of the photo-first
editorial direction. It updates Month Sheet, Daily Memory Stamp detail, Scrap
Finder, and matching demo routes enough to establish the visual system without
touching storage, auth, migrations, duplicate-day logic, local date logic,
texture upload, Supabase policy, or the 9:16 export canvas.

## Design Decisions Implemented

- Month Sheet uses a compact 3-column mobile app grid for sealed days only.
- Month tiles show the date as a caption below the photo, not as an overlay.
- Daily detail uses a simple editorial photo grid: 1 photo is one large column,
  2-4 photos use 2 columns, and 5-9 photos use 3 columns.
- Perforated stamp framing is removed from the Month Sheet and Daily Detail app
  grid while the existing full-screen photo viewer remains intact.
- Scrap Finder uses theme-aware leather and paper material tokens instead of the
  earlier blue plastic physical-frame treatment.
- The create flow passes the active journal theme down into the Scrap Finder so
  customer themes remain consistent when the finder opens.
- Shared primitives were introduced for this slice: `PaperPanel`,
  `RitualButton`, `TextLinkButton`, `IconButton`, `JournalIdentityHeader`, and
  `MonthTile`.

## Files Changed

- `app/globals.css`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/editorial-primitives.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-identity-header.tsx`
- `components/journal/month-sheet-grid.tsx`
- `components/journal/month-tile.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/memory-form.tsx`
- `components/scrap/scrap-table.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/stamp/stamp-grid.tsx`
- `data/journal-themes.ts`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_COPY_DECK.md`

## Components Created Or Refactored

- `JournalIdentityHeader`: compact journal name, Rename, Lock, and Seal Today.
- `PaperPanel`: theme-aware paper material surface.
- `RitualButton`: primary ritual action button.
- `TextLinkButton`: quiet text action.
- `IconButton`: compact icon action for month navigation.
- `MonthTile`: photo-first Month Sheet tile with date caption below image.
- `StampGrid`: refactored into an editorial photo grid while preserving viewer
  behavior and the 9-image cap.
- `ScrapTable`: refactored visually into a neutral editorial finder while
  preserving square crop metadata and pan/zoom behavior.

## Journal Home And Month Sheet Changes

- The journal identity is smaller and no longer competes with the photo grid.
- Seal Today moved into the identity header as a small ritual pill.
- Month navigation uses icon buttons.
- Count and duplicate explanatory copy were removed or reduced.
- Month Sheet app layout is 3 columns with tight gaps and no empty placeholder
  cells.
- Only sealed day positions are rendered; future or empty slots are not shown in
  the app grid.
- Tile date markers sit below each image via `data-month-sheet-date-caption`.

## Daily Memory Stamp Detail Changes

- The old heavy detail card shadow was removed.
- The photo grid is wrapped in `PaperPanel` and uses consistent editorial photo
  edges.
- Photo tile layout adapts by count: 1, 2, or 3 columns.
- Daily app tiles no longer use `StampFrameButton` or perforated edges.
- The full-screen `PhotoViewer` remains unchanged.
- Save / Share remains visible and still opens the existing export modal.

## Scrap Table Changes

- The finder background now inherits the active journal theme through
  `journalThemeStyle(theme)`.
- The finder is marked as `data-finder-tool="editorial-finder"`.
- The old `data-scrap-aperture="stamp-window"` marker was replaced by
  `data-scrap-aperture="finder-window"`.
- Blue one-off colors and the photo dimension readout were removed.
- `RitualButton` is used for the primary Use this scrap action.
- Pan, zoom, reset, crop confirmation, haptics, and square crop metadata remain
  unchanged.

## Copy Deck Created

`SCRAP_DAY_COPY_DECK.md` proposes a future `content/scrap-day-copy.ts` registry
and lists current text values for customer-facing surfaces. No runtime copy
registry was created in Phase 7.1.

## Theme Compatibility Notes

- New surface tokens were added to `journalThemeStyle`: paper softness, photo
  edge, leather control background/border/text, and soft shadow.
- The implementation relies on existing theme fields rather than adding a new
  admin theme data model.
- Existing texture opacity behavior is unchanged.
- The slice should work across the existing leather themes and ivory-style
  light themes because buttons, text, finder surfaces, and photo edges resolve
  from theme CSS variables.

## Tests Added Or Updated

- Updated `tests/journal-form-regression.test.mjs` to assert the Phase 7.1
  Month Sheet, Daily Detail, Scrap Finder, and copy deck source contracts.
- Added guards against reintroducing the blue finder colors, `StampFrame` in
  Scrap Finder, Month Sheet date overlays, and `StampFrameButton` in the Daily
  Detail grid.

## Commands Run And Results

- `npm test`: passed, 86 tests.
- `npm run lint`: passed with `eslint . --max-warnings=0`.
- `npm run build`: passed after rerun outside the sandbox. The first sandboxed
  attempt hit a Turbopack internal port-binding restriction while processing
  `app/globals.css`; the escalated rerun compiled, type-checked, and generated
  static pages successfully.
- `git diff --check`: passed.

## Phase 7.2 Export Redesign Handoff

Do not treat the Phase 7.1 app grid as an export redesign. Phase 7.2 should
redesign the Daily 9:16 export separately with these decisions:

- Show the journal name by default.
- Consider a future toggle for journal name visibility.
- Move toward a digital scrapbook page plus editorial postcard direction.
- Let photos occupy roughly 60-70% of the poster.
- Use a transparent MGP logo treatment.
- Remove the tiny unreadable logo treatment.
- Remove heavy childish stamp borders.
- Inherit the app grid and material system once the export canvas is redesigned.

## Known Issues And Deferred Work

- Phase 7.2 Daily Export Redesign.
- Phase 7.3 Save/Share modal polish if not handled separately.
- Phase 8 Monthly Export.
- Phase 2B Additional Moments Optional Adjust Scrap.
- Vercel preview / Phase 6.5 if not done yet.
- Runtime copy registry migration from `SCRAP_DAY_COPY_DECK.md`.
- Browser visual QA across all themes is still recommended after the vertical
  slice is reviewed.
