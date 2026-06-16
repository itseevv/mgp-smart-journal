create type public.capsule_batch_status as enum ('generated');
create type public.capsule_fulfillment_status as enum (
  'generated',
  'written',
  'tested',
  'packed',
  'shipped',
  'disabled'
);
create type public.nfc_write_status as enum ('pending', 'written', 'tested');
create type public.qr_status as enum ('generated');

create table public.capsule_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null check (length(trim(batch_name)) between 1 and 120),
  product_type public.capsule_product_type not null,
  quantity integer not null check (quantity between 1 and 500),
  status public.capsule_batch_status not null default 'generated',
  serial_prefix text not null check (serial_prefix ~ '^[A-Z0-9]{3,8}$'),
  serial_year integer not null check (serial_year between 2020 and 2100),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.capsule_serial_counters (
  serial_prefix text not null check (serial_prefix ~ '^[A-Z0-9]{3,8}$'),
  serial_year integer not null check (serial_year between 2020 and 2100),
  next_value integer not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (serial_prefix, serial_year)
);

create table public.capsule_fulfillment (
  capsule_id uuid primary key references public.capsules(id) on delete cascade,
  batch_id uuid not null references public.capsule_batches(id) on delete restrict,
  serial_number text not null unique check (
    serial_number ~ '^[A-Z0-9]{3,8}-[0-9]{4}-[0-9]{4,}$'
  ),
  fulfillment_status public.capsule_fulfillment_status not null default 'generated',
  nfc_write_status public.nfc_write_status not null default 'pending',
  qr_status public.qr_status not null default 'generated',
  disabled_at timestamptz,
  disabled_reason text,
  written_at timestamptz,
  tested_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (fulfillment_status = 'disabled' and disabled_at is not null and length(trim(disabled_reason)) between 1 and 500)
    or (fulfillment_status <> 'disabled' and disabled_at is null and disabled_reason is null)
  )
);

