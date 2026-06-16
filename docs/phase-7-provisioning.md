# Phase 7 Capsule Provisioning

Phase 7 adds an internal MVP Admin layer for physical NFC journal and bookmark
fulfilment. It does not add Shopify, email, customer accounts, payments,
browser NFC writing, or public media access.

## Admin Access

Admin uses a server-side passcode and a signed httpOnly cookie.

Required local/server environment:

```sh
ADMIN_PASSCODE=...
ADMIN_SESSION_SECRET=...
```

`ADMIN_SESSION_SECRET` must be at least 32 random characters. The cookie is
httpOnly, sameSite `strict`, and secure in production. Admin APIs validate the
signed cookie on every privileged request. Ordinary capsule users cannot call
admin APIs without this cookie.

Never expose these as `NEXT_PUBLIC_*`. The browser never receives the service
role key, recovery pepper, PIN hashes, recovery hashes, private media paths, or
signed URLs.

## Data Model

Migration `202606150004_phase_7_capsule_provisioning.sql` adds:

- `capsule_batches`
- `capsule_serial_counters`
- `capsule_fulfillment`
- `admin_action_audit`

All new tables have RLS enabled and no anon/authenticated grants. Admin data is
accessed through service-role-only RPCs from server-side Admin API routes.

Activation status remains on `capsules.status` as `unactivated` or `active`.
Fulfilment status lives separately in `capsule_fulfillment`.

## Serial Numbers

Serials are internal fulfilment identifiers only:

- journals default to `JNL`
- bookmarks default to `BMK`
- format is `PREFIX-YYYY-0001`

Serial counters are scoped by prefix and year. Public tokens remain random,
URL-safe, non-sequential 48-character hex strings and are still the values used
for NFC and QR.

## Batch Generation

Admin route:

```text
/admin/capsules
```

Batch fields:

- batch name
- product type
- quantity
- optional serial prefix
- notes
- optional initial Recovery Passcode issuance

Capsule creation is transactional in the database RPC. If initial recovery
issuance is requested, passcodes are issued after capsule creation through the
existing protected `capsule-access` issuance boundary. Any issuance failures are
reported explicitly; capsules are not silently marked as having handoff codes.

Local seed example after migration review/application:

```sh
node --env-file=.env.local scripts/seed-admin-batch.mjs --product journal --quantity 5 --recovery
```

Remote development integration applied these additive migrations:

- `202606150004_phase_7_capsule_provisioning.sql`
- `202606160001_fix_admin_batch_token_generation.sql`
- `202606160002_harden_admin_rpc_grants.sql`

`202606160001` qualifies `extensions.gen_random_bytes(24)` inside
`admin_generate_capsule_batch`. The Phase 7 RPC uses `search_path = public`, so
unqualified `gen_random_bytes()` may not resolve on Supabase projects where
extensions are installed into the `extensions` schema.

`202606160002` explicitly revokes admin/provisioning RPC execution from
`public`, `anon`, and `authenticated`, then grants execution only to
`service_role`. This is required because a direct anon Supabase client was able
to call `admin_list_capsules` until the explicit role revokes were applied.

## Recovery Handoff

Plaintext Recovery Passcodes are shown or exported only once. They are never
stored in the database. Issuing or rotating a passcode invalidates the previous
one.

The general CSV export contains no secrets. The sensitive recovery handoff CSV
is separate and clearly labelled.

## QR Fallback

QR codes encode only the full public capsule URL:

```text
/c/[publicToken]
```

QR is a locator, not an access credential. Owner PIN is still required after
activation. QR SVG/PNG downloads are generated server-side and named by serial
number, for example:

```text
JNL-2026-0001-qr.svg
```

QR images are not stored in the database.

## Manual NFC Workflow

1. Generate capsule batch in Admin.
2. Copy the capsule URL.
3. Write the URL to the NFC chip using NFC Tools or equivalent.
4. Tap the chip with a phone.
5. Confirm the correct capsule opens.
6. Mark the capsule as written.
7. Mark it as tested.
8. Attach or pack the physical chip/journal.

## Disabled Capsules

Disabled state is stored in `capsule_fulfillment`. Disabled capsules cannot be
activated, unlocked, recovered, or used to display private content. The public
UI shows only neutral copy:

```text
This memory capsule is unavailable. Please contact the maker if you believe this is a mistake.
```

The internal disabled reason appears only in Admin. Disabling an activated
capsule requires explicit confirmation.

## Privacy Boundary

Admin is for fulfilment metadata only.

Allowed:

- serial number
- product type
- activation and fulfilment status
- recovery issued status
- memory/photo/voice memo counts
- rough storage estimate

Not allowed:

- customer photos
- voice playback
- private memory browsing
- signed media URLs
- media storage paths
- PIN hashes or recovery hashes

## Verification Notes

Remote development verification completed:

- Admin route is blocked without the signed admin cookie.
- Admin unlock works with `ADMIN_PASSCODE` from `.env.local`.
- Journal and bookmark batches generate successfully.
- QR preview/download routes work and encode the public capsule URL only.
- Capsule URLs open the customer `/c/[publicToken]` route.
- Written/tested fulfilment transitions update from Admin.
- Recovery passcode handoff is visible once, then disappears after refresh.
- General CSV export contains fulfilment metadata only and no recovery
  passcodes, PINs, hashes, service-role keys, signed URLs, or media paths.
- Disabled capsules show only neutral unavailable copy on the public route.
- Anon clients cannot read admin tables.
- Anon clients cannot execute Phase 7 admin RPCs after
  `202606160002_harden_admin_rpc_grants.sql`.
- Service-role Admin API access still works after RPC grant hardening.
- Recovery credential rows contain `recovery_code_hash` and metadata only; no
  plaintext recovery passcodes are stored.
- Browser/public assets were scanned for admin/service/recovery secret values.

Commands run during verification:

```sh
npx supabase db push
npx supabase functions deploy capsule-access
npm test
npm run lint
npx tsc --noEmit
npm run build
```

The Supabase CLI reported an available update from `v2.105.0` to `v2.106.0`;
the update was not required for Phase 7 verification. In the Codex sandbox,
`npm run build` may need elevated local permissions because Next/Turbopack binds
an internal local port during CSS compilation.

## Future Integration

Future Shopify, order, and email flows should call the same protected Admin
server boundary. Email recovery delivery should reuse the one-time issuance
path without giving Shopify, CLI, or database clients access to the recovery
pepper.
