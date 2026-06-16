# Phase 6 Owner PIN Recovery

Phase 6 adds one Recovery Passcode per capsule. It works at capsule level for
both bookmark and journal products. It does not add email, accounts, a Viewer
PIN, Shopify integration, or an Admin Dashboard.

## Recovery Passcode

The displayed format is:

```text
M7KP-4QXN-92HF-W8TR
```

The code contains 16 random characters in four groups. The alphabet excludes
ambiguous `I`, `O`, `0`, and `1`. Spaces, hyphens, and letter case are ignored
when a user enters the code.

Formatting and security limits are defined in
`lib/recovery/config.ts`.

## Hashing And Secrets

The Edge Function calculates:

```text
HMAC-SHA-256(
  RECOVERY_CODE_PEPPER_V1,
  "recovery:v1:" + normalizedRecoveryCode
)
```

The database stores only the 32-byte digest and its hash-version number.
Plaintext Recovery Passcodes are never stored in database rows, operations, or
audit records.

`RECOVERY_CODE_PEPPER_V1` must be configured only as an Edge Function secret.
It is not needed by the browser, seed script, issuance CLI, future Admin
application, or database.

To rotate the pepper later:

1. add `RECOVERY_CODE_PEPPER_V2` without deleting V1
2. deploy code that verifies credentials using their stored hash version
3. issue or rotate codes onto V2
4. remove V1 only after no V1 credentials remain

Phase 6 initially issues V1 credentials only.

## Data Model

Migration `202606150002_phase_6_recovery_passcodes.sql` adds:

- `capsule_recovery_credentials`: the active digest and credential state
- `capsule_recovery_attempts`: session-scoped failures and lockout
- `capsule_recovery_failures`: rolling capsule-wide failure timestamps
- `capsule_recovery_operations`: reset idempotency and replacement state
- `capsule_recovery_audit`: non-sensitive security events

All tables have RLS enabled and no browser policies or grants. The normal
authenticated client cannot select recovery digests or mutate recovery state.
The migration grants its recovery RPCs only to `service_role`.

The existing `capsules.owner_recovery_hash` column remains unchanged for
migration safety, is marked deprecated in a schema comment, and is ignored by
all Phase 6 code. `capsule_recovery_credentials` is the sole recovery source of
truth.

## Trusted Identity

Supabase verifies the request JWT before `capsule-access` runs. The Edge
Function derives the technical `auth_user_id` only from that verified JWT and
passes it into the service-role-only transaction.

No recovery action accepts an auth-user ID from browser JSON. Knowing a public
capsule token is insufficient to grant access.

## Initial Issuance

The protected issuance path is:

```text
development CLI or future Admin server
  -> capsule-access issue-recovery-code
  -> Edge Function generates plaintext
  -> Edge Function calculates HMAC
  -> service-role-only RPC stores digest
  -> plaintext returns once
```

Load `.env.local`, then issue by exactly one identifier:

```sh
npm run issue:recovery -- --token PUBLIC_TOKEN
```

or:

```sh
npm run issue:recovery -- --capsule-id CAPSULE_UUID
```

The CLI uses `SUPABASE_SERVICE_ROLE_KEY`, but never receives the recovery
pepper. Its plaintext output is development-only and must be stored securely.
Issuing again immediately invalidates the previous code.

A development capsule can be created with a code:

```sh
npm run seed:capsule -- --journal --recovery
```

Use no `--journal` flag for a bookmark capsule.

Future Admin/email integration reuses the same protected issuance action. The
server will send the once-returned plaintext directly to the recipient and
must not persist it.

## Reset Transaction

The browser sends the public token, Recovery Passcode, new six-digit PIN,
confirmation, and a client-generated operation UUID. It never sends an auth
user ID.

The Edge Function:

1. validates the verified anonymous technical session
2. normalizes and HMACs the submitted code
3. verifies the Recovery Passcode with a service-role-only preflight RPC before
   showing the new PIN step
4. generates and HMACs a new Recovery Passcode during final reset
5. passes digests, PIN, operation ID, and verified user ID to the RPC

The preflight check exists for user experience only: a wrong passcode is shown
immediately, before the user chooses a new Owner PIN. The final reset RPC still
rechecks the submitted passcode, lockouts, and trusted technical session inside
the protected transaction.

The database transaction:

1. locks the capsule and active credential
2. checks session and capsule-wide lockouts
3. compares the fixed-length digest without early byte comparison
4. bcrypt-hashes the new Owner PIN at cost 12
5. deletes every existing `capsule_access` row for the capsule
6. grants owner access only to the verified current session
7. rotates the recovery digest and increments its version
8. clears normal PIN and recovery failure state
9. records non-sensitive audit events
10. records the completed idempotency operation

The Edge Function returns the new plaintext code once. The PIN and all hashes
are omitted from responses and logs.

## Idempotency And Lost Responses

A duplicate completed reset with the same operation UUID, capsule, and
technical session returns `completed` without changing the PIN or rotating the
credential again. The plaintext code cannot be reproduced because it is never
stored.

For a lost success response, the same technical session may request one
replacement using the same operation UUID:

- available for 30 minutes
- usable once
- immediately invalidates the unseen code
- increments the credential version
- repeated calls do not rotate again or reveal a code

If the replacement response is also lost, manual support is required. This
avoids storing plaintext or allowing unlimited rotations.

## Rate Limits

Recovery attempts are independent of normal Owner PIN attempts:

- session scope: five failures, then a 30-minute lockout
- capsule scope: 20 failures in a rolling 24-hour window, then a one-hour
  lockout

Capsule lockouts always use a finite timestamp. Correct recovery clears both
recovery failure scopes. User-facing errors do not disclose which threshold,
token, or code check failed.

## Access Revocation

Successful recovery revokes all previous capsule access rows and grants only
the recovering technical session. It does not delete Supabase anonymous users,
because one technical user may later hold access to multiple capsules.

The browser clears capsule-specific memory metadata and private-media URL
caches before reopening the capsule. Previously issued signed URLs can remain
valid until their short expiry.

## Deployment

Do not apply the migration until its SQL and service-role grants have been
reviewed.

After approval:

1. set `RECOVERY_CODE_PEPPER_V1` as an Edge Function secret
2. apply migration `202606150002_phase_6_recovery_passcodes.sql`
3. apply migration `202606150003_recovery_preflight_verify.sql`
4. deploy `capsule-access`
5. issue development codes for one journal and one bookmark
6. run the recovery and security verification matrix

## Known Limitations

- Phase 6 sends no recovery email.
- There is no production Admin or ownership-verification workflow.
- Losing both the Owner PIN and Recovery Passcode requires later manual
  support.
- Losing both the original reset response and the one permitted replacement
  response also requires manual support.
- Recovery Passcodes are not automatically issued by the migration.
