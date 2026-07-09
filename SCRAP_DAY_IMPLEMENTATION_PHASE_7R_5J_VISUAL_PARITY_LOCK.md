# Scrap Day Phase 7R.5J Emergency Visual Parity Lock

## 1. Scope

This pass locks production visual parity to the approved `/design/scrap-day-v2` playground implementation for:

- `/c/[publicToken]` Journal Home / Month Sheet
- `/journal/demo?screen=home`
- `/c/[publicToken]/m/[memoryId]` Daily Memory Stamp View
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=5`
- `/journal/demo?screen=detail&photos=9`
- `/journal/demo?screen=crop`, only for the shared primary CTA visual

Out of scope and intentionally untouched: database/auth/local-date logic, duplicate-day and one-stamp-per-day rules, upload/storage, Supabase policies, admin theme model, migrations, crop math/metadata semantics, 9-image cap, Save/Share modal chrome, export canvas/image generation, Copy Inventory, Daily Export Redesign, Monthly Export, Create/Edit layout except regression guards, fullscreen viewer chrome, and old stamp/perforation/photo-mat treatments.

## 2. Pre-edit Parity Audit

### A. Journal shell header

1. Approved playground component/file/class/token: `app/design/scrap-day-v2/scrap-day-v2-playground.tsx` `JournalHeader`, `DetailShellRow`, `grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]`, title `text-[1.42rem] leading-none` for Variant C / detail, `journalTitleStyle(theme)`, nav buttons `h-11 w-11`.
2. Current production component/file/class/token: `components/journal/journal-identity-header.tsx`, `.journal-identity-header__row`, `.journal-identity-header--home-variant-c .journal-identity-header__title`, `.month-sheet-nav-button`.
3. Production currently reuses playground implementation: partially. Production has a shared header and matching Variant C title tokens, but they were production CSS tokens, not extracted playground primitives.
4. Current visual drift: Daily Detail uses the shared header, but the detail body below it does not fully reuse the playground shell/stage rhythm. Month Sheet header is close and aligned to the settings button centerline.
5. Exact fix strategy: harden `JournalIdentityHeader` as the production/shared shell header and keep Month Sheet + Daily Detail on `typography="home-variant-c"` with icon controls matching the playground `h-11 w-11` shell controls.

### B. Month Sheet hierarchy

1. Approved playground component/file/class/token: `PhonePreview`, `MonthBar`, Variant C `JournalHeader`, `MonthTile`; journal title `text-[1.42rem] leading-none`, month title `text-[1.36rem] leading-[1.1]`, overlay `mt-3 min-h-0 flex-1 overflow-hidden`, grid `mt-2 grid grid-cols-3 gap-1`, date marker on photo.
2. Current production component/file/class/token: `JournalHome`, `MonthlyStampSheet`, `MonthSheetGrid`, `MonthTile`, `.month-sheet-title--home-variant-c`, `.month-sheet-stable-stage`, `.month-sheet-mobile-density`, `.month-sheet-photo-date-marker`.
3. Production currently reuses playground implementation: partially. The title scale, 3-column grid, stable stage, photo date markers, and borderless tiles are implemented with production tokens matching the selected playground direction.
4. Current visual drift: production still routes the overlay through `PaperPanel` plus Month Sheet-specific classes rather than an explicit shared `JournalStageOverlay`, leaving future page-by-page drift possible. Grid gap is slightly denser than the playground sample but accepted in earlier production mobile-density passes.
5. Exact fix strategy: wrap Month Sheet in a shared `JournalStageOverlay` while preserving the accepted stable monthly stage class, mobile-density class, three-column grid, photo date markers, and no label/no photo borders behavior.

### C. Daily Detail shell/header

1. Approved playground component/file/class/token: `DailyDetailActionPreview`, `DetailShellRow`, `DetailOverlayContent`, `DetailBottomSaveCta`; shell back arrow left, centered journal title, right spacer, no dot menu; overlay `mt-3 min-h-0 flex-1 overflow-hidden p-2.5`; date `text-[0.62rem]`, title `text-[1.48rem] leading-none`, grid `mt-3`; edit pencil `h-9 w-9`; bottom Save/Share CTA `mt-3` with shared primary CTA styling.
2. Current production component/file/class/token: `components/stamp/daily-memory-stamp.tsx`, `JournalIdentityHeader`, `.daily-detail-content-surface`, `.daily-detail-title`, `StampGrid`, `.daily-detail-bottom-action`, `RitualButton`.
3. Production currently reuses playground implementation: partially. It uses `JournalIdentityHeader` with left back control and no settings, removes saved status, and uses bottom Save/Share, but the overlay/title/stage/CTA are still directly assembled in the detail component.
4. Current visual drift: production detail title is `text-[2.15rem]` instead of the playground `text-[1.48rem]`; the overlay uses Month Sheet density classes rather than the playground detail overlay rhythm; the article is not explicitly a flex shell with the overlay consuming remaining space, so the bottom CTA can behave like normal in-flow content instead of the approved shell-layer CTA.
5. Exact fix strategy: move Daily Detail onto shared `JournalStageOverlay` and `JournalPrimaryCTA`, change detail date/title/grid spacing to the approved playground values, and make the detail article a flex shell so the bottom CTA remains anchored below the flexing overlay.

### D. Primary CTA component

1. Approved playground component/file/class/token: `ctaStyle(theme)` and buttons using `flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold`; used by `BottomCtaPreview`, `DetailBottomSaveCta`, and Scrap Finder `Use this scrap`.
2. Current production component/file/class/token: `RitualButton tone="home"`, `.journal-primary-bottom-cta`, `BottomRitualAction`, `DailyMemoryStamp`, `ScrapTable`.
3. Production currently reuses playground implementation: partially. All three surfaces have the `journal-primary-bottom-cta` class, but there is no shared CTA component enforcing that use.
4. Current visual drift: risk of future drift because each surface composes `RitualButton` separately. The visual token is already close: `min-height: 3rem`, `border-radius: 999px`, `padding: 0.75rem 1rem`, `font-size: 0.875rem`, `font-weight: 600`.
5. Exact fix strategy: create `JournalPrimaryCTA` and use it for Month Sheet `Seal the Day`, Daily Detail `Save / Share`, and Scrap Finder `Use this scrap`.

### E. Action tray

1. Approved playground component/file/class/token: `BottomCtaPreview`, open tray `grid gap-1.5 rounded-[1.1rem] p-2`, translucent `ctaTrayStyle(theme)`, option buttons `min-h-10 rounded-full px-4 text-xs font-semibold`, relationship to main CTA `grid gap-2`.
2. Current production component/file/class/token: `BottomRitualAction`, `.journal-bottom-ritual-action__tray`, `.journal-bottom-ritual-action__tray-option`.
3. Production currently reuses playground implementation: partially. The values match the approved playground, but the tray is still private to `BottomRitualAction`.
4. Current visual drift: no major visual drift observed; extraction/hardening is needed to prevent another local approximation.
5. Exact fix strategy: create `JournalActionTray` and `JournalActionTrayOption`, keep existing behavior/state labels, and preserve existing approved tray classes/data attributes for tests and QA.

### F. Photo surfaces

1. Approved playground component/file/class/token: `MonthTile`, `DetailPhotoGrid`, `ScrapFinderPlaygroundPreview`; borderless square photo surfaces with no StampFrame/perforation/mat/outline.
2. Current production component/file/class/token: `MonthTile`, `StampGrid`, `ScrapTable`, `.month-sheet-photo-tile`, `.daily-detail-photo-tile`, `.scrap-finder-window`.
3. Production currently reuses playground implementation: yes in behavior/treatment, not as a named shared photo primitive.
4. Current visual drift: no production Month Sheet, Daily Detail, or Scrap Finder customer photo surface uses `StampFrame` or a border/mat treatment. The old `StampFrame` component still exists for legacy/non-customer-export internals and is not used by these surfaces.
5. Exact fix strategy: keep existing borderless photo components and add regression guards for no `StampFrame`, no border, no outline, no mat, and no date-below-tile behavior on scoped customer surfaces.

## 3. Exact Approved Playground Source Components / Classes / Tokens Identified

Identified from `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`:

- `JournalHeader` / `DetailShellRow`: centered shell title, `2.75rem` side columns, `min-h-11`, icon controls `h-11 w-11`, Variant C / detail title `text-[1.42rem] leading-none`.
- `MonthBar`: Variant C month title `text-[1.36rem] leading-[1.1]`, nav controls `h-11 w-11`.
- `overlayStyle(theme)`: translucent overlay, `blur(1.5px)`, no border, no box-shadow.
- `BottomCtaPreview` / `DetailBottomSaveCta` / Scrap Finder footer: primary CTA `min-h-12`, full width, pill radius, `px-4`, `text-sm`, `font-semibold`.
- `BottomCtaPreview` tray: translucent tray, `rounded-[1.1rem]`, `p-2`, `gap-1.5`, option buttons `min-h-10`.
- `DetailOverlayContent`: detail date `text-[0.62rem]`, title `text-[1.48rem] leading-none`, grid `mt-3`, edit pencil `h-9 w-9`.
- `MonthTile` / `DetailPhotoGrid`: borderless square photo surfaces with date markers only on Month Sheet photos.

## 4. Production Drift Found

- Month Sheet was visually close, but its accepted overlay was still private to the Month Sheet file instead of being a named reusable stage primitive.
- Daily Detail title was oversized at `text-[2.15rem]` instead of the approved `text-[1.48rem]`.
- Daily Detail reused Month/Home mobile-density widening, while the approved detail playground uses the detail shell padding and overlay rhythm directly.
- Daily Detail was not explicitly a flex shell where the content overlay flexes and bottom Save/Share remains in the shell layer.
- Month Sheet, Daily Detail, and Scrap Finder each composed the primary CTA locally instead of using one shared CTA component.
- The CTA tray was visually aligned but still private to `BottomRitualAction`, making future drift easier.

## 5. Shared Components / Tokens Created Or Hardened

- Added `components/journal/journal-visual-primitives.tsx`.
- Added `JournalStageOverlay`, used by Month Sheet and Daily Detail.
- Added `JournalPrimaryCTA`, used by Month Sheet `Seal the Day`, Daily Detail `Save / Share`, and Scrap Finder `Use this scrap`.
- Added `JournalActionTray` and `JournalActionTrayOption`, used by the Month Sheet CTA tray.
- Added shared CSS tokens:
  - `.journal-stage-overlay`
  - `.journal-primary-bottom-cta`
  - `.journal-action-tray`
  - `.journal-action-tray__option`
  - `.daily-detail-shell-surface`
- Hardened tests so production now asserts shared primitive usage instead of local `RitualButton` / `PaperPanel` composition.

## 6. Month Sheet Parity Fixes

- `MonthlyStampSheet` now renders through `JournalStageOverlay variant="month-sheet"`.
- Preserved accepted Month Sheet page-specific differences:
  - `month-sheet-stable-stage`
  - `month-sheet-mobile-density`
  - 3-column app grid
  - photo date markers
  - no date below tiles
  - no `MONTH SHEET` label
  - no photo borders/mats/stamp frames
- `Seal the Day` now uses `JournalPrimaryCTA`.

## 7. Daily Detail Parity Fixes

- `DailyMemoryStamp` now renders through `JournalStageOverlay variant="daily-detail"`.
- Detail article is now a flex shell using `.daily-detail-shell-surface`, with the overlay as `flex-1` and `Save / Share` in the shell layer below it.
- Detail title changed from `text-[2.15rem]` to the approved `text-[1.48rem]`.
- Detail date changed to the approved `text-[0.62rem]`.
- Removed the Detail overlay’s Month Sheet mobile-density widening so the detail overlay follows the approved playground detail rhythm.
- Back arrow remains icon-only with `aria-label="Back to month sheet"`.
- Header remains centered journal name with no right dot/settings menu.
- Overlay contains date, title, photos, and edit pencil only.
- `Saved in this journal.` remains removed.
- `Save / Share` remains bottom shell CTA and still opens the existing composer.

## 8. Primary CTA Parity Fixes

- `JournalPrimaryCTA` is now the shared production CTA primitive.
- It wraps the approved `RitualButton tone="home"` treatment and always applies `.journal-primary-bottom-cta`.
- Home `Seal the Day` is anchored inside the red journal shell: `position: absolute`, `left: 0.75rem`, `right: 0.75rem`, `bottom: 0.75rem`.
- Daily Detail `Save / Share` is anchored inside the detail shell with the same `12px` left/right/bottom inset as the overlay.
- Shared computed values verified at mobile width:
  - min-height `48px`
  - radius `999px`
  - font-size `14px`
  - font-weight `600`
  - full-width layout
- Used by:
  - Month Sheet `Seal the Day`
  - Daily Detail `Save / Share`
  - Scrap Finder `Use this scrap`

## 9. Action Tray Parity Fixes

- `BottomRitualAction` now uses `JournalActionTray` and `JournalActionTrayOption`.
- Existing behavior is unchanged:
  - default CTA label remains `Seal the Day`
  - tray hidden by default
  - click opens tray
  - Escape / outside pointer closes tray
  - state-aware options remain `Today's Stamp` / `Seal Today` and `Seal Another Day`
