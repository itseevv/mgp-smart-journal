create or replace function public.activate_capsule_owner(
  requested_token text,
  requested_user uuid,
  requested_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target public.capsules;
begin
  if requested_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;
  select * into target from public.capsules where public_token = requested_token for update;
  if not found or target.status <> 'unactivated' then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  update public.capsules set
    status = 'active',
    owner_pin_hash = extensions.crypt(
      requested_pin,
      extensions.gen_salt('bf', 12)
    ),
    activated_at = now()
  where id = target.id;
  insert into public.capsule_access(capsule_id, auth_user_id, role)
  values (target.id, requested_user, 'owner')
  on conflict (capsule_id, auth_user_id) do update set role = 'owner';
  return jsonb_build_object('ok', true, 'capsuleId', target.id);
end;
$$;

create or replace function public.unlock_capsule_owner(
  requested_token text,
  requested_user uuid,
  requested_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.capsules;
  attempts public.capsule_unlock_attempts;
  next_attempts integer;
  next_block timestamptz;
begin
  select * into target from public.capsules where public_token = requested_token;
  if not found or target.status <> 'active' or requested_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  select * into attempts from public.capsule_unlock_attempts
  where capsule_id = target.id and auth_user_id = requested_user;
  if attempts.blocked_until is not null and attempts.blocked_until > now() then
    return jsonb_build_object(
      'ok', false, 'code', 'TEMPORARILY_LOCKED',
      'retryAfterSeconds', ceil(extract(epoch from attempts.blocked_until - now()))
    );
  end if;
  if target.owner_pin_hash = extensions.crypt(
    requested_pin,
    target.owner_pin_hash
  ) then
    insert into public.capsule_access(capsule_id, auth_user_id, role)
    values (target.id, requested_user, 'owner')
    on conflict (capsule_id, auth_user_id) do update set role = 'owner';
    delete from public.capsule_unlock_attempts
    where capsule_id = target.id and auth_user_id = requested_user;
    return jsonb_build_object('ok', true, 'capsuleId', target.id);
  end if;
  next_attempts := coalesce(attempts.failed_attempts, 0) + 1;
  next_block := case when next_attempts >= 5 then now() + interval '15 minutes' else null end;
  insert into public.capsule_unlock_attempts(
    capsule_id, auth_user_id, failed_attempts, blocked_until, updated_at
  ) values (target.id, requested_user, next_attempts, next_block, now())
  on conflict (capsule_id, auth_user_id) do update set
    failed_attempts = excluded.failed_attempts,
    blocked_until = excluded.blocked_until,
    updated_at = now();
  return jsonb_build_object(
    'ok', false,
    'code', case when next_block is null then 'ACCESS_DENIED' else 'TEMPORARILY_LOCKED' end,
    'retryAfterSeconds', case when next_block is null then null else 900 end
  );
end;
$$;

revoke all on function public.activate_capsule_owner(text, uuid, text) from public;
revoke all on function public.unlock_capsule_owner(text, uuid, text) from public;
grant execute on function public.activate_capsule_owner(text, uuid, text) to service_role;
grant execute on function public.unlock_capsule_owner(text, uuid, text) to service_role;
