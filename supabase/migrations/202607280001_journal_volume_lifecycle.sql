-- DEPLOYMENT REQUIREMENT: run this migration in a documented no-write
-- maintenance window. These transaction-scoped locks block capsule creation
-- and legacy RPC DML while Journal identity is backfilled and audited.
begin;

lock table public.capsules in share row exclusive mode;
lock table public.memories in share row exclusive mode;
lock table public.photos in share row exclusive mode;
lock table public.voice_memos in share row exclusive mode;

-- Backfill only missing Journal day identity. A missing timezone receives the
-- approved UTC fallback. A nonempty invalid timezone is never rewritten.
update public.memories memory
set
  local_date = (
    memory.occurred_at at time zone case
      when nullif(trim(memory.local_timezone), '') is null then 'UTC'
      else trim(memory.local_timezone)
    end
  )::date,
  local_timezone = coalesce(nullif(trim(memory.local_timezone), ''), 'UTC')
from public.capsules capsule
where capsule.id = memory.capsule_id
  and capsule.product_type = 'journal'
  and memory.local_date is null
  and (
    nullif(trim(memory.local_timezone), '') is null
    or exists (
      select 1 from pg_catalog.pg_timezone_names timezone
      where timezone.name = trim(memory.local_timezone)
    )
  );

create or replace function public.journal_voice_note_max_bytes()
returns bigint
language sql
immutable
set search_path = public
as $$
  select 6291456::bigint;
$$;

revoke all on function public.journal_voice_note_max_bytes() from public;

