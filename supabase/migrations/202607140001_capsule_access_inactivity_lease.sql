create or replace function public.capsule_access_lease_duration()
returns interval
language sql
immutable
set search_path = public
as $$
  select interval '1 hour';
$$;

alter table public.capsule_access
add column access_expires_at timestamptz;

update public.capsule_access
set access_expires_at = now() + public.capsule_access_lease_duration()
where access_expires_at is null;

alter table public.capsule_access
alter column access_expires_at
set default (now() + public.capsule_access_lease_duration());

alter table public.capsule_access
alter column access_expires_at set not null;

create index capsule_access_expiry_idx
on public.capsule_access(access_expires_at);

create or replace function public.has_capsule_role(
  target_capsule_id uuid,
  required_role public.capsule_access_role default 'owner'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.capsule_access
    where capsule_id = target_capsule_id
      and auth_user_id = auth.uid()
      and role = required_role
      and access_expires_at > now()
  );
$$;

create or replace function public.touch_capsule_access(
  requested_token text,
  requested_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.capsules;
  current_access public.capsule_access;
  next_expiry timestamptz;
begin
  select * into target
  from public.capsules
  where public_token = requested_token;

  if not found then
    return jsonb_build_object('state', 'notFound');
  end if;

  if public.is_capsule_fulfillment_disabled(target.id) then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into current_access
  from public.capsule_access
  where capsule_id = target.id
    and auth_user_id = requested_user
    and role = 'owner'
  for update;

  if not found then
    return jsonb_build_object(
      'state', case
        when target.status = 'unactivated' then 'unactivated'
        else 'locked'
      end,
      'capsuleId', target.id,
      'productType', target.product_type
    );
  end if;

  if current_access.access_expires_at <= now() then
    delete from public.capsule_access
    where capsule_id = target.id
      and auth_user_id = requested_user;

    return jsonb_build_object(
      'state', 'locked',
      'capsuleId', target.id,
      'productType', target.product_type
    );
  end if;

  update public.capsule_access
  set access_expires_at = now() + public.capsule_access_lease_duration()
  where capsule_id = target.id
    and auth_user_id = requested_user
  returning access_expires_at into next_expiry;

  return jsonb_build_object(
    'state', 'unlocked',
    'capsuleId', target.id,
    'productType', target.product_type,
    'accessExpiresAt', next_expiry
  );
end;
$$;

create or replace function public.inspect_capsule_access(
  requested_token text,
  requested_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.capsules;
  theme_record public.journal_themes;
  has_access boolean := false;
  next_expiry timestamptz;
begin
  select * into target
  from public.capsules
  where public_token = requested_token;

  if not found then
    return jsonb_build_object('state', 'notFound');
  end if;

  if target.journal_theme_id is not null then
    select * into theme_record
    from public.journal_themes
    where id = target.journal_theme_id;
  end if;

  if public.is_capsule_fulfillment_disabled(target.id) then
    return jsonb_build_object('state', 'unavailable');
  end if;

  delete from public.capsule_access
  where capsule_id = target.id
    and auth_user_id = requested_user
    and role = 'owner'
    and access_expires_at <= now();

  update public.capsule_access
  set access_expires_at = now() + public.capsule_access_lease_duration()
  where capsule_id = target.id
    and auth_user_id = requested_user
    and role = 'owner'
    and access_expires_at > now()
  returning access_expires_at into next_expiry;

  has_access := found;

  return jsonb_build_object(
    'state', case
      when has_access then 'unlocked'
      when target.status = 'unactivated' then 'unactivated'
      else 'locked'
    end,
    'capsuleId', target.id,
    'productType', target.product_type,
    'journalTheme', public.journal_theme_json(theme_record),
    'accessExpiresAt', next_expiry
  );
end;
$$;

create or replace function public.activate_capsule_owner(
  requested_token text,
  requested_user uuid,
  requested_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target public.capsules;
  next_expiry timestamptz := now() + public.capsule_access_lease_duration();
begin
  if requested_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  select * into target
  from public.capsules
  where public_token = requested_token
  for update;

  if not found
    or target.status <> 'unactivated'
    or public.is_capsule_fulfillment_disabled(target.id)
  then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  update public.capsules
  set
    status = 'active',
    owner_pin_hash = crypt(requested_pin, gen_salt('bf', 12)),
    activated_at = now()
  where id = target.id;

  insert into public.capsule_access(
    capsule_id,
    auth_user_id,
    role,
    access_expires_at
  )
  values (target.id, requested_user, 'owner', next_expiry)
  on conflict (capsule_id, auth_user_id) do update
  set
    role = 'owner',
    access_expires_at = excluded.access_expires_at;

  return jsonb_build_object(
    'ok', true,
    'state', 'unlocked',
    'capsuleId', target.id,
    'accessExpiresAt', next_expiry
  );
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
set search_path = public, extensions
as $$
declare
  target public.capsules;
  attempts public.capsule_unlock_attempts;
  next_attempts integer;
  next_block timestamptz;
  next_expiry timestamptz;
begin
  select * into target
  from public.capsules
  where public_token = requested_token;

  if not found
    or target.status <> 'active'
    or requested_pin !~ '^[0-9]{6}$'
    or public.is_capsule_fulfillment_disabled(target.id)
  then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select * into attempts
  from public.capsule_unlock_attempts
  where capsule_id = target.id
    and auth_user_id = requested_user;

  if attempts.blocked_until is not null
    and attempts.blocked_until > now()
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'TEMPORARILY_LOCKED',
      'retryAfterSeconds', ceil(
        extract(epoch from attempts.blocked_until - now())
      )
    );
  end if;

  if target.owner_pin_hash = crypt(requested_pin, target.owner_pin_hash) then
    next_expiry := now() + public.capsule_access_lease_duration();

    insert into public.capsule_access(
      capsule_id,
      auth_user_id,
      role,
      access_expires_at
    )
    values (target.id, requested_user, 'owner', next_expiry)
    on conflict (capsule_id, auth_user_id) do update
    set
      role = 'owner',
      access_expires_at = excluded.access_expires_at;

    delete from public.capsule_unlock_attempts
    where capsule_id = target.id
      and auth_user_id = requested_user;

    return jsonb_build_object(
      'ok', true,
      'state', 'unlocked',
      'capsuleId', target.id,
      'accessExpiresAt', next_expiry
    );
  end if;

  next_attempts := coalesce(attempts.failed_attempts, 0) + 1;
  next_block := case
    when next_attempts >= 5 then now() + interval '15 minutes'
    else null
  end;

  insert into public.capsule_unlock_attempts(
    capsule_id,
    auth_user_id,
    failed_attempts,
    blocked_until,
    updated_at
  )
  values (
    target.id,
    requested_user,
    next_attempts,
    next_block,
    now()
  )
  on conflict (capsule_id, auth_user_id) do update
  set
    failed_attempts = excluded.failed_attempts,
    blocked_until = excluded.blocked_until,
    updated_at = now();

  return jsonb_build_object(
    'ok', false,
    'code', case
      when next_block is null then 'ACCESS_DENIED'
      else 'TEMPORARILY_LOCKED'
    end,
    'retryAfterSeconds', case
      when next_block is null then null
      else 900
    end
  );
end;
$$;

revoke all on function public.capsule_access_lease_duration() from public;
revoke all on function public.has_capsule_role(
  uuid,
  public.capsule_access_role
) from public;
revoke all on function public.touch_capsule_access(text, uuid) from public;
revoke all on function public.inspect_capsule_access(text, uuid) from public;
revoke all on function public.activate_capsule_owner(text, uuid, text) from public;
revoke all on function public.unlock_capsule_owner(text, uuid, text) from public;

grant execute on function public.has_capsule_role(
  uuid,
  public.capsule_access_role
) to authenticated;
grant execute on function public.touch_capsule_access(text, uuid) to service_role;
grant execute on function public.inspect_capsule_access(text, uuid) to service_role;
grant execute on function public.activate_capsule_owner(text, uuid, text) to service_role;
grant execute on function public.unlock_capsule_owner(text, uuid, text) to service_role;
