# Phase 7R.5J.1 - Visual Parity Failure Fix

## Scope

This is a failure-correction pass for Phase 7R.5J. The approved implementation source of truth is `/design/scrap-day-v2`; this pass must correct production drift without redesigning product logic, copy, database/auth/date/crop/export behavior, Save/Share modal chrome, Create/Edit, or fullscreen viewing.

## Computed Style Parity Audit

Audit environment: Chromium, mobile viewport `390 x 844`, local dev server `http://127.0.0.1:3004`. The standalone Chromium run required sandbox escalation because macOS denied Chromium Mach port registration inside the sandbox.

### A1. Month Sheet Overlay

Approved playground source:
- Component/file: `PhonePreview` and `overlayStyle()` in `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`.
- Selected element: `[data-playground-home-hierarchy="stronger-journal-identity"][data-playground-month-state="filled"][data-playground-cta-model="current-reference"]` overlay.
- ClassName(s): `mt-3 min-h-0 flex-1 overflow-hidden`.
- Shell rect: width `358px`, left/right viewport inset `16px / 16px`, padding `12px / 12px`.
- Overlay rect: width `334px`, left/right viewport inset `28px / 28px`.
- Overlay inset from shell: left/right `12px / 12px`, top `68px`, bottom `12px`.
- Computed width/max-width: `334px` / `none`.
- Margin-left/right/top: `0px / 0px / 12px`.
- Padding-left/right/top/bottom: `0px / 0px / 0px / 0px`.
- Background: `rgba(178, 140, 123, 0.16)` plus `linear-gradient(rgba(232, 219, 204, 0.1), rgba(228, 180, 143, 0.07))`.
- Min-height: `0px`.
- Border/outline/box-shadow: `0px none rgb(251, 239, 232)` / `none` / `none`.

Production before fix:
- Component/file: `MonthlyStampSheet` in `components/journal/monthly-stamp-sheet.tsx`, `JournalStageOverlay` in `components/journal/journal-visual-primitives.tsx`, CSS in `app/globals.css`.
- ClassName(s): `editorial-paper-panel journal-stage-overlay journal-stage-overlay--month-sheet month-sheet-tactile-insert month-sheet-mobile-density month-sheet-stable-stage px-2.5 py-3 sm:px-3`.
- Shell rect: width `390px`; inner home surface width `366px`.
- Overlay rect: width `361.53px`, left/right viewport inset `14.23px / 14.23px`.
- Overlay inset from home surface: left/right `2.23px / 2.23px`, top `64px`, bottom `196px`.
- Computed width/max-width: `361.531px` / `none`.
- Margin-left/right/top: `-4px / -4px / 0px`.
- Padding-left/right/top/bottom: `7.8px / 7.8px / 12px / 12px`.
- Background: `color(srgb 0.698039 0.54902 0.482353 / 0.16)` plus the same approved gradient token.
- Min-height: `472.64px`.
- Border/outline/box-shadow: `0px none rgb(45, 41, 33)` / `none` / `none`.
- Drift: production is not using the playground outer-overlay width model. It uses a production-only negative margin and outer padding, so the leather inset and photo density do not match the approved playground.

### A2. Daily Detail Overlay

Approved playground source:
- Component/file: `DailyDetailActionPreview(detail-clean-shell-bottom-save)` and `overlayStyle()` in `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`.
- ClassName(s): `mt-3 min-h-0 flex-1 overflow-hidden p-2.5`.
- Shell rect: width `330px`, left/right viewport inset `30px / 30px`, padding `12px / 12px`.
- Overlay rect: width `306px`, left/right viewport inset `42px / 42px`.
- Overlay inset from shell: left/right `12px / 12px`, top `68px`, bottom `72px`.
- Computed width/max-width: `306px` / `none`.
- Margin-left/right/top: `0px / 0px / 12px`.
- Padding-left/right/top/bottom: `10px / 10px / 10px / 10px`.
- Background: `rgba(178, 140, 123, 0.16)` plus `linear-gradient(rgba(232, 219, 204, 0.1), rgba(228, 180, 143, 0.07))`.
- Min-height: `0px`.
- Border/outline/box-shadow: `0px none rgb(251, 239, 232)` / `none` / `none`.

