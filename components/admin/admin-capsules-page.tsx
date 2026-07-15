"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAdminLocale } from "@/components/admin/admin-locale-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AdminTranslationKey } from "@/lib/admin/i18n";

type ProductType = "journal" | "bookmark";
type FulfillmentStatus =
  | "generated"
  | "written"
  | "tested"
  | "packed"
  | "shipped"
  | "disabled";

type AdminBatch = {
  id: string;
  batchName: string;
  productType: ProductType;
  quantity: number;
  status: "generated";
  createdAt: string;
};

type AdminCapsule = {
  id: string;
  batchId: string;
  batchName: string;
  serialNumber: string;
  productType: ProductType;
  publicToken: string;
  activationStatus: "unactivated" | "active";
  fulfillmentStatus: FulfillmentStatus;
  nfcWriteStatus: "pending" | "written" | "tested";
  recoveryStatus: "not_issued" | "issued";
  createdAt: string;
  memoryCount: number;
  photoCount: number;
  voiceMemoCount: number;
  journalTheme?: AdminJournalTheme | null;
};

type AdminJournalTheme = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "active" | "archived";
  fallbackBackgroundColor: string;
};

type RecoveryHandoffItem = {
  capsuleId: string;
  serialNumber: string;
  capsuleUrl: string;
  recoveryCode: string;
  codeVersion: number;
};

type AdminUrlConfig = {
  appBaseUrlConfigured: boolean;
  appBaseUrlWarning?: string | null;
};

