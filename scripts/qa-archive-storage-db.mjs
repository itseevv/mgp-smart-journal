import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = process.env.MOMENTO_ARCHIVE_DB_CONTAINER ?? "momento-archive-db-integration";
const postgresImage =
  process.env.MOMENTO_ARCHIVE_DB_IMAGE ??
  "public.ecr.aws/supabase/postgres:17.6.1.132";

function docker(args, input) {
  try {
    return execFileSync("docker", args, {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

function dockerExec(args, input) {
  return docker(["exec", "-i", containerName, ...args], input);
}

function psql(sql, user = "postgres") {
  return dockerExec(
    ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", "postgres", "-At"],
    sql,
  );
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      dockerExec(["pg_isready", "-U", "postgres", "-d", "postgres"]);
      for (let stableAttempt = 0; stableAttempt < 3; stableAttempt += 1) {
        dockerExec([
          "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
          "-c", "select 1",
        ]);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error("Disposable Postgres did not become ready.");
}

function startContainer() {
  const existingContainer = docker([
    "ps",
    "-aq",
    "--filter",
    `name=^/${containerName}$`,
  ]).trim();
  if (existingContainer) docker(["rm", "-f", existingContainer]);
  docker([
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_DB=postgres",
    "-d",
    postgresImage,
  ]);
}

function bootstrapStorageFixtures() {
  psql(
    `
      create schema if not exists storage authorization supabase_admin;
      create table if not exists storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false
      );
      create table if not exists storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text not null references storage.buckets(id),
        name text not null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create or replace function storage.foldername(object_name text)
      returns text[] language sql immutable
      as $$ select string_to_array(object_name, '/') $$;
      alter table storage.objects enable row level security;
      grant usage on schema storage to postgres;
      grant all on storage.buckets, storage.objects to postgres;
      grant execute on function storage.foldername(text) to public;
    `,
    "supabase_admin",
  );
}

function applyCanonicalMigrations() {
  const migrationsDirectory = path.join(repositoryRoot, "supabase", "migrations");
  const migrations = readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  for (const filename of migrations) {
    process.stdout.write(`Applying ${filename}\n`);
    psql(readFileSync(path.join(migrationsDirectory, filename), "utf8"));
  }
  process.stdout.write(`Applied ${migrations.length} canonical migrations.\n`);
}

function runBehaviorAssertions() {
  psql(`
    do $archive_storage_integration$
    declare
      owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
      ownerless_capsule_id constant uuid := '11111111-1111-4111-8111-111111111112';
      below_capsule_id constant uuid := '11111111-1111-4111-8111-111111111113';
      exact_capsule_id constant uuid := '11111111-1111-4111-8111-111111111114';
      edit_capsule_id constant uuid := '11111111-1111-4111-8111-111111111115';
      date_capsule_id constant uuid := '11111111-1111-4111-8111-111111111116';
      below_memory_id constant uuid := '22222222-2222-4222-8222-222222222221';
      rejected_memory_id constant uuid := '22222222-2222-4222-8222-222222222222';
      exact_memory_id constant uuid := '22222222-2222-4222-8222-222222222223';
      exact_rejected_memory_id constant uuid := '22222222-2222-4222-8222-222222222227';
      edit_memory_id constant uuid := '22222222-2222-4222-8222-222222222224';
      date_memory_id constant uuid := '22222222-2222-4222-8222-222222222225';
      duplicate_memory_id constant uuid := '22222222-2222-4222-8222-222222222226';
      below_photo_id constant uuid := '33333333-3333-4333-8333-333333333331';
      rejected_photo_id constant uuid := '33333333-3333-4333-8333-333333333332';
      exact_photo_id constant uuid := '33333333-3333-4333-8333-333333333333';
      exact_voice_id constant uuid := '33333333-3333-4333-8333-333333333336';
      exact_rejected_voice_id constant uuid := '33333333-3333-4333-8333-333333333337';
      below_voice_id constant uuid := '33333333-3333-4333-8333-333333333338';
      below_rejected_voice_id constant uuid := '33333333-3333-4333-8333-333333333339';
      edit_photo_id constant uuid := '33333333-3333-4333-8333-333333333334';
      date_photo_id constant uuid := '33333333-3333-4333-8333-333333333335';
      result jsonb;
      ownerless_archive_id uuid;
      fill_memory_id uuid;
      fill_photo_size bigint;
      date_display_path text;
      date_thumbnail_path text;
      i integer;
    begin
      perform set_config('request.jwt.claim.sub', owner_id::text, true);

      insert into auth.users(id, aud, role, email, created_at, updated_at)
      values (owner_id, 'authenticated', 'authenticated', 'archive-test@example.test', now(), now());

      -- Task 1/2: provisioning must create the Archive before owner access,
      -- then sync the owner and retain one starter grant.
      insert into public.capsules(id, public_token, product_type, status, title)
      values (ownerless_capsule_id, repeat('a', 32), 'journal', 'unactivated', 'Ownerless Archive test');
      select archive_capsule.archive_id into ownerless_archive_id
      from public.archive_capsules archive_capsule
      where archive_capsule.capsule_id = ownerless_capsule_id;
      if ownerless_archive_id is null then
        raise exception 'ownerless provisioning did not create an Archive';
      end if;
      if exists (select 1 from public.archives archive where archive.id = ownerless_archive_id and archive.owner_auth_user_id is not null) then
        raise exception 'ownerless provisioning unexpectedly assigned an owner';
      end if;
      if (select count(*) from public.archive_storage_grants grant_row where grant_row.archive_id = ownerless_archive_id) <> 1
        or (select granted_bytes from public.archive_storage_grants grant_row where grant_row.archive_id = ownerless_archive_id and grant_row.grant_kind = 'starter') <> 1000000000 then
        raise exception 'starter grant was not created canonically';
      end if;
      insert into public.capsule_access(capsule_id, auth_user_id, role, access_expires_at)
      values (ownerless_capsule_id, owner_id, 'owner', now() + interval '1 hour');
      if (select owner_auth_user_id from public.archives where id = ownerless_archive_id) <> owner_id then
        raise exception 'Archive owner did not sync after owner access';
      end if;

      insert into public.archive_storage_grants(archive_id, grant_kind, granted_bytes)
      values (ownerless_archive_id, 'expansion', 1000000000), (ownerless_archive_id, 'expansion', 2000000000);
      if (select count(*) from public.archive_storage_grants grant_row where grant_row.archive_id = ownerless_archive_id) <> 3
        or (select sum(grant_row.granted_bytes) from public.archive_storage_grants grant_row where grant_row.archive_id = ownerless_archive_id) <> 4000000000 then
        raise exception 'repeated expansion grants were not preserved in the canonical sum';
      end if;

      -- Task 3: below-capacity reservation succeeds and a later reservation
      -- that would exceed the starter grant is rejected before insertion.
      insert into public.capsules(id, public_token, product_type, status, title)
      values (below_capsule_id, repeat('b', 32), 'journal', 'unactivated', 'Below quota test');
      insert into public.capsule_access(capsule_id, auth_user_id, role, access_expires_at)
      values (below_capsule_id, owner_id, 'owner', now() + interval '1 hour');
      for i in 0..38 loop
        if i % 8 = 0 then
          fill_memory_id := gen_random_uuid();
          insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
          values (fill_memory_id, below_capsule_id, 'Below fill ' || i, ('2024-03-01'::date + i / 8)::timestamptz, '2024-03-01'::date + i / 8, 'UTC');
        end if;
        fill_photo_size := case when i < 38 then 26214400 else 3852799 end;
        insert into public.photos(id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height)
        values (gen_random_uuid(), fill_memory_id, 'below-fill-' || i, i % 8, 'image/jpeg', fill_photo_size, 100, 100);
      end loop;
      result := public.reserve_journal_media_uploads(
        below_capsule_id, below_memory_id, false, '{}'::uuid[], array[below_voice_id],
        jsonb_build_array(
          jsonb_build_object('mediaId', below_voice_id, 'pathKind', 'voice', 'expectedSizeBytes', 1, 'expectedMimeType', 'audio/mp4')
        )
      );
      if result->>'ok' <> 'true' then
        raise exception 'below-capacity reservation failed: %', result;
      end if;
      result := public.reserve_journal_media_uploads(
        below_capsule_id, rejected_memory_id, false, '{}'::uuid[], array[below_rejected_voice_id],
        jsonb_build_array(
          jsonb_build_object('mediaId', below_rejected_voice_id, 'pathKind', 'voice', 'expectedSizeBytes', 1, 'expectedMimeType', 'audio/mp4')
        )
      );
      if result->>'code' <> 'JOURNAL_STORAGE_LIMIT' then
        raise exception 'over-capacity reservation was not rejected: %', result;
      end if;
      if exists (select 1 from public.journal_media_upload_reservations where memory_id = rejected_memory_id) then
        raise exception 'over-capacity reservation inserted rows';
      end if;

      -- Full capacity is allowed exactly, while a further reservation is not.
      insert into public.capsules(id, public_token, product_type, status, title)
      values (exact_capsule_id, repeat('c', 32), 'journal', 'unactivated', 'Exact quota test');
      insert into public.capsule_access(capsule_id, auth_user_id, role, access_expires_at)
      values (exact_capsule_id, owner_id, 'owner', now() + interval '1 hour');
      for i in 0..38 loop
        if i % 8 = 0 then
          fill_memory_id := gen_random_uuid();
          insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
          values (fill_memory_id, exact_capsule_id, 'Exact fill ' || i, ('2024-01-01'::date + i / 8)::timestamptz, '2024-01-01'::date + i / 8, 'UTC');
        end if;
        fill_photo_size := case when i < 38 then 26214400 else 3852799 end;
        insert into public.photos(id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height)
        values (gen_random_uuid(), fill_memory_id, 'exact-fill-' || i, i % 8, 'image/jpeg', fill_photo_size, 100, 100);
      end loop;
      result := public.reserve_journal_media_uploads(
        exact_capsule_id, exact_memory_id, false, '{}'::uuid[], array[exact_voice_id],
        jsonb_build_array(
          jsonb_build_object('mediaId', exact_voice_id, 'pathKind', 'voice', 'expectedSizeBytes', 1, 'expectedMimeType', 'audio/mp4')
        )
      );
      if result->>'ok' <> 'true' then
        raise exception 'exact-capacity reservation failed: %', result;
      end if;
      result := public.reserve_journal_media_uploads(
        exact_capsule_id, exact_rejected_memory_id, false, '{}'::uuid[], array[exact_rejected_voice_id],
        jsonb_build_array(
          jsonb_build_object('mediaId', exact_rejected_voice_id, 'pathKind', 'voice', 'expectedSizeBytes', 1, 'expectedMimeType', 'audio/mp4')
        )
      );
      if result->>'code' <> 'JOURNAL_STORAGE_LIMIT' then
        raise exception 'reservation over exact full capacity was not rejected: %', result;
      end if;

      -- Full-capacity retained edit must be accepted when no additional bytes
      -- are introduced by the edit.
      insert into public.capsules(id, public_token, product_type, status, title)
      values (edit_capsule_id, repeat('d', 32), 'journal', 'unactivated', 'Retained edit test');
      insert into public.capsule_access(capsule_id, auth_user_id, role, access_expires_at)
      values (edit_capsule_id, owner_id, 'owner', now() + interval '1 hour');
      insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
      values (edit_memory_id, edit_capsule_id, 'Retained', '2026-01-01T12:00:00Z', '2026-01-01', 'UTC');
      for i in 0..37 loop
        if i % 8 = 0 then
          fill_memory_id := gen_random_uuid();
          insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
          values (fill_memory_id, edit_capsule_id, 'Edit fill ' || i, ('2024-02-01'::date + i / 8)::timestamptz, '2024-02-01'::date + i / 8, 'UTC');
        end if;
        fill_photo_size := case when i < 37 then 26214400 else 3852800 end;
        insert into public.photos(id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height)
        values (gen_random_uuid(), fill_memory_id, 'edit-fill-' || i, i % 8, 'image/jpeg', fill_photo_size, 100, 100);
      end loop;
      insert into storage.objects(bucket_id, name, metadata)
      values
        ('memory-media', 'capsules/' || edit_capsule_id || '/memories/' || edit_memory_id || '/photos/' || edit_photo_id || '/display.jpg', jsonb_build_object('mimetype', 'image/jpeg', 'size', '26214400'));
      insert into public.photos(id, memory_id, storage_path, order_index, mime_type, size_bytes, width, height)
      values (edit_photo_id, edit_memory_id,
        'capsules/' || edit_capsule_id || '/memories/' || edit_memory_id || '/photos/' || edit_photo_id || '/display.jpg',
        0, 'image/jpeg', 26214400, 100, 100);
      result := public.commit_memory_with_lifecycle(
        edit_capsule_id, edit_memory_id, 'Retained edit', '2026-01-01T13:00:00Z', '2026-01-01', 'UTC',
        jsonb_build_array(jsonb_build_object(
          'id', edit_photo_id,
          'storagePath', 'capsules/' || edit_capsule_id || '/memories/' || edit_memory_id || '/photos/' || edit_photo_id || '/display.jpg',
          'orderIndex', 0, 'mimeType', 'image/jpeg', 'sizeBytes', 26214400, 'width', 100, 'height', 100
        )),
        '[]'::jsonb, true
      );
      if result->>'ok' <> 'true' then
        raise exception 'full-capacity retained edit failed: %', result;
      end if;

      -- 366th distinct date is permitted, while same-date remains rejected.
      insert into public.capsules(id, public_token, product_type, status, title)
      values (date_capsule_id, repeat('e', 32), 'journal', 'unactivated', 'Date rules test');
      insert into public.capsule_access(capsule_id, auth_user_id, role, access_expires_at)
      values (date_capsule_id, owner_id, 'owner', now() + interval '1 hour');
      for i in 0..364 loop
        insert into public.memories(id, capsule_id, title, occurred_at, local_date, local_timezone)
        values (gen_random_uuid(), date_capsule_id, 'Day ' || i, ('2025-01-01'::date + i)::timestamptz, '2025-01-01'::date + i, 'UTC');
      end loop;
      insert into storage.objects(bucket_id, name, metadata)
      values
        ('memory-media', 'capsules/' || date_capsule_id || '/memories/' || date_memory_id || '/photos/' || date_photo_id || '/display.jpg', jsonb_build_object('mimetype', 'image/jpeg', 'size', '1')),
        ('memory-media', 'capsules/' || date_capsule_id || '/memories/' || date_memory_id || '/photos/' || date_photo_id || '/thumb.jpg', jsonb_build_object('mimetype', 'image/jpeg', 'size', '1'));
      result := public.reserve_journal_media_uploads(
        date_capsule_id, date_memory_id, false, array[date_photo_id], '{}'::uuid[],
        jsonb_build_array(
          jsonb_build_object('mediaId', date_photo_id, 'pathKind', 'photo_display', 'expectedSizeBytes', 1, 'expectedMimeType', 'image/jpeg'),
          jsonb_build_object('mediaId', date_photo_id, 'pathKind', 'photo_thumbnail', 'expectedSizeBytes', 1, 'expectedMimeType', 'image/jpeg')
        )
      );
      if result->>'ok' <> 'true' then
        raise exception '366th-date reservation failed: %', result;
      end if;
      select result->'reservations'->0->>'storagePath', result->'reservations'->1->>'storagePath'
      into date_display_path, date_thumbnail_path;
      if date_display_path is null or date_thumbnail_path is null then
        raise exception '366th-date reservation did not return both media paths: %', result;
      end if;
      insert into storage.objects(bucket_id, name, metadata)
      values
        ('memory-media', date_display_path, jsonb_build_object('mimetype', 'image/jpeg', 'size', '1')),
        ('memory-media', date_thumbnail_path, jsonb_build_object('mimetype', 'image/jpeg', 'size', '1'));
      result := public.commit_memory_with_lifecycle(
        date_capsule_id, date_memory_id, 'Day 366', '2026-01-01T12:00:00Z', '2026-01-01', 'UTC',
        jsonb_build_array(jsonb_build_object(
          'id', date_photo_id, 'storagePath', date_display_path,
          'orderIndex', 0, 'mimeType', 'image/jpeg', 'sizeBytes', 1, 'width', 1, 'height', 1,
          'thumbnailStoragePath', date_thumbnail_path,
          'thumbnailMimeType', 'image/jpeg', 'thumbnailSizeBytes', 1, 'thumbnailWidth', 1, 'thumbnailHeight', 1
        )), '[]'::jsonb, false
      );
      if result->>'ok' <> 'true' then
        raise exception '366th distinct date commit failed: %', result;
      end if;
      result := public.commit_memory_with_lifecycle(
        date_capsule_id, duplicate_memory_id, 'Duplicate day', '2026-01-02T12:00:00Z', '2025-01-01', 'UTC',
        '[]'::jsonb, '[]'::jsonb, false
      );
      if result->>'code' <> 'DUPLICATE_LOCAL_DATE' then
        raise exception 'same-date commit was not rejected: %', result;
      end if;
    end $archive_storage_integration$;
  `);
}

async function main() {
  let started = false;
  const keepContainer = process.env.MOMENTO_ARCHIVE_DB_KEEP === "1";
  try {
    startContainer();
    started = true;
    await waitForPostgres();
    bootstrapStorageFixtures();
    applyCanonicalMigrations();
    runBehaviorAssertions();
    console.log("Archive storage DB integration: PASS");
  } finally {
    if (started && !keepContainer) docker(["rm", "-f", containerName]);
  }
}

await main();
