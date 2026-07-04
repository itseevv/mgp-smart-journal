# Scrap the Day Implementation Phase 3

## Summary

Phase 3 implements one-day-one-stamp integrity for the Scrap the Day journal product.

Product rule:

ONE JOURNAL + ONE LOCAL CALENDAR DAY = ONE DAILY MEMORY STAMP.

The implementation adds semantic local-date metadata, groups Month Sheets by that semantic date, blocks duplicate days in the home/direct-route/form paths, and adds a database unique index plus RPC duplicate handling so the save path cannot create a second stamp for the same journal day.

No Phase 2B Additional Moments Adjust Scrap, share/export, Year in Stamps, visual redesign, live media features, AI, OCR, or voice memo UI was added.

## Files Changed

Phase 3-relevant files:

- `data/local-date.ts`
- `data/journal-stamps.ts`
- `data/journal.ts`
- `data/memory-demo.ts`
- `components/journal/journal-home.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/journal-demo-flow.tsx`
- `components/memory/memory-form.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `lib/capsule/api.ts`
- `supabase/functions/capsule-access/index.ts`
- `supabase/migrations/202607040001_scrap_day_phase_3_local_date.sql`
- `tests/journal-product.test.mjs`
- `tests/journal-form-regression.test.mjs`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`
- `package.json`

This report:

- `SCRAP_DAY_IMPLEMENTATION_PHASE_3.md`

## Migration Notes

Migration:

- `supabase/migrations/202607040001_scrap_day_phase_3_local_date.sql`

SQL summary:

- Adds nullable `memories.local_date date`.
- Adds nullable `memories.local_timezone text`.
- Adds partial unique index `memories_capsule_local_date_unique` on `(capsule_id, local_date)` where `local_date is not null`.
- Adds an 8-argument `commit_memory` RPC wrapper accepting `requested_local_date` and `requested_local_timezone`.
- Adds matching `commit_single_memory` compatibility wrapper.
- Updates `get_journal_home` to return `localDate` and `localTimezone`.
- Orders journal home rows by `coalesce(memory.local_date, memory.occurred_at::date)` then `created_at`.

Deployment note:

Apply the Phase 3 migration before deploying this app code. The frontend and edge function now select `local_date` / `local_timezone`, and the save path sends the 8-argument RPC payload. A deployed environment missing the migration should fail clearly at the Supabase query/RPC layer, but it would block saves and journal loads until the migration is applied.

## Local Date Model

`local_date` is the semantic day identity for a Daily Memory Stamp. It is stored as `YYYY-MM-DD` and is preserved from the user's date input instead of deriving from `toISOString().slice(0, 10)`.

`local_timezone` stores the browser-resolved IANA timezone when available through `Intl.DateTimeFormat().resolvedOptions().timeZone`. It is nullable when unavailable.

Fallback behavior:

1. Use `localDate` / `local_date` when present.
2. Else derive from `capturedAt` / `occurred_at` using local date helpers.
3. Else fallback to `createdAt`.

## Enforcement

Helper level:

- `data/local-date.ts` provides safe local date and month key helpers.
- `data/journal-stamps.ts` provides local-date identity, duplicate detection, sorting, grouping, active month selection, and same-day lookup helpers.

Home guard:

- `JournalHome` computes today's local date and uses existing stamp lookup before generating a new memory id.
- If today is already sealed, it navigates to the existing stamp and shows calm copy.

Direct route guard:

- `JournalMemoryPage` checks create mode against today's existing stamp.
- Direct navigation to `/c/[publicToken]/m/[newMemoryId]` shows an already-sealed state instead of a blank create form when today's stamp already exists.

Form guard:

- `MemoryForm` checks the selected date against existing journal stamps.
- Duplicate dates disable save and show "That day is already sealed in this journal." with an action to open the existing stamp.
- Editing keeps the same memory id exempt, so retaining the same date is allowed.

API/backend:

- `savePersistentMemory` includes `requested_local_date` and `requested_local_timezone`.
- Duplicate local-date RPC responses and unique-index violations are mapped to calm duplicate-day copy.
- Existing callers without local date remain compatible through the older 6-argument RPC path.

Database:

