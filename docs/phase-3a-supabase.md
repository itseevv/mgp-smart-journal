# Phase 3A Supabase Setup

This phase persists one memory per physical capsule while keeping the approved
mobile UI. Supabase anonymous users are technical RLS sessions only; no member
login appears in the product.

## Prerequisites

- A Supabase project with anonymous sign-ins enabled.
- Supabase CLI installed for migration and Edge Function deployment.
- Node.js and the dependencies from `npm install`.

## Environment

Copy `.env.example` to `.env.local` and set:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is only for the local seed script and the Edge
Function environment. Never prefix it with `NEXT_PUBLIC_`.

## Migrate And Deploy

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set ALLOWED_ORIGIN=http://localhost:3000
supabase functions deploy capsule-access
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions.

Enable anonymous sign-ins in **Authentication > Providers > Anonymous** for the
hosted project. Local configuration is recorded in `supabase/config.toml`.

## Seed A Capsule

Load `.env.local` into the shell, then run:

```sh
set -a
source .env.local
set +a
npm run seed:capsule
```

The script prints the non-guessable public token and local `/c/[publicToken]`
URL. Add `-- --journal` to seed the future journal product type.

## Security Model

- PIN activation, verification, lockout, and access-row changes occur only
  through `capsule-access`.
- PINs are hashed with PostgreSQL `pgcrypto` bcrypt and raw PINs are never
  stored.
- Five failed attempts for one capsule/anonymous user block attempts for
  fifteen minutes.
- Application tables and the private `memory-media` bucket use owner-access
  RLS.
- The client cannot insert `capsule_access` rows or call privileged PIN SQL
  functions.
- Signed media URLs last five minutes and are refreshed every four minutes
  while the memory is open.

## Save Model

New local media uploads first. A single database RPC then commits memory
metadata and ordering transactionally. Removed stored objects are deleted after
the metadata commit. Upload or metadata failures keep the local draft visible
for retry. A cleanup failure is reported as `partialFailure`.

New photographs are re-encoded in the browser as a display image and a small
thumbnail. Uploads use a bounded queue and switch to TUS when a prepared file
exceeds the standard-upload threshold. Existing photographs created before the
thumbnail migration remain compatible, but use their display image as the
thumbnail until they are replaced or backfilled.

## Media Delivery

- The access function returns the first display-image URL with the unlocked
  memory payload, avoiding a separate initial metadata request.
- The first photograph requests its real thumbnail in parallel and displays it
  while the larger display image finishes loading.
- Additional thumbnails load only when they approach the horizontal viewport.
- Voice-memo media is resolved only when Play is selected.
- Signed URLs and resolved media are cleared when the journal is locked.

The development Supabase project is hosted in West EU (Ireland). Testing from
Shanghai includes unavoidable cross-region latency for the access function and
private Storage. For production use in East Asia, create the production project
in a nearby supported region and apply the same migrations. Supabase project
regions cannot be changed in place.

## Verification

Run:

```sh
npm run lint
npm run build
```

For a connected development project, verify activation, reload persistence,
edit/cancel/save, lock/unlock, five-attempt lockout, private media access, and
RLS using a second anonymous browser session.

## Known MVP Limitations

- HEIC/HEIF files depend on browser decoding support and currently show a
  recoverable unsupported-format error when decoding is unavailable.
- Legacy development photos without thumbnail metadata still transfer the
  larger display file in thumbnail positions. A production data migration
  should backfill variants outside the browser before launch.
- Cross-region latency cannot be removed by React loading-state changes or
  signed-URL caching.
- Successfully uploaded files can remain orphaned if the metadata transaction
  repeatedly fails; a later cleanup job can remove unreferenced objects.
- Signed URLs can remain usable until their five-minute expiry after manual
  locking.
- The deprecated `capsules.owner_recovery_hash` column is unused. Phase 6 uses
  the isolated recovery credential tables instead.

## Phase 4

Multi-memory journal architecture, routes, quota enforcement, and deployment
order are documented in [phase-4-journal.md](./phase-4-journal.md).

## Phase 6

Owner PIN recovery lifecycle, issuance, hashing, lockout, and deployment are
documented in [phase-6-recovery.md](./phase-6-recovery.md).