- Existing approved tray data markers are preserved.

## 10. Photo Surface Regression Checks

- Month Sheet tiles still use `data-month-sheet-photo-border="none"` and date markers on the photo.
- Daily Detail tiles still use `data-daily-detail-photo-tile="borderless-square"`.
- Scrap Finder still avoids `StampFrame`, perforation, mat, outline, and shadow-as-border treatments.
- Full mobile QA reported `stampEdgeCount: 0`, empty `stampFrameVariants`, and no old visible Month Sheet titles/full dates.

## 11. What Was Intentionally Not Changed

- No database, auth, Supabase, migration, upload/storage, crop math, crop metadata, local-date, duplicate-day, or one-day-one-stamp logic.
- No export canvas or Daily/Monthly export generation changes.
- No Save/Share modal chrome redesign.
- No Create/Edit layout redesign.
- No fullscreen photo viewer chrome change.
- No logo added to Month Sheet header.
- No old postage/perforated/stamp-edge frames.
- No blue plastic Scrap Finder.

## 12. Product-Owner QC Lock Addendum

The accepted playground shell is one textured wine-red shell, not a wine-red shell plus another wine-red content layer. Production Home and Daily Detail therefore keep `journal-leather-surface` structurally, but its nested visual background and pseudo overlays are transparent when inside `journal-themed-background`.