create table public.admin_action_audit (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (length(trim(action_type)) between 1 and 80),
  capsule_id uuid references public.capsules(id) on delete set null,
  batch_id uuid references public.capsule_batches(id) on delete set null,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.capsule_batches enable row level security;
alter table public.capsule_serial_counters enable row level security;
alter table public.capsule_fulfillment enable row level security;
alter table public.admin_action_audit enable row level security;

revoke all on public.capsule_batches from anon, authenticated;
revoke all on public.capsule_serial_counters from anon, authenticated;
revoke all on public.capsule_fulfillment from anon, authenticated;
revoke all on public.admin_action_audit from anon, authenticated;

create trigger capsule_batches_set_updated_at
before update on public.capsule_batches
for each row execute function public.set_updated_at();

create trigger capsule_serial_counters_set_updated_at
before update on public.capsule_serial_counters
for each row execute function public.set_updated_at();

create trigger capsule_fulfillment_set_updated_at
before update on public.capsule_fulfillment
for each row execute function public.set_updated_at();

create or replace function public.is_capsule_fulfillment_disabled(
  requested_capsule_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.capsule_fulfillment fulfillment
    where fulfillment.capsule_id = requested_capsule_id
      and fulfillment.fulfillment_status = 'disabled'
  );
$$;

revoke all on function public.is_capsule_fulfillment_disabled(uuid) from public;
grant execute on function public.is_capsule_fulfillment_disabled(uuid) to service_role;

create or replace function public.admin_generate_capsule_batch(
  requested_batch_name text,
  requested_product_type public.capsule_product_type,
  requested_quantity integer,
  requested_serial_prefix text default null,
  requested_notes text default null,
  requested_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  normalized_prefix text;
  batch_year integer;
  start_serial integer;
  batch_id uuid;
  token text;
  serial text;
  capsule_id uuid;
  created_capsules jsonb := '[]'::jsonb;
  token_attempt integer;
  index_value integer;
begin
  normalized_name := trim(coalesce(requested_batch_name, ''));
  normalized_prefix := upper(trim(coalesce(
    requested_serial_prefix,
    case
      when requested_product_type = 'journal' then 'JNL'
      when requested_product_type = 'bookmark' then 'BMK'
      else null
    end
  )));
  batch_year := extract(year from now())::integer;

  if normalized_name = ''
    or length(normalized_name) > 120
    or requested_product_type is null
    or requested_quantity is null
    or requested_quantity < 1
    or requested_quantity > 500
    or normalized_prefix !~ '^[A-Z0-9]{3,8}$'
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  insert into public.capsule_serial_counters(
    serial_prefix,
    serial_year,
    next_value
  ) values (
    normalized_prefix,
    batch_year,
    1
  )
  on conflict (serial_prefix, serial_year) do nothing;

  select next_value into start_serial
  from public.capsule_serial_counters
  where serial_prefix = normalized_prefix
    and serial_year = batch_year
  for update;

  update public.capsule_serial_counters
  set next_value = next_value + requested_quantity
  where serial_prefix = normalized_prefix
    and serial_year = batch_year;

  insert into public.capsule_batches(
    batch_name,
    product_type,
    quantity,
    serial_prefix,
    serial_year,
    notes,
    created_by
  ) values (
    normalized_name,
    requested_product_type,
    requested_quantity,
    normalized_prefix,
    batch_year,
    nullif(trim(coalesce(requested_notes, '')), ''),
    nullif(trim(coalesce(requested_actor, '')), '')
  )
  returning id into batch_id;

  for index_value in 0..(requested_quantity - 1) loop
    serial := normalized_prefix || '-' || batch_year || '-' ||
      lpad((start_serial + index_value)::text, 4, '0');

    token_attempt := 0;
    loop
      token_attempt := token_attempt + 1;
      token := encode(gen_random_bytes(24), 'hex');
      begin
        insert into public.capsules(public_token, product_type, status)
        values (token, requested_product_type, 'unactivated')
        returning id into capsule_id;
        exit;
      exception
        when unique_violation then
          if token_attempt >= 5 then
            raise exception 'public token collision';
          end if;
      end;
    end loop;

    insert into public.capsule_fulfillment(
      capsule_id,
      batch_id,
      serial_number
    ) values (
      capsule_id,
      batch_id,
      serial
    );

    created_capsules := created_capsules || jsonb_build_array(
      jsonb_build_object(
        'id', capsule_id,
        'publicToken', token,
        'serialNumber', serial,
        'productType', requested_product_type
      )
    );
  end loop;

  insert into public.admin_action_audit(
    action_type,
    batch_id,
    actor,
    metadata
  ) values (
    'capsule_batch_generated',
    batch_id,
    nullif(trim(coalesce(requested_actor, '')), ''),
    jsonb_build_object(
      'quantity', requested_quantity,
      'productType', requested_product_type,
      'serialPrefix', normalized_prefix
    )
  );

  return jsonb_build_object(
    'ok', true,
    'batchId', batch_id,
    'capsules', created_capsules
  );
end;
$$;

create or replace function public.admin_list_capsules(
  requested_product_type public.capsule_product_type default null,
  requested_batch_id uuid default null,
  requested_fulfillment_status public.capsule_fulfillment_status default null,
  requested_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  search_term text;
begin
  search_term := lower(trim(coalesce(requested_search, '')));

  select jsonb_build_object(
    'ok', true,
    'batches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', batch.id,
          'batchName', batch.batch_name,
          'productType', batch.product_type,
          'quantity', batch.quantity,
          'status', batch.status,
          'createdAt', batch.created_at
        )
        order by batch.created_at desc, batch.id desc
      )
      from public.capsule_batches batch
    ), '[]'::jsonb),
    'capsules', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', capsule.id,
        'batchId', batch.id,
        'batchName', batch.batch_name,
        'serialNumber', fulfillment.serial_number,
        'productType', capsule.product_type,
        'publicToken', capsule.public_token,
        'activationStatus', capsule.status,
        'fulfillmentStatus', fulfillment.fulfillment_status,
        'nfcWriteStatus', fulfillment.nfc_write_status,
        'qrStatus', fulfillment.qr_status,
        'recoveryStatus', case
          when recovery.capsule_id is null then 'not_issued'
          else 'issued'
        end,
        'createdAt', capsule.created_at,
        'activatedAt', capsule.activated_at,
        'memoryCount', coalesce(stats.memory_count, 0),
        'photoCount', coalesce(stats.photo_count, 0),
        'voiceMemoCount', coalesce(stats.voice_memo_count, 0)
      )
      order by fulfillment.created_at desc, fulfillment.serial_number desc
    ) filter (where capsule.id is not null), '[]'::jsonb)
  ) into result
  from public.capsule_fulfillment fulfillment
  join public.capsules capsule on capsule.id = fulfillment.capsule_id
  join public.capsule_batches batch on batch.id = fulfillment.batch_id
  left join public.capsule_recovery_credentials recovery
    on recovery.capsule_id = capsule.id
  left join lateral (
    select
      (
        select count(*)::integer
        from public.memories memory
        where memory.capsule_id = capsule.id
      ) memory_count,
      (
        select count(*)::integer
        from public.photos photo
        join public.memories memory on memory.id = photo.memory_id
        where memory.capsule_id = capsule.id
      ) photo_count,
      (
        select count(*)::integer
        from public.voice_memos memo
        join public.memories memory on memory.id = memo.memory_id
        where memory.capsule_id = capsule.id
      ) voice_memo_count
  ) stats on true
  where (requested_product_type is null or capsule.product_type = requested_product_type)
    and (requested_batch_id is null or batch.id = requested_batch_id)
    and (
      requested_fulfillment_status is null
      or fulfillment.fulfillment_status = requested_fulfillment_status
    )
    and (
      search_term = ''
      or lower(fulfillment.serial_number) like '%' || search_term || '%'
      or lower(capsule.public_token) like '%' || search_term || '%'
    );

  return result;