Production before fix:
- Component/file: `DailyMemoryStamp` in `components/stamp/daily-memory-stamp.tsx`, `JournalStageOverlay` in `components/journal/journal-visual-primitives.tsx`, CSS in `app/globals.css`.
- ClassName(s): `editorial-paper-panel journal-stage-overlay journal-stage-overlay--daily-detail daily-detail-content-surface mt-3 min-h-0 flex-1 overflow-hidden p-2.5`.
- Shell rect: width `366px`, left/right viewport inset `12px / 12px`, padding `12px / 12px`.
- Overlay rect: width `342px`, left/right viewport inset `24px / 24px`.
- Overlay inset from shell: left/right `12px / 12px`, top `76px`, bottom `80px`.
- Computed width/max-width: `342px` / `none`.
- Margin-left/right/top: `0px / 0px / 12px`.
- Padding-left/right/top/bottom: `10px / 10px / 10px / 10px`.
- Background/border/box-shadow match the shared overlay token, but the shell width and overlay horizontal inset do not match the approved playground.
- Drift: production detail shell is wider than the approved detail shell and the vertical start is `8px` lower than the approved shell rhythm.

### A3. Month Sheet Arrow Buttons

Approved playground source:
- Component/file: `MonthBar` and `navButtonStyle()` in `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`.
- ClassName(s): `flex h-11 w-11 items-center justify-center rounded-full`.
- Width/height: `44px / 44px`.
- Border-radius: effectively full round (`3.35544e+07px` in computed output).
- Background-color: `rgba(232, 219, 204, 0.13)`.
- Opacity: `1`.
- Border/box-shadow: `0px none rgb(232, 219, 204)` / `none`.
- Color: `rgb(232, 219, 204)`.

Production before fix:
- Component/file: `MonthlyStampSheet` uses `IconButton` plus `month-sheet-nav-button`.
- ClassName(s): `editorial-icon-button month-sheet-nav-button`.
- Width/height: `36px / 36px`.
- Background-color: `rgb(225, 212, 187)`.
- Opacity: previous arrow `1`, disabled next arrow `0.35`.
- Border/box-shadow: `1px solid rgba(0, 0, 0, 0)` / `none`.
- Color: `rgb(45, 41, 33)`.
- Drift: the later `.editorial-icon-button` rule overrides the intended translucent `month-sheet-nav-button` token, producing solid pale/cream buttons.

### A4. Daily Detail Back Arrow

Approved playground source:
- Component/file: `DetailShellRow` and `navButtonStyle()` in `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`.
- ClassName(s): `flex h-11 w-11 items-center justify-center rounded-full`.
- Width/height: `44px / 44px`.
- Background-color: `rgba(232, 219, 204, 0.13)`.
- Opacity: `1`.
- Border/box-shadow: `0px none rgb(232, 219, 204)` / `none`.
- Color: `rgb(232, 219, 204)`.
- Position: static shell-row icon at left.

Production before fix:
- Component/file: `DailyMemoryStamp` uses `IconButton` plus `month-sheet-nav-button daily-detail-shell-back-button`.
- ClassName(s): `editorial-icon-button month-sheet-nav-button daily-detail-shell-back-button`.
- Width/height: `36px / 36px`.
- Background-color: `rgb(225, 212, 187)`.
- Opacity: `1`.
- Border/box-shadow: `1px solid rgba(0, 0, 0, 0)` / `none`.
- Color: `rgb(45, 41, 33)`.
- Position: static shell-row icon at left.
- Drift: same solid pale/cream override as Month Sheet arrows.

### A5. Daily Detail Save / Share CTA

Approved playground source:
- Component/file: `DetailBottomSaveCta` in `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`.
- Position model: bottom shell CTA outside overlay, static in the shell layer.
- CTA wrapper: width `306px`, height `48px`, margin-top `12px`, inset from shell left/right/bottom `12px / 12px / 12px`.
- CTA: width `306px`, height/min-height `48px / 48px`.
- Bottom offset from shell: `12px`.
- Background-color: `rgba(232, 219, 204, 0.92)`.
- Border-radius: full round (`3.35544e+07px` computed).
- ClassName(s): `flex min-h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold`.

Production before fix:
- Component/file: `DailyMemoryStamp` footer plus `JournalPrimaryCTA`.
- Position model: outside overlay, but shell layer dimensions do not match the approved playground.
- CTA wrapper: width `342px`, height `60px`, margin-top `12px`, padding-bottom `12px`, inset from shell left/right/bottom `12px / 12px / 8px`.
- CTA: width `342px`, height/min-height `48px / 48px`.
- Background-color: `color(srgb 0.909804 0.858824 0.8 / 0.92)`.
- Border-radius: `999px`.
- ClassName(s): `editorial-ritual-button editorial-ritual-button--home journal-primary-bottom-cta daily-detail-save-share-button journal-primary-bottom-cta`.
- Drift: the CTA behavior is wired to the shared primary CTA, but the shell width and footer padding make the placement differ from the approved playground and visually read as an in-flow action directly under the overlay.

