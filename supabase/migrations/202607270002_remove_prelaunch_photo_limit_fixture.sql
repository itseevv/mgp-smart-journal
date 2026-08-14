-- Remove the only remaining pre-launch Journal fixture that exceeds the
-- retained nine-photo rule. Production had no customer Journals when this
-- cleanup shipped. Queue its stored media before deleting the fixture metadata.
begin;

do $$
declare
  target_capsule_id constant uuid := 'ac5a42f8-1d4b-4279-ac77-a008f4c646cf';
  target_memory_id constant uuid := '1b27eccb-c980-4166-b9c2-034072419e75';
  existing_target_count integer;
  verified_fixture_count integer;
  deleted_count integer;
begin
  select count(*)
  into existing_target_count
  from public.memories memory
  where memory.id = target_memory_id;

  if existing_target_count = 0 then
    return;
  end if;

  select count(*)
  into verified_fixture_count
  from public.memories memory
  join public.capsules capsule on capsule.id = memory.capsule_id
  where memory.id = target_memory_id
    and memory.capsule_id = target_capsule_id
    and capsule.product_type = 'journal'
    and memory.local_date is null
    and (memory.occurred_at at time zone 'UTC')::date = date '2026-06-16'
    and (
      select count(*) from public.photos photo
      where photo.memory_id = memory.id
    ) = 19
    and (
      select count(*) from public.voice_memos memo
      where memo.memory_id = memory.id
    ) = 1;

  if existing_target_count <> 1 or verified_fixture_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'PRELAUNCH_PHOTO_LIMIT_FIXTURE_MISMATCH';
  end if;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select target_capsule_id, fixture_path.storage_path
  from (
    select photo.storage_path
    from public.photos photo
    where photo.memory_id = target_memory_id
    union
    select photo.thumbnail_storage_path
    from public.photos photo
    where photo.memory_id = target_memory_id
      and photo.thumbnail_storage_path is not null
    union
    select memo.storage_path
    from public.voice_memos memo
    where memo.memory_id = target_memory_id
  ) fixture_path
  where fixture_path.storage_path is not null
  on conflict (storage_path) do nothing;

  delete from public.memories memory
  where memory.id = target_memory_id
    and memory.capsule_id = target_capsule_id;
  get diagnostics deleted_count = row_count;

  if deleted_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'PRELAUNCH_PHOTO_LIMIT_FIXTURE_DELETE_INCOMPLETE';
  end if;
end;
$$;

commit;
