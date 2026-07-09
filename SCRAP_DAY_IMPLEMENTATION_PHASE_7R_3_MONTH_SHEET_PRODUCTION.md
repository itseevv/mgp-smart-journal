# Scrap Day Phase 7R.3 Selected Month Sheet Visual Direction In Production

## Scope

Phase 7R.3 implements the selected Month Sheet direction in production Journal Home only.

In scope:

- `/c/[publicToken]` journal home / Month Sheet
- `/journal/demo?screen=home`
- Shared Journal Home / Month Sheet components needed by those routes

Out of scope:

- Daily Memory Stamp Detail
- Create/Edit flow
- Scrap Finder / Scrap Table
- Save/Share modal
- Daily and monthly export generation
- Admin pages
- Database, migrations, Supabase policies, auth, lock/unlock logic, local_date logic, duplicate-day rules, texture upload/storage, crop metadata semantics, 9-image cap, and voice memo hidden state

## Selected Playground Direction Summary

The selected direction is the Bottom sticky "Seal Today" CTA version from `/design/scrap-day-v2`.

Production Month Sheet now follows:

- No header logo
- Quiet centered serif journal title
- Top-right settings button with Rename / Lock journal in the menu
- No visible Rename / Lock main-header clutter
- No "MONTH SHEET" label
- Large 3-column photo-first grid
- Date shown subtly on the top-left of each photo
- No date captions below tiles
- Transparent / sheer overlay over leather
- No postage, perforation, stamp-edge, heavy paper card, decorative photo border, white mat, or placeholder tiles

## Brand Guideline Alignment

The implementation adds Month Sheet-specific Modern Goddess Patina tokens:

- Deep Burgundy `#421819`
- Champagne Peach `#E4B48F`
- Vintage Blush `#B28C7B`
- Warm Ivory `#E8DBCC`
- Cocoa Taupe `#62453A`

Dark and saturated leather themes use Warm Ivory / Champagne Peach for title and controls. Ivory/light leather uses Deep Burgundy and Cocoa Taupe-weighted contrast. Font stacks are CSS-only and scoped to the home surface.

## Files Changed

- `app/globals.css`
- `components/journal/bottom-ritual-action.tsx`
- `components/journal/editorial-primitives.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-identity-header.tsx`
- `components/journal/month-sheet-grid.tsx`
- `components/journal/month-tile.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `data/journal-themes.ts`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_3_MONTH_SHEET_PRODUCTION.md`

## Components Created/Refined

- Created `BottomRitualAction` for the home-only bottom CTA.
- Refined `JournalIdentityHeader` to show quiet journal title plus settings only.
- Refined `MonthlyStampSheet` to remove the Month Sheet eyebrow and use the selected sheer overlay.
- Refined `MonthSheetGrid` for 3-column app metadata and tighter photo-first gaps.
- Refined `MonthTile` for top-left on-photo date markers.

## Production Month Sheet Changes

- Production and demo home now share the selected home visual direction.
- Month navigation remains query-driven and unchanged.
- Month Sheet still renders only sealed days in local_date order.
- Empty/future placeholder tiles are not rendered.

## Header/Settings Changes

- Header logo remains absent.
- Journal title is centered, quiet, serif, truncated safely, and visually aligned with the top-right settings button.
- Rename and Lock journal remain available inside the settings menu.
- Rename / Lock are not standalone main-header actions.

## Bottom CTA Implementation

- "Seal Today" is rendered through `BottomRitualAction`.
- The CTA is home-only and not applied to Create/Edit.
- It is visually constrained to the mobile journal shell width and respects safe-area bottom.
- Journal Home content receives extra bottom padding so the final photo row can scroll above the CTA.
- Existing behavior is preserved: if today is sealed, Seal Today opens today's existing stamp; otherwise it opens the creation flow.

## Photo Grid/Date Marker Implementation

- Month Sheet uses a 3-column app grid.
- Each sealed day renders one square Cover Scrap using existing crop metadata.
- Dates render as subtle top-left on-photo text with no filled badge or solid background.
- No date captions below photos are rendered.
- Month Sheet tiles do not use `StampFrame`, perforation, photo mats, or decorative borders.

## Overlay/Material Implementation

- The Month Sheet surface uses a sheer Vintage Blush / Warm Ivory / Champagne Peach / Cocoa Taupe overlay.
- The overlay has no visible white border, no hard outline, and no heavy paper-card shadow.
- Leather remains visible around and through the Month Sheet surface.
- Desktop outer background still avoids stretching leather texture globally; leather texture remains scoped to the mobile journal shell.

## Theme Compatibility Notes

- Wine red / burgundy: strongest brand fit; Champagne Peach journal title and Warm Ivory month title stay legible.
- Black: Warm Ivory title/CTA keep the surface from feeling technical or flat black.
- Dark brown: Warm Ivory and Champagne Peach maintain warmth over the tactile leather.
- Teal / green: MGP overlay and CTA warm the cooler leather without adding random blue UI.
- Ivory: Deep Burgundy title/CTA provide brand contrast without pure black.

Known limitation: real customer thumbnails can vary widely in brightness, so the date marker uses light text plus shadow rather than a filled badge. Very pale photos may still reduce marker contrast slightly, but the treatment preserves the selected quiet photo-first direction.

## Tests Added/Updated

- Updated source regression guards for:
  - 3-column Month Sheet app grid
  - sealed-days-only rendering
  - no empty placeholder capacity loop
  - no "MONTH SHEET" label
  - no date captions below tiles
  - on-photo date markers
  - no `StampFrame` / perforated Month Sheet tile usage
  - no Month Sheet decorative photo border/mat class
  - bottom sticky Seal Today CTA
  - Rename / Lock hidden inside settings
  - local_date ordering and duplicate-day behavior staying intact
  - mobile shell texture route wiring for real and demo home routes

## Commands Run And Results

- `npm test` - passed, 87 tests.
- `npm run lint` - passed with `eslint . --max-warnings=0`.
- `npm run build` - failed inside the sandbox with the known Turbopack port-binding restriction while processing `app/globals.css`.
- `npm run build` - passed when rerun outside the sandbox after approval.
- `git diff --check` - passed.

## Known Issues / Deferred Work

- Phase 7R.4 Apply selected visual system to Daily Memory Stamp Detail
- Phase 7R.5 Apply selected visual system to Create/Edit and dedicated Scrap Finder
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 6.5 Vercel Preview
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
