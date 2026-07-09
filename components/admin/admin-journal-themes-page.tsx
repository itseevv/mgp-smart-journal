"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import {
  defaultJournalTheme,
  journalThemeStyle,
  resolveJournalTheme,
  type JournalTheme,
  type JournalThemeStatus,
} from "@/data/journal-themes";
import { isCloseToPortraitBackgroundAspect } from "@/lib/journal-theme-background";

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

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function textureDimensionLabel(theme: JournalTheme) {
  if (!theme.textureWidth || !theme.textureHeight) {
    return "Dimensions not detected yet";
  }

  return `${theme.textureWidth} × ${theme.textureHeight}`;
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
  const [themes, setThemes] = useState<AdminJournalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/journal-themes");
      if (response.status === 401) {
        setMessage("Admin session required. Unlock from the capsule admin page.");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? "UNAVAILABLE");
      setThemes(result.themes ?? []);
    } catch {
      setMessage("Theme library could not be loaded.");
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
              Back to capsules
            </Link>
            <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
              Journal system
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink">Theme library</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-ink-soft">
              Manage the dynamic leather and color identities that can be assigned
              to journal capsules.
            </p>
          </div>
          <Link
            href="/admin/journal-themes/new"
            className="inline-flex justify-center bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper"
          >
            New theme
          </Link>
        </header>

        {message ? <p className="font-sans text-sm text-oxblood">{message}</p> : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {themes.length} themes
            </h2>
            {loading ? <span className="font-sans text-xs text-ink-soft">Loading...</span> : null}
          </div>
          <div className="overflow-x-auto border border-rule">
            <table className="min-w-full border-collapse bg-paper/80 font-sans text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="border-b border-rule p-3">Preview</th>
                  <th className="border-b border-rule p-3">Name</th>
                  <th className="border-b border-rule p-3">Slug</th>
                  <th className="border-b border-rule p-3">Status</th>
                  <th className="border-b border-rule p-3">Sort</th>
                  <th className="border-b border-rule p-3">Texture</th>
                  <th className="border-b border-rule p-3">Assigned</th>
                  <th className="border-b border-rule p-3">Actions</th>
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
                      <td className="border-b border-rule p-3">{theme.sortOrder}</td>
                      <td className="border-b border-rule p-3">{resolved.textureUrl ? "Yes" : "No"}</td>
                      <td className="border-b border-rule p-3">{theme.assignedCapsuleCount}</td>
                      <td className="border-b border-rule p-3">
                        <Link href={`/admin/journal-themes/${theme.id}`} className="font-bold text-oxblood underline underline-offset-4">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
  const [form, setForm] = useState<ThemeFormState>(emptyForm);
  const [slugEdited, setSlugEdited] = useState(Boolean(themeId));
  const [loading, setLoading] = useState(Boolean(themeId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const preview = resolveJournalTheme({
    ...form,
    textureWidth: form.textureWidth ? Number(form.textureWidth) : undefined,
    textureHeight: form.textureHeight ? Number(form.textureHeight) : undefined,
  });

  useEffect(() => {
    if (!themeId) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setMessage("");
        try {
          const response = await fetch(`/api/admin/journal-themes/${themeId}`);
          if (response.status === 401) {
            setMessage("Admin session required. Unlock from the capsule admin page.");
            return;
          }
          const result = await response.json();
          if (!response.ok || !result.ok || !result.theme) {
            setMessage("Theme could not be loaded.");
            return;
          }
          setForm(formFromTheme(result.theme));
          setUploadWarnings([]);
          setUploadMessage("");
          setSlugEdited(true);
        } catch {
          setMessage("Theme could not be loaded.");
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
    setMessage("");
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
        setMessage(
          result.code === "SLUG_CONFLICT"
            ? "That slug is already used by another theme."
            : "Theme could not be saved. Check the fields and retry.",
        );
        return;
      }
      setMessage("Theme saved.");
      if (!themeId && result.theme?.id) {
        router.replace(`/admin/journal-themes/${result.theme.id}`);
      }
    } catch {
      setMessage("Theme could not be saved.");
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
    setUploadMessage("");
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
        const errorCopy: Record<string, string> = {
          TEXTURE_EMPTY: "Choose a texture image before uploading.",
          TEXTURE_TOO_LARGE: "Texture is too large. Use an image under 12MB.",
          TEXTURE_TYPE_UNSUPPORTED: "Use a JPEG, PNG, or WebP texture image.",
          TEXTURE_TYPE_MISMATCH: "The file contents do not match its image type.",
          TEXTURE_DIMENSIONS_UNREADABLE: "Texture dimensions could not be read.",
          TEXTURE_REQUIRED: "Choose a texture image before uploading.",
        };
        setUploadMessage(
          errorCopy[String(result.code)] ?? "Texture could not be uploaded.",
        );
        return;
      }

      setForm(formFromTheme(result.theme));
      setSlugEdited(true);
      const warnings = Array.isArray(result.texture?.warnings)
        ? result.texture.warnings.filter((warning: unknown) => typeof warning === "string")
        : [];
      setUploadWarnings(warnings);
      setUploadMessage(
        warnings.length > 0
          ? "Texture uploaded. Review the warnings before publishing."
          : "Texture uploaded.",
      );
    } catch {
      setUploadMessage("Texture could not be uploaded.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <AdminShell>
        <p className="font-sans text-sm text-ink-soft">Loading theme...</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <form onSubmit={submit} className="space-y-8">
        <header className="border-b border-rule pb-6">
          <Link href="/admin/journal-themes" className="font-sans text-sm font-bold text-oxblood underline underline-offset-4">
            Back to theme library
          </Link>
          <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
            Journal theme
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink">
            {themeId ? form.name || "Edit theme" : "New theme"}
          </h1>
        </header>

        {message ? <p className="font-sans text-sm text-oxblood">{message}</p> : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-8">
            <section className="space-y-5">
              <div>
                <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
                  Theme details
                </h2>
                <p className="mt-2 font-sans text-sm leading-6 text-ink-soft">
                  Name the journal theme, choose its availability, and set its library order.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Theme name" value={form.name} onChange={updateName} />
                <TextField label="Slug" value={form.slug} onChange={updateSlug} />
                <label className="block font-sans text-sm font-semibold">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as JournalThemeStatus })
                    }
                    className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <NumberField label="Sort order" value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder })} />
              </div>
              <label className="block font-sans text-sm font-semibold">
                Description
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
                  Leather texture
                </h2>
                <p className="mt-2 font-sans text-sm leading-6 text-ink-soft">
                  Upload a prepared 9:16 portrait leather background. The full
                  image is used by default for the app and daily export.
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
                  {uploading ? "Uploading..." : "Upload / Replace texture"}
                </label>
              ) : (
                <div>
                  <button
                    type="button"
                    disabled
                    className="border border-rule bg-paper-deep/20 px-4 py-3 font-sans text-sm font-bold text-ink-soft disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Upload / Replace texture
                  </button>
                  <p className="mt-2 font-sans text-xs leading-5 text-ink-soft">
                    Texture upload is available after the theme is saved.
                  </p>
                </div>
              )}

              {uploadMessage ? (
                <p className="font-sans text-sm text-oxblood" role="status">
                  {uploadMessage}
                </p>
              ) : null}
              {uploadWarnings.length > 0 ? (
                <ul className="space-y-1 border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-xs leading-5 text-oxblood">
                  {uploadWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}

              {preview.textureUrl ? (
                <div className="space-y-1 font-sans text-xs leading-5 text-ink-soft">
                  <p>
                    Current background: {textureDimensionLabel(preview)}{" "}
                    {preview.textureMimeType ?? "image"}
                  </p>
                  {shouldShowPortraitTextureNote(preview) ? (
                    <p className="text-oxblood">
                      For best results, upload a 9:16 portrait texture.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="font-sans text-xs leading-5 text-ink-soft">
                  No background uploaded yet. The previews fall back to the
                  theme color tokens.
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <ThemeMobilePreview theme={preview} />
                <ThemeExportPreview theme={preview} />
              </div>

              <details className="border border-rule bg-paper/45 p-4">
                <summary className="cursor-pointer font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
                  Advanced / Preview Settings
                </summary>
                <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
                  Advanced framing controls. Usually not needed when using a
                  prepared 9:16 background.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SliderField label="Focus X" value={form.focusX} min={0} max={1} step={0.01} onChange={(focusX) => setForm({ ...form, focusX })} />
                  <SliderField label="Focus Y" value={form.focusY} min={0} max={1} step={0.01} onChange={(focusY) => setForm({ ...form, focusY })} />
                  <SliderField label="Zoom" value={form.zoom} min={1} max={3} step={0.05} onChange={(zoom) => setForm({ ...form, zoom })} />
                  <SliderField label="Overlay opacity" value={form.overlayOpacity} min={0} max={0.8} step={0.01} onChange={(overlayOpacity) => setForm({ ...form, overlayOpacity })} />
                  <TextField label="Overlay color" value={form.overlayColor} onChange={(overlayColor) => setForm({ ...form, overlayColor })} />
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
                Preview
              </p>
              <p className="mt-3 font-serif text-3xl leading-none">{preview.name || "Theme"}</p>
              <div className="mt-5 h-10 border" style={{ background: preview.paperSurface, borderColor: preview.stampBorder }} />
            </div>
            <p className="font-sans text-xs leading-5 text-ink-soft">
              The preview uses the uploaded 9:16 background at full frame when
              available. Themes without a texture fall back to color tokens.
            </p>
          </aside>
        </section>

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            Advanced visual tokens
          </h2>
          <p className="font-sans text-sm leading-6 text-ink-soft">
            These color tokens remain editable while the texture workflow is prepared.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Background color" value={form.fallbackBackgroundColor} onChange={(fallbackBackgroundColor) => setForm({ ...form, fallbackBackgroundColor })} />
            <TextField label="Text primary" value={form.textPrimary} onChange={(textPrimary) => setForm({ ...form, textPrimary })} />
            <TextField label="Text secondary" value={form.textSecondary} onChange={(textSecondary) => setForm({ ...form, textSecondary })} />
            <TextField label="Paper surface" value={form.paperSurface} onChange={(paperSurface) => setForm({ ...form, paperSurface })} />
            <TextField label="Paper muted" value={form.paperSurfaceMuted} onChange={(paperSurfaceMuted) => setForm({ ...form, paperSurfaceMuted })} />
            <TextField label="Stamp border" value={form.stampBorder} onChange={(stampBorder) => setForm({ ...form, stampBorder })} />
            <TextField label="Accent color" value={form.accentColor} onChange={(accentColor) => setForm({ ...form, accentColor })} />
            <TextField label="Logo variant" value={form.logoVariant} onChange={(logoVariant) => setForm({ ...form, logoVariant })} />
          </div>
        </section>

        <details className="border-t border-rule pt-6">
          <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            Advanced / System Metadata
          </summary>
          <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
            Texture asset metadata is kept here for system continuity. Normal setup
            should use the upload flow above.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label="Texture storage path" value={form.textureStoragePath} readOnly />
            <TextField label="Texture public URL" value={form.texturePublicUrl} readOnly />
            <TextField label="Texture width" value={form.textureWidth} readOnly />
            <TextField label="Texture height" value={form.textureHeight} readOnly />
            <TextField label="Texture MIME type" value={form.textureMimeType} readOnly />
          </div>
        </details>

        <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
          <button
            disabled={saving}
            className="bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save theme"}
          </button>
          <Link href="/admin/journal-themes" className="border border-rule px-4 py-3 font-sans text-sm font-bold text-ink">
            Cancel
          </Link>
        </div>
      </form>
    </AdminShell>
  );
}

function ThemeMobilePreview({ theme }: { theme: JournalTheme }) {
  return (
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
        Mobile App Preview
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
              Journal
            </p>
            <p className="mt-2 font-serif text-3xl leading-none">
              {theme.name || "Theme"}
            </p>
          </header>
          <div className="mt-5 bg-[var(--journal-paper)] p-3 shadow-[0_12px_30px_rgba(18,11,10,0.2)]">
            <p className="font-sans text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--journal-paper-muted-text)]">
              July
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
            Private by nature.
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeExportPreview({ theme }: { theme: JournalTheme }) {
  return (
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink">
        Daily Export Preview
      </h3>
      <div
        className="relative mx-auto mt-3 aspect-[9/16] w-full max-w-[18rem] overflow-hidden bg-[var(--journal-background)] shadow-[0_16px_42px_rgba(18,11,10,0.22)]"
        data-theme-export-preview="true"
        style={journalThemeStyle(theme)}
      >
        <ThemePreviewTextureImage theme={theme} />
        <div className="relative z-10 flex h-full flex-col p-5">
          <p className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--journal-muted)]">
            July 6, 2026
          </p>
          <p className="mt-3 max-w-[10ch] font-serif text-4xl leading-none text-[var(--journal-text)]">
            Daily Scrap
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

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="paper-surface mx-auto max-w-6xl bg-paper p-5 shadow-[0_16px_45px_rgba(23,18,15,0.2)] sm:p-8">
        {children}
      </div>
    </main>
  );
}
