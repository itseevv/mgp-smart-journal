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
          'firstPhotoStoragePath', first_photo.storage_path,
          'firstPhotoWidth', first_photo.width,
          'firstPhotoHeight', first_photo.height,
          'firstThumbnailStoragePath', first_photo.thumbnail_path,
          'thumbnailWidth', first_photo.thumbnail_width,
          'thumbnailHeight', first_photo.thumbnail_height,
          'coverCropMetadata', first_photo.crop_metadata
        )
        order by
          coalesce(memory.local_date, memory.occurred_at::date) desc,
          memory.created_at desc,
          memory.id desc
      )
      from public.memories memory
      left join lateral (
        select
          photo.storage_path,
          photo.width,
          photo.height,
          coalesce(photo.thumbnail_storage_path, photo.storage_path)
            thumbnail_path,
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
