-- Remove the only pre-launch Journal fixture that predates one-Stamp-per-day
-- enforcement. Production had no customer Journals when this cleanup shipped.
-- Media paths are queued before metadata deletion so stored test objects remain
-- recoverable by the existing authenticated cleanup pipeline.
begin;

do $$
declare
  target_capsule_id constant uuid := '70442906-d2c9-4a1a-a39b-ab37ffdf66dc';
  target_memory_ids constant uuid[] := array[
    '3f5ff491-429f-4e5a-b19a-5b4d31d4337a'::uuid,
    '46ffd4a4-ac71-4c94-8cac-e0753d436dae'::uuid
  ];
  existing_target_count integer;
  verified_fixture_count integer;
  deleted_count integer;
begin
  select count(*)
  into existing_target_count
  from public.memories memory
  where memory.id = any(target_memory_ids);

  -- Clean databases and environments that never received this fixture are a
  -- valid no-op. A partial or changed match is stopped for manual review.
  if existing_target_count = 0 then
    return;
  end if;

  select count(*)
  into verified_fixture_count
  from public.memories memory
  join public.capsules capsule on capsule.id = memory.capsule_id
  where memory.id = any(target_memory_ids)
    and memory.capsule_id = target_capsule_id
    and capsule.product_type = 'journal'
    and memory.local_date is null
    and (memory.occurred_at at time zone 'UTC')::date = date '2026-06-15';

  if existing_target_count <> 2 or verified_fixture_count <> 2 then
    raise exception using
      errcode = '23514',
      message = 'PRELAUNCH_JOURNAL_FIXTURE_MISMATCH';
  end if;

  insert into public.media_cleanup_queue(capsule_id, storage_path)
  select target_capsule_id, fixture_path.storage_path
  from (
    select photo.storage_path
    from public.photos photo
    where photo.memory_id = any(target_memory_ids)
    union
    select photo.thumbnail_storage_path
    from public.photos photo
    where photo.memory_id = any(target_memory_ids)
      and photo.thumbnail_storage_path is not null
    union
    select memo.storage_path
    from public.voice_memos memo
    where memo.memory_id = any(target_memory_ids)
  ) fixture_path
  where fixture_path.storage_path is not null
  on conflict (storage_path) do nothing;

  delete from public.memories memory
  where memory.id = any(target_memory_ids)
    and memory.capsule_id = target_capsule_id;
  get diagnostics deleted_count = row_count;

  if deleted_count <> 2 then
    raise exception using
      errcode = '23514',
      message = 'PRELAUNCH_JOURNAL_FIXTURE_DELETE_INCOMPLETE';
  end if;
end;
$$;

commit;