The accepted playground inset is the shell's single `12px` content inset. Production Home and Daily Detail offset `JournalMobileShell`'s default padding so their Month Sheet / Daily Detail overlays and bottom CTAs measure `12px` from the shell edge, not the rejected `24px` double inset.

`Back to this month` belongs directly under the month title inside the Month Sheet overlay frame and remains left aligned to the month title.

The Month Sheet header keeps a fixed two-row rhythm in every month state. The current month reserves the same secondary-row height as the non-current `Back to this month` state, so the month title typography and grid start position do not visually change between July and August.
- No journal identity header added to Create/Edit, Scrap Finder, Save/Share modal chrome, or fullscreen viewer.

## 12. Browser Visual Parity Checks

Dev server used: `http://127.0.0.1:3004`.

Screenshots written by focused Playwright check:

- `/private/tmp/journal-chip-7r5j-visual-parity/home.png`
- `/private/tmp/journal-chip-7r5j-visual-parity/detail-1.png`
- `/private/tmp/journal-chip-7r5j-visual-parity/detail-5.png`
- `/private/tmp/journal-chip-7r5j-visual-parity/detail-9.png`
- `/private/tmp/journal-chip-7r5j-visual-parity/crop.png`

Focused mobile check at `390px`:

- `/journal/demo?screen=home`: passed. Journal title `22.72px`, month title `21.76px`, CTA `48px`, overlay `0px` border and `none` shadow, 31 date-on-photo markers, 3-column app grid.
- `/journal/demo?screen=detail&photos=1`: passed. No settings menu, no saved status, icon-only back arrow, edit pencil present, title `23.68px`, date `9.92px`, CTA `48px`, borderless photo tile, CTA below overlay.
- `/journal/demo?screen=detail&photos=5`: passed with the same shell/overlay/CTA checks and 5 photo tiles.
- `/journal/demo?screen=detail&photos=9`: passed with the same shell/overlay/CTA checks and 9 photo tiles.
- `/journal/demo?screen=crop`: passed. `Use this scrap` uses shared primary CTA, `48px` pill, no stamp-frame/perforation markers.