### A6. Shared Primitive Usage Before Fix

| Surface | JournalIdentityHeader | JournalStageOverlay | JournalPrimaryCTA | JournalActionTray | Shared arrow/icon primitive |
| --- | --- | --- | --- | --- | --- |
| `/journal/demo?screen=home` | yes | yes | yes | source yes, closed DOM no | no |
| `/c/[publicToken]` Journal Home | yes, via `JournalHome` | yes, via `MonthlyStampSheet` | yes, via `BottomRitualAction` | yes, via `BottomRitualAction` | no |
| `/journal/demo?screen=detail&photos=1` | yes | yes | yes | no | no |
| `/journal/demo?screen=detail&photos=5` | yes | yes | yes | no | no |
| `/journal/demo?screen=detail&photos=9` | yes | yes | yes | no | no |
| `/c/[publicToken]/m/[memoryId]` saved Daily Detail | yes, via `DailyMemoryStamp` | yes | yes | no | no |
| Scrap Finder crop route | no shell header | no stage overlay | yes | no | no |

## Pre-fix Conclusion

Do not mark complete until production replaces the one-off arrow button path, removes Month Sheet production-only overlay margin/padding drift, and constrains the Daily Detail shell/CTA/overlay width model to the approved playground values.

## Fixes Applied

### Fix 1: Month Sheet Overlay Width / Inset

- Changed production Month Sheet from a padded outer overlay to the playground model: outer overlay has `padding: 0` and `margin-inline: 0`; inner content uses `p-2`.
- Removed `month-sheet-mobile-density` from `MonthlyStampSheet` production markup.
- Constrained `.journal-home-surface` to the approved 390px computed shell model: `width: min(100%, 22.375rem)`, `margin-inline: auto`, `padding-inline: 0.75rem`.
- Updated Month grid app density from `gap-1.5` / `mt-3` to playground `gap-1` / `mt-2`.
- Preserved Month Sheet data rendering, month navigation behavior, and bottom Seal the Day action behavior.

### Fix 2: Arrow Button Visual Parity

- Added `JournalShellIconButton` in `components/journal/journal-visual-primitives.tsx`.
- Replaced Month Sheet previous/next controls and Daily Detail back control with `JournalShellIconButton`.
- Added the post-`editorial-icon-button` CSS lock:
  - `height: 2.75rem`
  - `width: 2.75rem`
  - `background: var(--journal-home-control-bg)`
  - `color: var(--journal-home-control-text)`
  - `border: 0`
  - `box-shadow: none`
- Root cause corrected: `.editorial-icon-button` previously appeared later in CSS and overrode the intended translucent `month-sheet-nav-button` token, producing solid pale/cream `36px` buttons.

### Fix 3: Daily Detail Save / Share Placement

- Superseded follow-up correction: `.daily-detail-shell-surface` now uses `width: 100%`, matching the same shell/content width model as Create/Edit and the accepted playground shell inset instead of the rejected narrow `20.625rem` production approximation.
- Changed Daily Detail shell rhythm to `px-3 py-3`.
- Removed the extra Daily Detail overlay `mt-3`; `JournalIdentityHeader` already owns the shell-row bottom gap, so this restores the approved `68px` overlay top rhythm.
- Set `.daily-detail-bottom-action` safe-area padding to `env(safe-area-inset-bottom)` so the CTA bottom inset resolves to the approved `12px` shell padding in the normal mobile viewport while still respecting safe area.
- Preserved existing Save/Share modal opening behavior and export canvas path.

### Product-Owner QC Follow-Up: Shell Width / CTA Width

Product-owner screenshots showed the previous correction still failed full visual parity:

- Month Sheet and Daily Detail overlays were still visibly narrower than the accepted Edit/Create shell and playground surfaces.
- Home `Seal the Day` and Detail `Save / Share` were using different effective width models.

Follow-up fix:

- `.journal-home-surface` now offsets the default `JournalMobileShell` padding for Home only, so the approved playground shell has one wine-red layer and one `12px` content inset.
- `.daily-detail-shell-surface` now offsets the default `JournalMobileShell` padding for Detail only, matching the same one-layer shell model.
- `.journal-home-surface .journal-bottom-ritual-action` is shell-contained: `position: absolute`, `left: 0.75rem`, `right: 0.75rem`, `bottom: 0.75rem`, `width: auto`.
- Home Month Sheet overlay is capped inside the journal shell and scrolls internally when a long month would otherwise push the CTA outside the shell.
- `.daily-detail-bottom-action` remains a shell-layer bottom action: `left: 0.75rem`, `right: 0.75rem`, `bottom: calc(0.75rem + env(safe-area-inset-bottom))`.
- Home Month Sheet overlay, Home CTA, Daily Detail overlay, and Daily Detail CTA now resolve to the same `12px` shell-inset width in browser measurement.

