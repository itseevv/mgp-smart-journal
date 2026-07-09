create table if not exists public.journal_themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  sort_order integer not null default 0,
  texture_storage_path text,
  texture_public_url text,
  texture_width integer check (texture_width is null or texture_width > 0),
  texture_height integer check (texture_height is null or texture_height > 0),
  texture_mime_type text,
  focus_x numeric not null default 0.5 check (focus_x >= 0 and focus_x <= 1),
  focus_y numeric not null default 0.5 check (focus_y >= 0 and focus_y <= 1),
  zoom numeric not null default 1.0 check (zoom >= 1 and zoom <= 3),
  overlay_color text,
  overlay_opacity numeric not null default 0 check (overlay_opacity >= 0 and overlay_opacity <= 1),
  fallback_background_color text not null default '#6f2730',
  text_primary text not null default '#fff3df',
  text_secondary text not null default '#d7c2aa',
  paper_surface text not null default '#f3ead8',
  paper_surface_muted text not null default '#e6d8bf',
  stamp_border text not null default '#7d3a3d',
  accent_color text not null default '#d6aa72',
  logo_variant text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_themes enable row level security;
revoke all on public.journal_themes from anon, authenticated;

drop trigger if exists journal_themes_set_updated_at on public.journal_themes;
create trigger journal_themes_set_updated_at
before update on public.journal_themes
for each row execute function public.set_updated_at();

create index if not exists journal_themes_status_sort_idx
  on public.journal_themes(status, sort_order, name);

alter table public.capsules
  add column if not exists journal_theme_id uuid
  references public.journal_themes(id);

create index if not exists capsules_journal_theme_id_idx
  on public.capsules(journal_theme_id);

insert into public.journal_themes(
  slug,
  name,
  description,
  status,
  sort_order,
  fallback_background_color,
  text_primary,
  text_secondary,
  paper_surface,
  paper_surface_muted,
  stamp_border,
  accent_color,
  logo_variant
) values
  ('ruby-red', 'Ruby leather', 'Placeholder ruby leather identity.', 'active', 10, '#4b2028', '#f7efe2', '#d9c8b7', '#f1e7d2', '#e1d4bb', '#7d3a3d', '#b89a62', 'light'),
  ('black', 'Black leather', 'Placeholder black leather identity.', 'active', 20, '#181614', '#f4ecdf', '#cfc4b5', '#efe4d1', '#dccbb0', '#3a332d', '#b89860', 'light'),
  ('dark-brown', 'Dark brown leather', 'Placeholder dark brown leather identity.', 'active', 30, '#3c261b', '#f7ecdb', '#d8c3ad', '#f2e5cf', '#dfcbb0', '#6c4630', '#c09a61', 'light'),
  ('cream', 'Cream leather', 'Placeholder cream leather identity.', 'active', 40, '#d8c9ab', '#2d2921', '#6f6552', '#f5eddd', '#e7dbc6', '#8b795d', '#8d6f37', 'dark'),
  ('teal', 'Teal leather', 'Placeholder teal leather identity.', 'active', 50, '#124f4d', '#f4efe1', '#c9d8cd', '#efe7d6', '#d9cab1', '#2d7069', '#c6a063', 'light'),
  ('blush', 'Blush leather', 'Placeholder blush leather identity.', 'active', 60, '#b97878', '#fff8ed', '#f2d7cf', '#f5ead8', '#e7d6bf', '#9a5f5e', '#b98b58', 'light'),
  ('sepia', 'Sepia leather', 'Placeholder sepia leather identity.', 'active', 70, '#6f5135', '#fff1dd', '#dfc5a2', '#f2e2c8', '#dec6a5', '#87613d', '#c49a5d', 'light'),
  ('olive', 'Olive leather', 'Placeholder olive leather identity.', 'active', 80, '#4f5a3f', '#f6eedb', '#d1d6bd', '#f1e6d0', '#ded0b3', '#66705a', '#b99b5f', 'light'),
  ('navy', 'Navy leather', 'Placeholder navy leather identity.', 'active', 90, '#1d3046', '#f4ecdf', '#c6d0dc', '#eee3d0', '#d8c8ad', '#344b68', '#b8945f', 'light')
on conflict (slug) do nothing;