export function AdminCapsulesPage() {
  const { t, statusLabel, formatNumber } = useAdminLocale();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [capsules, setCapsules] = useState<AdminCapsule[]>([]);
  const [journalThemes, setJournalThemes] = useState<AdminJournalTheme[]>([]);
  const [handoff, setHandoff] = useState<RecoveryHandoffItem[]>([]);
  const [urlConfig, setUrlConfig] = useState<AdminUrlConfig | null>(null);
  const [messageKey, setMessageKey] = useState<AdminTranslationKey | null>(null);
  const [filters, setFilters] = useState({
    productType: "",
    status: "",
    batchId: "",
    search: "",
  });
  const [form, setForm] = useState({
    batchName: "June 2026 Journal Batch",
    productType: "journal" as ProductType,
    quantity: 5,
    serialPrefix: "",
    journalThemeId: "",
    notes: "",
    issueRecovery: false,
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.productType) params.set("productType", filters.productType);
    if (filters.status) params.set("status", filters.status);
    if (filters.batchId) params.set("batchId", filters.batchId);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const loadCapsules = async () => {
    setLoading(true);
    setMessageKey(null);
    try {
      const response = await fetch(`/api/admin/capsules${query ? `?${query}` : ""}`);
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? "UNAVAILABLE");
      setAuthenticated(true);
      setBatches(result.batches ?? []);
      setCapsules(result.capsules ?? []);
      setJournalThemes(result.journalThemes ?? []);
      setUrlConfig(result.urlConfig ?? null);
    } catch {
      setMessageKey("capsulesLoadFailed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/session");
      const result = await response.json();
      setAuthenticated(result.authenticated === true);
      if (result.authenticated) void loadCapsules();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => {
      void loadCapsules();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError(false);
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!response.ok) {
      setLoginError(true);
      return;
    }
    setAuthenticated(true);
    setPasscode("");
    await loadCapsules();
  };

  const generateBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (form.productType === "journal" && !form.journalThemeId) {
      setMessageKey("journalThemeRequired");
      setHandoff([]);
      return;
    }
    setLoading(true);
    setMessageKey(null);
    setHandoff([]);
    try {
      const response = await fetch("/api/admin/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? "UNAVAILABLE");
      setHandoff(result.recoveryHandoff ?? []);
      setMessageKey(
        result.recoveryPartialFailure
          ? "batchGeneratedPartial"
          : "batchGenerated",
      );
      await loadCapsules();
    } catch (error) {
      setMessageKey(
        error instanceof Error && error.message === "JOURNAL_THEME_REQUIRED"
          ? "journalThemeRequired"
          : "batchGenerationFailed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (authenticated === null) {
    return <AdminShell><p className="font-sans text-sm text-ink-soft">{t("checkingSession")}</p></AdminShell>;
  }

  if (!authenticated) {
    return (
      <AdminShell>
        <form onSubmit={login} className="mx-auto max-w-sm space-y-5">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
              {t("loginEyebrow")}
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">
              {t("loginTitle")}
            </h1>
            <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
              {t("loginDescription")}
            </p>
          </div>
          <label className="block font-sans text-sm font-semibold text-ink">
            {t("loginPasscode")}
            <input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              type="password"
              className="mt-2 w-full border border-rule bg-paper px-3 py-3 font-sans text-base text-ink outline-none focus:border-oxblood"
            />
          </label>
          {loginError ? <p className="font-sans text-sm text-oxblood">{t("loginRejected")}</p> : null}
          <button className="w-full bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper">
            {t("loginSubmit")}
          </button>
        </form>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
              {t("capsulesEyebrow")}
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink">{t("capsulesTitle")}</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-ink-soft">
              {t("capsulesDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/journal-themes"
              className="inline-flex justify-center border border-rule px-4 py-2 font-sans text-sm font-bold text-ink"
            >
              {t("navThemes")}
            </Link>
            <a
              href={`/api/admin/capsules/export${query ? `?${query}` : ""}`}
              className="inline-flex justify-center border border-oxblood px-4 py-2 font-sans text-sm font-bold text-oxblood"
            >
              {t("exportCsv")}
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={generateBatch} className="space-y-4 border border-rule bg-paper/70 p-4">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {t("generateBatch")}
            </h2>
            <label className="block font-sans text-sm font-semibold">
              {t("batchName")}
              <input
                value={form.batchName}
                onChange={(event) => setForm({ ...form, batchName: event.target.value })}
                className="mt-2 w-full border border-rule bg-paper px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block font-sans text-sm font-semibold">
                {t("product")}
                <select
                  value={form.productType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      productType: event.target.value as ProductType,
                      journalThemeId:
                        event.target.value === "journal" ? form.journalThemeId : "",
                    })
                  }
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                >
                  <option value="journal">{statusLabel("journal")}</option>
                  <option value="bookmark">{statusLabel("bookmark")}</option>
                </select>
              </label>
              <label className="block font-sans text-sm font-semibold">
                {t("quantity")}
                <input
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: Number(event.target.value) })
                  }
                  min={1}
                  max={500}
                  type="number"
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                />
              </label>
            </div>
            {form.productType === "journal" ? (
              <label className="block font-sans text-sm font-semibold">
                {t("journalTheme")}
                <select
                  value={form.journalThemeId}
                  onChange={(event) =>
                    setForm({ ...form, journalThemeId: event.target.value })
                  }
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                >
                  <option value="">{t("chooseJournalTheme")}</option>
                  {journalThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name} ({theme.slug})
                    </option>
                  ))}
                </select>
                {journalThemes.length === 0 ? (
                  <span className="mt-2 block text-xs font-normal text-oxblood">
                    {t("noActiveThemes")}
                  </span>
                ) : null}
              </label>
            ) : null}
            <label className="block font-sans text-sm font-semibold">
              {t("optionalSerialPrefix")}
              <input
                value={form.serialPrefix}
                onChange={(event) => setForm({ ...form, serialPrefix: event.target.value })}
                placeholder={form.productType === "journal" ? "JNL" : "BMK"}
                className="mt-2 w-full border border-rule bg-paper px-3 py-2 uppercase"
              />
            </label>
            <label className="block font-sans text-sm font-semibold">
              {t("notes")}
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="mt-2 min-h-20 w-full border border-rule bg-paper px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-3 font-sans text-sm text-ink-soft">
              <input
                checked={form.issueRecovery}
                onChange={(event) =>
                  setForm({ ...form, issueRecovery: event.target.checked })
                }
                type="checkbox"
                className="mt-1"
              />
              {t("issueRecovery")}
            </label>
            <button
              disabled={loading}
              className="w-full bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper disabled:opacity-50"
            >
              {loading ? t("working") : t("generateCapsules")}
            </button>
          </form>

          <div className="space-y-4 border border-rule bg-paper/70 p-4">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {t("filters")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label={t("product")}
                value={filters.productType}
                onChange={(event) =>
                  setFilters({ ...filters, productType: event.target.value })
                }
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">{t("allProducts")}</option>
                <option value="journal">{statusLabel("journal")}</option>
                <option value="bookmark">{statusLabel("bookmark")}</option>
              </select>
              <select
                aria-label={t("status")}
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">{t("allStatuses")}</option>
                {["generated", "written", "tested", "disabled"].map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
              <select
                aria-label={t("allBatches")}
                value={filters.batchId}
                onChange={(event) => setFilters({ ...filters, batchId: event.target.value })}
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">{t("allBatches")}</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.batchName}</option>
                ))}
              </select>
              <input
                aria-label={t("searchSerialOrToken")}
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder={t("searchSerialOrToken")}
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              />
            </div>
            {messageKey ? <p className="font-sans text-sm text-oxblood">{t(messageKey)}</p> : null}
            {urlConfig?.appBaseUrlWarning ? (
              <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
                {t("appBaseUrlWarning")}
              </p>
            ) : null}
            {handoff.length > 0 ? <RecoveryHandoff items={handoff} /> : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {t("capsulesCount", { count: formatNumber(capsules.length) })}
            </h2>
            {loading ? <span className="font-sans text-xs text-ink-soft">{t("loading")}</span> : null}
          </div>
          <div className="overflow-x-auto border border-rule">
            <table className="min-w-full border-collapse bg-paper/80 font-sans text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="border-b border-rule p-3">{t("tableSerial")}</th>
                  <th className="border-b border-rule p-3">{t("tableProduct")}</th>
                  <th className="border-b border-rule p-3">{t("tableTheme")}</th>
                  <th className="border-b border-rule p-3">{t("tableFulfilment")}</th>
                  <th className="border-b border-rule p-3">{t("tableActivation")}</th>
                  <th className="border-b border-rule p-3">{t("tableRecovery")}</th>
                  <th className="border-b border-rule p-3">{t("tableCounts")}</th>
                  <th className="border-b border-rule p-3">{t("tableActions")}</th>
                </tr>
              </thead>
              <tbody>
                {capsules.map((capsule) => (
                  <tr key={capsule.id} className="align-top">
                    <td className="border-b border-rule p-3 font-bold">{capsule.serialNumber}</td>
                    <td className="border-b border-rule p-3">{statusLabel(capsule.productType)}</td>
                    <td className="border-b border-rule p-3">
                      {capsule.journalTheme?.name ?? t("none")}
                    </td>
                    <td className="border-b border-rule p-3 capitalize">{statusLabel(capsule.fulfillmentStatus)}</td>
                    <td className="border-b border-rule p-3">{statusLabel(capsule.activationStatus)}</td>
                    <td className="border-b border-rule p-3">{statusLabel(capsule.recoveryStatus)}</td>
                    <td className="border-b border-rule p-3 text-ink-soft">
                      {t("capsuleCounts", {
                        memories: formatNumber(capsule.memoryCount),
                        photos: formatNumber(capsule.photoCount),
                        voice: formatNumber(capsule.voiceMemoCount),
                      })}
                    </td>
                    <td className="border-b border-rule p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/capsules/${capsule.id}`} className="font-bold text-oxblood underline underline-offset-4">
                          {t("detail")}
                        </Link>
                        <a href={`/c/${capsule.publicToken}`} target="_blank" className="text-ink-soft underline underline-offset-4">
                          {t("open")}
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {capsules.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-ink-soft">
                      {t("noCapsules")}
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

function RecoveryHandoff({ items }: { items: RecoveryHandoffItem[] }) {
  const { t } = useAdminLocale();
  const csv = [
    "# SENSITIVE RECOVERY HANDOFF - plaintext passcodes are shown once",
    "serial_number,capsule_url,recovery_passcode",
    ...items.map((item) =>
      [item.serialNumber, item.capsuleUrl, item.recoveryCode].join(","),
    ),
  ].join("\n");
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <div className="border border-oxblood/40 bg-oxblood/5 p-3">
      <p className="font-sans text-sm font-bold text-oxblood">
        {t("recoveryHandoffTitle")}
      </p>
      <p className="mt-1 font-sans text-xs leading-5 text-ink-soft">
        {t("recoveryHandoffDescription")}
      </p>
      <a
        href={href}
        download="sensitive-recovery-handoff.csv"
        className="mt-3 inline-flex border border-oxblood px-3 py-2 font-sans text-xs font-bold text-oxblood"
      >
        {t("downloadSensitiveCsv")}
      </a>
      <div className="mt-3 max-h-52 overflow-auto font-mono text-xs">
        {items.map((item) => (
          <div key={item.capsuleId} className="border-t border-rule py-2">
            <div>{item.serialNumber}</div>
            <div>{item.recoveryCode}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