## Final Browser Visual Parity Verification

Verification environment: Chromium, mobile viewport `390 x 844`, dev server `http://127.0.0.1:3004`.

Screenshot directory:
- `/private/tmp/journal-chip-7r5j1-visual-parity`

### `/design/scrap-day-v2` Approved Playground

Month candidate screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/playground-month.png`

Computed values:
- Overlay width `334px`; viewport inset `28px / 28px`; shell inset `12px / 12px`; padding `0px / 0px`.
- Arrow width/height `44px / 44px`; background `rgba(232, 219, 204, 0.13)`; color `rgb(232, 219, 204)`.

Detail candidate screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/playground-detail.png`

Computed values:
- Overlay width `306px`; viewport inset `42px / 42px`; shell inset `12px / 12px`; top inset `68px`; padding `10px / 10px`.
- Back arrow width/height `44px / 44px`; background `rgba(232, 219, 204, 0.13)`; color `rgb(232, 219, 204)`.
- Bottom CTA width/height `306px / 48px`; shell inset left/right/bottom `12px / 12px / 12px`; background `rgba(232, 219, 204, 0.92)`.

### `/journal/demo?screen=home`

Screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/production-home.png`

Computed values:
- Overlay width `334px`; viewport inset `28px / 28px`; shell inset `12px / 12px`; top inset `68px`; padding `0px / 0px`.
- Previous arrow width/height `44px / 44px`; background `color(srgb 0.909804 0.858824 0.8 / 0.13)`; color `rgb(232, 219, 204)`.
- Shared arrow primitive: yes, `data-journal-icon-button="approved-playground"`.
- Result: matches playground for horizontal overlay width/inset, outer padding, top rhythm, arrow visual style, and shell-contained bottom Seal the Day placement.

### `/journal/demo?screen=detail&photos=1`

Screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/production-detail-1.png`

Computed values:
- Overlay width `306px`; viewport inset `42px / 42px`; shell inset `12px / 12px`; top inset `68px`; bottom inset `72px`; padding `10px / 10px`.
- Back arrow width/height `44px / 44px`; background `color(srgb 0.909804 0.858824 0.8 / 0.13)`; color `rgb(232, 219, 204)`.
- CTA width/height `306px / 48px`; shell inset left/right/bottom `12px / 12px / 12px`; background `color(srgb 0.909804 0.858824 0.8 / 0.92)`.
- Result: matches playground for overlay width/inset, shell top rhythm, back arrow visual style, and bottom shell CTA width/bottom placement.

### `/journal/demo?screen=detail&photos=5`

Screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/production-detail-5.png`

Computed values:
- Overlay width `306px`; viewport inset `42px / 42px`; shell inset `12px / 12px`; top inset `68px`; bottom inset `72px`; padding `10px / 10px`.
- Back arrow width/height `44px / 44px`; background `color(srgb 0.909804 0.858824 0.8 / 0.13)`; color `rgb(232, 219, 204)`.
- CTA width/height `306px / 48px`; shell inset left/right/bottom `12px / 12px / 12px`; background `color(srgb 0.909804 0.858824 0.8 / 0.92)`.
- Result: matches playground for overlay width/inset, shell top rhythm, back arrow visual style, and bottom shell CTA width/bottom placement.

### `/journal/demo?screen=detail&photos=9`

Screenshot:
- `/private/tmp/journal-chip-7r5j1-visual-parity/production-detail-9.png`

Computed values:
- Overlay width `306px`; viewport inset `42px / 42px`; shell inset `12px / 12px`; top inset `68px`; bottom inset `72px`; padding `10px / 10px`.
- Back arrow width/height `44px / 44px`; background `color(srgb 0.909804 0.858824 0.8 / 0.13)`; color `rgb(232, 219, 204)`.
- CTA width/height `306px / 48px`; shell inset left/right/bottom `12px / 12px / 12px`; background `color(srgb 0.909804 0.858824 0.8 / 0.92)`.
- Result: matches playground for overlay width/inset, shell top rhythm, back arrow visual style, and bottom shell CTA width/bottom placement.

## Tests Added / Updated

- Updated `tests/journal-form-regression.test.mjs` so older 7R.5E/7R.5G contracts no longer require the superseded Month Sheet negative-margin density class or Daily Detail `py-2` shell rhythm.
- Extended the 7R.5J regression lock to cover:
  - `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5J_1_VISUAL_PARITY_FAILURE_FIX.md`
  - `JournalShellIconButton`
  - `data-journal-icon-button="approved-playground"`
  - Month outer overlay `padding: 0` / `margin-inline: 0`
  - Home and Daily shells offset the default mobile-shell padding so playground surfaces use one `12px` shell inset
  - Home bottom CTA shell-contained absolute positioning with `12px` left/right/bottom insets
  - Daily bottom action absolute shell positioning with `12px` left/right/bottom insets
  - Month grid `gap-1` / `mt-2`
  - No Daily overlay double `mt-3`

## Product-Owner QC Follow-Up Verification

Verification viewports: Chromium `545 x 865`, `463 x 877`, and `656 x 908`, dev server `http://127.0.0.1:3004`.

