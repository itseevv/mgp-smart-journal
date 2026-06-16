# Phase 4 Multi-Memory Journal

Phase 4 keeps bookmark capsules as one-memory products and adds a journal home
for capsules whose `product_type` is `journal`.

## Routes

- `/c/[publicToken]`
  - bookmark: opens the existing single-memory flow
  - journal: opens Journal Home
- `/c/[publicToken]/m/[memoryId]`
  - journal: opens an existing memory or a new draft
  - bookmark: redirects to the bookmark's single-memory route

Journal Home generates a UUID before navigating to a new memory. That UUID is
used consistently by the route, private Storage paths, and the commit RPC.
There is no `/m/new` alias. Retrying Save with the same route is idempotent
because the same memory ID is committed again.

## Migration

`202606150001_phase_4_multi_memory_journal.sql`:

- adds the owner-editable `capsules.title`, defaulting to `My Journal`
- removes the one-memory-per-capsule unique constraint
- makes application media tables read-only through direct RLS access
- moves writes behind validated security-definer RPCs
- adds the journal-wide 100-photo transaction boundary
- adds one aggregated Journal Home query
- adds transactional memory deletion
- adds a persistent private-media cleanup queue

The migration preserves existing memories and media paths. A journal capsule
that already contains one memory shows that row as its first Journal Home card.

Do not apply this migration until its SQL and accompanying Edge Function change
have been reviewed together.

## Server Enforcement

`commit_memory` locks the capsule row before validating and committing.

- bookmark capsules reject a second committed memory
- journal capsules allow multiple memories
- each memory remains limited to 30 photos
- journal capsules are limited to 100 committed photos in total
- an edit excludes the current memory before calculating its available quota
- a memory ID already attached to another capsule is rejected
- media IDs already attached to another memory are rejected

The browser shows the immediate allowance, but the transaction is authoritative.

## Journal Home Query

`get_journal_home` returns all card metadata in one database request:

- memory ID and title
- occurred and created timestamps
- photo and voice-memo counts
- first ordered thumbnail path and dimensions

Ordering is stable:

`occurred_at DESC, created_at DESC, id DESC`

The client requests private thumbnail URLs in one batch and caches them for the
unlocked session. Journal Home does not resolve display images or audio.

## Cleanup Queue

Database deletion and Storage deletion are deliberately separate:

1. the metadata transaction queues every removed private path
2. the database deletion and journal quota release commit
3. the protected `capsule-access` function processes queued Storage removals
4. successful entries are removed from the queue
5. failed entries retain status, attempt count, and a bounded error message

Repeated cleanup calls are idempotent. Queue records contain Storage paths only,
never signed URLs. Journal Home shows pending cleanup and provides Retry.

## Deployment Order

After migration review:

1. apply the migration
2. deploy the updated `capsule-access` Edge Function
3. seed or use a `journal` capsule
4. verify journal and bookmark journeys

The browser save API temporarily falls back to `commit_single_memory` when the
new RPC is not yet present, preserving bookmark development during rollout.
