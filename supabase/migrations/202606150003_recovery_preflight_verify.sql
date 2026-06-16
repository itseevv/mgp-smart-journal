create or replace function public.verify_capsule_recovery_code(
  requested_token text,
  requested_user uuid,
  requested_code_hash_hex text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  credential public.capsule_recovery_credentials;
  attempts public.capsule_recovery_attempts;
  next_session_attempts integer;
  recent_capsule_failures integer;
  session_lock timestamptz;
  capsule_lock timestamptz;
begin
  if requested_user is null
    or requested_code_hash_hex is null
    or requested_code_hash_hex !~ '^[0-9a-f]{64}$'
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

  if public.secure_recovery_hash_equal(
    credential.recovery_code_hash,
    decode(requested_code_hash_hex, 'hex')
  ) then
    return jsonb_build_object(
      'ok', true,
      'capsuleId', target_capsule.id,
      'codeVersion', credential.code_version
    );
  end if;

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
      'step', 'preflight',
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
        'step', 'preflight',
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
end;
$$;

revoke all on function public.verify_capsule_recovery_code(
  text, uuid, text
) from public;

grant execute on function public.verify_capsule_recovery_code(
  text, uuid, text
) to service_role;
