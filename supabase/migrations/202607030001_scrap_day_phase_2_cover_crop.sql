alter table public.photos
  add column if not exists crop_metadata jsonb;

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
declare
  target_capsule public.capsules;
  other_memory_count integer;
  other_photo_count integer;
  removed_paths text[];
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id) then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  if exists (
    select 1 from public.memories
    where id = requested_memory_id
      and capsule_id <> requested_capsule_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEMORY_ID_CONFLICT');
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
    or jsonb_typeof(requested_voice_memos) <> 'array'
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

  if target_capsule.product_type = 'journal' then
    select count(*) into other_photo_count
    from public.photos photo
    join public.memories memory on memory.id = photo.memory_id
    where memory.capsule_id = requested_capsule_id
      and memory.id <> requested_memory_id;

    if other_photo_count + jsonb_array_length(requested_photos) > 100 then
      return jsonb_build_object(
        'ok', false,
        'code', 'JOURNAL_PHOTO_LIMIT',
        'photoCount', other_photo_count
      );
    end if;
  end if;

  select coalesce(array_agg(path), '{}') into removed_paths
  from (
    select storage_path path
    from public.photos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath'
        from jsonb_array_elements(requested_photos) item
      )
    union all
    select thumbnail_storage_path path
    from public.photos
    where memory_id = requested_memory_id
      and thumbnail_storage_path is not null
      and thumbnail_storage_path not in (
        select item->>'thumbnailStoragePath'
        from jsonb_array_elements(requested_photos) item
        where item->>'thumbnailStoragePath' is not null
      )
    union all
    select storage_path path
    from public.voice_memos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath'
        from jsonb_array_elements(requested_voice_memos) item
      )
  ) removed;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select requested_capsule_id, path
  from unnest(removed_paths) path
  where path is not null
  on conflict (storage_path) do update set
    status = 'pending',
    last_error = null,
    updated_at = now();

  insert into public.memories(id, capsule_id, title, occurred_at)
  values (
    requested_memory_id,
    requested_capsule_id,
    trim(requested_title),
    requested_occurred_at
  )
  on conflict (id) do update set
    title = excluded.title,
    occurred_at = excluded.occurred_at,
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

  return jsonb_build_object(
    'ok', true,
    'memoryId', requested_memory_id,
    'cleanupPendingCount', cardinality(removed_paths)
  );
end;
$$;

revoke all on function public.commit_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) from public;
grant execute on function public.commit_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) to authenticated;

create or replace function public.commit_single_memory(
  requested_capsule_id uuid,
  requested_memory_id uuid,
  requested_title text,
  requested_occurred_at timestamptz,
  requested_photos jsonb,
  requested_voice_memos jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.commit_memory(
    requested_capsule_id,
    requested_memory_id,
    requested_title,
    requested_occurred_at,
    requested_photos,
    requested_voice_memos
  );
$$;

revoke all on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) from public;
grant execute on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, jsonb, jsonb
) to authenticated;
