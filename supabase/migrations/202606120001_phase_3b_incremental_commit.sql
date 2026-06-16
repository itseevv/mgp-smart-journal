alter table public.photos
  drop constraint photos_memory_id_order_index_key;
alter table public.photos
  add constraint photos_memory_id_order_index_key
  unique (memory_id, order_index)
  deferrable initially deferred;

alter table public.voice_memos
  drop constraint voice_memos_memory_id_order_index_key;
alter table public.voice_memos
  add constraint voice_memos_memory_id_order_index_key
  unique (memory_id, order_index)
  deferrable initially deferred;

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
        select item->>'storagePath'
        from jsonb_array_elements(requested_photos) item
      )
    union all
    select storage_path path from public.voice_memos
    where memory_id = requested_memory_id
      and storage_path not in (
        select item->>'storagePath'
        from jsonb_array_elements(requested_voice_memos) item
      )
  ) removed;

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
    height = item.height
  from (
    select
      (value->>'id')::uuid id,
      value->>'storagePath' storage_path,
      (value->>'orderIndex')::integer order_index,
      value->>'mimeType' mime_type,
      (value->>'sizeBytes')::bigint size_bytes,
      nullif(value->>'width', '')::integer width,
      nullif(value->>'height', '')::integer height
    from jsonb_array_elements(requested_photos) value
  ) item
  where photo.id = item.id
    and photo.memory_id = requested_memory_id;

  insert into public.photos(
    id,
    memory_id,
    storage_path,
    order_index,
    mime_type,
    size_bytes,
    width,
    height
  )
  select
    (item->>'id')::uuid,
    requested_memory_id,
    item->>'storagePath',
    (item->>'orderIndex')::integer,
    item->>'mimeType',
    (item->>'sizeBytes')::bigint,
    nullif(item->>'width', '')::integer,
    nullif(item->>'height', '')::integer
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
    id,
    memory_id,
    title,
    storage_path,
    order_index,
    duration_seconds,
    mime_type,
    size_bytes,
    created_at
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

  return jsonb_build_object('removedPaths', to_jsonb(removed_paths));
end;
$$;

revoke all on function public.commit_single_memory(
  uuid,
  uuid,
  text,
  timestamptz,
  jsonb,
  jsonb
) from public;
grant execute on function public.commit_single_memory(
  uuid,
  uuid,
  text,
  timestamptz,
  jsonb,
  jsonb
) to authenticated;
