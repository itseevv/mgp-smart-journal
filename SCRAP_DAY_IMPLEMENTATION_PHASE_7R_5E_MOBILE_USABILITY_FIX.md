# Scrap Day Phase 7R.5E Mobile Usability Acceptance Fix

## 1. Scope

This phase is a narrow mobile usability fix after real-phone Vercel QA.

In scope:

- Month Sheet mobile width / photo size refinement
- Scrap Finder zoom control safe-zone refinement
- focused regression guards
- focused Vercel Preview Refresh for `https://journal-chip-preview.vercel.app`

Out of scope:

- Phase 7R.6A Copy Inventory Snapshot
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- database, auth, local_date logic, duplicate-day logic, one-day-one-stamp logic, texture upload/storage, Supabase policies, admin theme model, migrations, crop math, crop metadata semantics, 9-image cap, and export canvas

## 2. Mobile QA Issues

Real mobile browser QA found:

- Month Sheet transparent overlay had too much horizontal margin, making the 3-column Cover Scrap photos feel smaller than necessary.
- Scrap Finder zoom slider was too wide and started close enough to the screen edge that browser back/exit gestures were easy to trigger.

## 3. Fixes Applied

### Month Sheet Mobile Width

- Added `journal-home-surface--mobile-density` to production Journal Home and `/journal/demo` home.
- Added `month-sheet-mobile-density` and `data-month-sheet-mobile-width="wide-overlay"` to the Month Sheet production panel.
- Reduced mobile-only horizontal content padding with responsive `clamp()` values.
- Let the Month Sheet overlay sit slightly wider inside the journal shell while preserving visible leather on both sides.
- Reset the density refinement at the tablet breakpoint so desktop/tablet preview does not become awkwardly wide.

Preserved:

- transparent overlay visual direction
- stable monthly stage min-height behavior
- 3-column app grid
- sealed-days-only rendering
- date-on-photo markers
- no date below tiles
- no `MONTH SHEET` label
- bottom sticky CTA
- no photo borders, mats, or stamp/perforated frames

### Scrap Finder Zoom Control Safe-Zone

- Wrapped the zoom label/input in `scrap-finder-zoom-safe-zone`.
- Added `data-scrap-zoom-safe-zone="centered"` and `data-scrap-zoom-control="safe-range"`.
- Removed the full-width range utility from the input.
- Centered the range track with a 74% target width, 19rem max width, and a 6rem total edge reserve.
- Kept the label small/quiet and retained the brand-aligned `--journal-finder-edge` accent.

Preserved:

- zoom state and `setClampedView`
- crop math and `computeCoverCropMetadata`
- fixed finder + movable/zoomable photo interaction
- `Use this scrap` crop metadata return
- no image dimensions
- no blue plastic finder
- no postage/perforated edges

## 4. Files Changed

- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/scrap/scrap-table.tsx`
- `app/globals.css`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5E_MOBILE_USABILITY_FIX.md`

## 5. Local Commands And Results

- Pass: `npm test` (95/95 tests)
- Pass: `npm run lint`
- Pass: `npm run build`
  - The first sandboxed build failed because Turbopack could not bind an internal port (`Operation not permitted`).
  - The same `npm run build` command was rerun outside the sandbox and passed.
- Pass: `git diff --check`

Local mobile browser smoke on `http://localhost:3002`:

- Low-content Month Sheet, 320px viewport, `/journal/demo?screen=home&month=2026-05`:
  - panel left/right to viewport: 14px / 14px
  - panel width ratio: 0.912
  - app columns: 3
  - CSS grid columns: 3
  - saved positions: 2
  - tile width: 88.53125px
  - no `MONTH SHEET` label
  - no date captions
  - photo tile borders: 0px
- Fuller Month Sheet, 390px viewport, `/journal/demo?screen=home&month=2026-07`:
  - panel left/right to viewport: 14.23px / 14.23px
  - panel width ratio: 0.927
  - app columns: 3
  - CSS grid columns: 3
  - saved positions: 12
  - tile width: 111.3125px
  - no `MONTH SHEET` label
  - no date captions
  - photo tile borders: 0px
- Scrap Finder, 320px viewport, `/journal/demo?screen=crop`:
  - zoom slider left/right to viewport: 60px / 60px
  - slider width ratio: 0.625
  - zoom value changed from 1 to 2
  - no image dimension text
  - `Use this scrap` returned to Create/Edit
  - `Seal this day` opened detail after title entry
  - borderless detail tile present
- Scrap Finder, 390px viewport, `/journal/demo?screen=crop`:
  - zoom slider left/right to viewport: 60px / 60px
  - slider width ratio: 0.692
  - zoom value changed from 1 to 2
  - no image dimension text
  - `Use this scrap` returned to Create/Edit
  - `Seal this day` opened detail after title entry
  - borderless detail tile present
