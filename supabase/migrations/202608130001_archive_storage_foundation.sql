-- Momento Archive / Storage Launch forward migration.
-- Keep 202607280001_journal_volume_lifecycle.sql immutable; this migration is
-- safe to apply after it whether or not that file has reached every environment.

create table public.archives (
  id uuid primary key default gen_random_uuid(),
  owner_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.archive_capsules (
  archive_id uuid not null references public.archives(id) on delete cascade,
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (archive_id, capsule_id),
  constraint archive_capsules_capsule_id_key unique (capsule_id)
);

create index archive_capsules_archive_id_idx
on public.archive_capsules(archive_id, created_at, capsule_id);

create table public.archive_storage_grants (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.archives(id) on delete cascade,
  grant_kind text not null check (grant_kind in ('starter', 'expansion', 'adjustment')),
  granted_bytes bigint not null check (granted_bytes > 0),
  created_at timestamptz not null default now()
);

create unique index archive_storage_grants_starter_key
on public.archive_storage_grants(archive_id)
where grant_kind = 'starter';

alter table public.archives enable row level security;
alter table public.archive_capsules enable row level security;
alter table public.archive_storage_grants enable row level security;

revoke all on public.archives from public, anon, authenticated;
revoke all on public.archive_capsules from public, anon, authenticated;
revoke all on public.archive_storage_grants from public, anon, authenticated;

create trigger archives_set_updated_at
before update on public.archives
for each row execute function public.set_updated_at();

create or replace function public.prevent_archive_storage_grant_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ARCHIVE_STORAGE_GRANTS_APPEND_ONLY';
end;
$$;

create trigger archive_storage_grants_append_only
before update or delete on public.archive_storage_grants
for each row execute function public.prevent_archive_storage_grant_mutation();

revoke all on function public.prevent_archive_storage_grant_mutation() from public;

create or replace function public.ensure_archive_starter_grant(
  requested_archive_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.archive_storage_grants(
    archive_id,
    grant_kind,
    granted_bytes
  ) values (
    requested_archive_id,
    'starter',
    1000000000
  )
  on conflict (archive_id) where grant_kind = 'starter' do nothing;
end;
$$;

revoke all on function public.ensure_archive_starter_grant(uuid) from public;

create or replace function public.ensure_capsule_archive(
  requested_capsule_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capsule public.capsules;
  existing_archive_id uuid;
  created_archive_id uuid;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or target_capsule.product_type <> 'journal' then
    return null;
  end if;

  select archive_id into existing_archive_id
  from public.archive_capsules
  where capsule_id = requested_capsule_id;

  if existing_archive_id is not null then
    perform public.ensure_archive_starter_grant(existing_archive_id);
    return existing_archive_id;
  end if;

  insert into public.archives(owner_auth_user_id)
  values (
    (
      select access.auth_user_id
      from public.capsule_access access
      where access.capsule_id = requested_capsule_id
        and access.role = 'owner'
      order by access.created_at, access.auth_user_id
      limit 1
    )
  )
  returning id into created_archive_id;

  insert into public.archive_capsules(archive_id, capsule_id)
  values (created_archive_id, requested_capsule_id);

  perform public.ensure_archive_starter_grant(created_archive_id);
  return created_archive_id;
end;
$$;

revoke all on function public.ensure_capsule_archive(uuid) from public;

create or replace function public.initialize_capsule_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_type = 'journal' then
    perform public.ensure_capsule_archive(new.id);
  end if;
  return new;
end;
$$;

create trigger capsules_initialize_archive
after insert or update of product_type on public.capsules
for each row execute function public.initialize_capsule_archive();

revoke all on function public.initialize_capsule_archive() from public;

create or replace function public.sync_archive_owner_from_capsule_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    update public.archives archive
    set owner_auth_user_id = new.auth_user_id,
        updated_at = now()
    from public.archive_capsules link
    where link.archive_id = archive.id
      and link.capsule_id = new.capsule_id;
  end if;
  return new;
end;
$$;

create trigger capsule_access_sync_archive_owner
after insert or update of role on public.capsule_access
for each row execute function public.sync_archive_owner_from_capsule_access();

revoke all on function public.sync_archive_owner_from_capsule_access() from public;

-- Backfill every existing Journal capsule so generated/unactivated capsules
-- also have their included capacity before activation. Active capsules inherit
-- their current owner access row; no route or access lookup is changed.
do $$
declare
  capsule_record record;
begin
  for capsule_record in
    select capsule.id
    from public.capsules capsule
    where capsule.product_type = 'journal'
    order by capsule.id
  loop
    perform public.ensure_capsule_archive(capsule_record.id);
  end loop;
end;
$$;

create or replace function public.archive_quota_summary(
  requested_archive_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  granted_bytes bigint;
  stored_optimised_photo_bytes bigint;
  stored_thumbnail_bytes bigint;
  stored_voice_note_bytes bigint;
  used_bytes bigint;
  linked_chip_count integer;
  percentage numeric;
  storage_status text;
begin
  if not exists (
    select 1 from public.archives archive where archive.id = requested_archive_id
  ) then
    return null;
  end if;

  select coalesce(sum(grant_record.granted_bytes), 0)::bigint
  into granted_bytes
  from public.archive_storage_grants grant_record
  where grant_record.archive_id = requested_archive_id;

  select count(*)::integer
  into linked_chip_count
  from public.archive_capsules link
  where link.archive_id = requested_archive_id;

  select coalesce(sum(photo.size_bytes), 0)::bigint
  into stored_optimised_photo_bytes
  from public.archive_capsules link
  join public.memories memory on memory.capsule_id = link.capsule_id
  join public.photos photo on photo.memory_id = memory.id
  where link.archive_id = requested_archive_id;

  select coalesce(sum(photo.thumbnail_size_bytes), 0)::bigint
  into stored_thumbnail_bytes
  from public.archive_capsules link
  join public.memories memory on memory.capsule_id = link.capsule_id
  join public.photos photo on photo.memory_id = memory.id
  where link.archive_id = requested_archive_id;

  select coalesce(sum(memo.size_bytes), 0)::bigint
  into stored_voice_note_bytes
  from public.archive_capsules link
  join public.memories memory on memory.capsule_id = link.capsule_id
  join public.voice_memos memo on memo.memory_id = memory.id
  where link.archive_id = requested_archive_id;

  used_bytes := stored_optimised_photo_bytes
    + stored_thumbnail_bytes
    + stored_voice_note_bytes;
  percentage := case
    when granted_bytes > 0
      then round((used_bytes::numeric * 100) / granted_bytes, 2)
    else 0
  end;
  storage_status := case
    when granted_bytes > 0 and used_bytes >= granted_bytes then 'FULL'
    when granted_bytes > 0 and used_bytes * 100 >= granted_bytes * 80 then 'WARNING'
    else 'NORMAL'
  end;

  return jsonb_build_object(
    'archiveId', requested_archive_id,
    'grantedBytes', granted_bytes,
    'usedBytes', used_bytes,
    'percentage', percentage,
    'storageStatus', storage_status,
    'linkedChipCount', linked_chip_count,
    'storedOptimisedPhotoBytes', stored_optimised_photo_bytes,
    'storedThumbnailBytes', stored_thumbnail_bytes,
    'storedVoiceNoteBytes', stored_voice_note_bytes
  );
end;
$$;

revoke all on function public.archive_quota_summary(uuid) from public;

create or replace function public.get_archive_quota_summary(
  requested_archive_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.archive_capsules link
    where link.archive_id = requested_archive_id
      and public.has_capsule_role(link.capsule_id, 'owner')
  ) then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  return public.archive_quota_summary(requested_archive_id);
end;
$$;

revoke all on function public.get_archive_quota_summary(uuid) from public;
grant execute on function public.get_archive_quota_summary(uuid) to authenticated;

-- The Journal RPC remains the route/access boundary. It now carries the same
-- canonical Archive summary that Admin reads below.
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
    'archiveQuota', quota.summary,
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
  join public.archive_capsules archive_link
    on archive_link.capsule_id = capsule.id
  left join lateral (
    select public.archive_quota_summary(archive_link.archive_id) summary
  ) quota on true
  left join public.journal_themes theme on theme.id = capsule.journal_theme_id
  where capsule.id = requested_capsule_id
    and capsule.product_type = 'journal';

  return coalesce(
    result,
    jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL')
  );
end;
$$;

-- Keep the existing Admin detail shape compatible while making its storage
-- value and new archiveQuota field use the same canonical summary.
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
      'journalTheme', public.journal_theme_json(theme),
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
      'storageEstimateBytes', coalesce(
        (quota.summary->>'usedBytes')::bigint,
        stats.storage_bytes,
        0
      ),
      'archiveQuota', quota.summary,
      'archiveId', archive_link.archive_id,
      'archiveOwnerAuthUserId', archive.owner_auth_user_id,
      'archiveGrantHistory', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', grant_record.id,
          'grantKind', grant_record.grant_kind,
          'grantedBytes', grant_record.granted_bytes,
          'createdAt', grant_record.created_at
        ) order by grant_record.created_at, grant_record.id)
        from public.archive_storage_grants grant_record
        where grant_record.archive_id = archive.id
      ), '[]'::jsonb)
    )
  ) into result
  from public.capsule_fulfillment fulfillment
  join public.capsules capsule on capsule.id = fulfillment.capsule_id
  join public.capsule_batches batch on batch.id = fulfillment.batch_id
  left join public.journal_themes theme
    on theme.id = capsule.journal_theme_id
  left join public.archive_capsules archive_link
    on archive_link.capsule_id = capsule.id
  left join public.archives archive
    on archive.id = archive_link.archive_id
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
  left join lateral (
    select public.archive_quota_summary(archive_link.archive_id) summary
  ) quota on true
  where capsule.id = requested_capsule_id;

  return coalesce(result, jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
end;
$$;

revoke all on function public.admin_get_capsule_detail(uuid) from public;
grant execute on function public.admin_get_capsule_detail(uuid) to service_role;

do $$
begin
  if exists (
    select capsule.id
    from public.capsules capsule
    left join public.archive_capsules link on link.capsule_id = capsule.id
    where capsule.product_type = 'journal'
    group by capsule.id
    having count(link.capsule_id) <> 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'ARCHIVE_POSTCONDITION_CAPSULE_LINK_MISSING';
  end if;

  if exists (
    select archive.id
    from public.archives archive
    left join public.archive_storage_grants grant_record
      on grant_record.archive_id = archive.id
      and grant_record.grant_kind = 'starter'
    join public.archive_capsules link on link.archive_id = archive.id
    join public.capsules capsule on capsule.id = link.capsule_id
    where capsule.product_type = 'journal'
    group by archive.id
    having count(grant_record.id) <> 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'ARCHIVE_POSTCONDITION_STARTER_GRANT_MISSING';
  end if;
end;
$$;
