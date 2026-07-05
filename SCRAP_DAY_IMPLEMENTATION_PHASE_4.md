# Scrap the Day Implementation Phase 4

## Summary

Phase 4 matures the Journal Home Monthly Stamp Sheet into a browsable journal archive.

The journal now supports month query selection, calendar previous/next month navigation, a current-month shortcut, a compact stamped-sheet selector, and month-specific empty states. The Month Sheet still renders only saved Daily Memory Stamps. It does not render empty day cells, streaks, missed-day copy, storage dashboard metadata, voice memo counts, or photo quota copy.

Daily Memory Stamp detail now includes a clear `Back to month sheet` action. For real journal routes, it returns to `/c/[publicToken]?month=YYYY-MM` using the stamp's local date first. For demo detail, it returns to `/journal/demo?screen=home&month=YYYY-MM`.

Phase 3 one-day-one-stamp behavior is preserved. `Seal Today` still uses today's semantic local date and opens today's existing stamp when one exists.

## Files Changed

- `app/c/[publicToken]/page.tsx`
- `app/journal/demo/page.tsx`
- `components/capsule/capsule-page.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/stamp-tile.tsx`
- `components/journal/use-month-query-state.ts`
- `components/memory/completed-state.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `data/local-date.ts`
- `data/journal-stamps.ts`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `tests/journal-form-regression.test.mjs`
- `tests/journal-product.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_4.md`

## Month Archive Helpers

Added or strengthened helpers for:

- local month key validation: `YYYY-MM`
- current, previous, and next local calendar month keys
- local-date-first month grouping
- newest-first stamped sheet lists for selectors
- selected month resolution from a valid query month
- fallback to current stamped month, latest stamped month, or current empty month
- selected month stamp lists sorted by semantic local date ascending, then `createdAt`, then id
- selected month archive metadata, including past/current/future status

`local_date` remains first priority. `capturedAt` is the compatibility fallback, and `createdAt` is the old/dev-data fallback.

## URL Month Query Behavior

Supported URLs:

- `/c/[publicToken]?month=2026-07`
- `/journal/demo?month=2026-07`
- `/journal/demo?screen=home&month=2026-07`

Invalid month values are ignored by the month resolver and fall back to the default selected month. Month navigation updates the `month` query using browser history without changing the route path or remounting the journal flow.

Daily stamp detail return behavior also preserves month context:

- real detail routes return to `/c/[publicToken]?month=YYYY-MM`
- demo detail routes return to `/journal/demo?screen=home&month=YYYY-MM`
- month calculation uses the stamp's `localDate` first, then `capturedAt`

## Month Navigation UI

The Monthly Stamp Sheet now includes:

- prominent uppercase month title, for example `JULY 2026`
- previous calendar month control
- next calendar month control, disabled beyond the current month
- `Back to this month` when viewing past or future sheets
- compact `Sheets` selector for months that have saved stamps
- subtle day count copy, for example `2 days sealed`
- primary `Seal Today` CTA on every selected month
- Month Sheet tile images using the shared small perforated `StampFrame`
- Daily Memory Stamp detail includes a tap-friendly `Back to month sheet` button

The stamp grid remains a collection, not a calendar. It renders only saved stamps in the selected month.

## Empty State Behavior

Current month empty:

- `No scraps sealed for this month yet.`
- `Find one little piece of today.`

Past month empty:

- `This month is still blank.`
- `You can still seal a day from this month by choosing its date.`

Future month empty:

- `This sheet is waiting.`
- `Come back to this sheet when the month arrives.`

No missed-day, streak, or completion-pressure language was added.

## Phase 3 Preservation

Preserved:

- one journal plus one semantic local calendar day equals one Daily Memory Stamp
- home duplicate-today guard
- direct-route duplicate-today guard
- form duplicate-local-date guard
- RPC local date payload
- backend duplicate local date handling
- DB partial unique index from Phase 3
- backfilled stamps appearing in their selected `localDate` month

No Phase 4 migration was added. The Phase 3 migration still must be applied before deploying app code that depends on `local_date` and `local_timezone`.

## Demo Routes

Updated `/journal/demo` with in-memory archive data across several months:

- current July 2026 sheet with multiple stamps
- June 2026 sheet with multiple stamps
- May 2026 sheet with an older/backfilled-looking stamp
- April 2026 empty past-month state

Useful QA routes:

- `/journal/demo?screen=home`
- `/journal/demo?screen=home&month=2026-07`
- `/journal/demo?screen=home&month=2026-06`
- `/journal/demo?screen=home&month=2026-05`
- `/journal/demo?screen=home&month=2026-04`
- `/journal/demo?screen=create`
- `/journal/demo?screen=crop`
- `/journal/demo?screen=detail&photos=9`

`/memory/demo` still redirects to `/journal/demo`.

## Performance Notes

This phase keeps the current MVP data model: Journal Home loads the journal summary list and resolves only cover thumbnails for Month Sheet tiles. It does not load all original images for every stamp.

Future scalability note: when a journal approaches a full year of stamps, the app may need month-specific RPC pagination or a cover-only month summary query. That was intentionally not added in this phase.

## Intentionally Not Implemented

- Phase 2B Additional Moments Optional Adjust Scrap
- share/export
- Year in Stamps
- yearly review
- monthly video recap
- Live Photo support
- OCR
- AI
- public social network
- template marketplace
- cropper changes
- crop metadata changes
- local date database changes beyond using Phase 3
- real leather/fabric final polish
- heavy pagination

## Verification

- `npm test` - passed, 56 tests.
- `npm run lint` - passed.
- `npm run build` - passed after rerunning outside the sandbox; the sandboxed attempt hit the known Turbopack process/port permission error.
- `npm run qa:journal:smoke` - passed after rerunning with local loopback access to `127.0.0.1:3000`.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules PLAYWRIGHT_CHROMIUM_EXECUTABLE=/Users/yi/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run qa:journal:mobile:smoke` - passed with the stable dev server bound to `127.0.0.1`.
- `git diff --check` - passed.