- Console/page errors: none.

Theme token check:

- Default dark ruby theme produced `--journal-background`, `--journal-paper`, `--journal-finder-edge`, and `--journal-home-overlay`.
- Cream/ivory theme produced the same required theme variables.
- The mobile density and zoom safe-zone changes are spacing-based and do not branch by theme color.

## 6. Vercel Deployment

- Stable preview URL: `https://journal-chip-preview.vercel.app`
- Deployment URL: `https://journal-chip-39l1xqnzy-itseevvs-projects.vercel.app`
- Deployment id: `dpl_21WuXijDzeqjS8pBryaaUXZoj2JA`
- Stable alias updated successfully to the deployment URL above.
- Vercel build completed successfully.

## 7. Preview Route Checks

Route smoke while SSO was temporarily disabled for QA:

- `/journal/demo?screen=home` -> 200
- `/journal/demo?screen=crop` -> 200
- `/journal/demo?screen=create` -> 200
- `/journal/demo?screen=detail&photos=5` -> 200
- `/c/c766b057ec13e93237b91caa4ac94cb76420db9f65550003` -> 200

No ngrok URLs were found in preview-facing source/config paths:

- `app`
- `components`
- `lib`
- `data`
- `public`
- `package.json`
- `next.config.ts`
- `.vercelignore`

Local-only `.env.local` was not treated as a preview-facing source path.

## 8. Mobile / Emulation Checks

Preview mobile browser smoke on `https://journal-chip-preview.vercel.app`:

- Low-content Month Sheet, 320px viewport, `/journal/demo?screen=home&month=2026-05`:
  - panel left/right to viewport: 14px / 14px
  - panel width ratio: 0.912
  - app columns: 3
  - CSS grid columns: 3
  - saved positions: 2
  - tile width: 88.53125px
  - home padding inline: 6px / 6px
  - panel padding inline: 7.2px / 7.2px
  - no `MONTH SHEET` label
  - no date captions
  - photo tile borders: 0px
- Fuller Month Sheet, 390px viewport, `/journal/demo?screen=home&month=2026-07`:
  - panel left/right to viewport: 14.23px / 14.23px
  - panel width ratio: 0.927
  - app columns: 3
  - CSS grid columns: 3
  - saved positions: 12
  - tile width: 111.3125px
  - home padding inline: 6.24px / 6.24px
  - panel padding inline: 7.8px / 7.8px
  - no `MONTH SHEET` label
  - no date captions
  - photo tile borders: 0px
- Scrap Finder, 320px viewport, `/journal/demo?screen=crop`:
  - safe-zone left/right: 60px / 60px
  - slider width: 200px
  - slider width ratio: 0.625
  - zoom value changed from 1 to 2
  - no image dimension text
  - `Use this scrap` returned to Create/Edit
  - `Seal this day` opened detail after title entry
  - borderless detail tile present
- Scrap Finder, 390px viewport, `/journal/demo?screen=crop`:
  - safe-zone left/right: 60px / 60px
  - slider width: 270px
  - slider width ratio: 0.692
  - zoom value changed from 1 to 2
  - no image dimension text
  - `Use this scrap` returned to Create/Edit
  - `Seal this day` opened detail after title entry
  - borderless detail tile present
- Daily Detail, 390px viewport, `/journal/demo?screen=detail&photos=5`:
  - fullscreen viewer opened with `data-photo-viewer-overlay="fullscreen-viewport"`
  - export composer opened
  - export preview reached `data-daily-stamp-export-preview="ready"`
  - export preview alt: `9:16 preview of the saved Daily Memory Stamp export`
- Known customer token route:
  - route returned 200
  - current screen is Owner PIN unlock (`Private memory` / `Unlock this memory`)
  - no real customer capsule data was mutated
- Console/page errors: none.

## 9. SSO Status

- Initial status: enabled for `prod_deployment_urls_and_all_previews`.
- Temporarily disabled for focused Phase 7R.5E preview QA.
- Restored immediately after route and browser QA.
- Final status: enabled for `prod_deployment_urls_and_all_previews`.
- Final unauthenticated request to `/journal/demo?screen=home` returned 302 to `vercel.com/sso-api`, confirming preview protection is restored.

## 10. Remaining Deferred Work

- Phase 7R.6A Copy Inventory Snapshot
- Phase 7.2 Daily Export Redesign
- Phase 7.3 Save/Share modal polish
- Phase 8 Monthly Export
- Phase 2B Additional Moments Optional Adjust Scrap
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`