create or replace function public.journal_theme_json(theme public.journal_themes)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when theme.id is null then null
    else jsonb_build_object(
      'id', theme.id,
      'slug', theme.slug,
      'name', theme.name,
      'description', theme.description,
      'status', theme.status,
      'sortOrder', theme.sort_order,
      'textureStoragePath', theme.texture_storage_path,
      'textureUrl', theme.texture_public_url,
      'texturePublicUrl', theme.texture_public_url,
      'textureWidth', theme.texture_width,
      'textureHeight', theme.texture_height,
      'textureMimeType', theme.texture_mime_type,
      'focusX', theme.focus_x,
      'focusY', theme.focus_y,
      'zoom', theme.zoom,
      'overlayColor', theme.overlay_color,
      'overlayOpacity', theme.overlay_opacity,
      'fallbackBackgroundColor', theme.fallback_background_color,
      'textPrimary', theme.text_primary,
      'textSecondary', theme.text_secondary,
      'paperSurface', theme.paper_surface,
      'paperSurfaceMuted', theme.paper_surface_muted,
      'stampBorder', theme.stamp_border,
      'accentColor', theme.accent_color,
      'logoVariant', theme.logo_variant,
      'createdAt', theme.created_at,
      'updatedAt', theme.updated_at
    )
  end;
$$;

