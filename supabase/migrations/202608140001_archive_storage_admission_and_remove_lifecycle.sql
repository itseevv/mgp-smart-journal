-- Momento Archive / Storage Launch Tasks 3-5.
-- This is a forward migration. The 202607280001 file remains immutable.

-- Normalize any rows created by the historical lifecycle migration before
-- retiring that table and its enum at the end of this migration.
update public.journal_volume_lifecycle
set state = 'ACTIVE', completed_at = null, updated_at = now();

create unique index if not exists journal_memories_capsule_local_date_key
on public.memories(capsule_id, local_date)
where local_date is not null;

create or replace function public.journal_archive_projected_bytes(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_final_photo_ids uuid[],
  requested_final_voice_ids uuid[],
  requested_items jsonb
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requested_archive_id uuid;
  projected_bytes numeric;
begin
  select archive_id into requested_archive_id
  from public.archive_capsules
  where capsule_id = requested_capsule_id;

  if requested_archive_id is null then
    return null;
  end if;

  -- Count persisted bytes per media path. A reservation replaces only the
  -- matching path, not the whole Memory; this keeps retained media counted
  -- while allowing a replacement upload to be admitted atomically.
  select
    (
      select coalesce(sum(photo.size_bytes), 0)
      from public.archive_capsules link
      join public.memories memory on memory.capsule_id = link.capsule_id
      join public.photos photo on photo.memory_id = memory.id
      where link.archive_id = requested_archive_id
        and memory.id <> requested_memory_id
        and not exists (
          select 1 from public.journal_media_upload_reservations reservation
          where reservation.media_id = photo.id
            and reservation.path_kind = 'photo_display'
            and reservation.status = 'reserved'
            and reservation.expires_at > now()
        )
    )
    + (
      select coalesce(sum(photo.thumbnail_size_bytes), 0)
      from public.archive_capsules link
      join public.memories memory on memory.capsule_id = link.capsule_id
      join public.photos photo on photo.memory_id = memory.id
      where link.archive_id = requested_archive_id
        and memory.id <> requested_memory_id
        and photo.thumbnail_storage_path is not null
        and not exists (
          select 1 from public.journal_media_upload_reservations reservation
          where reservation.media_id = photo.id
            and reservation.path_kind = 'photo_thumbnail'
            and reservation.status = 'reserved'
            and reservation.expires_at > now()
        )
    )
    + (
      select coalesce(sum(memo.size_bytes), 0)
      from public.archive_capsules link
      join public.memories memory on memory.capsule_id = link.capsule_id
      join public.voice_memos memo on memo.memory_id = memory.id
      where link.archive_id = requested_archive_id
        and memory.id <> requested_memory_id
        and not exists (
          select 1 from public.journal_media_upload_reservations reservation
          where reservation.media_id = memo.id
            and reservation.path_kind = 'voice'
            and reservation.status = 'reserved'
            and reservation.expires_at > now()
        )
    )
    + (
      select coalesce(sum(photo.size_bytes), 0)
      from public.photos photo
      where photo.memory_id = requested_memory_id
        and photo.id = any(coalesce(requested_final_photo_ids, '{}'::uuid[]))
        and not exists (
          select 1 from jsonb_array_elements(coalesce(requested_items, '[]'::jsonb)) item
          where item->>'mediaId' = photo.id::text
            and item->>'pathKind' = 'photo_display'
        )
    )
    + (
      select coalesce(sum(photo.thumbnail_size_bytes), 0)
      from public.photos photo
      where photo.memory_id = requested_memory_id
        and photo.id = any(coalesce(requested_final_photo_ids, '{}'::uuid[]))
        and photo.thumbnail_storage_path is not null
        and not exists (
          select 1 from jsonb_array_elements(coalesce(requested_items, '[]'::jsonb)) item
          where item->>'mediaId' = photo.id::text
            and item->>'pathKind' = 'photo_thumbnail'
        )
    )
    + (
      select coalesce(sum(memo.size_bytes), 0)
      from public.voice_memos memo
      where memo.memory_id = requested_memory_id
        and memo.id = any(coalesce(requested_final_voice_ids, '{}'::uuid[]))
        and not exists (
          select 1 from jsonb_array_elements(coalesce(requested_items, '[]'::jsonb)) item
          where item->>'mediaId' = memo.id::text
            and item->>'pathKind' = 'voice'
        )
    )
    + (
      select coalesce(sum(reservation.expected_size_bytes), 0)
      from public.journal_media_upload_reservations reservation
      join public.archive_capsules link
        on link.capsule_id = reservation.capsule_id
       and link.archive_id = requested_archive_id
      where reservation.memory_id <> requested_memory_id
        and reservation.status = 'reserved'
        and reservation.expires_at > now()
    )
    + (
      select coalesce(sum((item->>'expectedSizeBytes')::numeric), 0)
      from jsonb_array_elements(coalesce(requested_items, '[]'::jsonb)) item
    )
  into projected_bytes;

  return coalesce(projected_bytes, 0);
end;
$$;

revoke all on function public.journal_archive_projected_bytes(
  uuid, uuid, uuid[], uuid[], jsonb
) from public;

-- Storage policies use reservation ownership and expiry, not the retired
-- Journal lifecycle state.
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
begin
  folders := storage.foldername(object_name);
  if folders[1] <> 'capsules' or folders[2] is null then return false; end if;
  begin
    target_capsule_id := folders[2]::uuid;
  exception when invalid_text_representation then return false;
  end;
  if not public.has_capsule_role(target_capsule_id, 'owner') then return false; end if;
  if exists (
    select 1 from public.media_cleanup_queue cleanup
    where cleanup.storage_path = object_name
  ) then return false; end if;
  if not exists (
    select 1 from public.capsules capsule
    where capsule.id = target_capsule_id
  ) then return false; end if;
  if exists (
    select 1 from public.capsules capsule
    where capsule.id = target_capsule_id and capsule.product_type = 'bookmark'
  ) then return true; end if;
  if folders[3] <> 'memories' or folders[4] is null then return false; end if;
  begin
    target_memory_id := folders[4]::uuid;
  exception when invalid_text_representation then return false;
  end;
  return exists (
    select 1
    from public.journal_media_upload_reservations reservation
    where reservation.capsule_id = target_capsule_id
      and reservation.memory_id = target_memory_id
      and reservation.storage_path = object_name
      and reservation.requested_by = auth.uid()
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
  );
end;
$$;

revoke all on function public.can_write_capsule_media_object(text) from public;
grant execute on function public.can_write_capsule_media_object(text) to authenticated;

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
  existing_memory boolean;
  resolved_archive_id uuid;
  granted_bytes bigint;
  projected_bytes numeric;
  projected_photo_ids uuid[];
  projected_voice_ids uuid[];
  superseded_paths text[];
  item jsonb;
  reservation_id uuid;
  media_id uuid;
  path_kind text;
  extension text;
  generated_storage_path text;
  reservations jsonb := '[]'::jsonb;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if target_capsule.product_type <> 'journal' or auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if requested_expected_exists is null then
    return jsonb_build_object('ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED');
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
  if requested_expected_exists and not existing_memory then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_NOT_FOUND');
  end if;
  if not requested_expected_exists and existing_memory then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ALREADY_EXISTS');
  end if;

  perform public.expire_journal_media_reservations(requested_capsule_id);
  if exists (
    select 1 from public.media_cleanup_queue cleanup
    where cleanup.capsule_id = requested_capsule_id
      and cleanup.status <> 'deleted'
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_CLEANUP_REQUIRED');
  end if;

  if requested_memory_id is null
    or requested_final_photo_ids is null
    or requested_final_voice_ids is null
    or cardinality(requested_final_photo_ids) <> (
      select count(distinct id) from unnest(requested_final_photo_ids) id
    )
    or cardinality(requested_final_voice_ids) <> (
      select count(distinct id) from unnest(requested_final_voice_ids) id
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
          requested_item->>'pathKind', requested_item->>'expectedMimeType'
        ) is null
    )
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEDIA_RESERVATION');
  end if;

  select coalesce(array_agg(id order by id), '{}') into projected_photo_ids
  from unnest(requested_final_photo_ids) id;
  select coalesce(array_agg(id order by id), '{}') into projected_voice_ids
  from unnest(requested_final_voice_ids) id;

  if cardinality(projected_photo_ids) > 9 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_PHOTO_LIMIT');
  end if;
  if cardinality(projected_voice_ids) > 1 then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_VOICE_LIMIT');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    group by requested_item->>'mediaId', requested_item->>'pathKind'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    where requested_item->>'pathKind' in ('photo_display', 'photo_thumbnail')
    group by requested_item->>'mediaId'
    having count(*) <> 2
      or count(*) filter (where requested_item->>'pathKind' = 'photo_display') <> 1
      or count(*) filter (where requested_item->>'pathKind' = 'photo_thumbnail') <> 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEDIA_RESERVATION');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(requested_items) requested_item
    group by requested_item->>'mediaId'
    having count(distinct case
      when requested_item->>'pathKind' = 'voice' then 'voice'
      else 'photo'
    end) > 1
  ) or (
    select count(*) from jsonb_array_elements(requested_items) requested_item
    where requested_item->>'pathKind' = 'voice'
  ) > 1 or exists (
    select 1 from jsonb_array_elements(requested_items) requested_item
    where (
      requested_item->>'pathKind' in ('photo_display', 'photo_thumbnail')
      and not ((requested_item->>'mediaId')::uuid = any(projected_photo_ids))
    ) or (
      requested_item->>'pathKind' = 'voice'
      and not ((requested_item->>'mediaId')::uuid = any(projected_voice_ids))
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEDIA_RESERVATION');
  end if;

  if exists (
    select 1 from unnest(projected_photo_ids) projected_id
    join public.photos photo on photo.id = projected_id
    where photo.memory_id <> requested_memory_id
  ) or exists (
    select 1 from unnest(projected_voice_ids) projected_id
    join public.voice_memos memo on memo.id = projected_id
    where memo.memory_id <> requested_memory_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_ID_CONFLICT');
  end if;

  select archive.id into resolved_archive_id
  from public.archives archive
  join public.archive_capsules link on link.archive_id = archive.id
  where link.capsule_id = requested_capsule_id
  for update;
  select coalesce(sum(grant_record.granted_bytes), 0)::bigint into granted_bytes
  from public.archive_storage_grants grant_record
  where grant_record.archive_id = resolved_archive_id;
  projected_bytes := public.journal_archive_projected_bytes(
    requested_capsule_id, requested_memory_id, projected_photo_ids,
    projected_voice_ids, requested_items
  );
  if resolved_archive_id is null or projected_bytes is null
    or projected_bytes > granted_bytes then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_STORAGE_LIMIT');
  end if;

  with superseded as (
    update public.journal_media_upload_reservations reservation
    set status = 'superseded', updated_at = now()
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id = requested_memory_id
      and reservation.status = 'reserved'
    returning reservation.storage_path
  )
  select coalesce(array_agg(distinct superseded.storage_path), '{}') into superseded_paths
  from superseded;
  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select requested_capsule_id, path from unnest(superseded_paths) path
  on conflict (storage_path) do nothing;
  if cardinality(superseded_paths) > 0 then
    return jsonb_build_object('ok', false, 'code', 'MEDIA_CLEANUP_REQUIRED');
  end if;

  for item in select requested_item from jsonb_array_elements(requested_items) requested_item loop
    reservation_id := gen_random_uuid();
    media_id := (item->>'mediaId')::uuid;
    path_kind := item->>'pathKind';
    extension := public.journal_media_extension(path_kind, item->>'expectedMimeType');
    generated_storage_path := case
      when path_kind = 'photo_display' then
        'capsules/' || requested_capsule_id || '/memories/' || requested_memory_id ||
        '/photos/' || media_id || '/' || reservation_id || '-display.' || extension
      when path_kind = 'photo_thumbnail' then
        'capsules/' || requested_capsule_id || '/memories/' || requested_memory_id ||
        '/photos/' || media_id || '/' || reservation_id || '-thumb.' || extension
      else
        'capsules/' || requested_capsule_id || '/memories/' || requested_memory_id ||
        '/voice/' || media_id || '/' || reservation_id || '.' || extension
    end;
    insert into public.journal_media_upload_reservations(
      id, capsule_id, memory_id, media_id, path_kind, storage_path,
      expected_size_bytes, expected_mime_type, requested_by,
      expected_memory_exists, projected_photo_ids,
      projected_voice_ids, expires_at
    ) values (
      reservation_id, requested_capsule_id, requested_memory_id, media_id,
      path_kind, generated_storage_path, (item->>'expectedSizeBytes')::bigint,
      trim(item->>'expectedMimeType'), auth.uid(), requested_expected_exists,
      projected_photo_ids, projected_voice_ids, now() + interval '30 minutes'
    );
    reservations := reservations || jsonb_build_array(jsonb_build_object(
      'reservationId', reservation_id, 'mediaId', media_id,
      'pathKind', path_kind, 'storagePath', generated_storage_path,
      'expectedSizeBytes', (item->>'expectedSizeBytes')::bigint,
      'expectedMimeType', trim(item->>'expectedMimeType'),
      'expiresAt', now() + interval '30 minutes'
    ));
  end loop;
  return jsonb_build_object('ok', true, 'reservations', reservations);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'MEDIA_RESERVATION_CONFLICT');
end;
$$;

revoke all on function public.reserve_journal_media_uploads(
  uuid, uuid, boolean, uuid[], uuid[], jsonb
) from public;
grant execute on function public.reserve_journal_media_uploads(
  uuid, uuid, boolean, uuid[], uuid[], jsonb
) to authenticated;

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
  existing_memory boolean;
  existing_memory_id uuid;
  effective_timezone text;
  final_photo_ids uuid[];
  final_voice_ids uuid[];
  admission_items jsonb;
  resolved_archive_id uuid;
  granted_bytes bigint;
  projected_bytes numeric;
  removed_paths text[];
begin
  select * into target_capsule from public.capsules
  where id = requested_capsule_id for update;
  if not found or not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  if exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id and memory.capsule_id <> requested_capsule_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT');
  end if;
  select exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id and memory.capsule_id = requested_capsule_id
  ) into existing_memory;

  if target_capsule.product_type = 'journal' then
    if requested_expected_exists is null then
      return jsonb_build_object('ok', false, 'code', 'EXPECTED_EXISTENCE_REQUIRED');
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
    effective_timezone := coalesce(nullif(trim(requested_local_timezone), ''), 'UTC');
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = effective_timezone)
    then
      return jsonb_build_object('ok', false, 'code', 'INVALID_LOCAL_DATE');
    end if;
    if requested_local_date > (current_timestamp at time zone effective_timezone)::date then
      return jsonb_build_object('ok', false, 'code', 'FUTURE_LOCAL_DATE');
    end if;
    select memory.id into existing_memory_id
    from public.memories memory
    where memory.capsule_id = requested_capsule_id
      and memory.id <> requested_memory_id
      and memory.local_date = requested_local_date
    limit 1;
    if existing_memory_id is not null then
      return jsonb_build_object(
        'ok', false, 'code', 'DUPLICATE_LOCAL_DATE',
        'existingMemoryId', existing_memory_id, 'localDate', requested_local_date
      );
    end if;
  elsif exists (
    select 1 from public.memories memory
    where memory.capsule_id = requested_capsule_id and memory.id <> requested_memory_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'BOOKMARK_MEMORY_LIMIT');
  end if;

  if requested_memory_id is null or requested_title is null
    or requested_occurred_at is null or requested_photos is null
    or requested_voice_memos is null or length(trim(requested_title)) not between 1 and 200
    or jsonb_typeof(requested_photos) <> 'array'
    or jsonb_array_length(requested_photos) < 1
    or (target_capsule.product_type = 'journal' and jsonb_array_length(requested_photos) > 9)
    or jsonb_typeof(requested_voice_memos) <> 'array'
    or (target_capsule.product_type = 'journal' and jsonb_array_length(requested_voice_memos) > 1)
    or exists (
      select 1 from jsonb_array_elements(requested_voice_memos) item
      where (item->>'sizeBytes')::bigint < 0
        or (target_capsule.product_type = 'journal'
          and (item->>'sizeBytes')::bigint > public.journal_voice_note_max_bytes())
    )
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      left join storage.objects object on object.bucket_id = 'memory-media'
        and object.name = item->>'storagePath'
      where object.id is null
        or lower(coalesce(object.metadata->>'mimetype', '')) <> lower(item->>'mimeType')
        or coalesce(object.metadata->>'size', '') !~ '^[0-9]+$'
        or (object.metadata->>'size')::bigint <> (item->>'sizeBytes')::bigint
    )
    or exists (
      select 1 from jsonb_array_elements(requested_photos) item
      left join storage.objects object on object.bucket_id = 'memory-media'
        and object.name = item->>'thumbnailStoragePath'
      where item->>'thumbnailStoragePath' is not null
        and (object.id is null
          or lower(coalesce(object.metadata->>'mimetype', '')) <> lower(item->>'thumbnailMimeType')
          or coalesce(object.metadata->>'size', '') !~ '^[0-9]+$'
          or (object.metadata->>'size')::bigint <> (item->>'thumbnailSizeBytes')::bigint)
    )
    or exists (
      select 1 from jsonb_array_elements(requested_voice_memos) item
      left join storage.objects object on object.bucket_id = 'memory-media'
        and object.name = item->>'storagePath'
      where object.id is null
        or lower(coalesce(object.metadata->>'mimetype', '')) <> lower(item->>'mimeType')
        or coalesce(object.metadata->>'size', '') !~ '^[0-9]+$'
        or (object.metadata->>'size')::bigint <> (item->>'sizeBytes')::bigint)
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MEMORY');
  end if;

  select coalesce(array_agg(id order by id), '{}') into final_photo_ids
  from (select distinct (item->>'id')::uuid id from jsonb_array_elements(requested_photos) item) ids;
  select coalesce(array_agg(id order by id), '{}') into final_voice_ids
  from (select distinct (item->>'id')::uuid id from jsonb_array_elements(requested_voice_memos) item) ids;
  if target_capsule.product_type = 'journal'
    and (cardinality(final_photo_ids) > 9 or cardinality(final_voice_ids) > 1) then
    return jsonb_build_object(
      'ok', false,
      'code', case when cardinality(final_photo_ids) > 9
        then 'JOURNAL_PHOTO_LIMIT' else 'JOURNAL_VOICE_LIMIT' end
    );
  end if;

  if target_capsule.product_type = 'journal' then
    select coalesce(jsonb_agg(item), '[]'::jsonb) into admission_items
    from (
      select jsonb_build_object(
        'mediaId', item->>'id', 'pathKind', 'photo_display',
        'expectedSizeBytes', (item->>'sizeBytes')::bigint
      ) item
      from jsonb_array_elements(requested_photos) item
      where not exists (
        select 1 from public.photos photo
        where photo.id = (item->>'id')::uuid
          and photo.memory_id = requested_memory_id
          and photo.storage_path = item->>'storagePath'
      )
      union all
      select jsonb_build_object(
        'mediaId', item->>'id', 'pathKind', 'photo_thumbnail',
        'expectedSizeBytes', (item->>'thumbnailSizeBytes')::bigint
      )
      from jsonb_array_elements(requested_photos) item
      where item->>'thumbnailStoragePath' is not null
        and not exists (
          select 1 from public.photos photo
          where photo.id = (item->>'id')::uuid
            and photo.memory_id = requested_memory_id
            and photo.thumbnail_storage_path = item->>'thumbnailStoragePath'
        )
      union all
      select jsonb_build_object(
        'mediaId', item->>'id', 'pathKind', 'voice',
        'expectedSizeBytes', (item->>'sizeBytes')::bigint
      )
      from jsonb_array_elements(requested_voice_memos) item
      where not exists (
        select 1 from public.voice_memos memo
        where memo.id = (item->>'id')::uuid
          and memo.memory_id = requested_memory_id
          and memo.storage_path = item->>'storagePath'
      )
    ) additions;

    select archive.id into resolved_archive_id
    from public.archives archive
    join public.archive_capsules link on link.archive_id = archive.id
    where link.capsule_id = requested_capsule_id
    for update;
    select coalesce(sum(grant_record.granted_bytes), 0)::bigint into granted_bytes
    from public.archive_storage_grants grant_record
    where grant_record.archive_id = resolved_archive_id;
    projected_bytes := public.journal_archive_projected_bytes(
      requested_capsule_id, requested_memory_id, final_photo_ids,
      final_voice_ids, admission_items
    );
    if resolved_archive_id is null or projected_bytes is null
      or projected_bytes > granted_bytes then
      return jsonb_build_object('ok', false, 'code', 'JOURNAL_STORAGE_LIMIT');
    end if;
  end if;

  if target_capsule.product_type = 'journal' then
    if exists (
      select 1
      from (
        select (item->>'id')::uuid id, 'photo_display' kind, item->>'storagePath' path,
          (item->>'sizeBytes')::bigint size_bytes, item->>'mimeType' mime_type
        from jsonb_array_elements(requested_photos) item
        union all
        select (item->>'id')::uuid, 'photo_thumbnail', item->>'thumbnailStoragePath',
          (item->>'thumbnailSizeBytes')::bigint, item->>'thumbnailMimeType'
        from jsonb_array_elements(requested_photos) item
        where item->>'thumbnailStoragePath' is not null
        union all
        select (item->>'id')::uuid, 'voice', item->>'storagePath',
          (item->>'sizeBytes')::bigint, item->>'mimeType'
        from jsonb_array_elements(requested_voice_memos) item
      ) requested
      where not (
        exists (
          select 1 from public.photos photo
          where photo.memory_id = requested_memory_id and photo.id = requested.id
            and ((requested.kind = 'photo_display' and photo.storage_path = requested.path)
              or (requested.kind = 'photo_thumbnail' and photo.thumbnail_storage_path = requested.path))
        ) or exists (
          select 1 from public.voice_memos memo
          where memo.memory_id = requested_memory_id and memo.id = requested.id
            and requested.kind = 'voice' and memo.storage_path = requested.path
        )
      )
      and not exists (
        select 1 from public.journal_media_upload_reservations reservation
        where reservation.capsule_id = requested_capsule_id
          and reservation.memory_id = requested_memory_id
          and reservation.media_id = requested.id
          and reservation.path_kind = requested.kind
          and reservation.storage_path = requested.path
          and reservation.expected_size_bytes = requested.size_bytes
          and lower(reservation.expected_mime_type) = lower(requested.mime_type)
          and reservation.requested_by = auth.uid()
          and reservation.status = 'reserved'
          and reservation.expires_at > now()
      )
    ) then
      return jsonb_build_object('ok', false, 'code', 'MEDIA_RESERVATION_REQUIRED');
    end if;
    update public.journal_media_upload_reservations reservation
    set status = 'committed', committed_at = now(), updated_at = now()
    where reservation.capsule_id = requested_capsule_id
      and reservation.memory_id = requested_memory_id
      and reservation.requested_by = auth.uid()
      and reservation.status = 'reserved'
      and reservation.expires_at > now()
      and reservation.projected_photo_ids = final_photo_ids
      and reservation.projected_voice_ids = final_voice_ids;
  end if;

  select coalesce(array_agg(distinct path), '{}') into removed_paths
  from (
    select photo.storage_path path from public.photos photo
    where photo.memory_id = requested_memory_id and photo.storage_path not in
      (select item->>'storagePath' from jsonb_array_elements(requested_photos) item)
    union select photo.thumbnail_storage_path from public.photos photo
    where photo.memory_id = requested_memory_id and photo.thumbnail_storage_path is not null
      and photo.thumbnail_storage_path not in
        (select item->>'thumbnailStoragePath' from jsonb_array_elements(requested_photos) item)
    union select memo.storage_path from public.voice_memos memo
    where memo.memory_id = requested_memory_id and memo.storage_path not in
      (select item->>'storagePath' from jsonb_array_elements(requested_voice_memos) item)
  ) removed;
  update public.journal_media_upload_reservations reservation
  set status = 'superseded', committed_at = null, updated_at = now()
  where reservation.capsule_id = requested_capsule_id
    and reservation.storage_path = any(removed_paths)
    and reservation.status in ('reserved', 'committed');
  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select requested_capsule_id, path from unnest(removed_paths) path where path is not null
  on conflict (storage_path) do nothing;

  insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
  values (
    requested_memory_id, requested_capsule_id, trim(requested_title), requested_occurred_at,
    case when target_capsule.product_type = 'journal' then requested_local_date else null end,
    case when target_capsule.product_type = 'journal' then effective_timezone else null end
  )
  on conflict (id) do update set
    title = excluded.title, occurred_at = excluded.occurred_at,
    local_date = case when target_capsule.product_type = 'journal'
      then excluded.local_date else public.memories.local_date end,
    local_timezone = case when target_capsule.product_type = 'journal'
      then excluded.local_timezone else public.memories.local_timezone end,
    updated_at = now();
  delete from public.photos where memory_id = requested_memory_id
    and id not in (select (item->>'id')::uuid from jsonb_array_elements(requested_photos) item);
  update public.photos photo set
    storage_path = item.storage_path, order_index = item.order_index,
    mime_type = item.mime_type, size_bytes = item.size_bytes,
    width = item.width, height = item.height,
    thumbnail_storage_path = item.thumbnail_storage_path,
    thumbnail_mime_type = item.thumbnail_mime_type,
    thumbnail_size_bytes = item.thumbnail_size_bytes,
    thumbnail_width = item.thumbnail_width, thumbnail_height = item.thumbnail_height,
    crop_metadata = item.crop_metadata
  from (
    select (value->>'id')::uuid id, value->>'storagePath' storage_path,
      (value->>'orderIndex')::integer order_index, value->>'mimeType' mime_type,
      (value->>'sizeBytes')::bigint size_bytes, nullif(value->>'width', '')::integer width,
      nullif(value->>'height', '')::integer height, value->>'thumbnailStoragePath' thumbnail_storage_path,
      value->>'thumbnailMimeType' thumbnail_mime_type,
      nullif(value->>'thumbnailSizeBytes', '')::bigint thumbnail_size_bytes,
      nullif(value->>'thumbnailWidth', '')::integer thumbnail_width,
      nullif(value->>'thumbnailHeight', '')::integer thumbnail_height,
      value->'cropMetadata' crop_metadata
    from jsonb_array_elements(requested_photos) value
  ) item where photo.id = item.id and photo.memory_id = requested_memory_id;
  insert into public.photos(
    id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height,
    thumbnail_storage_path, thumbnail_mime_type, thumbnail_size_bytes,
    thumbnail_width, thumbnail_height, crop_metadata
  )
  select (item->>'id')::uuid, requested_memory_id, item->>'storagePath',
    (item->>'orderIndex')::integer, item->>'mimeType', (item->>'sizeBytes')::bigint,
    nullif(item->>'width', '')::integer, nullif(item->>'height', '')::integer,
    item->>'thumbnailStoragePath', item->>'thumbnailMimeType',
    nullif(item->>'thumbnailSizeBytes', '')::bigint,
    nullif(item->>'thumbnailWidth', '')::integer,
    nullif(item->>'thumbnailHeight', '')::integer, item->'cropMetadata'
  from jsonb_array_elements(requested_photos) item
  where not exists (select 1 from public.photos where id = (item->>'id')::uuid);
  delete from public.voice_memos where memory_id = requested_memory_id
    and id not in (select (item->>'id')::uuid from jsonb_array_elements(requested_voice_memos) item);
  update public.voice_memos memo set
    title = item.title, storage_path = item.storage_path, order_index = item.order_index,
    duration_seconds = item.duration_seconds, mime_type = item.mime_type,
    size_bytes = item.size_bytes, created_at = item.created_at
  from (
    select (value->>'id')::uuid id,
      coalesce(nullif(trim(value->>'title'), ''), 'Voice memo ' || ((value->>'orderIndex')::integer + 1)) title,
      value->>'storagePath' storage_path, (value->>'orderIndex')::integer order_index,
      (value->>'durationSeconds')::integer duration_seconds, value->>'mimeType' mime_type,
      (value->>'sizeBytes')::bigint size_bytes, coalesce((value->>'createdAt')::timestamptz, now()) created_at
    from jsonb_array_elements(requested_voice_memos) value
  ) item where memo.id = item.id and memo.memory_id = requested_memory_id;
  insert into public.voice_memos(
    id, memory_id, title, storage_path, order_index, duration_seconds,
    mime_type, size_bytes, created_at
  )
  select (item->>'id')::uuid, requested_memory_id,
    coalesce(nullif(trim(item->>'title'), ''), 'Voice memo ' || ((item->>'orderIndex')::integer + 1)),
    item->>'storagePath', (item->>'orderIndex')::integer,
    (item->>'durationSeconds')::integer, item->>'mimeType',
    (item->>'sizeBytes')::bigint, coalesce((item->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(requested_voice_memos) item
  where not exists (select 1 from public.voice_memos where id = (item->>'id')::uuid);
  return jsonb_build_object(
    'ok', true, 'memoryId', requested_memory_id,
    'cleanupPendingCount', cardinality(removed_paths)
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'DUPLICATE_LOCAL_DATE', 'localDate', requested_local_date);
end;
$$;

revoke all on function public.commit_memory_with_lifecycle(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb, boolean
) from public;

create or replace function public.update_journal_title(
  requested_capsule_id uuid, requested_title text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare next_title text;
begin
  if not exists (
    select 1 from public.capsules capsule
    where capsule.id = requested_capsule_id
      and capsule.product_type = 'journal'
      and public.has_capsule_role(requested_capsule_id, 'owner')
  ) then return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED'); end if;
  next_title := coalesce(nullif(trim(requested_title), ''), 'My Journal');
  if length(next_title) > 100 then return jsonb_build_object('ok', false, 'code', 'TITLE_TOO_LONG'); end if;
  update public.capsules set title = next_title where id = requested_capsule_id;
  return jsonb_build_object('ok', true, 'title', next_title);
end;
$$;

create or replace function public.delete_journal_memory(
  requested_capsule_id uuid, requested_memory_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare removed_paths text[]; existing_memory boolean;
  target_capsule public.capsules;
begin
  select * into target_capsule from public.capsules
  where id = requested_capsule_id for update;
  if not found or target_capsule.product_type <> 'journal'
    or not public.has_capsule_role(requested_capsule_id, 'owner')
  then return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED'); end if;
  if exists (
    select 1 from public.memories memory
    where memory.id = requested_memory_id and memory.capsule_id <> requested_capsule_id
  ) then return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT'); end if;
  select exists (select 1 from public.memories where id = requested_memory_id
    and capsule_id = requested_capsule_id) into existing_memory;
  select coalesce(array_agg(distinct path), '{}') into removed_paths from (
    select photo.storage_path path from public.photos photo where photo.memory_id = requested_memory_id
    union select photo.thumbnail_storage_path from public.photos photo
      where photo.memory_id = requested_memory_id and photo.thumbnail_storage_path is not null
    union select memo.storage_path from public.voice_memos memo where memo.memory_id = requested_memory_id
    union select reservation.storage_path from public.journal_media_upload_reservations reservation
      where reservation.capsule_id = requested_capsule_id and reservation.memory_id = requested_memory_id
        and reservation.status in ('reserved', 'committed')
  ) paths;
  if not existing_memory and cardinality(removed_paths) = 0 then
    return jsonb_build_object('ok', true, 'deleted', false, 'cleanupPendingCount', 0);
  end if;
  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select requested_capsule_id, path from unnest(removed_paths) path where path is not null
  on conflict (storage_path) do nothing;
  update public.journal_media_upload_reservations
  set status = 'superseded', committed_at = null, updated_at = now()
  where capsule_id = requested_capsule_id and memory_id = requested_memory_id
    and status in ('reserved', 'committed');
  delete from public.memories where id = requested_memory_id and capsule_id = requested_capsule_id;
  return jsonb_build_object('ok', true, 'deleted', existing_memory,
    'cleanupPendingCount', cardinality(removed_paths));
end;
$$;

drop function if exists public.complete_journal_volume(uuid);

create or replace function public.get_journal_home(requested_capsule_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.has_capsule_role(requested_capsule_id, 'owner') then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;
  select jsonb_build_object(
    'ok', true, 'capsuleId', capsule.id, 'title', capsule.title,
    'journalTheme', public.journal_theme_json(theme),
    'photoCount', (select count(*) from public.photos photo join public.memories memory
      on memory.id = photo.memory_id where memory.capsule_id = capsule.id),
    'cleanupPendingCount', (select count(*) from public.media_cleanup_queue cleanup
      where cleanup.capsule_id = capsule.id and cleanup.status <> 'deleted'),
    'archiveQuota', public.archive_quota_summary(archive_link.archive_id),
    'memories', coalesce((select jsonb_agg(jsonb_build_object(
      'id', memory.id, 'title', memory.title, 'capturedAt', memory.occurred_at,
      'createdAt', memory.created_at, 'localDate', memory.local_date,
      'localTimezone', memory.local_timezone,
      'photoCount', (select count(*) from public.photos where memory_id = memory.id),
      'voiceMemoCount', (select count(*) from public.voice_memos where memory_id = memory.id),
      'firstPhotoStoragePath', first_photo.storage_path,
      'firstPhotoWidth', first_photo.width, 'firstPhotoHeight', first_photo.height,
      'firstThumbnailStoragePath', first_photo.thumbnail_path,
      'thumbnailWidth', first_photo.thumbnail_width, 'thumbnailHeight', first_photo.thumbnail_height,
      'coverCropMetadata', first_photo.crop_metadata
    ) order by memory.local_date desc, memory.created_at desc, memory.id desc)
      from public.memories memory left join lateral (
        select photo.storage_path, photo.width, photo.height,
          coalesce(photo.thumbnail_storage_path, photo.storage_path) thumbnail_path,
          coalesce(photo.thumbnail_width, photo.width) thumbnail_width,
          coalesce(photo.thumbnail_height, photo.height) thumbnail_height,
          photo.crop_metadata from public.photos photo
        where photo.memory_id = memory.id order by photo.order_index limit 1
      ) first_photo on true where memory.capsule_id = capsule.id), '[]'::jsonb)
  ) into result
  from public.capsules capsule
  join public.archive_capsules archive_link on archive_link.capsule_id = capsule.id
  left join public.journal_themes theme on theme.id = capsule.journal_theme_id
  where capsule.id = requested_capsule_id and capsule.product_type = 'journal';
  return coalesce(result, jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL'));
end;
$$;

revoke all on function public.update_journal_title(uuid, text) from public;
revoke all on function public.delete_journal_memory(uuid, uuid) from public;
revoke all on function public.get_journal_home(uuid) from public;
grant execute on function public.update_journal_title(uuid, text) to authenticated;
grant execute on function public.delete_journal_memory(uuid, uuid) to authenticated;
grant execute on function public.get_journal_home(uuid) to authenticated;

-- Remove the retired lifecycle storage and enum after all active RPCs and
-- Storage policies have been replaced above. Reservation rows retain their
-- durable admission history without a lifecycle-state column.
alter table public.journal_media_upload_reservations
  drop column if exists lifecycle_state;
drop trigger if exists capsules_initialize_journal_volume_lifecycle
  on public.capsules;
drop function if exists public.initialize_journal_volume_lifecycle();
drop trigger if exists journal_volume_lifecycle_set_updated_at
  on public.journal_volume_lifecycle;
drop table if exists public.journal_volume_lifecycle;
drop type if exists public.journal_volume_lifecycle_state;
