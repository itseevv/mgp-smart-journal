"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import { useAdminLocale } from "@/components/admin/admin-locale-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  defaultJournalTheme,
  journalThemeStyle,
  resolveJournalTheme,
  type JournalTheme,
  type JournalThemeStatus,
} from "@/data/journal-themes";
import { isCloseToPortraitBackgroundAspect } from "@/lib/journal-theme-background";
import type { AdminTranslationKey } from "@/lib/admin/i18n";

type AdminJournalTheme = JournalTheme & {
  description?: string | null;
  sortOrder: number;
  assignedCapsuleCount: number;
};

type ThemeFormState = {
  slug: string;
  name: string;
  description: string;
  status: JournalThemeStatus;
  sortOrder: number;
  textureStoragePath: string;
  texturePublicUrl: string;
  textureWidth: string;
  textureHeight: string;
  textureMimeType: string;
  focusX: number;
  focusY: number;
  zoom: number;
  overlayColor: string;
  overlayOpacity: number;
  fallbackBackgroundColor: string;
  textPrimary: string;
  textSecondary: string;
  paperSurface: string;
  paperSurfaceMuted: string;
  stampBorder: string;
  accentColor: string;
  logoVariant: string;
};

const emptyForm: ThemeFormState = {
  slug: "",
  name: "",
  description: "",
  status: "draft",
  sortOrder: 0,
  textureStoragePath: "",
  texturePublicUrl: "",
  textureWidth: "",
  textureHeight: "",
  textureMimeType: "",
  focusX: defaultJournalTheme.focusX,
  focusY: defaultJournalTheme.focusY,
  zoom: defaultJournalTheme.zoom,
  overlayColor: "",
  overlayOpacity: defaultJournalTheme.overlayOpacity,
  fallbackBackgroundColor: defaultJournalTheme.fallbackBackgroundColor,
  textPrimary: defaultJournalTheme.textPrimary,
  textSecondary: defaultJournalTheme.textSecondary,
  paperSurface: defaultJournalTheme.paperSurface,
  paperSurfaceMuted: defaultJournalTheme.paperSurfaceMuted,
  stampBorder: defaultJournalTheme.stampBorder,
  accentColor: defaultJournalTheme.accentColor,
  logoVariant: defaultJournalTheme.logoVariant,
};

function slugFromName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formFromTheme(theme: AdminJournalTheme): ThemeFormState {
  const resolved = resolveJournalTheme(theme);
  return {
    slug: resolved.slug,
    name: resolved.name,
    description: theme.description ?? "",
    status:
      resolved.status === "draft" ||
      resolved.status === "active" ||
      resolved.status === "archived"
        ? resolved.status
        : "draft",
    sortOrder: theme.sortOrder ?? 0,
    textureStoragePath: resolved.textureStoragePath ?? "",
    texturePublicUrl: resolved.texturePublicUrl ?? "",
    textureWidth: resolved.textureWidth ? String(resolved.textureWidth) : "",
    textureHeight: resolved.textureHeight ? String(resolved.textureHeight) : "",
    textureMimeType: resolved.textureMimeType ?? "",
    focusX: resolved.focusX,
    focusY: resolved.focusY,
    zoom: resolved.zoom,
    overlayColor: resolved.overlayColor ?? "",
    overlayOpacity: resolved.overlayOpacity,
    fallbackBackgroundColor: resolved.fallbackBackgroundColor,
    textPrimary: resolved.textPrimary,
    textSecondary: resolved.textSecondary,
    paperSurface: resolved.paperSurface,
    paperSurfaceMuted: resolved.paperSurfaceMuted,
    stampBorder: resolved.stampBorder,
    accentColor: resolved.accentColor,
    logoVariant: resolved.logoVariant,
  };
}

function themePayload(form: ThemeFormState) {
  return {
    ...form,
    textureWidth: form.textureWidth ? Number(form.textureWidth) : null,
    textureHeight: form.textureHeight ? Number(form.textureHeight) : null,
  };
}

function shouldShowPortraitTextureNote(theme: JournalTheme) {
  return Boolean(
    theme.textureUrl &&
      theme.textureWidth &&
      theme.textureHeight &&
      !isCloseToPortraitBackgroundAspect({
        width: theme.textureWidth,
        height: theme.textureHeight,
      }),
  );
}

