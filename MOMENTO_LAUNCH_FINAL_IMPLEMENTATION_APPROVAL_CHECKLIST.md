# Momento Launch Final Implementation Approval Checklist

**Status:** APPROVED FOR LOCAL IMPLEMENTATION — FOUNDER QC HOLD
**Canonical as of:** 2026-08-13
**Purpose:** Final human approval of the smallest pre-launch implementation scope.

## Approval Gate

- [x] Founder has reviewed every Launch requirement, architecture decision, task, non-goal, and acceptance criterion in this document.
- [x] Founder explicitly gave the implementation greenlight on 2026-08-13.
- [x] Product-code and database implementation may begin. Production deployment still requires the separate Final Release Gate approval below.

## Mandatory Local-Only QC Hold

- [x] Implementation and verification may proceed only as uncommitted local changes in the isolated worktree.
- [ ] Do not run `git commit` before the founder completes manual QC and gives a new explicit greenlight.
- [ ] Do not run `git push`, open/update a pull request, or upload code to GitHub before that greenlight.
- [ ] Do not deploy to Vercel, Supabase production, Shopify, or another production environment.
- [ ] Do not mutate live or shared customer data.
- [ ] Every Supervisor worker must receive and follow the same restrictions.
- [ ] The Final Release Gate handoff must include the complete local diff and verification evidence for founder QC.

## Locked Launch Product Contract

- [ ] A Memory Stamp retains its current title behavior.
- [ ] A Memory Stamp supports up to 9 photos.
- [ ] A Memory Stamp supports up to 1 Voice Note.
- [ ] Launch does not support video.
- [ ] Launch does not support written body text beyond the Stamp title.
- [ ] One Momento Archive can contain at most one Stamp for each calendar date.
- [ ] Stamps do not need to be consecutive; there is no streak requirement.
- [ ] Each newly provisioned Momento Archive receives 1 GB of included storage.
- [ ] For implementation and customer display, 1 GB means exactly 1,000,000,000 bytes.
- [ ] Storage usage counts the actual stored optimised photo files, derived photo thumbnails, and Voice Note files.
- [ ] Stamp titles, dates, and other database metadata do not consume the customer-visible 1 GB media allowance.
- [ ] The customer receives an in-product warning at 80% storage usage.
- [ ] The 80% warning strip supports an optional `Expand archive` CTA whose destination is supplied through configurable product/application configuration rather than hard-coded in the component.
- [ ] Until an expansion SKU and approved storefront URL exist, the CTA is hidden; adding the URL later does not require changing Archive quota logic.
- [ ] There is no fixed 30, 60, or 365 Stamp limit.
- [ ] There is no `FULL_REVIEW`, `COMPLETED`, or `Complete this volume` Launch lifecycle.
- [ ] Reaching 1 GB is a storage state, not completion of an Archive or Chapter.
- [ ] No subscription is required for the included 1 GB.

## Locked Architecture Decisions

### Ownership hierarchy

The durable ownership hierarchy is:

```text
User / Owner
└── Archive
    ├── Linked Chip / Capsule A
    ├── Future linked Chip / Capsule B
    ├── Storage grants
    └── Future Highlights
```

- [ ] Storage belongs to an Archive, not directly to a user and not permanently to a single Chip ID.
- [ ] A user may eventually own more than one separate Archive.
- [ ] An Archive may eventually contain more than one linked Chip/capsule.
- [ ] At Launch, the relationship remains one Archive to one Chip; no multi-Chip customer flow is exposed.
- [ ] Existing Memories may remain stored under their capsule; Archive-level services resolve all capsules linked to the Archive.
- [ ] Future Highlights will be scoped to `archive_id` and reference a Memory, rather than being trapped inside one Chip.

### Capacity and entitlement model

