# Scrap Day Phase 7R.5D Month Sheet Stable Stage + Scrap Finder Playground Refinement

## 1. Scope

Stage A only.

This phase applies one production refinement to Month Sheet and one playground-only refinement to the Scrap Finder tactile exploration.

In production scope:

- `/c/[publicToken]` Journal Home / Month Sheet
- `/journal/demo?screen=home`
- shared Month Sheet panel/component

Playground-only scope:

- `/design/scrap-day-v2`

Out of scope:

- Vercel Preview Refresh / Stage B
- Daily Detail redesign
- Create/Edit redesign
- production Scrap Finder tactile press
- Save/Share or export canvas redesign
- database, auth, local_date, duplicate-day logic, crop math, crop metadata, storage, migrations, and Supabase policies

## 2. Month Sheet Stable Stage Issue

With only one or two sealed days, the Month Sheet translucent overlay could visually shrink around its contents. That made the month surface feel like a small content box instead of a stable editorial monthly canvas inside the journal.

## 3. Production Fix Applied

The Month Sheet `PaperPanel` now carries `month-sheet-stable-stage` and `data-month-sheet-stage="stable-editorial"`.

The stable stage is controlled through `--journal-month-stage-min-height` and applied as a responsive `min-height`, not a fixed height. The panel can still grow naturally when more sealed days exist.

Preserved behavior:

- renders only actual saved stamps/memories
- no synthetic empty slots
- no 31 forced day cells
- no calendar gaps
- local_date ordering remains in `monthSheetStampPositions`
- accepted 3-column app grid remains
- date-on-photo markers remain
- no date-below captions
- no `MONTH SHEET` label
- bottom sticky CTA remains
- no header logo

### Phase 7R.5D.1 Month Sheet Link Polish

The `Back to this month` secondary navigation link was softened without changing copy, layout, overlay height, photo grid, or CTA behavior.

Polish applied:

- added `month-sheet-return-link`
- changed the link weight from semibold to medium
- moved color to theme-aware `--journal-month-return-link`
- moved underline color to subtle `--journal-month-return-link-decoration`
- dark wine/burgundy themes use a muted Champagne Peach treatment
- ivory/light themes use a muted Cocoa Taupe treatment
- Stage B QA found the first polish pass was still being overridden by the shared `.editorial-text-link { color: inherit; }` rule. The final fix raises specificity with `.editorial-text-link.month-sheet-return-link`, so the return link uses the muted brand token on preview.

## 4. Scrap Finder Playground Exploration

The `/design/scrap-day-v2` playground now marks the tactile variants by role:

- base current accepted finder: reference
- subtle bottom press detail: preferred candidate
- even lighter whisper lip: comparison only

The bottom press detail remains centered under the square finder, small, low contrast, brand-toned, and non-interactive.

## 5. Production Boundary

The tactile press detail was not shipped to production.

Production `components/scrap/scrap-table.tsx` remains on the accepted dedicated Scrap Finder visual system without `bottom-press`, `whisper-lip`, playground press data attributes, or `tactilePressStyle`.

## 6. Files Changed

- `components/journal/monthly-stamp-sheet.tsx`
- `app/globals.css`
- `data/journal-themes.ts`
- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`
- `SCRAP_DAY_PHASE_7R_PLAYGROUND_SCRAP_FINDER_TACTILE_EXPLORATION.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_5D_MONTH_STAGE_AND_SCRAP_FINDER_PLAYGROUND.md`

## 7. Tests Added / Updated

- Updated the playground-only tactile press regression guard to require variant roles and production absence.
- Added a Phase 7R.5D regression guard for:
  - Month Sheet stable stage class/data attribute
  - responsive min-height token
  - no fixed height or inner overflow on the stage class
  - sealed-days-only Month Sheet rendering
  - no placeholder / empty slot generation
  - preserved 3-column grid
  - preserved date-on-photo markers
  - preserved bottom sticky CTA
  - tactile press detail remaining playground-only

## 8. Commands Run And Results

- Pass: `npm test` (94/94 tests)
- Pass: `npm run lint`
- Pass: `npm run build`
  - The first sandboxed build failed because Turbopack could not bind an internal port (`Operation not permitted`).
  - The same command was rerun outside the sandbox and passed.
- Pass: `git diff --check`

Phase 7R.5D.1 rerun after link polish:

- Pass: `npm test` (94/94 tests)
- Pass: `npm run lint`
- Pass: `npm run build`
  - The first sandboxed build failed for the same Turbopack internal port permission issue.
  - The same command was rerun outside the sandbox and passed.
- Pass: `git diff --check`

Phase 7R.5D.1 rerun after final link specificity fix:

- Pass: `npm test` (94/94 tests)
- Pass: `npm run lint`
- Pass: `npm run build`
  - The sandboxed build again failed for the same Turbopack internal port permission issue.
  - The same command was rerun outside the sandbox and passed.
- Pass: `git diff --check`

## 8B. Stage B Vercel Preview Refresh

Final preview deployment:

- Stable preview URL: `https://journal-chip-preview.vercel.app`
- Final deployment URL: `https://journal-chip-28o9qyfjh-itseevvs-projects.vercel.app`
- Final deployment id: `dpl_HfmMwLjRBMYwgwGvztvtmk9Nuij6`
- Stable alias updated successfully to the final deployment.