create or replace function public.admin_list_journal_themes(
  requested_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_status text;
  result jsonb;
begin
  normalized_status := nullif(lower(trim(coalesce(requested_status, ''))), '');

  if normalized_status is not null
    and normalized_status not in ('draft', 'active', 'archived')
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  select jsonb_build_object(
    'ok', true,
    'themes', coalesce(jsonb_agg(
      public.journal_theme_json(theme) ||
      jsonb_build_object(
        'assignedCapsuleCount', coalesce(stats.assigned_capsule_count, 0)
      )
      order by theme.sort_order asc, theme.name asc, theme.id asc
    ), '[]'::jsonb)
  ) into result
  from public.journal_themes theme
  left join lateral (
    select count(*)::integer assigned_capsule_count
    from public.capsules capsule
    where capsule.journal_theme_id = theme.id
  ) stats on true
  where normalized_status is null or theme.status = normalized_status;

  return result;
end;
$$;

create or replace function public.admin_get_journal_theme(
  requested_theme_id uuid
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
    'theme', public.journal_theme_json(theme) ||
      jsonb_build_object(
        'assignedCapsuleCount', (
          select count(*)::integer
          from public.capsules capsule
          where capsule.journal_theme_id = theme.id
        )
      )
  ) into result
  from public.journal_themes theme
  where theme.id = requested_theme_id;

  return coalesce(result, jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
end;
$$;

create or replace function public.admin_upsert_journal_theme(
  requested_theme_id uuid default null,
  requested_slug text default null,
  requested_name text default null,
  requested_description text default null,
  requested_status text default 'draft',
  requested_sort_order integer default 0,
  requested_texture_storage_path text default null,
  requested_texture_public_url text default null,
  requested_texture_width integer default null,
  requested_texture_height integer default null,
  requested_texture_mime_type text default null,
  requested_focus_x numeric default 0.5,
  requested_focus_y numeric default 0.5,
  requested_zoom numeric default 1,
  requested_overlay_color text default null,
  requested_overlay_opacity numeric default 0,
  requested_fallback_background_color text default '#6f2730',
  requested_text_primary text default '#fff3df',
  requested_text_secondary text default '#d7c2aa',
  requested_paper_surface text default '#f3ead8',
  requested_paper_surface_muted text default '#e6d8bf',
  requested_stamp_border text default '#7d3a3d',
  requested_accent_color text default '#d6aa72',
  requested_logo_variant text default 'light',
  requested_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_slug text;
  normalized_name text;
  normalized_status text;
  saved_theme_id uuid;
begin
  normalized_slug := lower(trim(coalesce(requested_slug, '')));
  normalized_name := trim(coalesce(requested_name, ''));
  normalized_status := lower(trim(coalesce(requested_status, 'draft')));

  if normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(normalized_slug) > 80
    or length(normalized_name) not between 1 and 120
    or normalized_status not in ('draft', 'active', 'archived')
    or requested_focus_x is null
    or requested_focus_x < 0
    or requested_focus_x > 1
    or requested_focus_y is null
    or requested_focus_y < 0
    or requested_focus_y > 1
    or requested_zoom is null
    or requested_zoom < 1
    or requested_zoom > 3
    or requested_overlay_opacity is null
    or requested_overlay_opacity < 0
    or requested_overlay_opacity > 1
    or trim(coalesce(requested_fallback_background_color, '')) = ''
    or trim(coalesce(requested_text_primary, '')) = ''
    or trim(coalesce(requested_text_secondary, '')) = ''
    or trim(coalesce(requested_paper_surface, '')) = ''
    or trim(coalesce(requested_paper_surface_muted, '')) = ''
    or trim(coalesce(requested_stamp_border, '')) = ''
    or trim(coalesce(requested_accent_color, '')) = ''
    or trim(coalesce(requested_logo_variant, '')) = ''
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  if requested_theme_id is null then
    insert into public.journal_themes(
      slug,
      name,
      description,
      status,
      sort_order,
      texture_storage_path,
      texture_public_url,
      texture_width,
      texture_height,
      texture_mime_type,
      focus_x,
      focus_y,
      zoom,
      overlay_color,
      overlay_opacity,
      fallback_background_color,
      text_primary,
      text_secondary,
      paper_surface,
      paper_surface_muted,
      stamp_border,
      accent_color,
      logo_variant
    ) values (
      normalized_slug,
      normalized_name,
      nullif(trim(coalesce(requested_description, '')), ''),
      normalized_status,
      coalesce(requested_sort_order, 0),
      nullif(trim(coalesce(requested_texture_storage_path, '')), ''),
      nullif(trim(coalesce(requested_texture_public_url, '')), ''),
      requested_texture_width,
      requested_texture_height,
      nullif(trim(coalesce(requested_texture_mime_type, '')), ''),
      requested_focus_x,
      requested_focus_y,
      requested_zoom,
      nullif(trim(coalesce(requested_overlay_color, '')), ''),
      requested_overlay_opacity,
      trim(requested_fallback_background_color),
      trim(requested_text_primary),
      trim(requested_text_secondary),
      trim(requested_paper_surface),
      trim(requested_paper_surface_muted),
      trim(requested_stamp_border),
      trim(requested_accent_color),
      trim(requested_logo_variant)
    )
    returning id into saved_theme_id;
  else
    update public.journal_themes
    set slug = normalized_slug,
        name = normalized_name,
        description = nullif(trim(coalesce(requested_description, '')), ''),
        status = normalized_status,
        sort_order = coalesce(requested_sort_order, 0),
        texture_storage_path = nullif(trim(coalesce(requested_texture_storage_path, '')), ''),
        texture_public_url = nullif(trim(coalesce(requested_texture_public_url, '')), ''),
        texture_width = requested_texture_width,
        texture_height = requested_texture_height,
        texture_mime_type = nullif(trim(coalesce(requested_texture_mime_type, '')), ''),
        focus_x = requested_focus_x,
        focus_y = requested_focus_y,
        zoom = requested_zoom,
        overlay_color = nullif(trim(coalesce(requested_overlay_color, '')), ''),
        overlay_opacity = requested_overlay_opacity,
        fallback_background_color = trim(requested_fallback_background_color),
        text_primary = trim(requested_text_primary),
        text_secondary = trim(requested_text_secondary),
        paper_surface = trim(requested_paper_surface),
        paper_surface_muted = trim(requested_paper_surface_muted),
        stamp_border = trim(requested_stamp_border),
        accent_color = trim(requested_accent_color),
        logo_variant = trim(requested_logo_variant)
    where id = requested_theme_id
    returning id into saved_theme_id;

    if saved_theme_id is null then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;
  end if;

  insert into public.admin_action_audit(
    action_type,
    actor,
    metadata
  ) values (
    case
      when requested_theme_id is null then 'journal_theme_created'
      else 'journal_theme_updated'
    end,
    nullif(trim(coalesce(requested_actor, '')), ''),
    jsonb_build_object(
      'journalThemeId', saved_theme_id,
      'slug', normalized_slug,
      'status', normalized_status
    )
  );

  return public.admin_get_journal_theme(saved_theme_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'SLUG_CONFLICT');
end;
$$;

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

create or replace function public.admin_list_capsules(
  requested_product_type public.capsule_product_type default null,
  requested_batch_id uuid default null,
  requested_fulfillment_status public.capsule_fulfillment_status default null,
  requested_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  search_term text;
begin
  search_term := lower(trim(coalesce(requested_search, '')));

  select jsonb_build_object(
    'ok', true,
    'batches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', batch.id,
          'batchName', batch.batch_name,
          'productType', batch.product_type,
          'quantity', batch.quantity,
          'status', batch.status,
          'createdAt', batch.created_at
        )
        order by batch.created_at desc, batch.id desc
      )
      from public.capsule_batches batch
    ), '[]'::jsonb),
    'capsules', coalesce(jsonb_agg(
      jsonb_build_object(
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
        'recoveryStatus', case
          when recovery.capsule_id is null then 'not_issued'
          else 'issued'
        end,
        'journalTheme', public.journal_theme_json(theme),
        'createdAt', capsule.created_at,
        'activatedAt', capsule.activated_at,
        'memoryCount', coalesce(stats.memory_count, 0),
        'photoCount', coalesce(stats.photo_count, 0),
        'voiceMemoCount', coalesce(stats.voice_memo_count, 0)
      )
      order by fulfillment.created_at desc, fulfillment.serial_number desc
    ) filter (where capsule.id is not null), '[]'::jsonb)
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
      ) voice_memo_count
  ) stats on true
  where (requested_product_type is null or capsule.product_type = requested_product_type)
    and (requested_batch_id is null or batch.id = requested_batch_id)
    and (
      requested_fulfillment_status is null
      or fulfillment.fulfillment_status = requested_fulfillment_status
    )
    and (
      search_term = ''
      or lower(fulfillment.serial_number) like '%' || search_term || '%'
      or lower(capsule.public_token) like '%' || search_term || '%'
    );

  return result;