- [ ] The included 1 GB is represented as a starter storage grant, not as an irreversible hard-coded capsule constant.
- [ ] Storage grants are append-only and auditable.
- [ ] Capacity is calculated as the sum of grants for an Archive.
- [ ] Storage usage is calculated across all capsules linked to that Archive; at Launch this means the single linked capsule.
- [ ] User-facing and Admin-facing storage numbers come from the same Archive quota service/RPC.
- [ ] Launch provides no purchase expansion flow, Admin grant action, entitlement adjustment UI, or Shopify expansion webhook.
- [ ] Launch may include a dormant optional external expansion CTA integration point. It does not grant storage, verify purchases, or imply that an expansion SKU is currently available.

### Storage state, not Journal lifecycle

```text
NORMAL   used bytes < 80% of granted bytes
WARNING  used bytes >= 80% and below the current capacity
FULL     the proposed media change would exceed current capacity
```

- [ ] `FULL` does not make the Archive read-only.
- [ ] At `FULL`, existing Stamps remain viewable and playable.
- [ ] At `FULL`, title edits and media deletion remain available.
- [ ] At `FULL`, a replacement that reduces usage or remains within the quota remains available.
- [ ] Net-new media that would exceed the quota is rejected before upload.
- [ ] There is no automatic or manual Archive completion action in Launch.

## Implementation Plan

### Task 0: Confirm the remote migration baseline

**Description:** Determine whether the untracked local Journal lifecycle migration has been applied to any shared Supabase environment before choosing the migration strategy.

**Acceptance criteria:**

- [ ] Remote migration history is recorded for development, preview/staging, and production as applicable.
- [ ] If `202607280001_journal_volume_lifecycle.sql` is unapplied everywhere, the team may replace it before first deployment.
- [ ] If it has been applied anywhere shared, it remains immutable and a new forward migration is planned.

**Verification:**

- [ ] A read-only migration-history command or Supabase dashboard record is attached to the implementation task.
- [ ] The selected migration path is written into the implementation handoff before any database edit.

**Dependencies:** None
**Estimated scope:** XS
**Likely files touched:** None during this preflight.

### Task 1: Add the lightweight Archive ownership foundation

**Description:** Introduce the minimum durable Archive layer needed to prevent storage, future Chips, and future Highlights from being permanently bound to one capsule.

**Acceptance criteria:**

- [ ] An Archive has a stable internal ID and owner relationship.
- [ ] A capsule can be linked to an Archive through a schema that permits many capsules per Archive in the future.
- [ ] Existing Journal capsules are backfilled one-to-one into Archives without changing their current customer routes or access behavior.

**Verification:**

- [ ] Migration tests prove every active Journal capsule resolves to exactly one Archive after backfill.
- [ ] Constraint tests prevent a capsule from accidentally resolving to two Archives.
- [ ] Existing NFC, QR, Owner PIN, Journal home, and Memory routes continue resolving through the original capsule flow.

**Dependencies:** Task 0
**Estimated scope:** M
**Likely files touched:**

- `supabase/migrations/<new-or-rewritten-migration>.sql`
- provisioning RPC/migration files that create Journal capsules
- Archive/capsule data types used by the server

### Task 2: Add Archive storage grants and quota summary

**Description:** Represent the included 1 GB as an auditable Archive grant and expose one canonical storage summary for the app and Admin.

**Acceptance criteria:**

- [ ] Every newly provisioned Momento Archive receives one starter grant of `+1_000_000_000` bytes.
- [ ] Existing Momento Archives receive exactly one idempotent starter grant during backfill.
- [ ] The quota summary returns Archive ID, granted bytes, used bytes, percentage, storage status, and linked Chip count.
- [ ] Used bytes equal stored optimised photo bytes + thumbnail bytes + Voice Note bytes across linked capsules.

**Verification:**

- [ ] Re-running provisioning/backfill cannot issue a duplicate starter grant.
- [ ] A database test proves two grants are summed rather than overwriting history.
- [ ] A database-level compatibility test proves usage can aggregate across two linked capsules even though no multi-Chip Launch UI exists.