After the detail return-button follow-up, reran:

- `npm test` - passed, 56 tests.
- `npm run lint` - passed.
- `npm run qa:journal:smoke` - passed with local loopback access.
- `git diff --check` - passed.

The full build and mobile smoke were not rerun after this small follow-up so the active QC dev server could remain available.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

1. Open `/journal/demo?screen=home`.
2. Confirm Month Sheet appears.
3. Confirm month title is visible.
4. Confirm previous and next navigation exists.
5. Navigate to previous month.
6. Confirm selected month changes.
7. Confirm URL month query updates.
8. Navigate back to current month.
9. Confirm `Seal Today` remains primary.
10. Confirm no empty calendar day cells.
11. Confirm no streak or missed-day language.
12. Confirm no storage/photo quota language.
13. Confirm no voice memo count.
14. Open `/journal/demo?screen=home&month=2026-07`.
15. Confirm July sheet.
16. Open `/journal/demo?screen=home&month=2026-06`.
17. Confirm June sheet.
18. Open `/journal/demo?screen=home&month=2026-04`.
19. Confirm gentle empty past-month state.
20. Open `/journal/demo?screen=create`.
21. Confirm create flow still works and `Seal Today` is not tied to the archive month.
22. Open `/journal/demo?screen=detail&photos=9`.
23. Confirm detail route still works.
24. Tap `Back to month sheet`.
25. Confirm the demo returns to the Month Sheet with a `month=YYYY-MM` query.

Real route if available:

1. Open `/c/[publicToken]`.
2. Open `/c/[publicToken]?month=YYYY-MM`.
3. Confirm selected Month Sheet.
4. Tap a stamp tile.
5. Confirm detail opens.
6. Tap `Back to month sheet`.
7. Confirm selected month is restored by `/c/[publicToken]?month=YYYY-MM`.
8. Tap `Seal Today`.
9. Confirm Phase 3 duplicate-day behavior still works.

Mobile:

1. Test at 375px.
2. Test at 390px or 393px.
3. Test at 430px.
4. Confirm no horizontal overflow.
5. Confirm navigation controls are tap-friendly.

## Known Limitations

- Journal Home still loads the full journal summary list rather than a month-specific backend page.
- Next-month navigation is disabled after the current month, but a manually entered future `month` query can still render a gentle future empty state.
- No real Supabase-backed `/c/[publicToken]?month=...` manual QA has been run from this workspace yet.
- Full mobile QA was not run unless separately requested.

## Recommended Next Patch

Recommended next patch options:

- Phase 5: Static share/export for Daily Memory Stamp and Monthly Stamp Sheet.
- Phase 2B: Additional Moments Optional Adjust Scrap.
- Phase 6: Year in Stamps, later.
