# Momento Archive / Storage Launch Execution Ledger

Status: implementation complete through local verification; the canonical chain and executable Archive behavior suite pass on a disposable local Postgres database. Authenticated manual QC is still held until the app is started against that migrated database.
Canonical specification: `MOMENTO_LAUNCH_FINAL_IMPLEMENTATION_APPROVAL_CHECKLIST.md` (approved 2026-08-13).

## Decisions and preflight

- Existing dirty changes are user-owned and remain in place. No unrelated visual, copywriting, or route changes will be reverted.
- The lifecycle migration's SQL semantics remain unchanged, but it now has an explicit transaction wrapper so the canonical chain is executable by a clean Postgres migration runner; this is a local launch-chain correction, not a remote migration. Its shared-environment application status could not be established: no database URL/password or Supabase access token is available.
- Migration strategy: retain the ordered historical-plus-forward chain. The forward migration follows `202607280001`; no remote migration or live data mutation has been performed.
- The optional expansion CTA is configuration-only. Empty or invalid configuration hides it; a valid approved external URL renders it. No payment, webhook, entitlement, SKU, or Admin grant action is in scope.
- Launch customer UI remains one Archive / one Chip. The schema and quota RPCs are Archive-scoped and permit future linked Chips without exposing multi-Chip UI.
- Local-only QC hold is mandatory: no commit, push, PR, deployment, destructive remote migration, or live customer-data mutation before a new founder greenlight after manual QC.
- Conservative decision: the optional Expand archive CTA is configuration-only and HTTP(S)-validated; no expansion SKU, payment, webhook, or entitlement work is introduced.
- DB P0 corrections: ownerless Archive creation remains unconditional; the starter-only partial uniqueness rule permits repeated expansion grants; reservation/commit SQL uses unambiguous variable names; and the superseded-path cleanup query qualifies its returned column.
- Capacity display decision: all customer/Admin quota values use decimal units (1 GB = 1,000,000,000 bytes), with one formatter (`820 MB`, `1 GB`, etc.). The legacy Admin Storage estimate is hidden whenever canonical Archive quota data is present.
- Manual QC order is fixed: (1) establish the remote migration baseline read-only, (2) run the migration chain on an isolated/disposable test database, (3) start the app against that migrated database, (4) perform authenticated customer/Admin QC, and (5) request separate founder approval before any deployment preparation.

## Dependency graph

```text
Task 0 migration baseline
  -> Tasks 1-2 Archive ownership, grants, canonical quota summary
      -> Checkpoint A
          -> Tasks 3-5 byte admission, lifecycle removal, API/types
              -> Checkpoint B
                  -> Tasks 6-7 customer 80% UI, optional CTA, Archive-aware Admin
                      -> Checkpoint C
                          -> Task 8 test replacement and complete verification
                              -> Final Release Gate (no deployment)
```

Shared database contracts and API/types are integrated and reviewed before UI/Admin workers start.

## Task ledger