do $$
begin
  if exists (
    select 1
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
      and (
        nullif(trim(memory.local_timezone), '') is null
        or not exists (
          select 1 from pg_catalog.pg_timezone_names timezone
          where timezone.name = trim(memory.local_timezone)
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_INVALID_TIMEZONE';
  end if;

  if exists (
    select 1
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
      and memory.local_date is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_INVALID_LOCAL_DATE';
  end if;

  if exists (
    select 1
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
      and memory.local_date > (
        current_timestamp at time zone case
          when exists (
            select 1 from pg_catalog.pg_timezone_names timezone
            where timezone.name = trim(memory.local_timezone)
          ) then trim(memory.local_timezone)
          else 'UTC'
        end
      )::date
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_FUTURE_LOCAL_DATE';
  end if;

  if exists (
    select
      memory.capsule_id,
      memory.local_date
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
    group by
      memory.capsule_id,
      memory.local_date
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'JOURNAL_LEGACY_DUPLICATE_LOCAL_DATE';
  end if;

  if exists (
    select memory.capsule_id
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
    group by memory.capsule_id
    having count(*) > 365
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_DAY_LIMIT_EXCEEDED';
  end if;

  if exists (
    select memory.id
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    join public.photos photo on photo.memory_id = memory.id
    where capsule.product_type = 'journal'
    group by memory.id
    having count(photo.id) > 9
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_PHOTO_LIMIT_EXCEEDED';
  end if;

  if exists (
    select memory.id
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    join public.voice_memos memo on memo.memory_id = memory.id
    where capsule.product_type = 'journal'
    group by memory.id
    having count(memo.id) > 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_VOICE_NOTE_LIMIT_EXCEEDED';
  end if;

  if exists (
    select memo.id
    from public.voice_memos memo
    join public.memories memory on memory.id = memo.memory_id
    join public.capsules capsule on capsule.id = memory.capsule_id
    left join storage.objects stored_object
      on stored_object.bucket_id = 'memory-media'
      and stored_object.name = memo.storage_path
    where capsule.product_type = 'journal'
      and (
        memo.size_bytes > public.journal_voice_note_max_bytes()
        or coalesce(
          nullif(stored_object.metadata->>'size', '')::bigint,
          -1
        ) > public.journal_voice_note_max_bytes()
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_VOICE_NOTE_SIZE_EXCEEDED';
  end if;

  if exists (
    select memo.id
    from public.voice_memos memo
    join public.memories memory on memory.id = memo.memory_id
    join public.capsules capsule on capsule.id = memory.capsule_id
    left join storage.objects stored_object
      on stored_object.bucket_id = 'memory-media'
      and stored_object.name = memo.storage_path
    where capsule.product_type = 'journal'
      and (
        stored_object.id is null
        or nullif(stored_object.metadata->>'size', '') is null
        or (stored_object.metadata->>'size')::bigint <> memo.size_bytes
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'JOURNAL_LEGACY_VOICE_NOTE_STORAGE_MISMATCH';
  end if;
end;
$$;

create type public.journal_volume_lifecycle_state as enum (
  'ACTIVE',
  'FULL_REVIEW',
  'COMPLETED'
);

-- Phase 4 replaced mutation RLS policies with owner-read policies. Revoke the
-- default Supabase API DML grants as defense in depth so all writes continue
-- through the lifecycle-aware security-definer RPCs below.
revoke insert, update, delete, truncate, references, trigger
on table public.memories, public.photos, public.voice_memos
from authenticated, anon;

create table public.journal_volume_lifecycle (
  capsule_id uuid primary key references public.capsules(id) on delete cascade,
  state public.journal_volume_lifecycle_state not null default 'ACTIVE',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_volume_lifecycle_completion_check check (
    (state = 'COMPLETED' and completed_at is not null)
    or (state <> 'COMPLETED' and completed_at is null)
  )
);

alter table public.journal_volume_lifecycle enable row level security;

create policy "owners read journal volume lifecycle"
on public.journal_volume_lifecycle
for select to authenticated
using (public.has_capsule_role(capsule_id));

revoke all on table public.journal_volume_lifecycle from public;
grant select on table public.journal_volume_lifecycle to authenticated;

-- Cleanup rows are durable path reservations. A successful physical delete
-- becomes a tombstone instead of removing the queue row, so the path cannot be
-- uploaded again or attached to another Memory later.
alter table public.media_cleanup_queue
  drop constraint media_cleanup_queue_status_check;

alter table public.media_cleanup_queue
  add column claim_token uuid,
  add column claimed_at timestamptz,
  add column deleted_at timestamptz,
  add constraint media_cleanup_queue_status_check
    check (status in ('pending', 'processing', 'failed', 'deleted')),
  add constraint media_cleanup_queue_claim_check check (
    (status = 'processing' and claim_token is not null
      and claimed_at is not null and deleted_at is null)
    or (status = 'deleted' and claim_token is not null
      and claimed_at is not null and deleted_at is not null)
    or (status in ('pending', 'failed') and claim_token is null
      and claimed_at is null and deleted_at is null)
  );

create table public.journal_media_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  memory_id uuid not null,
  media_id uuid not null,
  path_kind text not null
    check (path_kind in ('photo_display', 'photo_thumbnail', 'voice')),
  storage_path text not null unique,
  expected_size_bytes bigint not null check (expected_size_bytes >= 0),
  expected_mime_type text not null check (length(trim(expected_mime_type)) > 0),
  requested_by uuid not null references auth.users(id) on delete cascade,
  expected_memory_exists boolean not null,
  lifecycle_state public.journal_volume_lifecycle_state not null,
  projected_photo_ids uuid[] not null,
  projected_voice_ids uuid[] not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'expired', 'superseded')),
  expires_at timestamptz not null,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_media_upload_reservation_time_check
    check (expires_at > created_at),
  constraint journal_media_upload_reservation_projection_check check (
    cardinality(projected_photo_ids) between 0 and 9
    and cardinality(projected_voice_ids) between 0 and 1
  ),
  constraint journal_media_upload_reservation_commit_check check (
    (status = 'committed' and committed_at is not null)
    or (status <> 'committed' and committed_at is null)
  )
);

create unique index journal_media_upload_reservations_active_slot
on public.journal_media_upload_reservations(
  capsule_id, memory_id, media_id, path_kind
)
where status = 'reserved';

create index journal_media_upload_reservations_capsule_status
on public.journal_media_upload_reservations(capsule_id, status, expires_at);

alter table public.journal_media_upload_reservations enable row level security;
revoke all on table public.journal_media_upload_reservations from public;

create trigger journal_media_upload_reservations_set_updated_at
before update on public.journal_media_upload_reservations
for each row execute function public.set_updated_at();

create or replace function public.journal_media_extension(
  requested_path_kind text,
  requested_mime_type text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when requested_path_kind in ('photo_display', 'photo_thumbnail')
      and lower(split_part(requested_mime_type, ';', 1)) = 'image/jpeg'
      then 'jpg'
    when requested_path_kind in ('photo_display', 'photo_thumbnail')
      and lower(split_part(requested_mime_type, ';', 1)) = 'image/png'
      then 'png'
    when requested_path_kind in ('photo_display', 'photo_thumbnail')
      and lower(split_part(requested_mime_type, ';', 1)) = 'image/webp'
      then 'webp'
    when requested_path_kind in ('photo_display', 'photo_thumbnail')
      and lower(split_part(requested_mime_type, ';', 1)) = 'image/gif'
      then 'gif'
    when requested_path_kind = 'voice'
      and lower(split_part(requested_mime_type, ';', 1)) = 'audio/webm'
      then 'webm'
    when requested_path_kind = 'voice'
      and lower(split_part(requested_mime_type, ';', 1)) = 'audio/mp4'
      then 'm4a'
    when requested_path_kind = 'voice'
      and lower(split_part(requested_mime_type, ';', 1)) = 'audio/mpeg'
      then 'mp3'
    when requested_path_kind = 'voice'
      and lower(split_part(requested_mime_type, ';', 1)) = 'audio/ogg'
      then 'ogg'
    else null
  end;
$$;

revoke all on function public.journal_media_extension(text, text) from public;

-- Callers must hold the capsule row lock. Expiration revokes Storage admission
-- and queues the immutable path even if upload never completed; remove is
-- idempotent and finalize turns that path into a durable deleted tombstone.
create or replace function public.expire_journal_media_reservations(
  target_capsule_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_paths text[];
begin
  with expired as (
    update public.journal_media_upload_reservations reservation
    set status = 'expired', updated_at = now()
    where reservation.capsule_id = target_capsule_id
      and reservation.status = 'reserved'
      and reservation.expires_at <= now()
    returning reservation.storage_path
  )
  select coalesce(array_agg(distinct storage_path), '{}')
  into expired_paths
  from expired;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct target_capsule_id, path
  from unnest(expired_paths) path
  on conflict (storage_path) do nothing;

  return cardinality(expired_paths);
end;
$$;

revoke all on function public.expire_journal_media_reservations(uuid)
from public;

create trigger journal_volume_lifecycle_set_updated_at
before update on public.journal_volume_lifecycle
for each row execute function public.set_updated_at();

insert into public.journal_volume_lifecycle(capsule_id, state)
select
  capsule.id,
  case count(memory.id)
    when 365 then 'FULL_REVIEW'::public.journal_volume_lifecycle_state
    else 'ACTIVE'::public.journal_volume_lifecycle_state
  end
from public.capsules capsule
left join public.memories memory on memory.capsule_id = capsule.id
where capsule.product_type = 'journal'
group by capsule.id;

create or replace function public.initialize_journal_volume_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_type = 'journal' then
    insert into public.journal_volume_lifecycle(capsule_id, state)
    values (new.id, 'ACTIVE')
    on conflict (capsule_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger capsules_initialize_journal_volume_lifecycle
after insert or update of product_type on public.capsules
for each row execute function public.initialize_journal_volume_lifecycle();

revoke all on function public.initialize_journal_volume_lifecycle() from public;

create or replace function public.reserve_journal_media_uploads(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_expected_exists boolean,
  requested_final_photo_ids uuid[],
  requested_final_voice_ids uuid[],
  requested_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  lifecycle public.journal_volume_lifecycle;
  existing_memory boolean;
  memory_day_count integer;
  reserved_memory_day_count integer;
  projected_photo_ids uuid[];
  projected_voice_ids uuid[];
  volume_photo_count integer;
  superseded_paths text[];
  item jsonb;
  reservation_id uuid;
  media_id uuid;
  path_kind text;
  extension text;
  storage_path text;
  reservations jsonb := '[]'::jsonb;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type <> 'journal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL');
  end if;
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select * into lifecycle
  from public.journal_volume_lifecycle
  where capsule_id = requested_capsule_id
  for update;
  if lifecycle.state = 'COMPLETED' then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_COMPLETED');
  end if;

  perform public.expire_journal_media_reservations(requested_capsule_id);

  if exists (
    select 1 from public.media_cleanup_queue cleanup
    where cleanup.capsule_id = requested_capsule_id
      and cleanup.status <> 'deleted'
  ) then
    return jsonb_build_object(
      'ok', false, 'code', 'MEDIA_CLEANUP_REQUIRED'
    );
  end if;

  if exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id
      and memory.capsule_id <> requested_capsule_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT');
  end if;

  select exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id
      and memory.capsule_id = requested_capsule_id
  ) into existing_memory;

  if requested_expected_exists is null then
    return jsonb_build_object(
      'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
    );
  end if;
  if requested_expected_exists and not existing_memory then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_NOT_FOUND');
  end if;
  if not requested_expected_exists and existing_memory then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ALREADY_EXISTS');
  end if;

  select count(*) into memory_day_count
  from public.memories memory
  where memory.capsule_id = requested_capsule_id;
  if not existing_memory and (
    lifecycle.state = 'FULL_REVIEW' or memory_day_count >= 365
  ) then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_DAY_LIMIT');
  end if;

  if requested_memory_id is null
    or requested_final_photo_ids is null
    or requested_final_voice_ids is null
    or cardinality(requested_final_photo_ids) <> (
      select count(distinct media_id)
      from unnest(requested_final_photo_ids) media_id
    )
    or cardinality(requested_final_voice_ids) <> (
      select count(distinct media_id)
      from unnest(requested_final_voice_ids) media_id
    )
    or requested_final_photo_ids && requested_final_voice_ids
    or requested_items is null
    or jsonb_typeof(requested_items) <> 'array'
    or jsonb_array_length(requested_items) not between 1 and 19
    or exists (
      select 1 from jsonb_array_elements(requested_items) requested_item
      where requested_item->>'pathKind' not in (
          'photo_display', 'photo_thumbnail', 'voice'
        )
        or coalesce(requested_item->>'mediaId', '') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(requested_item->>'expectedSizeBytes', '') !~ '^[0-9]+$'
        or (requested_item->>'expectedSizeBytes')::numeric <= 0
        or public.journal_media_extension(
          requested_item->>'pathKind',
          requested_item->>'expectedMimeType'
        ) is null
        or (
          requested_item->>'pathKind' in (
            'photo_display', 'photo_thumbnail'
          )
          and (requested_item->>'expectedSizeBytes')::numeric > 26214400
        )
        or (
          requested_item->>'pathKind' = 'voice'
          and (requested_item->>'expectedSizeBytes')::numeric >
            public.journal_voice_note_max_bytes()
        )
    )
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEDIA_RESERVATION');
  end if;

  select coalesce(array_agg(media_id order by media_id), '{}')
  into projected_photo_ids
  from unnest(requested_final_photo_ids) media_id;
  select coalesce(array_agg(media_id order by media_id), '{}')
  into projected_voice_ids
  from unnest(requested_final_voice_ids) media_id;

  if exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    group by requested_item->>'mediaId', requested_item->>'pathKind'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    group by requested_item->>'mediaId'
    having count(distinct case
      when requested_item->>'pathKind' = 'voice' then 'voice'
      else 'photo'
    end) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    where requested_item->>'pathKind' in ('photo_display', 'photo_thumbnail')
    group by requested_item->>'mediaId'
    having count(*) <> 2
      or count(*) filter (
        where requested_item->>'pathKind' = 'photo_display'
      ) <> 1
      or count(*) filter (
        where requested_item->>'pathKind' = 'photo_thumbnail'
      ) <> 1
  ) or (
    select count(*)
    from jsonb_array_elements(requested_items) requested_item
    where requested_item->>'pathKind' = 'voice'
  ) > 1 or exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    where (
      requested_item->>'pathKind' in ('photo_display', 'photo_thumbnail')
      and not (
        (requested_item->>'mediaId')::uuid = any(projected_photo_ids)
      )
    ) or (
      requested_item->>'pathKind' = 'voice'
      and not (
        (requested_item->>'mediaId')::uuid = any(projected_voice_ids)
      )
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEDIA_RESERVATION');
  end if;

  if exists (
    select 1
    from unnest(projected_photo_ids) media_id
    join public.photos photo on photo.id = media_id
    where photo.memory_id <> requested_memory_id
  ) or exists (
    select 1
    from unnest(projected_voice_ids) media_id
    join public.voice_memos memo on memo.id = media_id
    where memo.memory_id <> requested_memory_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_ID_CONFLICT');
  end if;

  select count(*) into reserved_memory_day_count
  from (
    select memory.id memory_id
    from public.memories memory
    where memory.capsule_id = requested_capsule_id
    union
    select reservation.memory_id
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = requested_capsule_id
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
    union
    select requested_memory_id
  ) reserved_memory_days;
  if reserved_memory_day_count > 365 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_DAY_LIMIT');
  end if;

  if cardinality(projected_photo_ids) > 9 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_PHOTO_LIMIT');
  end if;

  if cardinality(projected_voice_ids) > 1 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_VOICE_LIMIT');
  end if;

  -- Each active reservation batch binds one projected final state per Memory.
  -- Persisted counts are replaced by that projection, not added to it, so a
  -- full-capacity replacement remains admissible without weakening commit.
  select count(*) into volume_photo_count
  from public.photos photo
  join public.memories memory on memory.id = photo.memory_id
  where memory.capsule_id = requested_capsule_id
    and memory.id <> requested_memory_id
    and not exists (
      select 1
      from public.journal_media_upload_reservations reservation
      where reservation.capsule_id = requested_capsule_id
        and reservation.memory_id = memory.id
        and reservation.status = 'reserved'
        and reservation.expires_at > now()
    );

  select volume_photo_count + coalesce(
    sum(cardinality(active_intent.projected_photo_ids)), 0
  ) into volume_photo_count
  from (
    select distinct reservation.memory_id, reservation.projected_photo_ids
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id <> requested_memory_id
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
  ) active_intent;

  volume_photo_count := volume_photo_count + cardinality(projected_photo_ids);
  if volume_photo_count > public.journal_photo_capacity() then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_PHOTO_LIMIT');
  end if;

  with superseded as (
    update public.journal_media_upload_reservations reservation
    set status = 'superseded', updated_at = now()
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id = requested_memory_id
      and reservation.status = 'reserved'
    returning reservation.storage_path
  )
  select coalesce(array_agg(distinct storage_path), '{}')
  into superseded_paths
  from superseded;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct requested_capsule_id, path
  from unnest(superseded_paths) path
  on conflict (storage_path) do nothing;

  if cardinality(superseded_paths) > 0 then
    return jsonb_build_object(
      'ok', false, 'code', 'MEDIA_CLEANUP_REQUIRED'
    );
  end if;

  for item in
    select requested_item
    from jsonb_array_elements(requested_items) requested_item
  loop
    reservation_id := gen_random_uuid();
    media_id := (item->>'mediaId')::uuid;
    path_kind := item->>'pathKind';
    extension := public.journal_media_extension(
      path_kind, item->>'expectedMimeType'
    );
    storage_path := case
      when path_kind = 'photo_display' then
        'capsules/' || requested_capsule_id || '/memories/' ||
        requested_memory_id || '/photos/' || media_id || '/' ||
        reservation_id || '-display.' || extension
      when path_kind = 'photo_thumbnail' then
        'capsules/' || requested_capsule_id || '/memories/' ||
        requested_memory_id || '/photos/' || media_id || '/' ||
        reservation_id || '-thumb.' || extension
      else
        'capsules/' || requested_capsule_id || '/memories/' ||
        requested_memory_id || '/voice/' || media_id || '/' ||
        reservation_id || '.' || extension
    end;

    if exists (
      select 1 from public.media_cleanup_queue cleanup
      where cleanup.storage_path = storage_path
    ) or exists (
      select 1 from public.photos photo
      where photo.storage_path = storage_path
         or photo.thumbnail_storage_path = storage_path
    ) or exists (
      select 1 from public.voice_memos memo
      where memo.storage_path = storage_path
    ) then
      raise exception using
        errcode = '23505', message = 'MEDIA_RESERVATION_CONFLICT';
    end if;

    insert into public.journal_media_upload_reservations(
      id, capsule_id, memory_id, media_id, path_kind, storage_path,
      expected_size_bytes, expected_mime_type, requested_by,
      expected_memory_exists, lifecycle_state,
      projected_photo_ids, projected_voice_ids, expires_at
    ) values (
      reservation_id,
      requested_capsule_id,
      requested_memory_id,
      media_id,
      path_kind,
      storage_path,
      (item->>'expectedSizeBytes')::bigint,
      trim(item->>'expectedMimeType'),
      auth.uid(),
      requested_expected_exists,
      lifecycle.state,
      projected_photo_ids,
      projected_voice_ids,
      now() + interval '30 minutes'
    );

    reservations := reservations || jsonb_build_array(jsonb_build_object(
      'reservationId', reservation_id,
      'mediaId', media_id,
      'pathKind', path_kind,
      'storagePath', storage_path,
      'expectedSizeBytes', (item->>'expectedSizeBytes')::bigint,
      'expectedMimeType', trim(item->>'expectedMimeType'),
      'expiresAt', now() + interval '30 minutes'
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'lifecycleState', lifecycle.state,
    'reservations', reservations
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false, 'code', 'MEDIA_RESERVATION_CONFLICT'
    );
end;
$$;

revoke all on function public.reserve_journal_media_uploads(
  uuid, uuid, boolean, uuid[], uuid[], jsonb
) from public;
grant execute on function public.reserve_journal_media_uploads(
  uuid, uuid, boolean, uuid[], uuid[], jsonb
) to authenticated;

create or replace function public.can_write_capsule_media_object(
  object_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  folders text[];
  target_capsule_id uuid;
  target_memory_id uuid;
  target_product_type public.capsule_product_type;
  target_lifecycle_state public.journal_volume_lifecycle_state;
begin
  folders := storage.foldername(object_name);
  if folders[1] <> 'capsules' or folders[2] is null then
    return false;
  end if;

  begin
    target_capsule_id := folders[2]::uuid;
  exception
    when invalid_text_representation then return false;
  end;

  if not public.has_capsule_role(target_capsule_id, 'owner') then
    return false;
  end if;

  select capsule.product_type into target_product_type
  from public.capsules capsule
  where capsule.id = target_capsule_id
  for key share;
  if not found then
    return false;
  end if;

  -- Bookmark media keeps the pre-lifecycle owner/path behavior.
  if target_product_type = 'bookmark' then
    return true;
  end if;

  if exists (
    select 1 from public.media_cleanup_queue cleanup
    where cleanup.storage_path = object_name
  ) then
    return false;
  end if;

  if folders[3] <> 'memories' or folders[4] is null then
    return false;
  end if;
  begin
    target_memory_id := folders[4]::uuid;
  exception
    when invalid_text_representation then return false;
  end;

  select lifecycle.state into target_lifecycle_state
  from public.journal_volume_lifecycle lifecycle
  where lifecycle.capsule_id = target_capsule_id;

  return exists (
    select 1
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = target_capsule_id
      and reservation.memory_id = target_memory_id
      and reservation.storage_path = object_name
      and reservation.requested_by = auth.uid()
      and reservation.lifecycle_state = target_lifecycle_state
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
  );
end;
$$;

revoke all on function public.can_write_capsule_media_object(text) from public;
grant execute on function public.can_write_capsule_media_object(text)
to authenticated;

create or replace function public.journal_media_upload_metadata_matches(
  object_name text,
  object_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  folders text[];
  target_capsule_id uuid;
  target_product_type public.capsule_product_type;
  actual_size bigint;
  actual_mime_type text;
begin
  folders := storage.foldername(object_name);
  begin
    target_capsule_id := folders[2]::uuid;
  exception
    when invalid_text_representation then return false;
  end;

  select capsule.product_type into target_product_type
  from public.capsules capsule
  where capsule.id = target_capsule_id;
  if not found then
    return false;
  end if;
  if target_product_type = 'bookmark' then
    return true;
  end if;

  actual_size := case
    when coalesce(object_metadata->>'size', '') ~ '^[0-9]+$'
      then (object_metadata->>'size')::bigint
    else null
  end;
  actual_mime_type := nullif(trim(object_metadata->>'mimetype'), '');

  return exists (
    select 1
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = target_capsule_id
      and reservation.storage_path = object_name
      and reservation.requested_by = auth.uid()
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
      and reservation.expected_size_bytes = actual_size
      and lower(reservation.expected_mime_type) = lower(actual_mime_type)
  );
end;
$$;

revoke all on function public.journal_media_upload_metadata_matches(text, jsonb)
from public;
grant execute on function public.journal_media_upload_metadata_matches(text, jsonb)
to authenticated;

create or replace function public.can_update_capsule_media_object(
  object_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  folders text[];
  target_capsule_id uuid;
begin
  folders := storage.foldername(object_name);
  if folders[1] <> 'capsules' or folders[2] is null then
    return false;
  end if;
  begin
    target_capsule_id := folders[2]::uuid;
  exception
    when invalid_text_representation then return false;
  end;

  return public.has_capsule_role(target_capsule_id, 'owner')
    and exists (
      select 1 from public.capsules capsule
      where capsule.id = target_capsule_id
        and capsule.product_type = 'bookmark'
    );
end;
$$;

revoke all on function public.can_update_capsule_media_object(text) from public;
grant execute on function public.can_update_capsule_media_object(text)
to authenticated;

drop policy if exists "owners upload capsule media" on storage.objects;
drop policy if exists "owners update capsule media" on storage.objects;

create policy "owners upload writable capsule media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'memory-media'
  and public.can_write_capsule_media_object(name)
  and public.journal_media_upload_metadata_matches(name, metadata)
);

create policy "owners update writable capsule media" on storage.objects
for update to authenticated using (
  bucket_id = 'memory-media'
  and public.can_write_capsule_media_object(name)
  and public.can_update_capsule_media_object(name)
) with check (
  bucket_id = 'memory-media'
  and public.can_write_capsule_media_object(name)
  and public.can_update_capsule_media_object(name)
);

create or replace function public.can_delete_capsule_media_object(
  object_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  folders text[];
  target_capsule_id uuid;
  target_product_type public.capsule_product_type;
begin
  if not public.can_write_capsule_media_object(object_name) then
    return false;
  end if;

  folders := storage.foldername(object_name);
  begin
    target_capsule_id := folders[2]::uuid;
  exception
    when invalid_text_representation then return false;
  end;

  select capsule.product_type into target_product_type
  from public.capsules capsule
  where capsule.id = target_capsule_id;

  -- Bookmark deletion keeps its prior owner/path compatibility. Every Journal
  -- deletion, including reserved or unreferenced uploads, must use the locked
  -- service cleanup claim/finalize protocol.
  return target_product_type = 'bookmark';
end;
$$;

revoke all on function public.can_delete_capsule_media_object(text) from public;
grant execute on function public.can_delete_capsule_media_object(text)
to authenticated;

drop policy if exists "owners delete capsule media" on storage.objects;
drop policy if exists "owners delete removable capsule media" on storage.objects;

create policy "owners delete removable capsule media" on storage.objects
for delete to authenticated using (
  bucket_id = 'memory-media'
  and public.can_delete_capsule_media_object(name)
);

-- Browser code uses the capsule-access cleanup action, not this legacy RPC.
-- Keep a capsule-locked service-only request primitive for operational
-- compatibility. COMPLETED Journal orphans are intentionally queueable here;
-- referenced media is not.
create or replace function public.queue_media_cleanup(
  target_capsule_id uuid,
  paths text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;

  select * into target_capsule
  from public.capsules
  where id = target_capsule_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'INVALID_CAPSULE';
  end if;

  perform public.expire_journal_media_reservations(target_capsule_id);

  if exists (
    select 1 from unnest(paths) path
    where path is null
      or path = ''
      or path not like 'capsules/' || target_capsule_id || '/%'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CLEANUP_PATH';
  end if;

  if exists (
    select 1 from unnest(paths) path
    where exists (
      select 1 from public.photos photo
      where photo.storage_path = path
         or photo.thumbnail_storage_path = path
    ) or exists (
      select 1 from public.voice_memos memo
      where memo.storage_path = path
    )
  ) then
    raise exception using errcode = '23503', message = 'REFERENCED_MEDIA';
  end if;

  update public.journal_media_upload_reservations reservation
  set
    status = 'superseded',
    committed_at = null,
    updated_at = now()
  where reservation.capsule_id = target_capsule_id
    and reservation.storage_path = any(coalesce(paths, '{}'))
    and reservation.status in ('reserved', 'committed');

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct target_capsule_id, path from unnest(paths) path
  on conflict (storage_path) do nothing;
end;
$$;

revoke all on function public.queue_media_cleanup(uuid, text[]) from public;
revoke execute on function public.queue_media_cleanup(uuid, text[])
from authenticated, anon;
grant execute on function public.queue_media_cleanup(uuid, text[])
to service_role;

-- Concurrency contract: both this claim RPC and lifecycle commit/delete RPCs
-- lock the same capsule row first. If cleanup gets the lock first, it reserves
-- paths as processing and a later commit rejects them. If commit gets the lock
-- first, its references are visible to this transaction and are rejected (for
-- explicit requests) or quarantined as failed (for already queued work).
create or replace function public.claim_media_cleanup(
  target_capsule_id uuid,
  requested_paths text[] default '{}',
  requested_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  next_claim_token uuid := gen_random_uuid();
  claimed_rows jsonb;
  remaining_count integer;
  quarantined_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;

  select * into target_capsule
  from public.capsules
  where id = target_capsule_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CAPSULE');
  end if;

  perform public.expire_journal_media_reservations(target_capsule_id);

  if exists (
    select 1 from unnest(coalesce(requested_paths, '{}')) path
    where path is null
      or path = ''
      or path not like 'capsules/' || target_capsule_id || '/%'
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CLEANUP_PATH');
  end if;

  -- The request is checked under the capsule lock. This deliberately has no
  -- lifecycle-state rejection: a demonstrably unreferenced orphan may be
  -- cleaned after COMPLETED even though direct authenticated Storage delete is
  -- still denied by can_delete_capsule_media_object.
  if exists (
    select 1 from unnest(coalesce(requested_paths, '{}')) path
    where exists (
      select 1 from public.photos photo
      where photo.storage_path = path
         or photo.thumbnail_storage_path = path
    ) or exists (
      select 1 from public.voice_memos memo
      where memo.storage_path = path
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'REFERENCED_MEDIA');
  end if;

  update public.journal_media_upload_reservations reservation
  set
    status = 'superseded',
    committed_at = null,
    updated_at = now()
  where reservation.capsule_id = target_capsule_id
    and reservation.storage_path = any(coalesce(requested_paths, '{}'))
    and reservation.status in ('reserved', 'committed');

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct target_capsule_id, path
  from unnest(coalesce(requested_paths, '{}')) path
  on conflict (storage_path) do nothing;

  -- A crashed worker's lease is retryable. Storage removal is idempotent, and
  -- finalize is token-bound, so an old worker cannot finalize a newer claim.
  update public.media_cleanup_queue cleanup
  set
    status = 'failed',
    claim_token = null,
    claimed_at = null,
    last_error = 'CLAIM_LEASE_EXPIRED',
    updated_at = now()
  where cleanup.capsule_id = target_capsule_id
    and cleanup.status = 'processing'
    and cleanup.claimed_at < now() - interval '15 minutes';

  update public.media_cleanup_queue cleanup
  set
    status = 'failed',
    claim_token = null,
    claimed_at = null,
    last_error = 'INVALID_CLEANUP_PATH',
    updated_at = now()
  where cleanup.capsule_id = target_capsule_id
    and cleanup.status in ('pending', 'failed')
    and cleanup.storage_path not like
      'capsules/' || target_capsule_id || '/%';

  update public.media_cleanup_queue cleanup
  set
    status = 'failed',
    claim_token = null,
    claimed_at = null,
    last_error = 'REFERENCED_MEDIA',
    updated_at = now()
  where cleanup.capsule_id = target_capsule_id
    and cleanup.status in ('pending', 'failed')
    and (
      exists (
        select 1 from public.photos photo
        where photo.storage_path = cleanup.storage_path
           or photo.thumbnail_storage_path = cleanup.storage_path
      )
      or exists (
        select 1 from public.voice_memos memo
        where memo.storage_path = cleanup.storage_path
      )
    );
  get diagnostics quarantined_count = row_count;

  with candidates as (
    select cleanup.id
    from public.media_cleanup_queue cleanup
    where cleanup.capsule_id = target_capsule_id
      and cleanup.status in ('pending', 'failed')
      and cleanup.storage_path like 'capsules/' || target_capsule_id || '/%'
      and not exists (
        select 1 from public.photos photo
        where photo.storage_path = cleanup.storage_path
           or photo.thumbnail_storage_path = cleanup.storage_path
      )
      and not exists (
        select 1 from public.voice_memos memo
        where memo.storage_path = cleanup.storage_path
      )
    order by cleanup.created_at, cleanup.id
    for update skip locked
    limit greatest(1, least(coalesce(requested_limit, 100), 100))
  ), claimed as (
    update public.media_cleanup_queue cleanup
    set
      status = 'processing',
      attempts = cleanup.attempts + 1,
      claim_token = next_claim_token,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
    from candidates
    where cleanup.id = candidates.id
    returning cleanup.id, cleanup.storage_path
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', claimed.id,
      'storagePath', claimed.storage_path
    )),
    '[]'::jsonb
  ) into claimed_rows
  from claimed;

  select count(*) into remaining_count
  from public.media_cleanup_queue cleanup
  where cleanup.capsule_id = target_capsule_id
    and cleanup.status <> 'deleted';

  return jsonb_build_object(
    'ok', true,
    'claimToken', next_claim_token,
    'claimed', claimed_rows,
    'quarantinedCount', quarantined_count,
    'remaining', remaining_count
  );
end;
$$;

revoke all on function public.claim_media_cleanup(uuid, text[], integer)
from public;
grant execute on function public.claim_media_cleanup(uuid, text[], integer)
to service_role;

create or replace function public.finalize_media_cleanup(
  target_capsule_id uuid,
  requested_claim_token uuid,
  requested_succeeded boolean,
  requested_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  finalized_count integer;
  remaining_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if requested_claim_token is null or requested_succeeded is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CLAIM');
  end if;

  select * into target_capsule
  from public.capsules
  where id = target_capsule_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CAPSULE');
  end if;

  if requested_succeeded then
    update public.media_cleanup_queue cleanup
    set
      status = 'deleted',
      deleted_at = now(),
      last_error = null,
      updated_at = now()
    where cleanup.capsule_id = target_capsule_id
      and cleanup.status = 'processing'
      and cleanup.claim_token = requested_claim_token;
  else
    update public.media_cleanup_queue cleanup
    set
      status = 'failed',
      claim_token = null,
      claimed_at = null,
      last_error = left(
        coalesce(nullif(requested_error, ''), 'STORAGE_REMOVE_FAILED'),
        500
      ),
      updated_at = now()
    where cleanup.capsule_id = target_capsule_id
      and cleanup.status = 'processing'
      and cleanup.claim_token = requested_claim_token;
  end if;
  get diagnostics finalized_count = row_count;

  if finalized_count = 0 and not (
    requested_succeeded and exists (
      select 1 from public.media_cleanup_queue cleanup
      where cleanup.capsule_id = target_capsule_id
        and cleanup.status = 'deleted'
        and cleanup.claim_token = requested_claim_token
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CLAIM');
  end if;

  select count(*) into remaining_count
  from public.media_cleanup_queue cleanup
  where cleanup.capsule_id = target_capsule_id
    and cleanup.status <> 'deleted';

  return jsonb_build_object(
    'ok', requested_succeeded,
    'finalized', finalized_count,
    'remaining', remaining_count
  );
end;
$$;

revoke all on function public.finalize_media_cleanup(uuid, uuid, boolean, text)
from public;
grant execute on function public.finalize_media_cleanup(uuid, uuid, boolean, text)
to service_role;

create or replace function public.commit_memory_with_lifecycle(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_local_date date,
  requested_local_timezone text,
  requested_photos jsonb,
  requested_voice_memos jsonb,
  requested_expected_exists boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  lifecycle public.journal_volume_lifecycle;
  existing_memory boolean;
  existing_memory_id uuid;
  other_memory_count integer;
  other_photo_count integer;
  memory_day_count integer;
  effective_timezone text;
  next_lifecycle_state public.journal_volume_lifecycle_state;
  final_photo_ids uuid[];
  final_voice_ids uuid[];
  removed_paths text[];
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  if exists (
    select 1 from public.memories
    where id = requested_memory_id
      and capsule_id <> requested_capsule_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT');
  end if;

  select exists (
    select 1 from public.memories
    where id = requested_memory_id
      and capsule_id = requested_capsule_id
  ) into existing_memory;

  if target_capsule.product_type = 'journal' then
    insert into public.journal_volume_lifecycle(capsule_id, state)
    values (requested_capsule_id, 'ACTIVE')
    on conflict (capsule_id) do nothing;

    select * into lifecycle
    from public.journal_volume_lifecycle
    where capsule_id = requested_capsule_id
    for update;

    if lifecycle.state = 'COMPLETED' then
      return jsonb_build_object('ok', false, 'code', 'JOURNAL_COMPLETED');
    end if;

    perform public.expire_journal_media_reservations(requested_capsule_id);

    if requested_expected_exists is null then
      return jsonb_build_object(
        'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
      );
    end if;
    if requested_expected_exists and not existing_memory then
      return jsonb_build_object('ok', false, 'code', 'MEMORY_NOT_FOUND');
    end if;
    if not requested_expected_exists and existing_memory then
      return jsonb_build_object('ok', false, 'code', 'MEMORY_ALREADY_EXISTS');
    end if;

    if requested_local_date is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_LOCAL_DATE');
    end if;

    effective_timezone := coalesce(
      nullif(trim(requested_local_timezone), ''),
      'UTC'
    );
    if not exists (
      select 1 from pg_catalog.pg_timezone_names
      where name = effective_timezone
    ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_LOCAL_DATE');
    end if;

    if requested_local_date >
      (current_timestamp at time zone effective_timezone)::date
    then
      return jsonb_build_object('ok', false, 'code', 'FUTURE_LOCAL_DATE');
    end if;

    select count(*) into memory_day_count
    from public.memories
    where capsule_id = requested_capsule_id;

    next_lifecycle_state := case
      when memory_day_count = 365 then 'FULL_REVIEW'
      else 'ACTIVE'
    end;
    if lifecycle.state <> next_lifecycle_state then
      update public.journal_volume_lifecycle
      set state = next_lifecycle_state, completed_at = null
      where capsule_id = requested_capsule_id;
    end if;

    if not existing_memory and memory_day_count >= 365 then
      return jsonb_build_object(
        'ok', false,
        'code', 'JOURNAL_DAY_LIMIT',
        'lifecycleState', 'FULL_REVIEW',
        'memoryDayCount', memory_day_count
      );
    end if;

    select memory.id into existing_memory_id
    from public.memories memory
    where memory.capsule_id = requested_capsule_id
      and memory.id <> requested_memory_id
      and memory.local_date = requested_local_date
    order by memory.created_at asc, memory.id asc
    limit 1;

    if existing_memory_id is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'DUPLICATE_LOCAL_DATE',
        'existingMemoryId', existing_memory_id,
        'localDate', requested_local_date
      );
    end if;
  end if;

  select count(*) into other_memory_count
  from public.memories
  where capsule_id = requested_capsule_id
    and id <> requested_memory_id;

  if target_capsule.product_type = 'bookmark'
    and other_memory_count > 0
  then
    return jsonb_build_object('ok', false, 'code', 'BOOKMARK_MEMORY_LIMIT');
  end if;

  if requested_memory_id is null
    or requested_title is null
    or requested_occurred_at is null
    or requested_photos is null
    or requested_voice_memos is null
    or length(trim(requested_title)) not between 1 and 200
    or jsonb_typeof(requested_photos) <> 'array'
    or jsonb_array_length(requested_photos) < 1
    or jsonb_array_length(requested_photos) > 30
    or (
      target_capsule.product_type = 'journal'
      and jsonb_array_length(requested_photos) > 9
    )
    or jsonb_typeof(requested_voice_memos) <> 'array'
    or (
      target_capsule.product_type = 'journal'
      and jsonb_array_length(requested_voice_memos) > 1
    )
    or (
      target_capsule.product_type = 'journal'
      and exists (
        select 1
        from jsonb_array_elements(requested_voice_memos) item
        where (item->>'sizeBytes')::bigint < 0
          or (item->>'sizeBytes')::bigint >
            public.journal_voice_note_max_bytes()
      )
    )
    or exists (
      select 1
      from jsonb_array_elements(requested_photos) item
      left join storage.objects stored_object
        on stored_object.bucket_id = 'memory-media'
        and stored_object.name = item->>'storagePath'
      where stored_object.id is null
        or lower(coalesce(stored_object.metadata->>'mimetype', '')) <>
          lower(item->>'mimeType')
        or case
          when coalesce(stored_object.metadata->>'size', '') ~ '^[0-9]+$'
            then (stored_object.metadata->>'size')::bigint <>
              (item->>'sizeBytes')::bigint
          else true
        end
    )
    or exists (
      select 1
      from jsonb_array_elements(requested_photos) item
      left join storage.objects stored_object
        on stored_object.bucket_id = 'memory-media'
        and stored_object.name = item->>'thumbnailStoragePath'
      where item->>'thumbnailStoragePath' is not null
        and (
          stored_object.id is null
          or lower(coalesce(stored_object.metadata->>'mimetype', '')) <>
            lower(item->>'thumbnailMimeType')
          or case
            when coalesce(stored_object.metadata->>'size', '') ~ '^[0-9]+$'
              then (stored_object.metadata->>'size')::bigint <>
                (item->>'thumbnailSizeBytes')::bigint
            else true
          end
        )
    )
    or exists (
      select 1
      from jsonb_array_elements(requested_voice_memos) item
      left join storage.objects stored_object
        on stored_object.bucket_id = 'memory-media'
        and stored_object.name = item->>'storagePath'
      where stored_object.id is null
        or lower(coalesce(stored_object.metadata->>'mimetype', '')) <>
          lower(item->>'mimeType')
        or case
          when coalesce(stored_object.metadata->>'size', '') ~ '^[0-9]+$'
            then (stored_object.metadata->>'size')::bigint <>
              (item->>'sizeBytes')::bigint
          else true
        end
        or (
          target_capsule.product_type = 'journal'
          and case
            when coalesce(stored_object.metadata->>'size', '') ~ '^[0-9]+$'
              then (stored_object.metadata->>'size')::bigint
            else null
          end > public.journal_voice_note_max_bytes()
        )
    )
    or coalesce((
      select sum((item->>'durationSeconds')::integer)
      from jsonb_array_elements(requested_voice_memos) item
    ), 0) > 300
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      where item->>'storagePath' not like
        'capsules/' || requested_capsule_id || '/memories/' ||
        requested_memory_id || '/photos/%'
    )
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
        and item->>'thumbnailStoragePath' not like
          'capsules/' || requested_capsule_id || '/memories/' ||
          requested_memory_id || '/photos/%'
    )
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      where item ? 'cropMetadata'
        and item->'cropMetadata' <> 'null'::jsonb
        and jsonb_typeof(item->'cropMetadata') <> 'object'
    )
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      where (
        item->>'thumbnailStoragePath' is null
        or item->>'thumbnailMimeType' is null
        or item->>'thumbnailSizeBytes' is null
        or item->>'thumbnailWidth' is null
        or item->>'thumbnailHeight' is null
      ) and not (
        item->>'thumbnailStoragePath' is null
        and item->>'thumbnailMimeType' is null
        and item->>'thumbnailSizeBytes' is null
        and item->>'thumbnailWidth' is null
        and item->>'thumbnailHeight' is null
      )
    )
    or exists (
      select 1 from jsonb_array_elements(requested_voice_memos) item
      where item->>'storagePath' not like
        'capsules/' || requested_capsule_id || '/memories/' ||
        requested_memory_id || '/voice/%'
    )
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEMORY');
  end if;

  select coalesce(array_agg(media_id order by media_id), '{}')
  into final_photo_ids
  from (
    select distinct (item->>'id')::uuid media_id
    from jsonb_array_elements(requested_photos) item
  ) requested_photo_ids;
  select coalesce(array_agg(media_id order by media_id), '{}')
  into final_voice_ids
  from (
    select distinct (item->>'id')::uuid media_id
    from jsonb_array_elements(requested_voice_memos) item
  ) requested_voice_ids;

  if exists (
    select 1
    from jsonb_array_elements(requested_photos) item
    join public.photos photo on photo.id = (item->>'id')::uuid
    where photo.memory_id <> requested_memory_id
  ) or exists (
    select 1
    from jsonb_array_elements(requested_voice_memos) item
    join public.voice_memos memo on memo.id = (item->>'id')::uuid
    where memo.memory_id <> requested_memory_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_ID_CONFLICT');
  end if;

  -- A storage object may have exactly one metadata owner. This also prevents a
  -- previously queued or deleted path from being cross-linked under a new id.
  if exists (
    select requested_path.path
    from (
      select item->>'storagePath' path
      from jsonb_array_elements(requested_photos) item
      union all
      select item->>'thumbnailStoragePath' path
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
      union all
      select item->>'storagePath' path
      from jsonb_array_elements(requested_voice_memos) item
    ) requested_path
    group by requested_path.path
    having count(*) > 1
  ) or exists (
    select 1
    from (
      select
        (item->>'id')::uuid media_id,
        'photo' media_kind,
        'display' path_kind,
        item->>'storagePath' path
      from jsonb_array_elements(requested_photos) item
      union all
      select
        (item->>'id')::uuid media_id,
        'photo' media_kind,
        'thumbnail' path_kind,
        item->>'thumbnailStoragePath' path
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
      union all
      select
        (item->>'id')::uuid media_id,
        'voice' media_kind,
        'audio' path_kind,
        item->>'storagePath' path
      from jsonb_array_elements(requested_voice_memos) item
    ) requested_path
    where exists (
      select 1
      from public.photos photo
      where (
          photo.storage_path = requested_path.path
          or photo.thumbnail_storage_path = requested_path.path
        )
        and not (
          photo.memory_id = requested_memory_id
          and photo.id = requested_path.media_id
          and requested_path.media_kind = 'photo'
          and (
            (requested_path.path_kind = 'display'
              and photo.storage_path = requested_path.path)
            or (requested_path.path_kind = 'thumbnail'
              and photo.thumbnail_storage_path = requested_path.path)
          )
        )
    ) or exists (
      select 1
      from public.voice_memos memo
      where memo.storage_path = requested_path.path
        and not (
          memo.memory_id = requested_memory_id
          and memo.id = requested_path.media_id
          and requested_path.media_kind = 'voice'
          and requested_path.path_kind = 'audio'
        )
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_PATH_CONFLICT');
  end if;

  if target_capsule.product_type = 'journal' and exists (
    select 1
    from (
      select item->>'storagePath' path
      from jsonb_array_elements(requested_photos) item
      union
      select item->>'thumbnailStoragePath' path
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
      union
      select item->>'storagePath' path
      from jsonb_array_elements(requested_voice_memos) item
    ) requested_path
    join public.media_cleanup_queue cleanup
      on cleanup.storage_path = requested_path.path
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MEDIA_CLEANUP_RESERVED'
    );
  end if;

  if target_capsule.product_type = 'journal' and exists (
    select 1
    from (
      select
        (item->>'id')::uuid media_id,
        'photo_display' path_kind,
        item->>'storagePath' path,
        (item->>'sizeBytes')::bigint expected_size_bytes,
        item->>'mimeType' expected_mime_type
      from jsonb_array_elements(requested_photos) item
      union all
      select
        (item->>'id')::uuid media_id,
        'photo_thumbnail' path_kind,
        item->>'thumbnailStoragePath' path,
        (item->>'thumbnailSizeBytes')::bigint expected_size_bytes,
        item->>'thumbnailMimeType' expected_mime_type
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
      union all
      select
        (item->>'id')::uuid media_id,
        'voice' path_kind,
        item->>'storagePath' path,
        (item->>'sizeBytes')::bigint expected_size_bytes,
        item->>'mimeType' expected_mime_type
      from jsonb_array_elements(requested_voice_memos) item
    ) requested_path
    where not (
      exists (
        select 1 from public.photos photo
        where photo.memory_id = requested_memory_id
          and photo.id = requested_path.media_id
          and (
            (requested_path.path_kind = 'photo_display'
              and photo.storage_path = requested_path.path)
            or (requested_path.path_kind = 'photo_thumbnail'
              and photo.thumbnail_storage_path = requested_path.path)
          )
      )
      or exists (
        select 1 from public.voice_memos memo
        where memo.memory_id = requested_memory_id
          and memo.id = requested_path.media_id
          and requested_path.path_kind = 'voice'
          and memo.storage_path = requested_path.path
      )
    )
    and not exists (
      select 1
      from public.journal_media_upload_reservations reservation
      where reservation.capsule_id = requested_capsule_id
        and reservation.memory_id = requested_memory_id
        and reservation.media_id = requested_path.media_id
        and reservation.path_kind = requested_path.path_kind
        and reservation.storage_path = requested_path.path
        and reservation.expected_size_bytes = requested_path.expected_size_bytes
        and lower(reservation.expected_mime_type) =
          lower(requested_path.expected_mime_type)
        and reservation.requested_by = auth.uid()
        and reservation.expected_memory_exists = requested_expected_exists
        and reservation.lifecycle_state = lifecycle.state
        and reservation.projected_photo_ids = final_photo_ids
        and reservation.projected_voice_ids = final_voice_ids
        and reservation.status = 'reserved'
        and reservation.expires_at > now()
    )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MEDIA_RESERVATION_REQUIRED'
    );
  end if;

  if target_capsule.product_type = 'journal' then
    select count(*) into other_photo_count
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.capsule_id = requested_capsule_id
      and memory.id <> requested_memory_id;

    if other_photo_count + jsonb_array_length(requested_photos)
      > public.journal_photo_capacity()
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'JOURNAL_PHOTO_LIMIT',
        'photoCount', other_photo_count
      );
    end if;

    with requested_paths as (
      select
        (item->>'id')::uuid media_id,
        'photo_display' path_kind,
        item->>'storagePath' path
      from jsonb_array_elements(requested_photos) item
      union all
      select
        (item->>'id')::uuid media_id,
        'photo_thumbnail' path_kind,
        item->>'thumbnailStoragePath' path
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
      union all
      select
        (item->>'id')::uuid media_id,
        'voice' path_kind,
        item->>'storagePath' path
      from jsonb_array_elements(requested_voice_memos) item
    )
    update public.journal_media_upload_reservations reservation
    set
      status = 'committed',
      committed_at = now(),
      updated_at = now()
    from requested_paths requested_path
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id = requested_memory_id
      and reservation.media_id = requested_path.media_id
      and reservation.path_kind = requested_path.path_kind
      and reservation.storage_path = requested_path.path
      and reservation.requested_by = auth.uid()
      and reservation.projected_photo_ids = final_photo_ids
      and reservation.projected_voice_ids = final_voice_ids
      and reservation.status = 'reserved';
  end if;

  select coalesce(array_agg(distinct path), '{}') into removed_paths
  from (
    select storage_path path
    from public.photos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath'
        from jsonb_array_elements(requested_photos) item
      )
    union
    select thumbnail_storage_path path
    from public.photos
    where memory_id = requested_memory_id
      and thumbnail_storage_path is not null
      and thumbnail_storage_path not in (
        select item->>'thumbnailStoragePath'
        from jsonb_array_elements(requested_photos) item
        where item->>'thumbnailStoragePath' is not null
      )
    union
    select storage_path path
    from public.voice_memos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath'
        from jsonb_array_elements(requested_voice_memos) item
      )
  ) removed;

  update public.journal_media_upload_reservations reservation
  set
    status = 'superseded',
    committed_at = null,
    updated_at = now()
  where reservation.capsule_id = requested_capsule_id
    and reservation.storage_path = any(removed_paths)
    and reservation.status in ('reserved', 'committed');

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct requested_capsule_id, path
  from unnest(removed_paths) path
  where path is not null
  on conflict (storage_path) do nothing;

  insert into public.memories(
    id, capsule_id, title, occurred_at, local_date, local_timezone
  )
  values (
    requested_memory_id,
    requested_capsule_id,
    trim(requested_title),
    requested_occurred_at,
    case when target_capsule.product_type = 'journal'
      then requested_local_date else null end,
    case when target_capsule.product_type = 'journal'
      then effective_timezone else null end
  )
  on conflict (id) do update set
    title = excluded.title,
    occurred_at = excluded.occurred_at,
    local_date = case when target_capsule.product_type = 'journal'
      then excluded.local_date else public.memories.local_date end,
    local_timezone = case when target_capsule.product_type = 'journal'
      then excluded.local_timezone else public.memories.local_timezone end,
    updated_at = now()
  where public.memories.capsule_id = requested_capsule_id;

  delete from public.photos
  where memory_id = requested_memory_id
    and id not in (
      select (item->>'id')::uuid
      from jsonb_array_elements(requested_photos) item
    );

  update public.photos photo set
    storage_path = item.storage_path,
    order_index = item.order_index,
    mime_type = item.mime_type,
    size_bytes = item.size_bytes,
    width = item.width,
    height = item.height,
    thumbnail_storage_path = item.thumbnail_storage_path,
    thumbnail_mime_type = item.thumbnail_mime_type,
    thumbnail_size_bytes = item.thumbnail_size_bytes,
    thumbnail_width = item.thumbnail_width,
    thumbnail_height = item.thumbnail_height,
    crop_metadata = item.crop_metadata
  from (
    select
      (value->>'id')::uuid id,
      value->>'storagePath' storage_path,
      (value->>'orderIndex')::integer order_index,
      value->>'mimeType' mime_type,
      (value->>'sizeBytes')::bigint size_bytes,
      nullif(value->>'width', '')::integer width,
      nullif(value->>'height', '')::integer height,
      value->>'thumbnailStoragePath' thumbnail_storage_path,
      value->>'thumbnailMimeType' thumbnail_mime_type,
      nullif(value->>'thumbnailSizeBytes', '')::bigint thumbnail_size_bytes,
      nullif(value->>'thumbnailWidth', '')::integer thumbnail_width,
      nullif(value->>'thumbnailHeight', '')::integer thumbnail_height,
      value->'cropMetadata' crop_metadata
    from jsonb_array_elements(requested_photos) value
  ) item
  where photo.id = item.id
    and photo.memory_id = requested_memory_id;

  insert into public.photos(
    id, memory_id, storage_path, order_index, mime_type, size_bytes,
    width, height, thumbnail_storage_path, thumbnail_mime_type,
    thumbnail_size_bytes, thumbnail_width, thumbnail_height, crop_metadata
  )
  select
    (item->>'id')::uuid,
    requested_memory_id,
    item->>'storagePath',
    (item->>'orderIndex')::integer,
    item->>'mimeType',
    (item->>'sizeBytes')::bigint,
    nullif(item->>'width', '')::integer,
    nullif(item->>'height', '')::integer,
    item->>'thumbnailStoragePath',
    item->>'thumbnailMimeType',
    nullif(item->>'thumbnailSizeBytes', '')::bigint,
    nullif(item->>'thumbnailWidth', '')::integer,
    nullif(item->>'thumbnailHeight', '')::integer,
    item->'cropMetadata'
  from jsonb_array_elements(requested_photos) item
  where not exists (
    select 1 from public.photos
    where id = (item->>'id')::uuid
  );

  delete from public.voice_memos
  where memory_id = requested_memory_id
    and id not in (
      select (item->>'id')::uuid
      from jsonb_array_elements(requested_voice_memos) item
    );

  update public.voice_memos memo set
    title = item.title,
    storage_path = item.storage_path,
    order_index = item.order_index,
    duration_seconds = item.duration_seconds,
    mime_type = item.mime_type,
    size_bytes = item.size_bytes,
    created_at = item.created_at
  from (
    select
      (value->>'id')::uuid id,
      coalesce(
        nullif(trim(value->>'title'), ''),
        'Voice memo ' || ((value->>'orderIndex')::integer + 1)
      ) title,
      value->>'storagePath' storage_path,
      (value->>'orderIndex')::integer order_index,
      (value->>'durationSeconds')::integer duration_seconds,
      value->>'mimeType' mime_type,
      (value->>'sizeBytes')::bigint size_bytes,
      coalesce((value->>'createdAt')::timestamptz, now()) created_at
    from jsonb_array_elements(requested_voice_memos) value
  ) item
  where memo.id = item.id
    and memo.memory_id = requested_memory_id;

  insert into public.voice_memos(
    id, memory_id, title, storage_path, order_index,
    duration_seconds, mime_type, size_bytes, created_at
  )
  select
    (item->>'id')::uuid,
    requested_memory_id,
    coalesce(
      nullif(trim(item->>'title'), ''),
      'Voice memo ' || ((item->>'orderIndex')::integer + 1)
    ),
    item->>'storagePath',
    (item->>'orderIndex')::integer,
    (item->>'durationSeconds')::integer,
    item->>'mimeType',
    (item->>'sizeBytes')::bigint,
    coalesce((item->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(requested_voice_memos) item
  where not exists (
    select 1 from public.voice_memos
    where id = (item->>'id')::uuid
  );

  if target_capsule.product_type = 'journal' then
    select count(*) into memory_day_count
    from public.memories
    where capsule_id = requested_capsule_id;
    next_lifecycle_state := case
      when memory_day_count = 365 then 'FULL_REVIEW'
      else 'ACTIVE'
    end;
    update public.journal_volume_lifecycle
    set state = next_lifecycle_state, completed_at = null
    where capsule_id = requested_capsule_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'memoryId', requested_memory_id,
    'cleanupPendingCount', cardinality(removed_paths),
    'lifecycleState', case when target_capsule.product_type = 'journal'
      then next_lifecycle_state else null end,
    'memoryDayCount', case when target_capsule.product_type = 'journal'
      then memory_day_count else null end
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'DUPLICATE_LOCAL_DATE',
      'localDate', requested_local_date
    );
end;
$$;

revoke all on function public.commit_memory_with_lifecycle(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) from public;

create or replace function public.commit_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_local_date date,
  requested_local_timezone text,
  requested_photos jsonb,
  requested_voice_memos jsonb,
  requested_expected_exists boolean
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, requested_local_date, requested_local_timezone,
    requested_photos, requested_voice_memos, requested_expected_exists
  );
$$;

create or replace function public.commit_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_local_date date,
  requested_local_timezone text,
  requested_photos jsonb,
  requested_voice_memos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_capsule public.capsules;
begin
  select * into target_capsule from public.capsules
  where id = requested_capsule_id;
  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type = 'journal' then
    return jsonb_build_object(
      'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
    );
  end if;
  return public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, requested_local_date, requested_local_timezone,
    requested_photos, requested_voice_memos, null
  );
end;
$$;

create or replace function public.commit_memory(
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
declare target_capsule public.capsules;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id;
  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type = 'journal' then
    return jsonb_build_object(
      'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
    );
  end if;
  return public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, null, null, requested_photos, requested_voice_memos,
    null
  );
end;
$$;

create or replace function public.commit_single_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_local_date date,
  requested_local_timezone text,
  requested_photos jsonb,
  requested_voice_memos jsonb,
  requested_expected_exists boolean
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, requested_local_date, requested_local_timezone,
    requested_photos, requested_voice_memos, requested_expected_exists
  );
$$;

create or replace function public.commit_single_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_local_date date,
  requested_local_timezone text,
  requested_photos jsonb,
  requested_voice_memos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_capsule public.capsules;
begin
  select * into target_capsule from public.capsules
  where id = requested_capsule_id;
  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type = 'journal' then
    return jsonb_build_object(
      'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
    );
  end if;
  return public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, requested_local_date, requested_local_timezone,
    requested_photos, requested_voice_memos, null
  );
end;
$$;

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
declare target_capsule public.capsules;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id;
  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type = 'journal' then
    return jsonb_build_object(
      'ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED'
    );
  end if;
  return public.commit_memory_with_lifecycle(
    requested_capsule_id, requested_memory_id, requested_title,
    requested_occurred_at, null, null, requested_photos, requested_voice_memos,
    null
  );
end;
$$;

revoke all on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) from public;
revoke all on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) from public;
revoke all on function public.commit_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) from public;
revoke all on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) from public;
revoke all on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) from public;
revoke all on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) from public;

grant execute on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) to authenticated;
grant execute on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) to authenticated;
grant execute on function public.commit_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) to authenticated;
grant execute on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) to authenticated;
grant execute on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) to authenticated;
grant execute on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) to authenticated;

create or replace function public.update_journal_title(
  requested_capsule_id uuid,
  requested_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  lifecycle_state public.journal_volume_lifecycle_state;
  next_title text;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type <> 'journal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL');
  end if;

  select state into lifecycle_state
  from public.journal_volume_lifecycle
  where capsule_id = requested_capsule_id
  for update;
  if lifecycle_state = 'COMPLETED' then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_COMPLETED');
  end if;

  next_title := coalesce(nullif(trim(requested_title), ''), 'My Journal');
  if length(next_title) > 100 then
    return jsonb_build_object('ok', false, 'code', 'TITLE_TOO_LONG');
  end if;

  update public.capsules set title = next_title
  where id = requested_capsule_id;
  return jsonb_build_object('ok', true, 'title', next_title);
end;
$$;

create or replace function public.delete_journal_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  lifecycle public.journal_volume_lifecycle;
  existing_memory boolean;
  memory_day_count integer;
  next_lifecycle_state public.journal_volume_lifecycle_state;
  removed_paths text[];
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type <> 'journal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL');
  end if;

  -- Memory IDs are global identifiers. Reject a foreign-capsule ID while the
  -- requested capsule is locked and before collecting or queueing any paths.
  -- This prevents a caller from tagging another capsule's media for cleanup.
  if exists (
    select 1
    from public.memories memory
    where memory.id = requested_memory_id
      and memory.capsule_id <> requested_capsule_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT');
  end if;

  select * into lifecycle
  from public.journal_volume_lifecycle
  where capsule_id = requested_capsule_id
  for update;

  select exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id
      and memory.capsule_id = requested_capsule_id
  ) into existing_memory;

  select coalesce(array_agg(distinct path), '{}') into removed_paths
  from (
    select photo.storage_path path
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.id = requested_memory_id
      and memory.capsule_id = requested_capsule_id
    union
    select photo.thumbnail_storage_path path
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.id = requested_memory_id
      and memory.capsule_id = requested_capsule_id
      and photo.thumbnail_storage_path is not null
    union
    select memo.storage_path path
    from public.voice_memos memo
    join public.memories memory on memory.id = memo.memory_id
    where memory.id = requested_memory_id
      and memory.capsule_id = requested_capsule_id
    union
    select reservation.storage_path path
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id = requested_memory_id
      and reservation.status in ('reserved', 'committed')
  ) media;

  if not existing_memory and cardinality(removed_paths) = 0 then
    select count(*) into memory_day_count
    from public.memories where capsule_id = requested_capsule_id;
    return jsonb_build_object(
      'ok', true, 'deleted', false,
      'lifecycleState', lifecycle.state,
      'memoryDayCount', memory_day_count
    );
  end if;

  -- Queue every persisted and precommit reservation path before invalidating
  -- metadata. The capsule lock serializes this against reservation and commit.
  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct requested_capsule_id, path
  from unnest(removed_paths) path
  where path is not null
  on conflict (storage_path) do nothing;

  update public.journal_media_upload_reservations reservation
  set
    status = 'superseded',
    committed_at = null,
    updated_at = now()
  where reservation.capsule_id = requested_capsule_id
    and reservation.memory_id = requested_memory_id
    and reservation.status in ('reserved', 'committed');

  delete from public.memories
  where id = requested_memory_id and capsule_id = requested_capsule_id;

  select count(*) into memory_day_count
  from public.memories where capsule_id = requested_capsule_id;
  if lifecycle.state = 'COMPLETED' then
    next_lifecycle_state := 'COMPLETED';
  else
    next_lifecycle_state := case
      when memory_day_count = 365 then 'FULL_REVIEW'
      else 'ACTIVE'
    end;
    update public.journal_volume_lifecycle
    set state = next_lifecycle_state, completed_at = null
    where capsule_id = requested_capsule_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', existing_memory,
    'cleanupPendingCount', cardinality(removed_paths),
    'lifecycleState', next_lifecycle_state,
    'memoryDayCount', memory_day_count
  );
end;
$$;

create or replace function public.complete_journal_volume(
  requested_capsule_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  lifecycle public.journal_volume_lifecycle;
  memory_day_count integer;
  cleanup_pending_count integer;
  abandoned_paths text[];
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type <> 'journal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL');
  end if;

  select * into lifecycle
  from public.journal_volume_lifecycle
  where capsule_id = requested_capsule_id
  for update;

  -- Expiration is materialized while the capsule is locked so the audit and
  -- cleanupPendingCount observe the same durable cleanup work.
  perform public.expire_journal_media_reservations(requested_capsule_id);

  select count(*) into memory_day_count
  from public.memories where capsule_id = requested_capsule_id;

  if lifecycle.state = 'COMPLETED' then
    return jsonb_build_object(
      'ok', true,
      'lifecycleState', 'COMPLETED',
      'memoryDayCount', memory_day_count,
      'completedAt', lifecycle.completed_at
    );
  end if;

  -- Completion is an explicit boundary: any still-uncommitted upload intent
  -- is abandoned under the capsule lock and routed through durable cleanup.
  with abandoned as (
    update public.journal_media_upload_reservations reservation
    set status = 'superseded', updated_at = now()
    where reservation.capsule_id = requested_capsule_id
      and reservation.status = 'reserved'
    returning reservation.storage_path
  )
  select coalesce(array_agg(distinct storage_path), '{}')
  into abandoned_paths
  from abandoned;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select distinct requested_capsule_id, path
  from unnest(abandoned_paths) path
  on conflict (storage_path) do nothing;

  select count(*) into cleanup_pending_count
  from public.media_cleanup_queue cleanup
  where cleanup.capsule_id = requested_capsule_id
    and cleanup.status <> 'deleted';
  if cleanup_pending_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'MEDIA_CLEANUP_REQUIRED',
      'cleanupPendingCount', cleanup_pending_count
    );
  end if;

  if memory_day_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_EMPTY');
  end if;
  if memory_day_count > 365 then
    return jsonb_build_object(
      'ok', false, 'code', 'JOURNAL_DAY_LIMIT_EXCEEDED'
    );
  end if;

  -- Final archive audit. After expiration materialization this block is
  -- read-only. Every failure is stable and leaves lifecycle state unchanged.
  if exists (
    select 1
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = requested_capsule_id
      and reservation.status = 'committed'
      and not (
        exists (
          select 1 from public.memories reservation_memory
          where reservation_memory.id = reservation.memory_id
            and reservation_memory.capsule_id = reservation.capsule_id
        )
        and (
          (
            reservation.path_kind = 'photo_display'
            and exists (
              select 1 from public.photos photo
              where photo.memory_id = reservation.memory_id
                and photo.id = reservation.media_id
                and photo.storage_path = reservation.storage_path
            )
          )
          or (
            reservation.path_kind = 'photo_thumbnail'
            and exists (
              select 1 from public.photos photo
              where photo.memory_id = reservation.memory_id
                and photo.id = reservation.media_id
                and photo.thumbnail_storage_path = reservation.storage_path
            )
          )
          or (
            reservation.path_kind = 'voice'
            and exists (
              select 1 from public.voice_memos memo
              where memo.memory_id = reservation.memory_id
                and memo.id = reservation.media_id
                and memo.storage_path = reservation.storage_path
            )
          )
        )
      )
  ) or exists (
    select 1
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.capsule_id = requested_capsule_id
    group by photo.memory_id
    having count(*) > 9
  ) or (
    select count(*)
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.capsule_id = requested_capsule_id
  ) > public.journal_photo_capacity()
  or exists (
    select 1
    from public.voice_memos memo
    join public.memories memory on memory.id = memo.memory_id
    where memory.capsule_id = requested_capsule_id
    group by memo.memory_id
    having count(*) > 1
      or sum(memo.duration_seconds) > 300
      or max(memo.size_bytes) > public.journal_voice_note_max_bytes()
  ) or exists (
    select 1
    from (
      select photo.storage_path path, memory.capsule_id
      from public.photos photo
      join public.memories memory on memory.id = photo.memory_id
      union all
      select photo.thumbnail_storage_path path, memory.capsule_id
      from public.photos photo
      join public.memories memory on memory.id = photo.memory_id
      where photo.thumbnail_storage_path is not null
      union all
      select memo.storage_path path, memory.capsule_id
      from public.voice_memos memo
      join public.memories memory on memory.id = memo.memory_id
    ) external_reference
    where external_reference.path like
      'capsules/' || requested_capsule_id || '/%'
      and external_reference.capsule_id <> requested_capsule_id
  ) or exists (
    select global_media_path.path
    from (
      select photo.storage_path path
      from public.photos photo
      union all
      select photo.thumbnail_storage_path path
      from public.photos photo
      where photo.thumbnail_storage_path is not null
      union all
      select memo.storage_path path
      from public.voice_memos memo
    ) global_media_path
    where global_media_path.path like
      'capsules/' || requested_capsule_id || '/%'
    group by global_media_path.path
    having count(*) > 1
  ) or exists (
    select 1
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    left join storage.objects display_object
      on display_object.bucket_id = 'memory-media'
      and display_object.name = photo.storage_path
    left join storage.objects thumbnail_object
      on thumbnail_object.bucket_id = 'memory-media'
      and thumbnail_object.name = photo.thumbnail_storage_path
    where memory.capsule_id = requested_capsule_id
      and (
        photo.storage_path not like
          'capsules/' || requested_capsule_id || '/memories/' ||
          memory.id || '/photos/' || photo.id || '/%'
        or not (
          photo.storage_path like '%/display.' ||
            public.journal_media_extension('photo_display', photo.mime_type)
          or photo.storage_path like '%-display.' ||
            public.journal_media_extension('photo_display', photo.mime_type)
        )
        or display_object.id is null
        or lower(coalesce(display_object.metadata->>'mimetype', '')) <>
          lower(photo.mime_type)
        or case
          when coalesce(display_object.metadata->>'size', '') ~ '^[0-9]+$'
            then (display_object.metadata->>'size')::bigint <> photo.size_bytes
          else true
        end
        or (
          photo.thumbnail_storage_path is not null
          and (
            photo.thumbnail_storage_path not like
              'capsules/' || requested_capsule_id || '/memories/' ||
              memory.id || '/photos/' || photo.id || '/%'
            or not (
              photo.thumbnail_storage_path like '%/thumb.' ||
                public.journal_media_extension(
                  'photo_thumbnail', photo.thumbnail_mime_type
                )
              or photo.thumbnail_storage_path like '%-thumb.' ||
                public.journal_media_extension(
                  'photo_thumbnail', photo.thumbnail_mime_type
                )
            )
            or thumbnail_object.id is null
            or lower(coalesce(thumbnail_object.metadata->>'mimetype', '')) <>
              lower(photo.thumbnail_mime_type)
            or case
              when coalesce(thumbnail_object.metadata->>'size', '') ~
                '^[0-9]+$'
                then (thumbnail_object.metadata->>'size')::bigint <>
                  photo.thumbnail_size_bytes
              else true
            end
          )
        )
      )
  ) or exists (
    select 1
    from public.voice_memos memo
    join public.memories memory on memory.id = memo.memory_id
    left join storage.objects stored_object
      on stored_object.bucket_id = 'memory-media'
      and stored_object.name = memo.storage_path
    where memory.capsule_id = requested_capsule_id
      and (
        memo.storage_path not like
          'capsules/' || requested_capsule_id || '/memories/' ||
          memory.id || '/voice/' || memo.id || '/%'
        or memo.storage_path not like '%.' ||
          public.journal_media_extension('voice', memo.mime_type)
        or stored_object.id is null
        or lower(coalesce(stored_object.metadata->>'mimetype', '')) <>
          lower(memo.mime_type)
        or case
          when coalesce(stored_object.metadata->>'size', '') ~ '^[0-9]+$'
            then (stored_object.metadata->>'size')::bigint <> memo.size_bytes
          else true
        end
        or memo.size_bytes > public.journal_voice_note_max_bytes()
      )
  ) or exists (
    select 1
    from storage.objects stored_object
    where stored_object.bucket_id = 'memory-media'
      and stored_object.name like 'capsules/' || requested_capsule_id || '/%'
      and stored_object.name not like
        'capsules/' || requested_capsule_id || '/exports/%'
      and not exists (
        select 1 from public.photos photo
        where photo.storage_path = stored_object.name
           or photo.thumbnail_storage_path = stored_object.name
      )
      and not exists (
        select 1 from public.voice_memos memo
        where memo.storage_path = stored_object.name
      )
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'JOURNAL_ARCHIVE_AUDIT_FAILED'
    );
  end if;

  update public.journal_volume_lifecycle
  set state = 'COMPLETED', completed_at = now()
  where capsule_id = requested_capsule_id
  returning * into lifecycle;

  return jsonb_build_object(
    'ok', true,
    'lifecycleState', 'COMPLETED',
    'memoryDayCount', memory_day_count,
    'completedAt', lifecycle.completed_at
  );
end;
$$;

create or replace function public.get_journal_home(
  requested_capsule_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select jsonb_build_object(
    'ok', true,
    'capsuleId', capsule.id,
    'title', capsule.title,
    'journalTheme', public.journal_theme_json(theme),
    'lifecycleState', lifecycle.state,
    'memoryDayCount', (
      select count(*) from public.memories
      where capsule_id = capsule.id
    ),
    'completedAt', lifecycle.completed_at,
    'photoCount', (
      select count(*)
      from public.photos photo
      join public.memories memory on memory.id = photo.memory_id
      where memory.capsule_id = capsule.id
    ),
    'maxPhotos', public.journal_photo_capacity(),
    'cleanupPendingCount', (
      select count(*) from public.media_cleanup_queue cleanup
      where cleanup.capsule_id = capsule.id
        and cleanup.status <> 'deleted'
    ),
    'memories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', memory.id,
          'title', memory.title,
          'capturedAt', memory.occurred_at,
          'createdAt', memory.created_at,
          'localDate', memory.local_date,
          'localTimezone', memory.local_timezone,
          'photoCount', (select count(*) from public.photos where memory_id = memory.id),
          'voiceMemoCount', (select count(*) from public.voice_memos where memory_id = memory.id),
          'firstPhotoStoragePath', first_photo.storage_path,
          'firstPhotoWidth', first_photo.width,
          'firstPhotoHeight', first_photo.height,
          'firstThumbnailStoragePath', first_photo.thumbnail_path,
          'thumbnailWidth', first_photo.thumbnail_width,
          'thumbnailHeight', first_photo.thumbnail_height,
          'coverCropMetadata', first_photo.crop_metadata
        )
        order by memory.local_date desc, memory.created_at desc, memory.id desc
      )
      from public.memories memory
      left join lateral (
        select
          photo.storage_path,
          photo.width,
          photo.height,
          coalesce(photo.thumbnail_storage_path, photo.storage_path) thumbnail_path,
          coalesce(photo.thumbnail_width, photo.width) thumbnail_width,
          coalesce(photo.thumbnail_height, photo.height) thumbnail_height,
          photo.crop_metadata
        from public.photos photo
        where photo.memory_id = memory.id
        order by photo.order_index
        limit 1
      ) first_photo on true
      where memory.capsule_id = capsule.id
    ), '[]'::jsonb)
  ) into result
  from public.capsules capsule
  join public.journal_volume_lifecycle lifecycle
    on lifecycle.capsule_id = capsule.id
  left join public.journal_themes theme on theme.id = capsule.journal_theme_id
  where capsule.id = requested_capsule_id
    and capsule.product_type = 'journal';

  return coalesce(
    result,
    jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL')
  );