**Dependencies:** Task 1
**Estimated scope:** M
**Likely files touched:**

- `supabase/migrations/<new-or-rewritten-migration>.sql`
- `lib/admin/capsules.ts`
- Archive/quota API types or helpers

### Task 3: Replace count-based media admission with Archive byte admission

**Description:** Reuse the existing upload reservation flow, but replace the 3,285-photo Journal capacity check with an Archive-level byte projection.

**Acceptance criteria:**

- [ ] Admission includes persisted media, valid concurrent reservations, and the current proposed final media state.
- [ ] Editing a Stamp excludes media being replaced before calculating the proposed final usage.
- [ ] A request that would exceed granted bytes returns a stable `JOURNAL_STORAGE_LIMIT` or equivalent canonical error before object upload.
- [ ] Existing per-Stamp 9-photo and 1-Voice-Note database enforcement remains unchanged.

**Verification:**

- [ ] A request below quota is reserved successfully.
- [ ] A request crossing quota is rejected before upload.
- [ ] Two concurrent reservations cannot jointly exceed quota.
- [ ] A full-capacity Stamp can be replaced with an equal-or-smaller final media state.

**Dependencies:** Task 2
**Estimated scope:** M
**Likely files touched:**

- `supabase/migrations/<new-or-rewritten-migration>.sql`
- `lib/capsule/api.ts`
- `tests/journal-media-reservations.test.mjs`

### Task 4: Remove the 365-day and completion lifecycle from the database

**Description:** Remove every server-side condition that transitions, blocks, completes, or makes a Journal read-only because of Stamp count.

**Acceptance criteria:**

- [ ] Reservation and commit RPCs contain no `>= 365` or `> 365` admission rule.
- [ ] The database no longer transitions Journals into `FULL_REVIEW` or `COMPLETED`.
- [ ] `complete_journal_volume` is removed or made unavailable according to the selected migration strategy.
- [ ] Same-calendar-date uniqueness and the existing 9-photo / 1-Voice-Note enforcement remain active.

**Verification:**

- [ ] A database test permits a 366th distinct dated Stamp when sufficient bytes remain.
- [ ] A database test still rejects a second Stamp for the same calendar date.
- [ ] A database test still rejects a 10th photo and a second Voice Note in one Stamp.

**Dependencies:** Tasks 0 and 3
**Estimated scope:** M
**Likely files touched:**

- `supabase/migrations/202607280001_journal_volume_lifecycle.sql` if confirmed unapplied
- or `supabase/migrations/<forward-migration>.sql` if already applied
- lifecycle-focused migration tests

### Task 5: Remove the 365 lifecycle from application types and API code

**Description:** Remove year-capacity constants, lifecycle states, completion methods, and old errors while retaining per-Stamp product rules.

**Acceptance criteria:**

- [ ] `JOURNAL_YEAR_DAYS`, `JOURNAL_YEAR_PHOTO_CAPACITY`, and volume-level Voice Note capacity are removed.
- [ ] Application types no longer expose `FULL_REVIEW`, `COMPLETED`, `completedAt`, `canComplete`, or volume completion results.
- [ ] `JOURNAL_DAY_LIMIT` and `JOURNAL_COMPLETED` no longer appear in active Journal save behavior.
- [ ] Per-Stamp `DAILY_MEMORY_STAMP_MAX_PHOTOS = 9` and the one-Voice-Note rule remain unchanged.

**Verification:**

- [ ] Static search finds no active 365 lifecycle code outside historical documentation/migrations intentionally retained for audit.
- [ ] Type checking succeeds without lifecycle fallbacks.
- [ ] Journal data loading returns Archive storage summary fields instead of `maxPhotos` and lifecycle fields.

**Dependencies:** Tasks 2 and 4
**Estimated scope:** M
**Likely files touched:**

