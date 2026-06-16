comment on column public.capsules.owner_recovery_hash is
  'Deprecated and unused. Phase 6 recovery uses capsule_recovery_credentials exclusively.';

create table public.capsule_recovery_credentials (
  capsule_id uuid primary key references public.capsules(id) on delete cascade,
  recovery_code_hash bytea not null unique
    check (octet_length(recovery_code_hash) = 32),
  code_version integer not null check (code_version > 0),
  hash_version integer not null check (hash_version > 0),
  issued_at timestamptz not null default now(),
  last_used_at timestamptz,
  rotated_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.capsule_recovery_attempts (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (capsule_id, auth_user_id)
);

create table public.capsule_recovery_failures (
  id bigint generated always as identity primary key,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  failed_at timestamptz not null default now()
);

create index capsule_recovery_failures_capsule_time_idx
on public.capsule_recovery_failures(capsule_id, failed_at desc);

create table public.capsule_recovery_operations (
  idempotency_key uuid primary key,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('completed')),
  credential_version integer not null check (credential_version > 0),
  replacement_used boolean not null default false,
  replacement_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.capsule_recovery_audit (
  id bigint generated always as identity primary key,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'recovery_code_issued',
      'recovery_attempt_failed',
      'recovery_locked',
      'pin_reset_succeeded',
      'recovery_code_rotated',
      'recovery_code_revoked'
    )
  ),
  auth_user_id uuid references auth.users(id) on delete set null,
  code_version integer,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.capsule_recovery_credentials enable row level security;
alter table public.capsule_recovery_attempts enable row level security;
alter table public.capsule_recovery_failures enable row level security;
alter table public.capsule_recovery_operations enable row level security;
alter table public.capsule_recovery_audit enable row level security;

revoke all on public.capsule_recovery_credentials from anon, authenticated;
revoke all on public.capsule_recovery_attempts from anon, authenticated;
revoke all on public.capsule_recovery_failures from anon, authenticated;
revoke all on public.capsule_recovery_operations from anon, authenticated;
revoke all on public.capsule_recovery_audit from anon, authenticated;

create trigger capsule_recovery_credentials_set_updated_at
before update on public.capsule_recovery_credentials
for each row execute function public.set_updated_at();

create trigger capsule_recovery_attempts_set_updated_at
before update on public.capsule_recovery_attempts
for each row execute function public.set_updated_at();

create trigger capsule_recovery_operations_set_updated_at
before update on public.capsule_recovery_operations
for each row execute function public.set_updated_at();

create or replace function public.secure_recovery_hash_equal(
  left_hash bytea,
  right_hash bytea
)
returns boolean
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  difference integer := 0;
  index_value integer;
begin
  if octet_length(left_hash) <> 32 or octet_length(right_hash) <> 32 then
    return false;
  end if;
  for index_value in 0..31 loop
    difference := difference | (
      get_byte(left_hash, index_value) # get_byte(right_hash, index_value)
    );
  end loop;
  return difference = 0;
end;
$$;

revoke all on function public.secure_recovery_hash_equal(bytea, bytea)
from public;

