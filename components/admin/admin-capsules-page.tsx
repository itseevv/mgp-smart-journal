"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function AdminCapsulesPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [capsules, setCapsules] = useState<AdminCapsule[]>([]);
  const [journalThemes, setJournalThemes] = useState<AdminJournalTheme[]>([]);
  const [handoff, setHandoff] = useState<RecoveryHandoffItem[]>([]);
  const [urlConfig, setUrlConfig] = useState<AdminUrlConfig | null>(null);
  const [message, setMessage] = useState("");
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
    setMessage("");
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
      setMessage("Admin capsule data could not be loaded.");
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
    setLoginError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!response.ok) {
      setLoginError("That admin passcode was not accepted.");
      return;
    }
    setAuthenticated(true);
    setPasscode("");
    await loadCapsules();
  };

  const generateBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (form.productType === "journal" && !form.journalThemeId) {
      setMessage("Choose a journal theme before generating journal capsules.");
      setHandoff([]);
      return;
    }
    setLoading(true);
    setMessage("");
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
      setMessage(
        result.recoveryPartialFailure
          ? "Batch generated, but some recovery passcodes failed to issue. Retry from capsule detail."
          : "Batch generated.",
      );
      await loadCapsules();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "JOURNAL_THEME_REQUIRED"
          ? "Choose a journal theme before generating journal capsules."
          : "Batch generation failed. No silent recovery handoff was created.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (authenticated === null) {
    return <AdminShell><p className="font-sans text-sm text-ink-soft">Checking admin session…</p></AdminShell>;
  }

  if (!authenticated) {
    return (
      <AdminShell>
        <form onSubmit={login} className="mx-auto max-w-sm space-y-5">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
              Internal admin
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">
              Capsule provisioning
            </h1>
            <p className="mt-3 font-sans text-sm leading-6 text-ink-soft">
              Enter the internal admin passcode to generate NFC/QR capsule batches.
            </p>
          </div>
          <label className="block font-sans text-sm font-semibold text-ink">
            Admin passcode
            <input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              type="password"
              className="mt-2 w-full border border-rule bg-paper px-3 py-3 font-sans text-base text-ink outline-none focus:border-oxblood"
            />
          </label>
          {loginError ? <p className="font-sans text-sm text-oxblood">{loginError}</p> : null}
          <button className="w-full bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper">
            Unlock admin
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
              Internal fulfilment
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink">Capsules</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-ink-soft">
              Generate unactivated capsule URLs for NFC writing and QR fallback. No
              private customer media or memory contents are shown here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/journal-themes"
              className="inline-flex justify-center border border-rule px-4 py-2 font-sans text-sm font-bold text-ink"
            >
              Theme library
            </Link>
            <a
              href={`/api/admin/capsules/export${query ? `?${query}` : ""}`}
              className="inline-flex justify-center border border-oxblood px-4 py-2 font-sans text-sm font-bold text-oxblood"
            >
              Export CSV
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={generateBatch} className="space-y-4 border border-rule bg-paper/70 p-4">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              Generate batch
            </h2>
            <label className="block font-sans text-sm font-semibold">
              Batch name
              <input
                value={form.batchName}
                onChange={(event) => setForm({ ...form, batchName: event.target.value })}
                className="mt-2 w-full border border-rule bg-paper px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block font-sans text-sm font-semibold">
                Product
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
                  <option value="journal">Journal</option>
                  <option value="bookmark">Bookmark</option>
                </select>
              </label>
              <label className="block font-sans text-sm font-semibold">
                Quantity
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
                Journal theme
                <select
                  value={form.journalThemeId}
                  onChange={(event) =>
                    setForm({ ...form, journalThemeId: event.target.value })
                  }
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                >
                  <option value="">Choose a journal theme</option>
                  {journalThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name} ({theme.slug})
                    </option>
                  ))}
                </select>
                {journalThemes.length === 0 ? (
                  <span className="mt-2 block text-xs font-normal text-oxblood">
                    Add or activate a journal theme before generating journals.
                  </span>
                ) : null}
              </label>
            ) : null}
            <label className="block font-sans text-sm font-semibold">
              Optional serial prefix
              <input
                value={form.serialPrefix}
                onChange={(event) => setForm({ ...form, serialPrefix: event.target.value })}
                placeholder={form.productType === "journal" ? "JNL" : "BMK"}
                className="mt-2 w-full border border-rule bg-paper px-3 py-2 uppercase"
              />
            </label>
            <label className="block font-sans text-sm font-semibold">
              Notes
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
              Issue initial Recovery Passcodes and show a one-time sensitive handoff.
            </label>
            <button
              disabled={loading}
              className="w-full bg-oxblood px-4 py-3 font-sans text-sm font-bold text-paper disabled:opacity-50"
            >
              {loading ? "Working…" : "Generate capsules"}
            </button>
          </form>

          <div className="space-y-4 border border-rule bg-paper/70 p-4">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              Filters
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={filters.productType}
                onChange={(event) =>
                  setFilters({ ...filters, productType: event.target.value })
                }
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">All products</option>
                <option value="journal">Journal</option>
                <option value="bookmark">Bookmark</option>
              </select>
              <select
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">All statuses</option>
                {["generated", "written", "tested", "disabled"].map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
              <select
                value={filters.batchId}
                onChange={(event) => setFilters({ ...filters, batchId: event.target.value })}
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              >
                <option value="">All batches</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.batchName}</option>
                ))}
              </select>
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Search serial or token"
                className="border border-rule bg-paper px-3 py-2 font-sans text-sm"
              />
            </div>
            {message ? <p className="font-sans text-sm text-oxblood">{message}</p> : null}
            {urlConfig?.appBaseUrlWarning ? (
              <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
                {urlConfig.appBaseUrlWarning}
              </p>
            ) : null}
            {handoff.length > 0 ? <RecoveryHandoff items={handoff} /> : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {capsules.length} capsules
            </h2>
            {loading ? <span className="font-sans text-xs text-ink-soft">Loading…</span> : null}
          </div>
          <div className="overflow-x-auto border border-rule">
            <table className="min-w-full border-collapse bg-paper/80 font-sans text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="border-b border-rule p-3">Serial</th>
                  <th className="border-b border-rule p-3">Product</th>
                  <th className="border-b border-rule p-3">Theme</th>
                  <th className="border-b border-rule p-3">Fulfilment</th>
                  <th className="border-b border-rule p-3">Activation</th>
                  <th className="border-b border-rule p-3">Recovery</th>
                  <th className="border-b border-rule p-3">Counts</th>
                  <th className="border-b border-rule p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capsules.map((capsule) => (
                  <tr key={capsule.id} className="align-top">
                    <td className="border-b border-rule p-3 font-bold">{capsule.serialNumber}</td>
                    <td className="border-b border-rule p-3 capitalize">{capsule.productType}</td>
                    <td className="border-b border-rule p-3">
                      {capsule.journalTheme?.name ?? "None"}
                    </td>
                    <td className="border-b border-rule p-3 capitalize">{statusLabel(capsule.fulfillmentStatus)}</td>
                    <td className="border-b border-rule p-3 capitalize">{capsule.activationStatus}</td>
                    <td className="border-b border-rule p-3">{statusLabel(capsule.recoveryStatus)}</td>
                    <td className="border-b border-rule p-3 text-ink-soft">
                      {capsule.memoryCount} memories · {capsule.photoCount} photos · {capsule.voiceMemoCount} voice
                    </td>
                    <td className="border-b border-rule p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/capsules/${capsule.id}`} className="font-bold text-oxblood underline underline-offset-4">
                          Detail
                        </Link>
                        <a href={`/c/${capsule.publicToken}`} target="_blank" className="text-ink-soft underline underline-offset-4">
                          Open
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function RecoveryHandoff({ items }: { items: RecoveryHandoffItem[] }) {
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
        Sensitive one-time recovery handoff
      </p>
      <p className="mt-1 font-sans text-xs leading-5 text-ink-soft">
        These plaintext passcodes are not stored and cannot be viewed again after
        this page changes.
      </p>
      <a
        href={href}
        download="sensitive-recovery-handoff.csv"
        className="mt-3 inline-flex border border-oxblood px-3 py-2 font-sans text-xs font-bold text-oxblood"
      >
        Download sensitive CSV
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

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="paper-surface mx-auto max-w-6xl bg-paper p-5 shadow-[0_16px_45px_rgba(23,18,15,0.2)] sm:p-8">
        {children}
      </div>
    </main>
  );
}