export function AdminJournalThemesPage() {
  const { t, statusLabel, formatNumber } = useAdminLocale();
  const [themes, setThemes] = useState<AdminJournalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageKey, setMessageKey] = useState<AdminTranslationKey | null>(null);

  const load = async () => {
    setLoading(true);
    setMessageKey(null);
    try {
      const response = await fetch("/api/admin/journal-themes");
      if (response.status === 401) {
        setMessageKey("themeLibrarySessionRequired");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? "UNAVAILABLE");
      setThemes(result.themes ?? []);
    } catch {
      setMessageKey("themeLibraryLoadFailed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AdminShell>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin/capsules" className="font-sans text-sm font-bold text-oxblood underline underline-offset-4">
              {t("backToCapsules")}
            </Link>
            <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
              {t("themesEyebrow")}
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink">{t("themesTitle")}</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-ink-soft">
              {t("themesDescription")}
            </p>
          </div>
          <Link
            href="/admin/journal-themes/new"
            className="inline-flex justify-center bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper"
          >
            {t("newTheme")}
          </Link>
        </header>

        {messageKey ? <p className="font-sans text-sm text-oxblood">{t(messageKey)}</p> : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {t("themesCount", { count: formatNumber(themes.length) })}
            </h2>
            {loading ? <span className="font-sans text-xs text-ink-soft">{t("loading")}</span> : null}
          </div>
          <div className="overflow-x-auto border border-rule">
            <table className="min-w-full border-collapse bg-paper/80 font-sans text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="border-b border-rule p-3">{t("preview")}</th>
                  <th className="border-b border-rule p-3">{t("name")}</th>
                  <th className="border-b border-rule p-3">{t("slug")}</th>
                  <th className="border-b border-rule p-3">{t("status")}</th>
                  <th className="border-b border-rule p-3">{t("sort")}</th>
                  <th className="border-b border-rule p-3">{t("texture")}</th>
                  <th className="border-b border-rule p-3">{t("assigned")}</th>
                  <th className="border-b border-rule p-3">{t("tableActions")}</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => {
                  const resolved = resolveJournalTheme(theme);
                  return (
                    <tr key={theme.id} className="align-top">
                      <td className="border-b border-rule p-3">
                        <span
                          aria-hidden="true"
                          className="block h-10 w-16 border border-rule"
                          style={{ background: resolved.fallbackBackgroundColor }}
                        />
                      </td>
                      <td className="border-b border-rule p-3 font-bold">{resolved.name}</td>
                      <td className="border-b border-rule p-3 font-mono text-xs">{resolved.slug}</td>
                      <td className="border-b border-rule p-3 capitalize">{statusLabel(String(resolved.status ?? ""))}</td>
                      <td className="border-b border-rule p-3">{formatNumber(theme.sortOrder)}</td>
                      <td className="border-b border-rule p-3">{resolved.textureUrl ? t("yes") : t("no")}</td>
                      <td className="border-b border-rule p-3">{formatNumber(theme.assignedCapsuleCount)}</td>
                      <td className="border-b border-rule p-3">
                        <Link href={`/admin/journal-themes/${theme.id}`} className="font-bold text-oxblood underline underline-offset-4">
                          {t("edit")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {themes.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-ink-soft">
                      {t("noThemes")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export function AdminJournalThemeEditPage({ themeId }: { themeId?: string }) {
  const router = useRouter();
  const {
    t,
    statusLabel,
    errorMessage,
    textureWarning,
    formatNumber,
  } = useAdminLocale();
  const [form, setForm] = useState<ThemeFormState>(emptyForm);
  const [slugEdited, setSlugEdited] = useState(Boolean(themeId));
  const [loading, setLoading] = useState(Boolean(themeId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [messageKey, setMessageKey] = useState<AdminTranslationKey | null>(null);
  const [uploadMessageKey, setUploadMessageKey] =
    useState<AdminTranslationKey | null>(null);
  const [uploadErrorCode, setUploadErrorCode] = useState<string | null>(null);
  const preview = resolveJournalTheme({
    ...form,
    textureWidth: form.textureWidth ? Number(form.textureWidth) : undefined,
    textureHeight: form.textureHeight ? Number(form.textureHeight) : undefined,
  });
  const textureDimensions =
    preview.textureWidth && preview.textureHeight
      ? `${formatNumber(preview.textureWidth)} × ${formatNumber(preview.textureHeight)}`
      : t("dimensionsUnknown");

  useEffect(() => {
    if (!themeId) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setMessageKey(null);
        try {
          const response = await fetch(`/api/admin/journal-themes/${themeId}`);
          if (response.status === 401) {
            setMessageKey("themeLibrarySessionRequired");
            return;
          }
          const result = await response.json();
          if (!response.ok || !result.ok || !result.theme) {
            setMessageKey("themeLoadFailed");
            return;
          }
          setForm(formFromTheme(result.theme));
          setUploadWarnings([]);
          setUploadMessageKey(null);
          setUploadErrorCode(null);
          setSlugEdited(true);
        } catch {
          setMessageKey("themeLoadFailed");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [themeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessageKey(null);
    try {
      const response = await fetch(
        themeId ? `/api/admin/journal-themes/${themeId}` : "/api/admin/journal-themes",
        {
          method: themeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(themePayload(form)),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessageKey(
          result.code === "SLUG_CONFLICT"
            ? "slugConflict"
            : "themeSaveFailed",
        );
        return;
      }
      setMessageKey("themeSaved");
      if (!themeId && result.theme?.id) {
        router.replace(`/admin/journal-themes/${result.theme.id}`);
      }
    } catch {
      setMessageKey("themeSaveFailed");
    } finally {
      setSaving(false);
    }
  };

  const updateName = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: slugEdited ? current.slug : slugFromName(name),
    }));
  };

  const updateSlug = (slug: string) => {
    setSlugEdited(true);
    setForm((current) => ({ ...current, slug: slugFromName(slug) }));
  };

  const uploadTexture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !themeId) return;

    setUploading(true);
    setUploadMessageKey(null);
    setUploadErrorCode(null);
    setUploadWarnings([]);
    try {
      const formData = new FormData();
      formData.append("texture", file);
      const response = await fetch(`/api/admin/journal-themes/${themeId}/texture`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.theme) {
        setUploadErrorCode(String(result.code ?? "UNAVAILABLE"));
        return;
      }

      setForm(formFromTheme(result.theme));
      setSlugEdited(true);
      const warnings = Array.isArray(result.texture?.warnings)
        ? result.texture.warnings.filter((warning: unknown) => typeof warning === "string")
        : [];
      setUploadWarnings(warnings);
      setUploadMessageKey(
        warnings.length > 0
          ? "textureUploadedWithWarnings"
          : "textureUploaded",
      );
    } catch {
      setUploadMessageKey("textureUploadFailed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <AdminShell>
        <p className="font-sans text-sm text-ink-soft">{t("loadingTheme")}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <form onSubmit={submit} className="space-y-8">
        <header className="border-b border-rule pb-6">
          <Link href="/admin/journal-themes" className="font-sans text-sm font-bold text-oxblood underline underline-offset-4">
            {t("backToThemeLibrary")}
          </Link>
          <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
            {t("themeEyebrow")}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink">
            {themeId ? form.name || t("editTheme") : t("newTheme")}
          </h1>
        </header>

        {messageKey ? <p className="font-sans text-sm text-oxblood">{t(messageKey)}</p> : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-8">
            <section className="space-y-5">
              <div>
                <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
                  {t("themeDetails")}
                </h2>
                <p className="mt-2 font-sans text-sm leading-6 text-ink-soft">
                  {t("themeDetailsDescription")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("themeName")} value={form.name} onChange={updateName} />
                <TextField label={t("slug")} value={form.slug} onChange={updateSlug} />
                <label className="block font-sans text-sm font-semibold">
                  {t("status")}
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as JournalThemeStatus })
                    }
                    className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                  >
                    <option value="draft">{statusLabel("draft")}</option>
                    <option value="active">{statusLabel("active")}</option>
                    <option value="archived">{statusLabel("archived")}</option>
                  </select>
                </label>
                <NumberField label={t("sortOrder")} value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder })} />
              </div>
              <label className="block font-sans text-sm font-semibold">
                {t("description")}
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="mt-2 min-h-20 w-full border border-rule bg-paper px-3 py-2"
                />
              </label>
            </section>

            <section className="space-y-4 border-t border-rule pt-6">
              <div>
                <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
                  {t("leatherTexture")}
                </h2>
                <p className="mt-2 font-sans text-sm leading-6 text-ink-soft">
                  {t("leatherTextureDescription")}
                </p>
              </div>

              {themeId ? (
                <label className="inline-flex cursor-pointer border border-oxblood px-4 py-3 font-sans text-sm font-bold text-oxblood">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => void uploadTexture(event)}
                  />
                  {uploading ? t("uploading") : t("uploadReplaceTexture")}
                </label>
              ) : (
                <div>
                  <button
                    type="button"
                    disabled
                    className="border border-rule bg-paper-deep/20 px-4 py-3 font-sans text-sm font-bold text-ink-soft disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {t("uploadReplaceTexture")}
                  </button>
                  <p className="mt-2 font-sans text-xs leading-5 text-ink-soft">
                    {t("textureAfterSave")}
                  </p>
                </div>
              )}

              {uploadMessageKey || uploadErrorCode ? (
                <p className="font-sans text-sm text-oxblood" role="status">
                  {uploadErrorCode
                    ? errorMessage(uploadErrorCode)
                    : t(uploadMessageKey!)}
                </p>
              ) : null}
              {uploadWarnings.length > 0 ? (
                <ul className="space-y-1 border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-xs leading-5 text-oxblood">
                  {uploadWarnings.map((warning) => (
                    <li key={warning}>{textureWarning(warning)}</li>
                  ))}
                </ul>
              ) : null}

              {preview.textureUrl ? (
                <div className="space-y-1 font-sans text-xs leading-5 text-ink-soft">
                  <p>
                    {t("currentBackground", {
                      dimensions: textureDimensions,
                      mimeType: preview.textureMimeType ?? t("image"),
                    })}
                  </p>
                  {shouldShowPortraitTextureNote(preview) ? (
                    <p className="text-oxblood">
                      {t("portraitTextureRecommendation")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="font-sans text-xs leading-5 text-ink-soft">
                  {t("noBackground")}
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <ThemeMobilePreview theme={preview} />
                <ThemeExportPreview theme={preview} />
              </div>

              <details className="border border-rule bg-paper/45 p-4">
                <summary className="cursor-pointer font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
                  {t("advancedPreviewSettings")}
                </summary>
                <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
                  {t("advancedPreviewDescription")}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SliderField label={t("focusX")} value={form.focusX} min={0} max={1} step={0.01} onChange={(focusX) => setForm({ ...form, focusX })} />
                  <SliderField label={t("focusY")} value={form.focusY} min={0} max={1} step={0.01} onChange={(focusY) => setForm({ ...form, focusY })} />
                  <SliderField label={t("zoom")} value={form.zoom} min={1} max={3} step={0.05} onChange={(zoom) => setForm({ ...form, zoom })} />
                  <SliderField label={t("overlayOpacity")} value={form.overlayOpacity} min={0} max={0.8} step={0.01} onChange={(overlayOpacity) => setForm({ ...form, overlayOpacity })} />
                  <TextField label={t("overlayColor")} value={form.overlayColor} onChange={(overlayColor) => setForm({ ...form, overlayColor })} />
                </div>
              </details>
            </section>
          </div>

          <aside className="space-y-3 border border-rule p-4">
            <div
              className="h-40 border border-rule p-4"
              style={{ background: preview.fallbackBackgroundColor, color: preview.textPrimary }}
            >
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em]" style={{ color: preview.textSecondary }}>
                {t("preview")}
              </p>
              <p className="mt-3 font-serif text-3xl leading-none">{preview.name || t("themeFallbackName")}</p>
              <div className="mt-5 h-10 border" style={{ background: preview.paperSurface, borderColor: preview.stampBorder }} />
            </div>
            <p className="font-sans text-xs leading-5 text-ink-soft">
              {t("previewDescription")}
            </p>
          </aside>
        </section>

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            {t("advancedVisualTokens")}
          </h2>
          <p className="font-sans text-sm leading-6 text-ink-soft">
            {t("advancedVisualDescription")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label={t("backgroundColor")} value={form.fallbackBackgroundColor} onChange={(fallbackBackgroundColor) => setForm({ ...form, fallbackBackgroundColor })} />
            <TextField label={t("textPrimary")} value={form.textPrimary} onChange={(textPrimary) => setForm({ ...form, textPrimary })} />
            <TextField label={t("textSecondary")} value={form.textSecondary} onChange={(textSecondary) => setForm({ ...form, textSecondary })} />
            <TextField label={t("paperSurface")} value={form.paperSurface} onChange={(paperSurface) => setForm({ ...form, paperSurface })} />
            <TextField label={t("paperMuted")} value={form.paperSurfaceMuted} onChange={(paperSurfaceMuted) => setForm({ ...form, paperSurfaceMuted })} />
            <TextField label={t("stampBorder")} value={form.stampBorder} onChange={(stampBorder) => setForm({ ...form, stampBorder })} />
            <TextField label={t("accentColor")} value={form.accentColor} onChange={(accentColor) => setForm({ ...form, accentColor })} />
            <TextField label={t("logoVariant")} value={form.logoVariant} onChange={(logoVariant) => setForm({ ...form, logoVariant })} />
          </div>
        </section>

        <details className="border-t border-rule pt-6">
          <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            {t("advancedSystemMetadata")}
          </summary>
          <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
            {t("systemMetadataDescription")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label={t("textureStoragePath")} value={form.textureStoragePath} readOnly />
            <TextField label={t("texturePublicUrl")} value={form.texturePublicUrl} readOnly />
            <TextField label={t("textureWidth")} value={form.textureWidth} readOnly />
            <TextField label={t("textureHeight")} value={form.textureHeight} readOnly />
            <TextField label={t("textureMimeType")} value={form.textureMimeType} readOnly />
          </div>
        </details>

        <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
          <button
            disabled={saving}
            className="bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper disabled:opacity-50"
          >
            {saving ? t("saving") : t("saveTheme")}
          </button>
          <Link href="/admin/journal-themes" className="border border-rule px-4 py-3 font-sans text-sm font-bold text-ink">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </AdminShell>
  );
}

function ThemeMobilePreview({ theme }: { theme: JournalTheme }) {
  const { t } = useAdminLocale();
  return (
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
        {t("mobileAppPreview")}
      </h3>
      <div
        className="relative mx-auto mt-3 aspect-[9/16] w-full max-w-[18rem] overflow-hidden bg-[var(--journal-background)] shadow-[0_16px_42px_rgba(18,11,10,0.22)]"
        data-theme-mobile-preview="true"
        style={journalThemeStyle(theme)}
      >
        <ThemePreviewTextureImage theme={theme} />
        <div className="relative z-10 flex h-full flex-col p-4">
          <header className="text-[var(--journal-text)]">
            <p className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--journal-muted)]">
              {t("previewJournal")}
            </p>
            <p className="mt-2 font-serif text-3xl leading-none">
              {theme.name || t("themeFallbackName")}
            </p>
          </header>
          <div className="mt-5 bg-[var(--journal-paper)] p-3 shadow-[0_12px_30px_rgba(18,11,10,0.2)]">
            <p className="font-sans text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--journal-paper-muted-text)]">
              {t("previewMonth")}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5 bg-[var(--journal-paper-muted)] p-1.5">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={index}
                  className="aspect-square border border-[var(--journal-stamp-border)] bg-[var(--journal-paper)]"
                />
              ))}
            </div>
          </div>
          <div className="mt-auto pt-4 font-sans text-[0.62rem] text-[var(--journal-muted)]">
            {t("previewPrivacy")}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeExportPreview({ theme }: { theme: JournalTheme }) {
  const { t, formatDateOnly } = useAdminLocale();
  return (
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
        {t("dailyExportPreview")}
      </h3>
      <div
        className="relative mx-auto mt-3 aspect-[9/16] w-full max-w-[18rem] overflow-hidden bg-[var(--journal-background)] shadow-[0_16px_42px_rgba(18,11,10,0.22)]"
        data-theme-export-preview="true"
        style={journalThemeStyle(theme)}
      >
        <ThemePreviewTextureImage theme={theme} />
        <div className="relative z-10 flex h-full flex-col p-5">
          <p className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--journal-muted)]">
            {formatDateOnly(new Date("2026-07-06T12:00:00Z"))}
          </p>
          <p className="mt-3 max-w-[10ch] font-serif text-4xl leading-none text-[var(--journal-text)]">
            {t("previewDailyScrap")}
          </p>
          <div className="mt-8 bg-[var(--journal-paper)] p-3 shadow-[0_18px_38px_rgba(18,11,10,0.24)]">
            <div className="grid grid-cols-3 gap-2 bg-[var(--journal-paper-muted)] p-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <span
                  key={index}
                  className="aspect-square border-4 border-paper bg-[var(--journal-filler-a)] shadow-[inset_0_0_0_1px_var(--journal-stamp-border)]"
                />
              ))}
            </div>
          </div>
          <p className="mt-auto text-right font-serif text-2xl text-[var(--journal-logo-mark)]">
            MGP
          </p>
        </div>
      </div>
    </section>
  );
}

function ThemePreviewTextureImage({ theme }: { theme: JournalTheme }) {
  if (!theme.textureUrl) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={theme.textureUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="absolute inset-0 z-0 h-full w-full object-contain"
    />
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="block font-sans text-sm font-semibold">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-xs font-normal text-ink-soft">
          {value.toFixed(step < 0.05 ? 2 : 1)}
        </span>
      </span>
      <input
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        min={min}
        max={max}
        step={step}
        className="mt-3 w-full accent-oxblood"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block font-sans text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        className={`mt-2 w-full border border-rule px-3 py-2 ${
          readOnly ? "bg-paper-deep/30 text-ink-soft" : "bg-paper"
        }`}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block font-sans text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        min={min}
        max={max}
        step={step}
        className="mt-2 w-full border border-rule bg-paper px-3 py-2"
      />
    </label>
  );
}