SSO protection:

- Initial status: enabled for `prod_deployment_urls_and_all_previews`.
- Temporarily disabled for Stage B QA after explicit product-owner approval.
- Restored after QA.
- Final status: enabled for `prod_deployment_urls_and_all_previews`.
- Final unauthenticated route check returned `302` to `vercel.com/sso-api`, confirming preview protection is restored.

Pre-deploy checks:

- Working tree was already dirty with accepted prior phase files and reports; no unrelated changes were reverted.
- No user-facing ngrok URLs found in app/config paths.
- Production Scrap Finder still does not include `bottom-press`, `whisper-lip`, playground press data attributes, or `tactilePressStyle`.

Route smoke while SSO was temporarily disabled:

- `/journal/demo?screen=home` -> 200
- `/journal/demo?screen=detail&photos=1` -> 200
- `/journal/demo?screen=detail&photos=5` -> 200
- `/journal/demo?screen=detail&photos=9` -> 200
- `/journal/demo?screen=create` -> 200
- `/journal/demo?screen=crop` -> 200
- `/admin/journal-themes` -> 200
- `/design/scrap-day-v2` -> 200
- `/c/c766b057ec13e93237b91caa4ac94cb76420db9f65550003` -> 200

Browser smoke while SSO was temporarily disabled:

- Low-content Month Sheet (`/journal/demo?screen=home&month=2026-05`):
  - app grid columns: 3
  - rendered CSS grid columns: 3
  - saved positions: 2
  - stable stage height: 472.625px
  - `Back to this month` text preserved
  - computed return-link color: `color(srgb 0.894118 0.705882 0.560784 / 0.72)`
  - computed underline color: `color(srgb 0.894118 0.705882 0.560784 / 0.3)`
  - font weight: 500
  - opacity: 0.78
  - no `MONTH SHEET` label visible
- Populated Month Sheet (`/journal/demo?screen=home&month=2026-07`):
  - app grid columns: 3
  - rendered CSS grid columns: 3
  - saved positions: 12
  - photo titles were not visible on the sheet
- Daily Detail (`/journal/demo?screen=detail&photos=5`):
  - fullscreen photo viewer opened
  - export composer opened
  - export preview reached `data-daily-stamp-export-preview="ready"`
  - export preview alt confirmed 9:16 output
- Create / Scrap / Seal / Detail demo flow (`/journal/demo?screen=crop`):
  - Scrap Finder opened
  - `Use this scrap` returned to Create/Edit
  - `Seal this day` opened detail
  - borderless detail tile marker present
- Playground Scrap Finder tactile section:
  - subtle bottom press preferred-candidate markers present
  - wine and ivory variants visible

Theme token check:

- Dark wine/burgundy return-link token: `color-mix(in srgb, #E4B48F 72%, transparent)`
- Dark wine/burgundy underline token: `color-mix(in srgb, #E4B48F 30%, transparent)`
- Ivory/light return-link token: `color-mix(in srgb, #62453A 72%, transparent)`
- Ivory/light underline token: `color-mix(in srgb, #62453A 30%, transparent)`

Customer route note:

- The known DEV customer token route returned 200, but the capsule is currently at the Owner PIN unlock screen.
- No real customer capsule data was mutated in this Stage B run.
- Create / Scrap / Seal / Detail was verified through the preview demo flow instead.

QA script note:

- Existing `scripts/qa-journal-mobile-browser.mjs` still checks the older 4-column / 8-row Month Sheet expectation and fails against the accepted Phase 7R production app contract.
- A Phase 7R-specific temporary Playwright smoke was used for Stage B verification instead.

## 9. Localhost QA Checklist

Month Sheet:

- Open `/journal/demo?screen=home`.
- Open `/c/[publicToken]` with a real or seeded journal.
- Check a low-content month with one or two sealed days.
- Confirm the translucent overlay feels like a stable monthly stage, not a small shrunken box.
- Confirm only actual saved/demo images render.
- Confirm no empty UI placeholders or generated calendar gaps appear.
- Confirm 3-column grid, date-on-photo markers, quiet title, settings top-right, no header logo, and bottom sticky CTA remain.
- Confirm bottom CTA does not cover final content.

Playground:

- Open `/design/scrap-day-v2`.
- Review the Scrap Finder tactile section on wine and ivory leather.
- Compare base current accepted finder, subtle bottom press detail, and whisper lip.
- Confirm the subtle bottom press feels tasteful, not too visible, not too invisible, not toy-like, and not button-like.

## 10. Next gated step: Phase 7R Preview Refresh

Do not run Stage B yet.

Only after the product owner says "Stage A accepted. Proceed to Vercel Preview Refresh.", deploy the latest accepted redesign to the existing preview:

- `https://journal-chip-preview.vercel.app`

Stage B must rerun the verification commands, then perform focused route smoke QA, visual QA, functional flow QA, and theme QA on the preview.
