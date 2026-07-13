alter table public.capsule_fulfillment
  add column if not exists latest_scan_url text,
  add column if not exists latest_scan_at timestamptz;

create or replace function public.record_capsule_latest_scan(
  requested_token text,
  requested_scan_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_url text;
begin
  normalized_url := left(trim(coalesce(requested_scan_url, '')), 2048);

  if trim(coalesce(requested_token, '')) = '' or normalized_url = '' then
    return;
  end if;

  if normalized_url !~ '^https?://' then
    return;
  end if;

  update public.capsule_fulfillment fulfillment
  set
    latest_scan_url = normalized_url,
    latest_scan_at = now()
  from public.capsules capsule
  where capsule.id = fulfillment.capsule_id
    and capsule.public_token = requested_token;
end;
$$;

revoke all on function public.record_capsule_latest_scan(text, text) from public;
grant execute on function public.record_capsule_latest_scan(text, text) to service_role;

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
      'latestScanUrl', fulfillment.latest_scan_url,
      'latestScanAt', fulfillment.latest_scan_at,
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
      'storageEstimateBytes', coalesce(stats.storage_bytes, 0)
    )
  ) into result
  from public.capsule_fulfillment fulfillment
  join public.capsules capsule on capsule.id = fulfillment.capsule_id
  join public.capsule_batches batch on batch.id = fulfillment.batch_id
  left join public.journal_themes theme on theme.id = capsule.journal_theme_id
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
  where capsule.id = requested_capsule_id;

  return coalesce(result, jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
end;
$$;

revoke all on function public.admin_get_capsule_detail(uuid) from public;
grant execute on function public.admin_get_capsule_detail(uuid) to service_role;
