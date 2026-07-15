import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_LOCALES,
  adminDictionaries,
  adminErrorMessage,
  adminStatusLabel,
  normalizeAdminLocale,
  translateAdmin,
} from "../lib/admin/i18n.ts";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("English and Simplified Chinese dictionaries contain identical keys", () => {
  assert.deepEqual(ADMIN_LOCALES, ["en", "zh-CN"]);
  assert.deepEqual(
    Object.keys(adminDictionaries.en).sort(),
    Object.keys(adminDictionaries["zh-CN"]).sort(),
  );
  assert.ok(Object.keys(adminDictionaries.en).length > 80);
});

test("invalid or missing Admin locales fall back to English", () => {
  assert.equal(normalizeAdminLocale(undefined), "en");
  assert.equal(normalizeAdminLocale("fr"), "en");
  assert.equal(normalizeAdminLocale("zh-CN"), "zh-CN");
});

test("all visible Admin status values have locale-aware labels", () => {
  const statuses = [
    "journal",
    "bookmark",
    "generated",
    "written",
    "tested",
    "packed",
    "shipped",
    "disabled",
    "unactivated",
    "active",
    "pending",
    "not_issued",
    "issued",
    "draft",
    "archived",
  ];

  for (const status of statuses) {
    assert.notEqual(adminStatusLabel("en", status), status);
    assert.notEqual(adminStatusLabel("zh-CN", status), status);
  }
});

test("Admin API error codes map to localized copy without exposing raw codes", () => {
  const codes = [
    "INVALID_REQUEST",
    "ADMIN_NOT_CONFIGURED",
    "ACCESS_DENIED",
    "UNAVAILABLE",
    "JOURNAL_THEME_REQUIRED",
    "ACTIVATED_CONFIRMATION_REQUIRED",
    "REASON_REQUIRED",
    "INVALID_JOURNAL_THEME",
    "NOT_FOUND",
    "ISSUANCE_FAILED",
    "SLUG_CONFLICT",
    "TEXTURE_EMPTY",
    "TEXTURE_TOO_LARGE",
    "TEXTURE_TYPE_UNSUPPORTED",
    "TEXTURE_TYPE_MISMATCH",
    "TEXTURE_DIMENSIONS_UNREADABLE",
    "TEXTURE_REQUIRED",
    "APP_BASE_URL_REQUIRED",
    "APP_BASE_URL_INVALID",
  ];

  for (const code of codes) {
    assert.notEqual(adminErrorMessage("en", code), code);
    assert.notEqual(adminErrorMessage("zh-CN", code), code);
  }
  assert.equal(
    adminErrorMessage("zh-CN", "UNKNOWN_INTERNAL_CODE"),
    adminDictionaries["zh-CN"].errorGeneric,
  );
});

test("Admin translation interpolation preserves every supplied variable", () => {
  assert.equal(
    translateAdmin("en", "capsuleCounts", {
      memories: 2,
      photos: 3,
      voice: 4,
    }),
    "2 memories · 3 photos · 4 voice memos",
  );
  assert.equal(
    translateAdmin("zh-CN", "capsuleCounts", {
      memories: 2,
      photos: 3,
      voice: 4,
    }),
    "2 条回忆 · 3 张照片 · 4 条语音备忘",
  );
});

test("Admin locale provider persists only supported locales in a strict cookie", async () => {
  const provider = await readSource(
    "components/admin/admin-locale-provider.tsx",
  );
  const layout = await readSource("app/admin/layout.tsx");
  const i18n = await readSource("lib/admin/i18n.ts");

  assert.match(i18n, /journal_chip_admin_locale/);
  assert.match(provider, /ADMIN_LOCALE_COOKIE/);
  assert.match(provider, /path=\/admin/i);
  assert.match(provider, /samesite=strict/i);
  assert.match(provider, /max-age=31536000/i);
  assert.match(provider, /normalizeAdminLocale/);
  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /AdminLocaleProvider/);
});

test("all Admin surfaces use the shared shell and no legacy shell remains", async () => {
  const sourceFiles = [
    "components/admin/admin-capsules-page.tsx",
    "components/admin/admin-capsule-detail-page.tsx",
    "components/admin/admin-journal-themes-page.tsx",
  ];

  for (const sourceFile of sourceFiles) {
    const source = await readSource(sourceFile);
    assert.match(source, /import \{ AdminShell \}/);
    assert.doesNotMatch(source, /function AdminShell/);
  }

  const shell = await readSource("components/admin/admin-shell.tsx");
  assert.match(shell, /AdminLanguageSwitcher/);
  assert.match(shell, /aria-label/);

  const capsulesPage = await readSource(
    "components/admin/admin-capsules-page.tsx",
  );
  assert.match(
    capsulesPage,
    /if \(!authenticated\)[\s\S]+<AdminShell>/,
  );
  assert.match(
    capsulesPage,
    /return \([\s\S]+<AdminShell>[\s\S]+t\("capsulesEyebrow"\)/,
  );
});