end;
$$;

revoke all on function public.update_journal_title(uuid, text) from public;
revoke all on function public.delete_journal_memory(uuid, uuid) from public;
revoke all on function public.complete_journal_volume(uuid) from public;
revoke all on function public.get_journal_home(uuid) from public;

grant execute on function public.update_journal_title(uuid, text) to authenticated;
grant execute on function public.delete_journal_memory(uuid, uuid) to authenticated;
grant execute on function public.complete_journal_volume(uuid) to authenticated;
grant execute on function public.get_journal_home(uuid) to authenticated;

-- Final transactional postconditions. Any failure rolls back the migration,
-- including the approved NULL-local_date backfill.
do $$
begin
  if exists (
    select capsule.id
    from public.capsules capsule
    left join public.journal_volume_lifecycle lifecycle
      on lifecycle.capsule_id = capsule.id
    where capsule.product_type = 'journal'
    group by capsule.id
    having count(lifecycle.capsule_id) <> 1
  ) then
    raise exception using errcode = '23514',
      message = 'JOURNAL_POSTCONDITION_LIFECYCLE_MISSING';
  end if;

  if exists (
    select memory.capsule_id from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
    group by memory.capsule_id having count(*) > 365
  ) then
    raise exception using errcode = '23514',
      message = 'JOURNAL_POSTCONDITION_DAY_LIMIT';
  end if;

  if exists (
    select 1 from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
      and (
        memory.local_date is null
        or nullif(trim(memory.local_timezone), '') is null
        or not exists (
          select 1 from pg_catalog.pg_timezone_names timezone
          where timezone.name = trim(memory.local_timezone)
        )
        or memory.local_date > (
          current_timestamp at time zone case
            when exists (
              select 1 from pg_catalog.pg_timezone_names timezone
              where timezone.name = trim(memory.local_timezone)
            ) then trim(memory.local_timezone)
            else 'UTC'
          end
        )::date
      )
  ) then
    raise exception using errcode = '23514',
      message = 'JOURNAL_POSTCONDITION_INVALID_LOCAL_IDENTITY';
  end if;

  if exists (
    select memory.capsule_id, memory.local_date
    from public.memories memory
    join public.capsules capsule on capsule.id = memory.capsule_id
    where capsule.product_type = 'journal'
    group by memory.capsule_id, memory.local_date
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'JOURNAL_POSTCONDITION_DUPLICATE_LOCAL_DATE';
  end if;

  if exists (
    select lifecycle.capsule_id
    from public.journal_volume_lifecycle lifecycle
    join public.capsules capsule on capsule.id = lifecycle.capsule_id
    left join public.memories memory on memory.capsule_id = capsule.id
    where capsule.product_type = 'journal'
      and lifecycle.state <> 'COMPLETED'
    group by lifecycle.capsule_id, lifecycle.state
    having lifecycle.state <> case count(memory.id)
      when 365 then 'FULL_REVIEW'::public.journal_volume_lifecycle_state
      else 'ACTIVE'::public.journal_volume_lifecycle_state
    end
  ) then
    raise exception using errcode = '23514',
      message = 'JOURNAL_POSTCONDITION_LIFECYCLE_MISMATCH';
  end if;
end;
$$;

commit;