Full mobile QA:

- `npm run qa:journal:mobile -- http://127.0.0.1:3004` passed in full mode at widths `375`, `390`, and `430`.
- It covered Home, Month Sheet month variants, Create, Crop, Sealed, Create with photos, and Detail photo counts 1 through 9.
- Reported no horizontal overflow and no console issues.

Remaining differences:

- Production uses live/demo route data and app shell constraints rather than the playground comparison card labels and surrounding documentation.
- Month Sheet keeps the previously accepted production mobile-density/stable-stage treatment while now sharing the stage primitive.
- No intentional visual difference remains for the scoped CTA, Daily Detail shell, Daily Detail overlay, back arrow, or photo surface contracts.

## 13. Tests Added / Updated

- Updated `tests/journal-form-regression.test.mjs` to assert:
  - `JournalStageOverlay`, `JournalPrimaryCTA`, `JournalActionTray`, and `JournalActionTrayOption` exist.
  - Month Sheet uses `JournalStageOverlay`.
  - Daily Detail uses `JournalStageOverlay` and `JournalPrimaryCTA`.
  - Daily Detail title/date sizing match the approved playground values.
  - Daily Detail no longer uses Month/Home mobile-density widening.
  - Bottom CTA and Scrap Finder CTA use the shared primary CTA.
  - CTA tray uses shared tray primitives.
  - Save/Share modal chrome and export renderer do not receive shared app CTA/detail markers.
