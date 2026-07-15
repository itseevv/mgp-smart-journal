import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 6A migration creates dynamic journal themes and capsule assignment", async () => {
  const migration = await readSource(
    "supabase/migrations/202607060001_scrap_day_phase_6a_journal_themes.sql",
  );

  assert.match(migration, /create table if not exists public\.journal_themes/i);
  assert.match(migration, /slug text not null unique/i);
  assert.match(migration, /status text not null default 'draft'/i);
  assert.match(migration, /texture_storage_path text/i);
  assert.match(migration, /fallback_background_color text not null default/i);
  assert.match(migration, /alter table public\.capsules[\s\S]+journal_theme_id uuid/i);
  assert.match(migration, /references public\.journal_themes\(id\)/i);
  assert.match(migration, /ruby-red/i);
  assert.doesNotMatch(migration, /theme_10|ten themes|10 themes/i);
});

test("phase 6A admin RPCs require themes for journal generation but not bookmarks", async () => {
  const migration = await readSource(
    "supabase/migrations/202607060001_scrap_day_phase_6a_journal_themes.sql",
  );

  assert.match(migration, /requested_journal_theme_id uuid default null/i);
  assert.match(migration, /requested_product_type = 'journal'[\s\S]+requested_journal_theme_id is null/i);
  assert.match(migration, /JOURNAL_THEME_REQUIRED/i);
  assert.match(migration, /theme_record\.status <> 'active'/i);
  assert.match(migration, /journal_theme_id\)/i);
  assert.match(migration, /extensions\.gen_random_bytes\(24\)/i);
  assert.doesNotMatch(migration, /[^.]gen_random_bytes\(24\)/i);
  assert.match(migration, /admin_update_capsule_journal_theme/i);
  assert.match(migration, /capsule_journal_theme_updated/i);
  assert.match(migration, /grant execute on function public\.admin_generate_capsule_batch[\s\S]+to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_.* to authenticated/i);
});

test("admin routes and pages expose journal theme management and assignment", async () => {
  const capsuleRoute = await readSource("app/api/admin/capsules/route.ts");
  const capsuleDetailRoute = await readSource("app/api/admin/capsules/[capsuleId]/route.ts");
  const capsulesPage = await readSource("components/admin/admin-capsules-page.tsx");
  const capsuleDetailPage = await readSource("components/admin/admin-capsule-detail-page.tsx");
  const themeRoute = await readSource("app/api/admin/journal-themes/route.ts");
  const themeDetailRoute = await readSource("app/api/admin/journal-themes/[themeId]/route.ts");
  const themeListPage = await readSource("components/admin/admin-journal-themes-page.tsx");

  assert.match(capsuleRoute, /JOURNAL_THEME_REQUIRED/);
  assert.match(capsuleRoute, /requested_journal_theme_id/);
  assert.match(capsulesPage, /"journalThemeRequired"/);
  assert.match(capsulesPage, /journalThemeId/);
  assert.match(capsuleDetailRoute, /admin_update_capsule_journal_theme/);
  assert.match(capsuleDetailRoute, /capsuleUrl/);
  assert.match(capsuleDetailPage, /t\("activeThemeChangeWarning"\)/);
  assert.match(capsuleDetailPage, /t\("saveTheme"\)/);
  for (const route of [themeRoute, themeDetailRoute]) {
    assert.match(route, /requireAdminSession/);
    assert.doesNotMatch(route, /ADMIN_PASSCODE|SUPABASE_SERVICE_ROLE_KEY/);
  }
  assert.match(themeListPage, /t\("themesTitle"\)/);
  assert.match(themeListPage, /assignedCapsuleCount/);
});