Screenshot directory:
- `/private/tmp/journal-chip-playground-inset-exact`

Computed width parity:

- `/journal/demo?screen=home&month=2026-08`, `545 x 865`: shell `x=32.5`, `width=480`; Month Sheet overlay shell inset `12 / 12`; `Seal the Day` CTA shell inset `12 / 12`; CTA viewport bottom gap `12`.
- `/journal/demo?screen=home&month=2026-07`, `545 x 865`: shell `x=32.5`, `width=480`; Month Sheet overlay shell inset `12 / 12`; `Seal the Day` CTA shell inset `12 / 12`; CTA shell/viewport bottom gap `12`; `Back to this month` text-align `left` and x delta from month title `0`.
- `/journal/demo?screen=home&month=2026-08`, `463 x 877`: shell `x=0`, `width=463`; Month Sheet overlay shell inset `12 / 12`; `Seal the Day` CTA shell inset `12 / 12`; CTA viewport bottom gap `12`.
- `/journal/demo?screen=detail&photos=9`, `656 x 908`: shell `x=88`, `width=480`; Daily Detail overlay shell inset `12 / 12`; `Save / Share` CTA shell inset `12 / 12`; CTA shell bottom gap `12`.
- `/journal/demo?screen=detail&photos=9`, `463 x 877`: shell `x=0`, `width=463`; Daily Detail overlay shell inset `12 / 12`; `Save / Share` CTA shell inset `12 / 12`; CTA shell/viewport bottom gap `12`.
- Home and Daily Detail inner `journal-leather-surface` computed background is transparent; `::before` background is `none` with opacity `0`; `::after` background is transparent with opacity `0`.

Result:

- Month Sheet overlay now uses the same narrow playground side inset as the approved screenshots.
- Daily Detail overlay uses the same narrow playground side inset.
- Home and Detail CTAs share the same effective width model as their overlays.
- `Back to this month` is left aligned under the month title inside the overlay frame.
- The previous double wine-red background layer is removed for Home and Detail.
- The previous `24px` double-inset model, viewport-fixed Home CTA placement, and state-dependent Month Sheet header height are rejected and no longer used.

## Product-Owner Design Review Follow-Up

Final correction after desktop-localhost QC:

- Home `Seal the Day` is anchored to the red journal shell, not to the browser viewport. At tall desktop viewports, the CTA no longer appears below the journal surface.
- Long months keep the CTA visible by scrolling Month Sheet content inside the overlay instead of increasing the shell height.
- Month Sheet header typography is state-invariant: July and August use the same month title size/line-height/weight and the same two-row header block.
- `Back to this month` remains under the month title, left aligned, but the current month reserves an invisible secondary row so the grid and nav rhythm do not jump between months.
- Month navigation arrows align to the month-title row center, not to the full two-row header block, so current months without a visible `Back to this month` row do not look vertically misaligned.

## Commands Run

- `npm test` - passed, `101` tests.
- `npm run lint` - passed.
- `git diff --check` - passed.
- `npm run build` - sandbox run failed on Turbopack helper port binding (`Operation not permitted`); rerun with escalation passed.
- Headless Chromium computed-style audit and screenshot capture - passed after sandbox escalation for Chromium launch.

## Remaining Issues

No remaining parity blocker from the reported failures:
- Production Month Sheet overlay is no longer using the narrower/drifted production-only margin/padding model.
- Month Sheet and Daily Detail arrows use the shared translucent playground-derived shell icon primitive.
- Daily Detail Save / Share is bottom-shell positioned with approved width and bottom inset while preserving the existing modal/composer behavior.