- Added a guard that Month Sheet no longer imports `PaperPanel` directly.
- Added a guard that Scrap Finder primary CTA is shared through `JournalPrimaryCTA`.

## 14. Commands Run And Results

- `npm test` - passed, 101 tests.
- `npm run lint` - passed.
- `npm run build` - initial sandbox run failed because Turbopack could not bind its helper port; rerun outside sandbox passed.
- `git diff --check` - passed.
- `npm run qa:journal:mobile -- http://127.0.0.1:3004` - initially failed without explicit Playwright runtime because project Node could not resolve Playwright; rerun with bundled Playwright module and cached Chromium passed full mode.
- Focused Playwright parity check for `/journal/demo?screen=home`, detail 1/5/9, and crop - passed and wrote screenshots under `/private/tmp/journal-chip-7r5j-visual-parity`.

## 15. Remaining Issues

None for the scoped Phase 7R.5J parity lock.

Deferred by instruction:

- Daily Export redesign remains Phase 7.2.
- Monthly Export remains out of scope.
- Copy Inventory remains out of scope.

## Product-Owner QC Follow-Up

The first 7R.5J.1 correction still left a structural mismatch: Month Sheet and Daily Detail were using narrow production-only shell widths while Create/Edit and the approved playground surface used the wider shell-inset model.

Follow-up correction now locks:

- Home shell: `width: 100%`, matching the Create/Edit shell-level surface rather than a narrow `22.375rem` card.
- Daily Detail shell: `width: 100%`, matching the same shell-level surface rather than a narrow `20.625rem` card.
- Home Month Sheet overlay and `Seal the Day` CTA: same `x=24`, `width=400` browser measurement at `463px`.
- Daily Detail overlay and `Save / Share` CTA: same `x=24`, `width=400` browser measurement at `463px`.

The rejected narrow-width contract is no longer considered accepted parity.