- The partial unique index blocks two non-null local dates for the same capsule.
- Null local dates remain valid for old/dev rows.
- The Phase 3 RPC checks old null-local-date rows using `coalesce(memory.local_date, memory.occurred_at::date)` before committing a new journal stamp.

## Month Sheet Behavior

Month grouping now uses semantic local date first. Backfilled stamps appear in the month of their selected `localDate`, not the month in which they were created.

Sorting within a month uses local date ascending, then `createdAt` ascending, then id as a stable tiebreaker.

Active month selection:

- Current month if it has stamps.
- Otherwise latest stamped month.
- Otherwise current empty month.

Empty calendar slots, missed days, and streak language are not rendered.

## Demo And QA

`/journal/demo` keeps the existing demo states and adds duplicate-date scenarios:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=crop`
- `/journal/demo?screen=detail&photos=9`
- `/journal/demo?screen=create&scenario=duplicate-today`
- `/journal/demo?screen=create&scenario=backfill-may`

`/memory/demo` continues to redirect to `/journal/demo`.

During recovery, mobile smoke initially failed after clicking `[data-stamp-photo-frame="true"]` because the QA script clicked while the demo stamp image was still in its `Loading...` state. A one-route Playwright probe confirmed the product viewer opens once the frame has settled. The QA script now waits for the first stamp frame loading status to clear before clicking.

## Verification

- `npm test` - passed, 52 tests.
- `npm run lint` - passed.
- `npm run build` - passed after rerunning outside the sandbox; the sandboxed attempt hit the known Turbopack worker/process permission error.
- `npm run qa:journal:smoke` - passed after allowing local loopback access to `127.0.0.1:3000`.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules PLAYWRIGHT_CHROMIUM_EXECUTABLE=/Users/yi/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run qa:journal:mobile:smoke` - passed.

Full mobile QA was intentionally not run in this step.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

1. Open `/journal/demo` or a real `/c/[publicToken]` journal.
2. Tap `Seal Today` when today has no stamp.
3. Create today's stamp.
4. Return to home.
5. Tap `Seal Today` again.
6. Confirm it opens the existing today stamp and does not create a second one.
7. Manually open a new `/c/[publicToken]/m/[newMemoryId]` route when today already exists.
8. Confirm the blank create form does not proceed normally.
9. Confirm the already-sealed state appears.
10. Backfill a stamp for May 8.
11. Confirm it appears in May Sheet, not the current month.
12. Try to create another May 8 stamp.
13. Confirm it is blocked at form level.
14. Edit an existing stamp.
15. Confirm keeping the same date is allowed.
16. Confirm changing to another existing date is blocked.
17. Confirm backend/API does not create duplicates if the client guard is bypassed.
18. Confirm lock, rename, and private media still work.
19. Confirm no voice memo UI appears in the journal customer flow.
20. Confirm max 9 images still applies.

## Known Limitations And Risks

- Phase 3 migration must be applied before the app code is deployed.
- Old rows with null `local_date` are not backfilled. They remain valid and are considered through an `occurred_at` fallback.
- The SQL fallback `occurred_at::date` depends on database date casting semantics for legacy rows; it is a compatibility guard, not a perfect reconstruction of the user's original timezone.
- The 9-image journal limit remains frontend/product-path enforcement; no hard backend 9-photo constraint was added in this phase.
- Duplicate-date UI guards rely on the current journal home/context memory list; the database unique index and RPC duplicate check are the final authority.
- Full mobile browser QA has not been rerun after the smoke fix.

## Intentionally Not Implemented

- Phase 2B Additional Moments optional Adjust Scrap.
- Share/export.
- Year in Stamps.
- Month navigation redesign.
- Visual redesign or leather texture polish.
- Live Photo support.
- Video editing.
- OCR.
- AI.
- Public social network.
- Template marketplace.
- Voice memo UI.

## Recommended Next Patch

Recommended next patch: Phase 2B, Additional Moments optional Adjust Scrap, using the existing Scrap Table while keeping cover-first as the primary ritual.

Alternate next patches:

- Phase 4: Month navigation / archive maturity.
- Phase 5: Daily and Monthly static share/export.