- `data/journal-product.ts`
- `data/journal.ts`
- `lib/capsule/api.ts`
- affected unit tests

### Task 6: Replace lifecycle UI with the 80% storage experience

**Description:** Remove the volume completion UI and show only the minimum capacity feedback required for Launch.

**Acceptance criteria:**

- [ ] `JournalVolumeLifecyclePanel` and `Complete this volume` are removed from the active Journal home.
- [ ] Completed/read-only Journal branches are removed from Journal home and detail flows.
- [ ] No storage component is shown below 80% usage.
- [ ] At 80% or above, Journal home shows used bytes, granted bytes, and a clear space-management message.
- [ ] When an approved expansion URL is configured, the warning strip shows an `Expand archive` button that opens that storefront URL.
- [ ] When no expansion URL is configured, the warning strip remains complete and usable without rendering a dead CTA.
- [ ] A quota rejection is translated into customer-facing copy without exposing database errors.

**Verification:**

- [ ] 79.99% does not show the warning; 80% does.
- [ ] CTA tests cover both configurations: URL present and URL absent.
- [ ] Deleting enough media to fall below 80% removes the warning after refresh.
- [ ] At full capacity, saved Stamps remain accessible and removable.
- [ ] The create/edit form continues to allow up to 9 photos and one Voice Note; it no longer derives a limit from a whole-Journal photo count.

**Dependencies:** Task 5
**Estimated scope:** M
**Likely files touched:**

- `components/journal/journal-home.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/journal-volume-lifecycle-panel.tsx` (remove from active product)
- `components/capsule/persistent-memory-flow.tsx`
- `lib/capsule/api.ts`

### Task 7: Make Admin Archive-aware and read-only for grants

**Description:** Replace the capsule-only storage estimate with an Archive summary that remains compatible with future expansion and linked Chips.

**Acceptance criteria:**

- [ ] Admin shows Archive ID, owner identity, linked Chip count, used bytes, granted bytes, percentage, and current storage status.
- [ ] Admin shows the starter grant in a read-only grant history.
- [ ] Admin and customer UI use the same quota summary source.
- [ ] Launch exposes no manual `Add storage`, `Adjust quota`, or paid-expansion action.

**Verification:**

- [ ] Admin and Journal home show the same used and granted byte values for the same Archive.
- [ ] A capsule detail page links or clearly scopes the information to its Archive.
- [ ] Admin remains usable for a one-Archive/one-Chip Launch record and a seeded multi-Chip compatibility fixture.

**Dependencies:** Tasks 2 and 5
**Estimated scope:** M
**Likely files touched:**

- `components/admin/admin-capsule-detail-page.tsx`
- `lib/admin/capsules.ts`
- Admin data RPC/migration
- Admin translations

### Task 8: Replace old lifecycle tests with the locked Launch contract

**Description:** Preserve current per-Stamp constraints while replacing tests whose passing state currently proves the obsolete 365 lifecycle.

**Acceptance criteria:**

- [ ] Existing 9-photo, 1-Voice-Note, title, local-date, cleanup, and reservation regression coverage remains.
- [ ] Tests no longer expect `FULL_REVIEW`, `COMPLETED`, completion RPCs, or 3,285 total photos.
- [ ] New coverage proves Archive grants, byte quota, warning boundary, full-state edit/delete behavior, and absence of the 365 cap.

**Verification:**

- [ ] Targeted Journal test suite passes.
- [ ] Type check passes.
- [ ] Production build passes.
- [ ] Database migration tests pass for both a clean database and the approved forward-migration baseline.

**Dependencies:** Tasks 1–7
**Estimated scope:** M
**Likely files touched:**

- `tests/journal-product.test.mjs`
- `tests/journal-lifecycle.test.mjs` (replace/remove obsolete expectations)
- `tests/journal-media-reservations.test.mjs`
- `tests/journal-voice-note-capacity.test.mjs`
- new Archive quota tests as needed

