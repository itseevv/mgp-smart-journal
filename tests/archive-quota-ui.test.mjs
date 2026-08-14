import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  archiveQuotaNoticeLevel,
  formatArchiveCapacity,
  getArchiveExpansionUrl,
  isArchiveQuotaWarning,
} from "../data/archive-quota.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const quota = (usedBytes) => ({
  archiveId: "archive-1",
  grantedBytes: 1_000_000_000,
  usedBytes,
  percentage: (usedBytes / 1_000_000_000) * 100,
  storageStatus: usedBytes >= 1_000_000_000 ? "FULL" : usedBytes >= 800_000_000 ? "WARNING" : "NORMAL",
  linkedChipCount: 1,
  storedOptimisedPhotoBytes: usedBytes,
  storedThumbnailBytes: 0,
  storedVoiceNoteBytes: 0,
});

test("Archive warning boundary is quiet at 79.99%, visible at 80%, and visible when full", () => {
  assert.equal(isArchiveQuotaWarning(quota(799_900_000)), false);
  assert.equal(isArchiveQuotaWarning(quota(800_000_000)), true);
  assert.equal(isArchiveQuotaWarning(quota(1_000_000_000)), true);
});

test("Archive notices distinguish dismissible 80%, dismissible 95%, and persistent full states", () => {
  assert.equal(archiveQuotaNoticeLevel(quota(799_900_000)), "NONE");
  assert.equal(archiveQuotaNoticeLevel(quota(800_000_000)), "EIGHTY");
  assert.equal(archiveQuotaNoticeLevel(quota(949_999_999)), "EIGHTY");
  assert.equal(archiveQuotaNoticeLevel(quota(950_000_000)), "NINETY_FIVE");
  assert.equal(archiveQuotaNoticeLevel(quota(999_999_999)), "NINETY_FIVE");
  assert.equal(archiveQuotaNoticeLevel(quota(1_000_000_000)), "FULL");
});

test("Archive expansion CTA accepts only configured HTTP(S) URLs", () => {
  assert.equal(getArchiveExpansionUrl(undefined), undefined);
  assert.equal(getArchiveExpansionUrl(""), undefined);
  assert.equal(getArchiveExpansionUrl("not-a-url"), undefined);
  assert.equal(getArchiveExpansionUrl("javascript:alert(1)"), undefined);
  assert.equal(
    getArchiveExpansionUrl("https://shop.example.com/archive-expand"),
    "https://shop.example.com/archive-expand",
  );
  assert.equal(
    getArchiveExpansionUrl("http://shop.example.com/archive-expand"),
    "http://shop.example.com/archive-expand",
  );
});

test("Archive capacity uses one decimal-byte formatter across customer and Admin displays", () => {
  assert.equal(formatArchiveCapacity(820_000_000), "820 MB");
  assert.equal(formatArchiveCapacity(1_000_000_000), "1 GB");
  assert.equal(formatArchiveCapacity(26_214_400), "26.2 MB");
  assert.equal(
    formatArchiveCapacity(820_000_000, {
      unit: "GB",
      maximumFractionDigits: 2,
    }),
    "0.82 GB",
  );
  assert.equal(
    formatArchiveCapacity(950_000_000, {
      unit: "GB",
      maximumFractionDigits: 2,
    }),
    "0.95 GB",
  );
});

test("customer Journal uses the quota strip and has no active lifecycle UI branches", () => {
  const home = readSource("components/journal/journal-home.tsx");
  const detail = readSource("components/journal/journal-memory-page.tsx");
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");

  assert.match(home, /<ArchiveQuotaWarning quota=\{journal\.archiveQuota\}/);
  assert.doesNotMatch(
    home,
    /JournalVolumeLifecyclePanel|FULL_REVIEW|COMPLETED|completeJournalVolume|Complete this volume|journal\.maxPhotos/,
  );
  assert.doesNotMatch(detail, /FULL_REVIEW|COMPLETED|complete|readOnly/);
  assert.doesNotMatch(flow, /readOnly|FULL_REVIEW|COMPLETED|complete-volume/);
  assert.match(detail, /maxPhotos=\{context\.maxPhotosPerEntry\}/);
  assert.match(flow, /productRules\.maxPhotosPerEntry/);
});

test("Archive notice uses warm milestone copy, durable dismissal, and a collapsible full state", () => {
  const notice = readSource("components/journal/archive-quota-warning.tsx");
  const api = readSource("lib/capsule/api.ts");

  assert.match(notice, /Your Momento has gathered so much already\./);
  assert.match(notice, /Your Momento is almost full of days worth keeping\./);
  assert.match(notice, /This Momento is full of memories\./);
  assert.match(notice, /window\.localStorage\.setItem/);
  assert.match(notice, /momento:archive-quota:v2:/);
  assert.match(notice, /<JournalShellIconButton/);
  assert.match(notice, /archive-quota-notice-button/);
  assert.match(notice, /min-h-\[3\.5rem\]/);
  const globalCss = readSource("app/globals.css");
  assert.match(
    globalCss,
    /journal-shell-icon-button\.archive-quota-notice-button[\s\S]*month-sheet-nav-control-size/,
  );
  assert.match(
    globalCss,
    /journal-shell-icon-button\.archive-quota-notice-button[\s\S]*background:\s*var\(--journal-paper-muted,[\s\S]*color:\s*var\(--journal-paper-text,/,
  );
  assert.match(notice, /Dismiss Archive capacity notice/);
  assert.match(notice, /Collapse Archive capacity notice/);
  assert.match(notice, /data-archive-quota-collapsed/);
  assert.match(notice, /maximumFractionDigits:\s*2/);
  assert.match(notice, /used\./);
  assert.match(notice, /Expand your Archive/);
  assert.match(
    api,
    /error\.code === "JOURNAL_STORAGE_LIMIT"[\s\S]*ARCHIVE_STORAGE_LIMIT_MESSAGE/,
  );
  assert.match(
    api,
    /Your Momento is full, so these new moments couldn’t be saved\. Remove some media or expand your Archive, then try again\./,
  );
  assert.doesNotMatch(api, /Your draft is still here/);
});

test("Admin hides the legacy storage estimate when canonical Archive quota is present", () => {
  const admin = readSource("components/admin/admin-capsule-detail-page.tsx");

  assert.match(admin, /formatArchiveCapacity\(capsule\.archiveQuota\.usedBytes\)/);
  assert.match(admin, /!capsule\.archiveQuota/);
  assert.doesNotMatch(admin, /const bytesLabel|const quotaBytesLabel/);
});