test("phase 6B theme form supports texture upload without exposing system metadata as the primary workflow", async () => {
  const source = await readSource("components/admin/admin-journal-themes-page.tsx");

  assert.match(source, /t\("themeDetails"\)/);
  assert.match(source, /t\("themeName"\)/);
  assert.match(source, /t\("slug"\)/);
  assert.match(source, /t\("status"\)/);
  assert.match(source, /t\("sortOrder"\)/);
  assert.match(source, /t\("description"\)/);
  assert.match(source, /slugFromName/);

  assert.match(source, /t\("leatherTexture"\)/);
  assert.match(source, /t\("uploadReplaceTexture"\)/);
  assert.match(source, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(source, /new FormData/);
  assert.match(source, /t\("textureAfterSave"\)/);
  assert.match(source, /t\("leatherTextureDescription"\)/);
  assert.match(source, /t\("currentBackground"/);
  assert.match(source, /textureDimensions/);
  assert.match(source, /t\("portraitTextureRecommendation"\)/);
  assert.match(source, /t\("mobileAppPreview"\)/);
  assert.match(source, /t\("dailyExportPreview"\)/);
  assert.match(source, /data-theme-mobile-preview="true"/);
  assert.match(source, /data-theme-export-preview="true"/);
  assert.match(source, /ThemePreviewTextureImage/);
  assert.match(source, /src=\{theme\.textureUrl\}/);
  assert.match(source, /object-contain/);
  assert.doesNotMatch(source, /data-theme-mobile-preview="true"[\s\S]{0,180}journal-leather-surface/);
  assert.doesNotMatch(source, /data-theme-export-preview="true"[\s\S]{0,180}journal-leather-surface/);

  assert.match(source, /t\("advancedVisualTokens"\)/);
  assert.match(source, /t\("advancedPreviewSettings"\)/);
  assert.match(source, /t\("advancedPreviewDescription"\)/);
  assert.match(source, /t\("previewDescription"\)/);

  const textureIndex = source.indexOf('t("leatherTexture")');
  const previewSettingsIndex = source.indexOf('t("advancedPreviewSettings")');
  const systemMetadataIndex = source.indexOf('t("advancedSystemMetadata")');
  assert.ok(textureIndex > 0);
  assert.ok(previewSettingsIndex > textureIndex);
  assert.ok(systemMetadataIndex > 0);
  assert.ok(source.indexOf('t("focusX")') > previewSettingsIndex);
  assert.ok(source.indexOf('t("focusY")') > previewSettingsIndex);
  assert.ok(source.indexOf('t("zoom")') > previewSettingsIndex);
  assert.ok(source.indexOf('t("overlayOpacity")') > previewSettingsIndex);
  assert.ok(source.indexOf('t("overlayColor")') > previewSettingsIndex);
  assert.ok(source.indexOf("type=\"range\"") > previewSettingsIndex);
  assert.ok(source.indexOf('t("textureStoragePath")') > systemMetadataIndex);
  assert.ok(source.indexOf('t("texturePublicUrl")') > systemMetadataIndex);
  assert.ok(source.indexOf('t("textureWidth")') > systemMetadataIndex);
  assert.ok(source.indexOf('t("textureHeight")') > systemMetadataIndex);
  assert.ok(source.indexOf('t("textureMimeType")') > systemMetadataIndex);
  assert.match(source, /readOnly/);
});

test("public journal data resolves and receives selected theme safely", async () => {
  const migration = await readSource(
    "supabase/migrations/202607060001_scrap_day_phase_6a_journal_themes.sql",
  );
  const capsuleApi = await readSource("lib/capsule/api.ts");
  const capsulePage = await readSource("components/capsule/capsule-page.tsx");
  const journalHome = await readSource("components/journal/journal-home.tsx");
  const journalMemoryPage = await readSource("components/journal/journal-memory-page.tsx");
  const persistentFlow = await readSource("components/capsule/persistent-memory-flow.tsx");
  const dailyStamp = await readSource("components/stamp/daily-memory-stamp.tsx");
  const edgeFunction = await readSource("supabase/functions/capsule-access/index.ts");

  assert.match(migration, /'journalTheme'/);
  assert.match(migration, /public\.journal_theme_json/);
  assert.match(capsuleApi, /mapJournalTheme/);
  assert.match(capsuleApi, /theme:\s*mapJournalTheme/);
  assert.match(capsulePage, /journalTheme/);
  assert.match(journalHome, /resolveJournalTheme\(journal\.theme\)/);
  assert.match(journalMemoryPage, /theme\?: JournalTheme/);
  assert.match(persistentFlow, /theme\?: JournalTheme/);
  assert.match(dailyStamp, /theme = defaultJournalTheme/);
  assert.match(edgeFunction, /journalTheme/);
});