## Implementation Checkpoints

### Checkpoint A: Foundation after Tasks 0–2

- [ ] Migration strategy is approved.
- [ ] Every Journal capsule resolves to one Archive.
- [ ] Starter 1 GB grants are idempotent.
- [ ] Existing Journal access behavior is unchanged.
- [ ] Founder/technical review approves the schema before quota enforcement begins.

### Checkpoint B: Server contract after Tasks 3–5

- [ ] Byte quota is authoritative and concurrency-safe.
- [ ] 365 lifecycle is absent from active server behavior.
- [ ] Same-day, 9-photo, and 1-Voice-Note rules still pass.
- [ ] A 366th distinct Stamp is technically permitted when storage remains.

### Checkpoint C: User and Admin experience after Tasks 6–7

- [ ] Warning appears at exactly 80%.
- [ ] Full capacity blocks only net-new media beyond quota.
- [ ] No completion UI remains.
- [ ] Admin and customer storage values match.

### Final Release Gate after Task 8

- [ ] Targeted tests pass.
- [ ] Full test suite passes.
- [ ] Type check passes.
- [ ] Production build passes.
- [ ] Migration dry run passes against the approved baseline.
- [ ] Manual mobile test passes: create, edit, delete, voice playback, same-day routing, 80% warning, and full-capacity recovery.
- [ ] Manual Admin test passes for Archive and storage summary.
- [ ] Storefront Homepage, Meet Momento, all Momento PDPs, and FAQ contain no obsolete product promise.
- [ ] Founder gives a separate deployment approval after reviewing the implementation evidence.

## Explicitly Out of Scope for Launch

- [ ] No video upload or playback.
- [ ] No additional written Memory body.
- [ ] No more than one Stamp per calendar date.
- [ ] No Highlights feature.
- [ ] No multi-Chip customer UI or activation flow.
- [ ] No cross-Chip Archive home.
- [ ] No paid digital expansion SKU implementation, payment verification, entitlement fulfillment, or Shopify expansion webhook. The optional external CTA integration point is allowed.
- [ ] No Admin capacity adjustment action.
- [ ] No 95% second reminder.
- [ ] No persistent storage meter below 80%.
- [ ] No storage email or push notifications.
- [ ] No Chapter Seal, Chapter Keeper, or Chapter completion workflow.
- [ ] No account-level global storage pool spanning separate Archives.

## Copywriting and Storefront Coordination

Copywriting implementation is coordinated separately in the **copywriting polish** task. That task has received the locked product truths and must remove or replace:

- `365 Memory Stamps`, `365 Meaningful Days`, and all fixed Stamp-count promises;
- `approximately 3GB`, `3,285 photos`, and `365 Voice Notes`;
- video and additional-word upload promises;
- `Lifetime Archive`, `forever`, and similar perpetual-service guarantees;
- `FULL_REVIEW`, completion, volume-full, and “delete one to open a position” language;
- absolute `100% private` claims;
- inconsistent `Memento` spelling;
- unresolved dimensions, Shipping, and Returns placeholders.

Copywriting changes do not authorise product-code implementation. Engineering remains on hold until the Approval Gate at the top of this document is satisfied.

## Founder Final Decision

- [ ] **APPROVED AS WRITTEN** — implementation may begin in dependency order.
- [x] **APPROVED WITH CHANGES** — implementation may begin after incorporating the note below.
- [ ] **NOT APPROVED** — return to product/architecture review.

**Requested changes / notes:**

```text
The 80% customer warning strip must be compatible with a future external
"Expand archive" purchase button. No expansion SKU or URL exists yet. Build
the CTA as optional configuration: hide it when unset; once the founder
provides an approved storefront URL, expose the button without changing the
Archive quota model. Purchase-to-storage entitlement fulfilment remains
post-launch and out of scope for this implementation.
```