create or replace function public.inspect_capsule_recovery(
  requested_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule_id uuid;
  credential_exists boolean;
begin
  select id into target_capsule_id
  from public.capsules
  where public_token = requested_token
    and status = 'active';

  if target_capsule_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  select exists (
    select 1
    from public.capsule_recovery_credentials
    where capsule_id = target_capsule_id
  ) into credential_exists;

  return jsonb_build_object(
    'ok', true,
    'recoveryEnabled', credential_exists
  );
end;
$$;

create or replace function public.issue_capsule_recovery_code(
  requested_token text,
  requested_capsule_id uuid,
  requested_code_hash_hex text,
  requested_hash_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_capsule public.capsules;
  existing_credential public.capsule_recovery_credentials;
  next_version integer;
begin
  if (requested_token is null) = (requested_capsule_id is null)
    or requested_code_hash_hex is null
    or requested_code_hash_hex !~ '^[0-9a-f]{64}$'
    or requested_hash_version is null
    or requested_hash_version < 1
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  select * into target_capsule
  from public.capsules
  where (
    requested_token is not null
    and public_token = requested_token
  ) or (
    requested_capsule_id is not null
    and id = requested_capsule_id
  )
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE');
  end if;

  select * into existing_credential
  from public.capsule_recovery_credentials
  where capsule_id = target_capsule.id
  for update;

  next_version := coalesce(existing_credential.code_version, 0) + 1;

  if existing_credential.capsule_id is not null then
    insert into public.capsule_recovery_audit(
      capsule_id, event_type, code_version
    ) values (
      target_capsule.id,
      'recovery_code_revoked',
      existing_credential.code_version
    );
  end if;

  insert into public.capsule_recovery_credentials(
    capsule_id,
    recovery_code_hash,
    code_version,
    hash_version,
    issued_at,
    last_used_at,
    rotated_at,
    locked_until
  ) values (
    target_capsule.id,
    decode(requested_code_hash_hex, 'hex'),
    next_version,
    requested_hash_version,
    now(),
    null,
    case when existing_credential.capsule_id is null then null else now() end,
    null
  )
  on conflict (capsule_id) do update set
    recovery_code_hash = excluded.recovery_code_hash,
    code_version = excluded.code_version,
    hash_version = excluded.hash_version,
    issued_at = excluded.issued_at,
    last_used_at = null,
    rotated_at = excluded.rotated_at,
    locked_until = null,
    updated_at = now();

  delete from public.capsule_recovery_attempts
  where capsule_id = target_capsule.id;
  delete from public.capsule_recovery_failures
  where capsule_id = target_capsule.id;

  insert into public.capsule_recovery_audit(
    capsule_id, event_type, code_version
  ) values (
    target_capsule.id,
    'recovery_code_issued',
    next_version
  );

  return jsonb_build_object(
    'ok', true,
    'capsuleId', target_capsule.id,
    'codeVersion', next_version
  );
end;
$$;

create or replace function public.reset_capsule_owner_with_recovery(
  requested_token text,
  requested_user uuid,
  requested_operation_id uuid,
  requested_code_hash_hex text,
  requested_new_pin text,
  requested_new_code_hash_hex text,
  requested_hash_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_capsule public.capsules;
  credential public.capsule_recovery_credentials;
  attempts public.capsule_recovery_attempts;
  existing_operation public.capsule_recovery_operations;
  next_session_attempts integer;
  recent_capsule_failures integer;
  next_version integer;
  session_lock timestamptz;
  capsule_lock timestamptz;
begin
  if requested_user is null
    or requested_operation_id is null
    or requested_code_hash_hex is null
    or requested_code_hash_hex !~ '^[0-9a-f]{64}$'
    or requested_new_code_hash_hex is null
    or requested_new_code_hash_hex !~ '^[0-9a-f]{64}$'
    or requested_new_pin is null
    or requested_new_pin !~ '^[0-9]{6}$'
    or requested_hash_version is null
    or requested_hash_version < 1
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  select * into target_capsule
  from public.capsules
  where public_token = requested_token
  for update;

  if not found or target_capsule.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select * into existing_operation
  from public.capsule_recovery_operations
  where idempotency_key = requested_operation_id
  for update;

  if existing_operation.idempotency_key is not null then
    if existing_operation.capsule_id <> target_capsule.id
      or existing_operation.auth_user_id <> requested_user
    then
      return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'completed',
      'duplicate', true,
      'capsuleId', target_capsule.id,
      'codeVersion', existing_operation.credential_version,
      'replacementAvailable',
        not existing_operation.replacement_used
        and existing_operation.replacement_expires_at > now()
    );
  end if;

  select * into credential
  from public.capsule_recovery_credentials
  where capsule_id = target_capsule.id
  for update;

  if credential.capsule_id is null then
    return jsonb_build_object('ok', false, 'code', 'RECOVERY_NOT_ENABLED');
  end if;

  select * into attempts
  from public.capsule_recovery_attempts
  where capsule_id = target_capsule.id
    and auth_user_id = requested_user
  for update;

  if (credential.locked_until is not null and credential.locked_until > now())
    or (attempts.locked_until is not null and attempts.locked_until > now())
  then
    return jsonb_build_object('ok', false, 'code', 'TEMPORARILY_LOCKED');
  end if;

  if not public.secure_recovery_hash_equal(
    credential.recovery_code_hash,
    decode(requested_code_hash_hex, 'hex')
  ) then
    next_session_attempts := coalesce(attempts.failed_attempts, 0) + 1;
    session_lock := case
      when next_session_attempts >= 5 then now() + interval '30 minutes'
      else null
    end;

    insert into public.capsule_recovery_attempts(
      capsule_id,
      auth_user_id,
      failed_attempts,
      locked_until
    ) values (
      target_capsule.id,
      requested_user,
      next_session_attempts,
      session_lock
    )
    on conflict (capsule_id, auth_user_id) do update set
      failed_attempts = excluded.failed_attempts,
      locked_until = excluded.locked_until,
      updated_at = now();

    insert into public.capsule_recovery_failures(
      capsule_id, auth_user_id
    ) values (
      target_capsule.id, requested_user
    );

    select count(*) into recent_capsule_failures
    from public.capsule_recovery_failures
    where capsule_id = target_capsule.id
      and failed_at >= now() - interval '24 hours';

    capsule_lock := case
      when recent_capsule_failures >= 20 then now() + interval '1 hour'
      else null
    end;

    if capsule_lock is not null then
      update public.capsule_recovery_credentials
      set locked_until = capsule_lock
      where capsule_id = target_capsule.id;
    end if;

    insert into public.capsule_recovery_audit(
      capsule_id,
      event_type,
      auth_user_id,
      code_version,
      metadata
    ) values (
      target_capsule.id,
      'recovery_attempt_failed',
      requested_user,
      credential.code_version,
      jsonb_build_object(
        'sessionThresholdReached', session_lock is not null,
        'capsuleThresholdReached', capsule_lock is not null
      )
    );

    if session_lock is not null or capsule_lock is not null then
      insert into public.capsule_recovery_audit(
        capsule_id,
        event_type,
        auth_user_id,
        code_version,
        metadata
      ) values (
        target_capsule.id,
        'recovery_locked',
        requested_user,
        credential.code_version,
        jsonb_build_object(
          'scope', case
            when capsule_lock is not null then 'capsule'
            else 'session'
          end
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'code', case
        when session_lock is not null or capsule_lock is not null
          then 'TEMPORARILY_LOCKED'
        else 'ACCESS_DENIED'
      end
    );
  end if;

  next_version := credential.code_version + 1;

  update public.capsules
  set owner_pin_hash = extensions.crypt(
    requested_new_pin,
    extensions.gen_salt('bf', 12)
  )
  where id = target_capsule.id;

  delete from public.capsule_access
  where capsule_id = target_capsule.id;

  insert into public.capsule_access(capsule_id, auth_user_id, role)
  values (target_capsule.id, requested_user, 'owner');

  update public.capsule_recovery_credentials
  set
    recovery_code_hash = decode(requested_new_code_hash_hex, 'hex'),
    code_version = next_version,
    hash_version = requested_hash_version,
    issued_at = now(),
    last_used_at = now(),
    rotated_at = now(),
    locked_until = null,
    updated_at = now()
  where capsule_id = target_capsule.id;

  delete from public.capsule_recovery_attempts
  where capsule_id = target_capsule.id;
  delete from public.capsule_recovery_failures
  where capsule_id = target_capsule.id;
  delete from public.capsule_unlock_attempts
  where capsule_id = target_capsule.id;

  insert into public.capsule_recovery_operations(
    idempotency_key,
    capsule_id,
    auth_user_id,
    status,
    credential_version,
    replacement_expires_at
  ) values (
    requested_operation_id,
    target_capsule.id,
    requested_user,
    'completed',
    next_version,
    now() + interval '30 minutes'
  );

  insert into public.capsule_recovery_audit(
    capsule_id, event_type, auth_user_id, code_version
  ) values
    (
      target_capsule.id,
      'recovery_code_revoked',
      requested_user,
      credential.code_version
    ),
    (
      target_capsule.id,
      'pin_reset_succeeded',
      requested_user,
      next_version
    ),
    (
      target_capsule.id,
      'recovery_code_rotated',
      requested_user,
      next_version
    );

  return jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'duplicate', false,
    'capsuleId', target_capsule.id,
    'codeVersion', next_version,
    'replacementAvailable', true
  );
end;
$$;

create or replace function public.replace_lost_recovery_code(
  requested_token text,
  requested_user uuid,
  requested_operation_id uuid,
  requested_new_code_hash_hex text,
  requested_hash_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule_id uuid;
  operation_record public.capsule_recovery_operations;
  credential public.capsule_recovery_credentials;
  next_version integer;
begin
  if requested_user is null
    or requested_operation_id is null
    or requested_new_code_hash_hex is null
    or requested_new_code_hash_hex !~ '^[0-9a-f]{64}$'
    or requested_hash_version is null
    or requested_hash_version < 1
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  select id into target_capsule_id
  from public.capsules
  where public_token = requested_token
    and status = 'active'
  for update;

  if target_capsule_id is null then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select * into operation_record
  from public.capsule_recovery_operations
  where idempotency_key = requested_operation_id
  for update;

  if operation_record.idempotency_key is null
    or operation_record.capsule_id <> target_capsule_id
    or operation_record.auth_user_id <> requested_user
  then
    return jsonb_build_object('ok', false, 'code', 'REPLACEMENT_UNAVAILABLE');
  end if;

  if operation_record.replacement_used then
    return jsonb_build_object(
      'ok', true,
      'status', 'completed',
      'duplicate', true,
      'capsuleId', target_capsule_id,
      'codeVersion', operation_record.credential_version,
      'replacementAvailable', false
    );
  end if;

  if operation_record.replacement_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'REPLACEMENT_UNAVAILABLE');
  end if;

  select * into credential
  from public.capsule_recovery_credentials
  where capsule_id = target_capsule_id
  for update;

  if credential.capsule_id is null
    or credential.code_version <> operation_record.credential_version
  then
    return jsonb_build_object('ok', false, 'code', 'REPLACEMENT_UNAVAILABLE');
  end if;

  next_version := credential.code_version + 1;

  update public.capsule_recovery_credentials
  set
    recovery_code_hash = decode(requested_new_code_hash_hex, 'hex'),
    code_version = next_version,
    hash_version = requested_hash_version,
    issued_at = now(),
    rotated_at = now(),
    updated_at = now()
  where capsule_id = target_capsule_id;

  update public.capsule_recovery_operations
  set
    replacement_used = true,
    credential_version = next_version,
    updated_at = now()
  where idempotency_key = requested_operation_id;

  insert into public.capsule_recovery_audit(
    capsule_id, event_type, auth_user_id, code_version, metadata
  ) values
    (
      target_capsule_id,
      'recovery_code_revoked',
      requested_user,
      credential.code_version,
      '{"reason":"lost_response_replacement"}'::jsonb
    ),
    (
      target_capsule_id,
      'recovery_code_rotated',
      requested_user,
      next_version,
      '{"reason":"lost_response_replacement"}'::jsonb
    );

  return jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'duplicate', false,
    'capsuleId', target_capsule_id,
    'codeVersion', next_version,
    'replacementAvailable', false
  );
end;
$$;

revoke all on function public.inspect_capsule_recovery(text) from public;
revoke all on function public.issue_capsule_recovery_code(
  text, uuid, text, integer
) from public;
revoke all on function public.reset_capsule_owner_with_recovery(
  text, uuid, uuid, text, text, text, integer
) from public;
revoke all on function public.replace_lost_recovery_code(
  text, uuid, uuid, text, integer
) from public;

grant execute on function public.inspect_capsule_recovery(text)
to service_role;
grant execute on function public.issue_capsule_recovery_code(
  text, uuid, text, integer
) to service_role;
grant execute on function public.reset_capsule_owner_with_recovery(
  text, uuid, uuid, text, text, text, integer
) to service_role;
grant execute on function public.replace_lost_recovery_code(
  text, uuid, uuid, text, integer
) to service_role;