end;
$$;

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

create or replace function public.admin_update_capsule_journal_theme(
  requested_capsule_id uuid,
  requested_journal_theme_id uuid,
  requested_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  capsule_record public.capsules;
  fulfillment_record public.capsule_fulfillment;
  theme_record public.journal_themes;
  previous_theme_id uuid;
begin
  select * into capsule_record
  from public.capsules
  where id = requested_capsule_id
  for update;

  select * into fulfillment_record
  from public.capsule_fulfillment
  where capsule_id = requested_capsule_id;

  if capsule_record.id is null or fulfillment_record.capsule_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if capsule_record.product_type <> 'journal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL');
  end if;

  if requested_journal_theme_id is null then
    return jsonb_build_object('ok', false, 'code', 'JOURNAL_THEME_REQUIRED');
  end if;

  select * into theme_record
  from public.journal_themes
  where id = requested_journal_theme_id;

  if theme_record.id is null
    or (
      theme_record.status = 'archived'
      and theme_record.id is distinct from capsule_record.journal_theme_id
    )
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_JOURNAL_THEME');
  end if;

  previous_theme_id := capsule_record.journal_theme_id;

  update public.capsules
  set journal_theme_id = theme_record.id
  where id = capsule_record.id;

  insert into public.admin_action_audit(
    action_type,
    capsule_id,
    batch_id,
    actor,
    metadata
  ) values (
    'capsule_journal_theme_updated',
    capsule_record.id,
    fulfillment_record.batch_id,
    nullif(trim(coalesce(requested_actor, '')), ''),
    jsonb_build_object(
      'fromJournalThemeId', previous_theme_id,
      'toJournalThemeId', theme_record.id,
      'toJournalThemeStatus', theme_record.status,
      'capsuleActivationStatus', capsule_record.status
    )
  );

  return public.admin_get_capsule_detail(capsule_record.id);
end;
$$;

create or replace function public.inspect_capsule_access(
  requested_token text,
  requested_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.capsules;
  theme_record public.journal_themes;
  has_access boolean;
begin
  select * into target from public.capsules where public_token = requested_token;
  if not found then return jsonb_build_object('state', 'notFound'); end if;

  if target.journal_theme_id is not null then
    select * into theme_record
    from public.journal_themes
    where id = target.journal_theme_id;
  end if;

  if public.is_capsule_fulfillment_disabled(target.id) then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select exists (
    select 1 from public.capsule_access
    where capsule_id = target.id and auth_user_id = requested_user and role = 'owner'
  ) into has_access;
  return jsonb_build_object(
    'state', case
      when has_access then 'unlocked'
      when target.status = 'unactivated' then 'unactivated'
      else 'locked'
    end,
    'capsuleId', target.id,
    'productType', target.product_type,
    'journalTheme', public.journal_theme_json(theme_record)
  );
end;
$$;

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
    'journalTheme', public.journal_theme_json(theme),
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
  left join public.journal_themes theme on theme.id = capsule.journal_theme_id
  where capsule.id = requested_capsule_id
    and capsule.product_type = 'journal';

  return coalesce(
    result,
    jsonb_build_object('ok', false, 'code', 'NOT_A_JOURNAL')
  );
end;
$$;

revoke all on function public.journal_theme_json(public.journal_themes) from public;
revoke all on function public.admin_list_journal_themes(text) from public;
revoke all on function public.admin_get_journal_theme(uuid) from public;
revoke all on function public.admin_upsert_journal_theme(
  uuid, text, text, text, text, integer, text, text, integer, integer, text,
  numeric, numeric, numeric, text, numeric, text, text, text, text, text, text,
  text, text, text
) from public;
revoke all on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) from public;
revoke all on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text, uuid
) from public;
revoke all on function public.admin_update_capsule_journal_theme(
  uuid, uuid, text
) from public;

grant execute on function public.journal_theme_json(public.journal_themes) to service_role;
grant execute on function public.admin_list_journal_themes(text) to service_role;
grant execute on function public.admin_get_journal_theme(uuid) to service_role;
grant execute on function public.admin_upsert_journal_theme(
  uuid, text, text, text, text, integer, text, text, integer, integer, text,
  numeric, numeric, numeric, text, numeric, text, text, text, text, text, text,
  text, text, text
) to service_role;
grant execute on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) to service_role;
grant execute on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text, uuid
) to service_role;
grant execute on function public.admin_update_capsule_journal_theme(
  uuid, uuid, text
) to service_role;
grant execute on function public.get_journal_home(uuid) to authenticated;
