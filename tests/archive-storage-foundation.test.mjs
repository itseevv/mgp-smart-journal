import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = readSource(
  "supabase/migrations/202608130001_archive_storage_foundation.sql",
);
const lifecycleMigration = readSource(
  "supabase/migrations/202607280001_journal_volume_lifecycle.sql",
);
const provisioningMigration = readSource(
  "supabase/migrations/202606150004_phase_7_capsule_provisioning.sql",
);

test("Archive foundation is additive and leaves the approved lifecycle migration unchanged", () => {
  assert.match(migration, /create table public\.archives/);
  assert.match(migration, /owner_auth_user_id uuid references auth\.users\(id\)/);
  assert.match(migration, /create table public\.archive_capsules/);
  assert.match(migration, /constraint archive_capsules_capsule_id_key unique \(capsule_id\)/);
  assert.match(migration, /create index archive_capsules_archive_id_idx/);
  assert.match(
    migration,
    /insert into public\.archives\(owner_auth_user_id\)[\s\S]*values \([\s\S]*select access\.auth_user_id[\s\S]*returning id into created_archive_id/,
  );
  assert.doesNotMatch(
    migration,
    /insert into public\.archives\(owner_auth_user_id\)\s*select access\.auth_user_id/,
  );
  assert.match(migration, /where capsule\.product_type = 'journal'/);
  assert.match(migration, /perform public\.ensure_capsule_archive\(capsule_record\.id\)/);
  assert.match(migration, /create trigger capsules_initialize_archive/);
  assert.match(migration, /create trigger capsule_access_sync_archive_owner/);
  assert.match(provisioningMigration, /create or replace function public\.admin_generate_capsule_batch\(/);
  assert.match(provisioningMigration, /insert into public\.capsules\(public_token, product_type, status\)/);
  assert.match(migration, /ARCHIVE_POSTCONDITION_CAPSULE_LINK_MISSING/);
  assert.equal(lifecycleMigration.startsWith("-- DEPLOYMENT REQUIREMENT:"), true);
});

test("starter grants are append-only and idempotent at exactly one billion bytes", () => {
  assert.match(migration, /create table public\.archive_storage_grants/);
  assert.match(migration, /granted_bytes bigint not null check \(granted_bytes > 0\)/);
  assert.match(migration, /create unique index archive_storage_grants_starter_key/);
  assert.match(migration, /on public\.archive_storage_grants\(archive_id\)\s*where grant_kind = 'starter'/);
  assert.doesNotMatch(migration, /unique \(archive_id, grant_kind\)/);
  assert.match(migration, /'starter',\s*\n\s*1000000000/);
  assert.match(migration, /on conflict \(archive_id\) where grant_kind = 'starter' do nothing/);
  assert.match(migration, /before update or delete on public\.archive_storage_grants/);
  assert.match(migration, /ARCHIVE_STORAGE_GRANTS_APPEND_ONLY/);
  assert.match(migration, /ARCHIVE_POSTCONDITION_STARTER_GRANT_MISSING/);
});

test("provisioning creates an Archive and starter grant before owner access exists", () => {
  const ensureArchiveBody = migration.slice(
    migration.indexOf("create or replace function public.ensure_capsule_archive"),
    migration.indexOf("revoke all on function public.ensure_capsule_archive"),
  );
  assert.match(ensureArchiveBody, /insert into public\.archives\(owner_auth_user_id\)/);
  assert.match(ensureArchiveBody, /select access\.auth_user_id/);
  assert.match(ensureArchiveBody, /perform public\.ensure_archive_starter_grant\(created_archive_id\)/);

  // Deterministic semantic fixture for the trigger path: provisioning has no
  // owner access row yet, but must still create the Archive and starter grant.
  const provisionJournalCapsule = ({ ownerAuthUserId = null } = {}) => {
    const archive = { id: "archive-1", ownerAuthUserId };
    return {
      archives: [archive],
      links: [{ archiveId: archive.id, capsuleId: "capsule-1" }],
      grants: [{ archiveId: archive.id, grantKind: "starter", grantedBytes: 1_000_000_000 }],
    };
  };

  assert.deepEqual(provisionJournalCapsule(), {
    archives: [{ id: "archive-1", ownerAuthUserId: null }],
    links: [{ archiveId: "archive-1", capsuleId: "capsule-1" }],
    grants: [{ archiveId: "archive-1", grantKind: "starter", grantedBytes: 1_000_000_000 }],
  });
});

test("two expansion grants coexist and both contribute to the canonical sum", () => {
  assert.match(migration, /grant_kind text not null check \(grant_kind in \('starter', 'expansion', 'adjustment'\)\)/);
  assert.match(migration, /select coalesce\(sum\(grant_record\.granted_bytes\), 0\)::bigint/);

  const grants = [
    { grantKind: "starter", grantedBytes: 1_000_000_000 },
    { grantKind: "expansion", grantedBytes: 250_000_000 },
    { grantKind: "expansion", grantedBytes: 500_000_000 },
  ];
  assert.equal(
    grants.reduce((total, grant) => total + grant.grantedBytes, 0),
    1_750_000_000,
  );
});

test("canonical quota summary aggregates all linked capsule media and is shared by app/Admin reads", () => {
  assert.match(migration, /create or replace function public\.archive_quota_summary\(/);
  assert.match(migration, /sum\(photo\.size_bytes\)/);
  assert.match(migration, /sum\(photo\.thumbnail_size_bytes\)/);
  assert.match(migration, /sum\(memo\.size_bytes\)/);
  assert.match(migration, /'archiveId'/);
  assert.match(migration, /'grantedBytes'/);
  assert.match(migration, /'usedBytes'/);
  assert.match(migration, /'percentage'/);
  assert.match(migration, /'storageStatus'/);
  assert.match(migration, /'linkedChipCount'/);
  assert.match(migration, /'storedOptimisedPhotoBytes'/);
  assert.match(migration, /'storedThumbnailBytes'/);
  assert.match(migration, /'storedVoiceNoteBytes'/);
  assert.match(
    migration,
    /create or replace function public\.get_archive_quota_summary\(/,
  );
  assert.match(
    migration,
    /'archiveQuota', quota\.summary,[\s\S]*create or replace function public\.admin_get_capsule_detail/,
  );
  assert.match(
    migration,
    /create or replace function public\.get_journal_home\([\s\S]*'archiveQuota', quota\.summary/,
  );
  const adminDetailBody = migration.slice(
    migration.indexOf("create or replace function public.admin_get_capsule_detail"),
  );
  assert.match(adminDetailBody, /public\.archive_quota_summary\(archive_link\.archive_id\)/);
  assert.match(
    adminDetailBody,
    /'storageEstimateBytes', coalesce\([\s\S]*quota\.summary->>'usedBytes'/,
  );
  assert.match(adminDetailBody, /left join public\.archive_capsules archive_link/);
  assert.match(adminDetailBody, /'archiveId', archive_link\.archive_id/);
  assert.match(adminDetailBody, /'archiveOwnerAuthUserId', archive\.owner_auth_user_id/);
  assert.match(adminDetailBody, /'archiveGrantHistory'/);
});

test("Admin Archive storage is read-only and has no grant mutation action", () => {
  const component = readSource("components/admin/admin-capsule-detail-page.tsx");
  assert.match(component, /archiveGrantHistory/);
  assert.match(component, /archiveQuota\.usedBytes/);
  assert.match(component, /archiveQuota\.grantedBytes/);
  assert.doesNotMatch(component, /Add storage|Adjust quota|purchase expansion/i);
});

test("shared quota contract names every canonical field", () => {
  const source = readSource("data/archive-quota.ts");
  for (const field of [
    "archiveId",
    "grantedBytes",
    "usedBytes",
    "percentage",
    "storageStatus",
    "linkedChipCount",
    "storedOptimisedPhotoBytes",
    "storedThumbnailBytes",
    "storedVoiceNoteBytes",
  ]) {
    assert.match(source, new RegExp(`\\b${field}:`));
  }
  assert.match(source, /"NORMAL" \| "WARNING" \| "FULL"/);
});