| Task | Bounded owner / write set | Dependencies | Checkpoint evidence | Status |
|---|---|---|---|---|
| 0. Migration baseline | Supervisor; ledger only | None | CLI/config/credential check recorded; forward strategy selected | Complete with blocker: remote history unavailable |
| 1. Archive ownership | Worker A, supervisor correction; new forward migration, Archive/capsule schema and backfill only | 0 | Every active Journal capsule maps to exactly one Archive; one-to-one link constraint; ownerless provisioning and owner-sync tests | Complete; executable DB run passed |
| 2. Grants and quota summary | Worker A, supervisor correction; same forward migration plus shared quota contract/helpers, provisioning RPC changes, and `lib/admin/capsules.ts` shared contract type | 1 | Idempotent +1,000,000,000-byte starter grant; starter-only uniqueness; repeat expansion sum fixture | Complete; executable DB run passed |
| Checkpoint A | Supervisor | 1-2 | 22 canonical migrations applied cleanly on disposable Postgres; ownerless provisioning, starter grant, repeated expansion grants, and canonical sum assertions passed | Complete locally; remote baseline still unavailable |
| 3. Byte admission | Worker B; forward migration RPC admission logic, `lib/capsule/api.ts`, reservation tests | 2 | Persisted + valid reservations + proposed final state; pre-upload stable quota error; concurrent reservations cannot exceed quota | Complete; executable DB run passed |
| 4. Remove DB lifecycle | Worker B; forward migration lifecycle cleanup and DB contract tests | 0, 3 | No active 365 admission/completion state; same-day, 9-photo, one-Voice-Note, 366th distinct date evidence | Complete; executable DB run passed |
| 5. Remove app lifecycle | Worker B; `data/journal-product.ts`, `data/journal.ts`, API/types and focused tests | 2, 4 | No active 365 lifecycle symbols; Archive summary returned; typecheck/build evidence recorded separately | Complete; executable DB run passed |
| Checkpoint B | Supervisor | 3-5 | Executable assertions for below/full reservation, retained full-capacity edit, 366th distinct date, and same-date rejection | Complete locally; authenticated browser journey still pending |
| 6. Customer storage UI | Worker C; `components/journal/*`, `components/capsule/persistent-memory-flow.tsx`, configuration/copy tests | 5 | 79.99% hidden, 80% shown, CTA present/absent, full-capacity view/delete/recovery | Complete locally; manual authenticated QC pending |
| 7. Archive-aware Admin | Supervisor; `components/admin/admin-capsule-detail-page.tsx`, `lib/admin/capsules.ts`, Admin translations, foundation Admin RPC | 2, 5 | Same canonical decimal capacity values as customer; Archive ID/owner/linked Chips/grant history; no mutation action | Complete; formatter parity tests passed |
| Checkpoint C | Supervisor | 6-7 | Customer 80%/CTA behavior and Admin canonical display parity; legacy duplicate estimate hidden when Archive quota exists | Complete locally; authenticated manual QC still pending |
| 8. Test replacement | Supervisor; Journal lifecycle/capacity/reservation/product tests and narrowly required fixtures | 1-7 | Targeted suite, full suite, lint, standalone typecheck result, production build, migration dry-run, manual journey evidence | Complete locally; manual journey and remote baseline remain release-gate items |
| Final Release Gate | Supervisor + founder QC | 8 | Evidence pack complete; production deployment explicitly not performed | Held: remote baseline and app-connected authenticated founder QC remain required |

## Worker boundaries

- Worker A — Foundation: schema, Archive backfill/linking, starter grants, quota RPC/service contract, provisioning changes, and the shared `lib/admin/capsules.ts` type contract already touched by the worker. No Admin component edits.
- Worker B — Server contract: byte admission, reservation/commit lifecycle removal, application API/types, and server-focused tests. No customer UI or Admin component edits.
- Worker C — Customer UI: 80% warning, optional external CTA, removal of completion/read-only branches, and customer-facing quota errors. No migrations or Admin files.
- Worker D (optional, only after B): Admin read-only Archive summary/grant history in `components/admin/*` and Admin translations/tests only. The shared `lib/admin/capsules.ts` contract remains Worker A/shared-contract ownership. The supervisor may keep this bounded slice local if worker capacity or context makes that safer.
- Worker D was not spawned: the supervisor retained the bounded Admin slice locally so the shared `lib/admin/capsules.ts` contract stayed single-owner.
- Supervisor: integration, ledger/checkpoint evidence, diff review, Admin if not delegated, test replacement, full verification, and final release evidence.

## Blockers / risks

1. Remote migration history is unavailable until a founder-approved credentialed read-only check or dashboard record is supplied. The forward migration strategy avoids mutating that unknown baseline, but Task 0's shared-environment evidence remains incomplete.
2. Remote migration history remains unavailable. A disposable Docker Postgres database is available locally; the executable harness now applies all 22 canonical migrations and runs the required behavior assertions. The existing `momento-archive-db` container was not used or mutated by the harness.
3. The current worktree contains an untracked lifecycle migration and tests that encode the obsolete contract, plus unrelated dirty product/design changes. Workers must edit only their declared write sets and report exact files changed.
4. The existing lifecycle migration is about 3,000 lines and owns reservation, cleanup, and RPC behavior. Forward migration edits must preserve security-definer grants, cleanup semantics, same-date uniqueness, 9-photo, and one-Voice-Note enforcement.
5. Storage byte accounting must use stored optimised display photo bytes, thumbnail bytes, and Voice Note bytes, not metadata or source upload estimates.
6. The isolated worktree initially lacked `node_modules`. Verification used a temporary in-worktree copy from `/Users/yi/Documents/Journal Chip/node_modules`; package versions matched the lockfile (Next 16.2.7, TypeScript 5.9.3, ESLint 9.39.4, Resvg 2.6.2, Sharp 0.34.5). The copy is removed after verification and no package or lockfile is changed.
7. Standalone `npx tsc --noEmit` still reports the pre-existing Next route-export helper errors in the daily/monthly export routes. Those routes and their tests were clean at task start and were deliberately left untouched; no export-route remediation is part of Tasks 0–8. The production build passes once the existing Google Fonts fetch is allowed.
8. `/Users/yi/Documents/Journal Chip/.env.local` was not inspected for secret values or used for speculative operations. No remote database URL/password or Supabase access token is available, so remote migration baseline evidence remains blocked even though disposable local DB verification now passes.

