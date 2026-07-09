create or replace function public.admin_generate_capsule_batch(
  requested_batch_name text,
  requested_product_type public.capsule_product_type,
  requested_quantity integer,
  requested_serial_prefix text default null,
  requested_notes text default null,
  requested_actor text default null,
  requested_journal_theme_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  normalized_prefix text;
  batch_year integer;
  start_serial integer;
  batch_id uuid;
  token text;
  serial text;
  capsule_id uuid;
  created_capsules jsonb := '[]'::jsonb;
  token_attempt integer;
  index_value integer;
  theme_record public.journal_themes;
begin
  normalized_name := trim(coalesce(requested_batch_name, ''));
  normalized_prefix := upper(trim(coalesce(
    requested_serial_prefix,
    case
      when requested_product_type = 'journal' then 'JNL'
      when requested_product_type = 'bookmark' then 'BMK'
      else null
    end
  )));
  batch_year := extract(year from now())::integer;

  if normalized_name = ''
    or length(normalized_name) > 120
    or requested_product_type is null
    or requested_quantity is null
    or requested_quantity < 1
    or requested_quantity > 500
    or normalized_prefix !~ '^[A-Z0-9]{3,8}$'
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  if requested_product_type = 'journal' and requested_journal_theme_id is null then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_THEME_REQUIRED');
  end if;

  if requested_product_type = 'journal' then
    select * into theme_record
    from public.journal_themes
    where id = requested_journal_theme_id;

    if theme_record.id is null or theme_record.status <> 'active' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_JOURNAL_THEME');
    end if;
  end if;

  insert into public.capsule_serial_counters(
    serial_prefix,
    serial_year,
    next_value
  ) values (
    normalized_prefix,
    batch_year,
    1
  )
  on conflict (serial_prefix, serial_year) do nothing;

  select next_value into start_serial
  from public.capsule_serial_counters
  where serial_prefix = normalized_prefix
    and serial_year = batch_year
  for update;

  update public.capsule_serial_counters
  set next_value = next_value + requested_quantity
  where serial_prefix = normalized_prefix
    and serial_year = batch_year;

  insert into public.capsule_batches(
    batch_name,
    product_type,
    quantity,
    serial_prefix,
    serial_year,
    notes,
    created_by
  ) values (
    normalized_name,
    requested_product_type,
    requested_quantity,
    normalized_prefix,
    batch_year,
    nullif(trim(coalesce(requested_notes, '')), ''),
    nullif(trim(coalesce(requested_actor, '')), '')
  )
  returning id into batch_id;

  for index_value in 0..(requested_quantity - 1) loop
    serial := normalized_prefix || '-' || batch_year || '-' ||
      lpad((start_serial + index_value)::text, 4, '0');

    token_attempt := 0;
    loop
      token_attempt := token_attempt + 1;
      token := encode(extensions.gen_random_bytes(24), 'hex');
      begin
        insert into public.capsules(
          public_token,
          product_type,
          status,
          journal_theme_id
        )
        values (
          token,
          requested_product_type,
          'unactivated',
          case
            when requested_product_type = 'journal' then theme_record.id
            else null
          end
        )
        returning id into capsule_id;
        exit;
      exception
        when unique_violation then
          if token_attempt >= 5 then
            raise exception 'public token collision';
          end if;
      end;
    end loop;

    insert into public.capsule_fulfillment(
      capsule_id,
      batch_id,
      serial_number
    ) values (
      capsule_id,
      batch_id,
      serial
    );

    created_capsules := created_capsules || jsonb_build_array(
      jsonb_build_object(
        'id', capsule_id,
        'publicToken', token,
        'serialNumber', serial,
        'productType', requested_product_type,
        'journalTheme', case
          when requested_product_type = 'journal' then public.journal_theme_json(theme_record)
          else null
        end
      )
    );
  end loop;

  insert into public.admin_action_audit(
    action_type,
    batch_id,
    actor,
    metadata
  ) values (
    'capsule_batch_generated',
    batch_id,
    nullif(trim(coalesce(requested_actor, '')), ''),
    jsonb_build_object(
      'quantity', requested_quantity,
      'productType', requested_product_type,
      'serialPrefix', normalized_prefix,
      'journalThemeId', case
        when requested_product_type = 'journal' then theme_record.id
        else null
      end
    )
  );

  return jsonb_build_object(
    'ok', true,
    'batchId', batch_id,
    'capsules', created_capsules
  );
end;
$$;

create or replace function public.admin_generate_capsule_batch(
  requested_batch_name text,
  requested_product_type public.capsule_product_type,
  requested_quantity integer,
  requested_serial_prefix text default null,
  requested_notes text default null,
  requested_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_product_type = 'journal' then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_THEME_REQUIRED');
  end if;

  return public.admin_generate_capsule_batch(
    requested_batch_name,
    requested_product_type,
    requested_quantity,
    requested_serial_prefix,
    requested_notes,
    requested_actor,
    null
  );
end;
$$;
