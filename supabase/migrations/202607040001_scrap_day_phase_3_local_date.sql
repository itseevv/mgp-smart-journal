alter table public.memories
  add column if not exists local_date date,
  add column if not exists local_timezone text;

create unique index if not exists memories_capsule_local_date_unique
  on public.memories(capsule_id, local_date)
  where local_date is not null;

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
declare
  target_capsule public.capsules;
  existing_memory_id uuid;
  commit_result jsonb;
begin
  select * into target_capsule
  from public.capsules
  where id = requested_capsule_id
  for update;

  if not found or not public.has_capsule_role(requested_capsule_id) then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  if target_capsule.product_type = 'journal'
    and requested_local_date is not null
  then
    select memory.id into existing_memory_id
    from public.memories memory
    where memory.capsule_id = requested_capsule_id
      and memory.id <> requested_memory_id
      and coalesce(memory.local_date, memory.occurred_at::date) =
        requested_local_date
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

  begin
    commit_result := public.commit_memory(
      requested_capsule_id,
      requested_memory_id,
      requested_title,
      requested_occurred_at,
      requested_photos,
      requested_voice_memos
    );

    if coalesce((commit_result->>'ok')::boolean, false) then
      update public.memories
      set
        local_date = requested_local_date,
        local_timezone = nullif(trim(requested_local_timezone), ''),
        updated_at = now()
      where id = requested_memory_id
        and capsule_id = requested_capsule_id;
    end if;

    return commit_result;
  exception
    when unique_violation then
      return jsonb_build_object(
        'ok', false,
        'code', 'DUPLICATE_LOCAL_DATE',
        'localDate', requested_local_date
      );
  end;
end;
$$;

revoke all on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) from public;
grant execute on function public.commit_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) to authenticated;

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
language sql
security definer
set search_path = public
as $$
  select public.commit_memory(
    requested_capsule_id,
    requested_memory_id,
    requested_title,
    requested_occurred_at,
    requested_local_date,
    requested_local_timezone,
    requested_photos,
    requested_voice_memos
  );
$$;

revoke all on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) from public;
grant execute on function public.commit_single_memory(
  uuid, uuid, text, timestamptz, date, text, jsonb, jsonb
) to authenticated;

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
  if not public.has_capsule_role(requested_capsule_id) then
    return jsonb_build_object('ok', false, 'code', 'ACCESS_DENIED');
  end if;

  select jsonb_build_object(
    'ok', true,
    'capsuleId', capsule.id,
    'title', capsule.title,
    'photoCount', (
      select count(*)
      from public.photos photo
      join public.memories memory on memory.id = photo.memory_id
      where memory.capsule_id = capsule.id
    ),
    'maxPhotos', 100,
    'cleanupPendingCount', (
      select count(*) from public.media_cleanup_queue cleanup
      where cleanup.capsule_id = capsule.id
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
          'photoCount', (
            select count(*) from public.photos where memory_id = memory.id
          ),
          'voiceMemoCount', (
            select count(*) from public.voice_memos where memory_id = memory.id
          ),
          'firstThumbnailStoragePath', first_photo.thumbnail_path,
          'thumbnailWidth', first_photo.thumbnail_width,
          'thumbnailHeight', first_photo.thumbnail_height
        )
        order by
          coalesce(memory.local_date, memory.occurred_at::date) desc,
          memory.created_at desc,
          memory.id desc
      )
      from public.memories memory
      left join lateral (
        select
          coalesce(photo.thumbnail_storage_path, photo.storage_path)
            thumbnail_path,
          coalesce(photo.thumbnail_width, photo.width) thumbnail_width,
          coalesce(photo.thumbnail_height, photo.height) thumbnail_height
        from public.photos photo
        where photo.memory_id = memory.id
        order by photo.order_index
        limit 1
      ) first_photo on true
      where memory.capsule_id = capsule.id
    ), '[]'::jsonb)
  ) into result
  from public.capsules capsule
  where capsule.id = requested_capsule_id
    and capsule.product_type = 'journal';

  return coalesce(
    result,
    jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL')
  );
end;
$$;

revoke all on function public.get_journal_home(uuid) from public;
grant execute on function public.get_journal_home(uuid) to authenticated;