end;
$$;

create or replace function public.admin_get_capsule_detail(
  requested_capsule_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'ok', true,
    'capsule', jsonb_build_object(
      'id', capsule.id,
      'batchId', batch.id,
      'batchName', batch.batch_name,
      'serialNumber', fulfillment.serial_number,
      'productType', capsule.product_type,
      'publicToken', capsule.public_token,
      'activationStatus', capsule.status,
      'fulfillmentStatus', fulfillment.fulfillment_status,
      'nfcWriteStatus', fulfillment.nfc_write_status,
      'qrStatus', fulfillment.qr_status,
      'disabledAt', fulfillment.disabled_at,
      'disabledReason', fulfillment.disabled_reason,
      'writtenAt', fulfillment.written_at,
      'testedAt', fulfillment.tested_at,
      'createdAt', capsule.created_at,
      'activatedAt', capsule.activated_at,
      'recoveryStatus', case
        when recovery.capsule_id is null then 'not_issued'
        else 'issued'
      end,
      'recoveryIssuedAt', recovery.issued_at,
      'recoveryRotatedAt', recovery.rotated_at,
      'recoveryCodeVersion', recovery.code_version,
      'memoryCount', coalesce(stats.memory_count, 0),
      'photoCount', coalesce(stats.photo_count, 0),
      'voiceMemoCount', coalesce(stats.voice_memo_count, 0),
      'storageEstimateBytes', coalesce(stats.storage_bytes, 0)
    )
  ) into result
  from public.capsule_fulfillment fulfillment
  join public.capsules capsule on capsule.id = fulfillment.capsule_id
  join public.capsule_batches batch on batch.id = fulfillment.batch_id
  left join public.capsule_recovery_credentials recovery
    on recovery.capsule_id = capsule.id
  left join lateral (
    select
      (
        select count(*)::integer
        from public.memories memory
        where memory.capsule_id = capsule.id
      ) memory_count,
      (
        select count(*)::integer
        from public.photos photo
        join public.memories memory on memory.id = photo.memory_id
        where memory.capsule_id = capsule.id
      ) photo_count,
      (
        select count(*)::integer
        from public.voice_memos memo
        join public.memories memory on memory.id = memo.memory_id
        where memory.capsule_id = capsule.id
      ) voice_memo_count,
      (
        select coalesce(sum(photo.size_bytes), 0)
          + coalesce(sum(photo.thumbnail_size_bytes), 0)
        from public.photos photo
        join public.memories memory on memory.id = photo.memory_id
        where memory.capsule_id = capsule.id
      ) + (
        select coalesce(sum(memo.size_bytes), 0)
        from public.voice_memos memo
        join public.memories memory on memory.id = memo.memory_id
        where memory.capsule_id = capsule.id
      ) storage_bytes
  ) stats on true
  where capsule.id = requested_capsule_id;

  return coalesce(result, jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
end;
$$;

create or replace function public.admin_update_capsule_fulfillment(
  requested_capsule_id uuid,
  requested_action text,
  requested_reason text default null,
  requested_confirm_activated boolean default false,
  requested_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  capsule_record public.capsules;
  fulfillment_record public.capsule_fulfillment;
  next_status public.capsule_fulfillment_status;
  next_nfc_status public.nfc_write_status;
  reason text;
begin
  select * into capsule_record
  from public.capsules
  where id = requested_capsule_id
  for update;

  select * into fulfillment_record
  from public.capsule_fulfillment
  where capsule_id = requested_capsule_id
  for update;

  if capsule_record.id is null or fulfillment_record.capsule_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if requested_action = 'mark_written' then
    if fulfillment_record.fulfillment_status <> 'generated' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION');
    end if;
    next_status := 'written';
    next_nfc_status := 'written';
    update public.capsule_fulfillment
    set fulfillment_status = next_status,
        nfc_write_status = next_nfc_status,
        written_at = coalesce(written_at, now())
    where capsule_id = requested_capsule_id;
  elsif requested_action = 'mark_tested' then
    if fulfillment_record.fulfillment_status not in ('written', 'tested') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION');
    end if;
    next_status := 'tested';
    next_nfc_status := 'tested';
    update public.capsule_fulfillment
    set fulfillment_status = next_status,
        nfc_write_status = next_nfc_status,
        written_at = coalesce(written_at, now()),
        tested_at = coalesce(tested_at, now())
    where capsule_id = requested_capsule_id;
  elsif requested_action = 'disable' then
    reason := trim(coalesce(requested_reason, ''));
    if reason = '' or length(reason) > 500 then
      return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
    end if;
    if capsule_record.status = 'active' and requested_confirm_activated is not true then
      return jsonb_build_object('ok', false, 'code', 'ACTIVATED_CONFIRMATION_REQUIRED');
    end if;
    update public.capsule_fulfillment
    set fulfillment_status = 'disabled',
        disabled_at = now(),
        disabled_reason = reason
    where capsule_id = requested_capsule_id;
  elsif requested_action = 'reenable' then
    if fulfillment_record.fulfillment_status <> 'disabled'
      or capsule_record.status <> 'unactivated'
    then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION');
    end if;
    update public.capsule_fulfillment
    set fulfillment_status = coalesce(
          case
            when tested_at is not null then 'tested'::public.capsule_fulfillment_status
            when written_at is not null then 'written'::public.capsule_fulfillment_status
            else 'generated'::public.capsule_fulfillment_status
          end,
          'generated'::public.capsule_fulfillment_status
        ),
        disabled_at = null,
        disabled_reason = null
    where capsule_id = requested_capsule_id;
  else
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  insert into public.admin_action_audit(
    action_type,
    capsule_id,
    batch_id,
    actor,
    metadata
  ) values (
    'capsule_fulfillment_' || requested_action,
    requested_capsule_id,
    fulfillment_record.batch_id,
    nullif(trim(coalesce(requested_actor, '')), ''),
    jsonb_build_object(
      'fromStatus', fulfillment_record.fulfillment_status,
      'capsuleActivationStatus', capsule_record.status,
      'hasReason', requested_reason is not null and trim(requested_reason) <> ''
    )
  );

  return public.admin_get_capsule_detail(requested_capsule_id);
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
  has_access boolean;
begin
  select * into target from public.capsules where public_token = requested_token;
  if not found then return jsonb_build_object('state', 'notFound'); end if;

  if public.is_capsule_fulfillment_disabled(target.id) then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select exists (
    select 1 from public.capsule_access
    where capsule_id = target.id and auth_user_id = requested_user and role = 'owner'
  ) into has_access;
  return jsonb_build_object(
    'state', case
      when has_access then 'unlocked'
      when target.status = 'unactivated' then 'unactivated'
      else 'locked'
    end,
    'capsuleId', target.id,
    'productType', target.product_type
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
declare target public.capsules;
begin
  if requested_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;
  select * into target from public.capsules where public_token = requested_token for update;
  if not found
    or target.status <> 'unactivated'
    or public.is_capsule_fulfillment_disabled(target.id)
  then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  update public.capsules set
    status = 'active',
    owner_pin_hash = crypt(requested_pin, gen_salt('bf', 12)),
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
set search_path = public, extensions
as $$
declare
  target public.capsules;
  attempts public.capsule_unlock_attempts;
  next_attempts integer;
  next_block timestamptz;
begin
  select * into target from public.capsules where public_token = requested_token;
  if not found
    or target.status <> 'active'
    or requested_pin !~ '^[0-9]{6}$'
    or public.is_capsule_fulfillment_disabled(target.id)
  then
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
  if target.owner_pin_hash = crypt(requested_pin, target.owner_pin_hash) then
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

revoke all on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) from public;
revoke all on function public.admin_list_capsules(
  public.capsule_product_type,
  uuid,
  public.capsule_fulfillment_status,
  text
) from public;
revoke all on function public.admin_get_capsule_detail(uuid) from public;
revoke all on function public.admin_update_capsule_fulfillment(
  uuid, text, text, boolean, text
) from public;

grant execute on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) to service_role;
grant execute on function public.admin_list_capsules(
  public.capsule_product_type,
  uuid,
  public.capsule_fulfillment_status,
  text
) to service_role;
grant execute on function public.admin_get_capsule_detail(uuid) to service_role;
grant execute on function public.admin_update_capsule_fulfillment(
  uuid, text, text, boolean, text
) to service_role;