## Final local verification record

- Full `npm test` after the DB P0 fixes and formatter change, run with a temporary lockfile-matching dependency copy: 220 passing, 0 failing.
- Archive UI targeted suite: `node --test tests/archive-quota-ui.test.mjs`: 5 passing, 0 failing. It verifies 820 MB / 1 GB decimal formatting and hides the duplicate legacy Admin estimate when canonical Archive quota is present.
- Disposable DB integration: `node scripts/qa-archive-storage-db.mjs`: 22 canonical migrations applied; executable ownerless starter, repeated expansion, below/exact/full reservation, retained full-capacity edit, 366th distinct date, and same-date rejection assertions passed. The harness removed its own container.
- Archive-focused command `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/archive-storage-foundation.test.mjs tests/archive-quota-ui.test.mjs tests/journal-lifecycle.test.mjs tests/journal-media-reservations.test.mjs tests/journal-media-cleanup.test.mjs tests/journal-photo-capacity-migration.test.mjs tests/journal-photo-capacity.test.mjs tests/journal-product.test.mjs tests/journal-voice-note-capacity.test.mjs tests/journal-watchdog-frontend.test.mjs tests/admin-i18n.test.mjs tests/admin-security.test.mjs`: 92 passing, 0 failing.
- `npm run lint`: passed with `--max-warnings=0`.
- `npx tsc --noEmit`: failed only on the pre-existing helper exports from `app/api/export/daily-stamp/route.ts` and `app/api/export/monthly-sheet/route.ts`; deliberately untouched.
- `npm run build`: passed with the matching temporary dependency copy and read-only network access for the existing Google Fonts imports. The initial in-sandbox attempt failed only because fonts could not be fetched; the symlink attempt was also rejected by Turbopack as an out-of-root dependency path.
- The temporary dependency copy is removed after this record; no `node_modules` residue remains. No package or lockfile was changed.
- `git diff --check`: passed after scope cleanup.
- `HEAD` remains unchanged at `44c5629651c832540f7701089214e8f78c2fda07`.
- Database dry-run: canonical 22-migration chain and behavior harness passed on disposable local Postgres; remote migration history remains unavailable and no remote operation was attempted.
- Browser/manual QC: still held until the app is started against a migrated safe test database. Founder QC remains required before deployment approval.

## Worker A validation limitation

- The worker environment could not establish the remote baseline. Supervisor verification used the cached Supabase Postgres image in a disposable container instead; no shared Supabase project container was touched.
- The executable harness covers ownerless provisioning, starter-only idempotency, multiple expansion grants, canonical grant summing, Archive links, below/exact/full reservation, retained full-capacity edit, date rules, and reservation-path fidelity.

## Worker reporting contract

Each worker must report: files changed; tests run and results; exact checklist acceptance criteria satisfied; unresolved risks; and any requested follow-up. Supervisor reviews the diff before accepting it and updates this ledger after each task/checkpoint.

## Worker reports received

- Worker B (Harvey): changed `supabase/migrations/202608140001_archive_storage_admission_and_remove_lifecycle.sql`, `lib/capsule/api.ts`, `data/journal-product.ts`, `data/journal.ts`, and `tests/journal-lifecycle.test.mjs`; reported the server slice complete with 22 related tests passing, static forbidden-symbol checks passing, and no database dry-run available. Supervisor corrected the byte projection to account for replacement per media path and re-ran the focused foundation/server tests (13 passing) plus TypeScript.
- Worker C (Dewey): changed the customer quota warning/configuration and Journal home/detail flow plus `tests/archive-quota-ui.test.mjs`, updated per-Stamp tests, and reported 104 Journal/archive tests passing, targeted lint/typecheck passing in its worker environment, and manual authenticated mobile QC still required. No Admin, migration, or storefront files were touched.

## Verification budget

- Targeted tests during implementation; one complete lint/test/typecheck/build/browser gate after the final relevant change.
- No production deployment, destructive remote migration, live customer mutation, commit, push, or pull request in this task.
- Planned full verification gates: 1; completed with the temporary dependency copy plus one disposable-DB run. Current work remains within the declared production-feature budget band. No deployment or external-system action was taken.
