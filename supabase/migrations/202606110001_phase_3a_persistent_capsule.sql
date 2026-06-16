create extension if not exists pgcrypto;

create type public.capsule_product_type as enum ('bookmark', 'journal');
create type public.capsule_status as enum ('unactivated', 'active');
create type public.capsule_access_role as enum ('owner', 'viewer');

create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique check (length(public_token) >= 32),
  product_type public.capsule_product_type not null default 'bookmark',
  status public.capsule_status not null default 'unactivated',
  owner_pin_hash text,
  owner_recovery_hash text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'unactivated' and owner_pin_hash is null and activated_at is null)
    or (status = 'active' and owner_pin_hash is not null and activated_at is not null)
  )
);

create table public.capsule_access (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.capsule_access_role not null,
  created_at timestamptz not null default now(),
  primary key (capsule_id, auth_user_id)
);

create table public.memories (
  id uuid primary key,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capsule_id)
);

create table public.photos (
  id uuid primary key,
  memory_id uuid not null references public.memories(id) on delete cascade,
  storage_path text not null unique,
  order_index integer not null check (order_index between 0 and 29),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (memory_id, order_index)
);

create table public.voice_memos (
  id uuid primary key,
  memory_id uuid not null references public.memories(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  order_index integer not null check (order_index >= 0),
  duration_seconds integer not null check (duration_seconds between 1 and 300),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (memory_id, order_index)
);

create table public.capsule_unlock_attempts (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (capsule_id, auth_user_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger capsules_set_updated_at before update on public.capsules
for each row execute function public.set_updated_at();
create trigger memories_set_updated_at before update on public.memories
for each row execute function public.set_updated_at();

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
    select 1 from public.capsule_access
    where capsule_id = target_capsule_id
      and auth_user_id = auth.uid()
      and role = required_role
  );
$$;

revoke all on function public.has_capsule_role(uuid, public.capsule_access_role) from public;
grant execute on function public.has_capsule_role(uuid, public.capsule_access_role) to authenticated;

alter table public.capsules enable row level security;
alter table public.capsule_access enable row level security;
alter table public.memories enable row level security;
alter table public.photos enable row level security;
alter table public.voice_memos enable row level security;
alter table public.capsule_unlock_attempts enable row level security;

create policy "owners read capsules" on public.capsules
for select to authenticated using (public.has_capsule_role(id));
revoke select on public.capsules from authenticated;
grant select (id, public_token, product_type, status, activated_at, created_at, updated_at)
on public.capsules to authenticated;

create policy "users read their capsule access" on public.capsule_access
for select to authenticated using (auth_user_id = auth.uid());

create policy "owners manage memories" on public.memories
for all to authenticated
using (public.has_capsule_role(capsule_id))
with check (public.has_capsule_role(capsule_id));

create policy "owners manage photos" on public.photos
for all to authenticated
using (
  exists (
    select 1 from public.memories m
    where m.id = memory_id and public.has_capsule_role(m.capsule_id)
  )
)
with check (
  exists (
    select 1 from public.memories m
    where m.id = memory_id and public.has_capsule_role(m.capsule_id)
  )
);

create policy "owners manage voice memos" on public.voice_memos
for all to authenticated
using (
  exists (
    select 1 from public.memories m
    where m.id = memory_id and public.has_capsule_role(m.capsule_id)
  )
)
with check (
  exists (
    select 1 from public.memories m
    where m.id = memory_id and public.has_capsule_role(m.capsule_id)
  )
);

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

create or replace function public.lock_capsule_owner(
  requested_token text,
  requested_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  select id into target_id from public.capsules where public_token = requested_token;
  if target_id is null then return jsonb_build_object('ok', false); end if;
  delete from public.capsule_access
  where capsule_id = target_id and auth_user_id = requested_user;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.inspect_capsule_access(text, uuid) from public;
revoke all on function public.activate_capsule_owner(text, uuid, text) from public;
revoke all on function public.unlock_capsule_owner(text, uuid, text) from public;
revoke all on function public.lock_capsule_owner(text, uuid) from public;
grant execute on function public.inspect_capsule_access(text, uuid) to service_role;
grant execute on function public.activate_capsule_owner(text, uuid, text) to service_role;
grant execute on function public.unlock_capsule_owner(text, uuid, text) to service_role;
grant execute on function public.lock_capsule_owner(text, uuid) to service_role;

create or replace function public.commit_single_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_photos jsonb,
  requested_voice_memos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare removed_paths text[];
begin
  if not public.has_capsule_role(requested_capsule_id)
    or length(trim(requested_title)) not between 1 and 200
    or jsonb_array_length(requested_photos) < 1
    or jsonb_array_length(requested_photos) > 30
    or coalesce((
      select sum((item->>'durationSeconds')::integer)
      from jsonb_array_elements(requested_voice_memos) item
    ), 0) > 300
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      where item->>'storagePath' not like
        'capsules/' || requested_capsule_id || '/memories/' || requested_memory_id || '/photos/%'
    )
    or exists (
      select 1 from jsonb_array_elements(requested_voice_memos) item
      where item->>'storagePath' not like
        'capsules/' || requested_capsule_id || '/memories/' || requested_memory_id || '/voice/%'
    )
  then raise exception 'invalid memory request'; end if;

  if exists (
    select 1 from public.memories
    where id = requested_memory_id and capsule_id <> requested_capsule_id
  ) then raise exception 'invalid memory request'; end if;

  select coalesce(array_agg(path), '{}') into removed_paths
  from (
    select storage_path path from public.photos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath' from jsonb_array_elements(requested_photos) item
      )
    union all
    select storage_path path from public.voice_memos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath' from jsonb_array_elements(requested_voice_memos) item
      )
  ) removed;

  insert into public.memories(id, capsule_id, title, occurred_at)
  values (requested_memory_id, requested_capsule_id, trim(requested_title), requested_occurred_at)
  on conflict (id) do update set
    title = excluded.title, occurred_at = excluded.occurred_at, updated_at = now()
  where public.memories.capsule_id = requested_capsule_id;

  delete from public.photos where memory_id = requested_memory_id;
  insert into public.photos(id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height)
  select
    (item->>'id')::uuid, requested_memory_id, item->>'storagePath',
    (item->>'orderIndex')::integer, item->>'mimeType',
    (item->>'sizeBytes')::bigint,
    nullif(item->>'width', '')::integer, nullif(item->>'height', '')::integer
  from jsonb_array_elements(requested_photos) item;

  delete from public.voice_memos where memory_id = requested_memory_id;
  insert into public.voice_memos(
    id, memory_id, title, storage_path, order_index,
    duration_seconds, mime_type, size_bytes, created_at
  )
  select
    (item->>'id')::uuid, requested_memory_id,
    coalesce(nullif(trim(item->>'title'), ''), 'Voice memo ' || ((item->>'orderIndex')::integer + 1)),
    item->>'storagePath', (item->>'orderIndex')::integer,
    (item->>'durationSeconds')::integer, item->>'mimeType',
    (item->>'sizeBytes')::bigint, coalesce((item->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(requested_voice_memos) item;

  return jsonb_build_object('removedPaths', to_jsonb(removed_paths));
end;
$$;

revoke all on function public.commit_single_memory(uuid, uuid, text, timestamptz, jsonb, jsonb) from public;
grant execute on function public.commit_single_memory(uuid, uuid, text, timestamptz, jsonb, jsonb) to authenticated;

insert into storage.buckets (id, name, public)
values ('memory-media', 'memory-media', false)
on conflict (id) do update set public = false;

create policy "owners read capsule media" on storage.objects
for select to authenticated using (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = 'capsules'
  and public.has_capsule_role(((storage.foldername(name))[2])::uuid)
);
create policy "owners upload capsule media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'memory-media'
  and (storage.foldername(name))[1] = 'capsules'
  and public.has_capsule_role(((storage.foldername(name))[2])::uuid)
);
create policy "owners update capsule media" on storage.objects
for update to authenticated using (
  bucket_id = 'memory-media'
  and public.has_capsule_role(((storage.foldername(name))[2])::uuid)
) with check (
  bucket_id = 'memory-media'
  and public.has_capsule_role(((storage.foldername(name))[2])::uuid)
);
create policy "owners delete capsule media" on storage.objects
for delete to authenticated using (
  bucket_id = 'memory-media'
  and public.has_capsule_role(((storage.foldername(name))[2])::uuid)
);
