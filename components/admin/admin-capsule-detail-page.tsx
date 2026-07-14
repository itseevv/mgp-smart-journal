"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type CapsuleDetail = {
  id: string;
  batchName: string;
  serialNumber: string;
  productType: "journal" | "bookmark";
  publicToken: string;
  capsulePath: string;
  capsuleUrl: string;
  latestScanUrl?: string | null;
  latestScanAt?: string | null;
  latestScanUrlMatchesExpected?: boolean | null;
  appBaseUrlConfigured: boolean;
  appBaseUrlWarning?: string | null;
  activationStatus: "unactivated" | "active";
  fulfillmentStatus: string;
  nfcWriteStatus: string;
  recoveryStatus: "not_issued" | "issued";
  createdAt: string;
  activatedAt?: string | null;
  disabledAt?: string | null;
  disabledReason?: string | null;
  writtenAt?: string | null;
  testedAt?: string | null;
  recoveryIssuedAt?: string | null;
  recoveryRotatedAt?: string | null;
  memoryCount: number;
  photoCount: number;
  voiceMemoCount: number;
  storageEstimateBytes: number;
  journalTheme?: AdminJournalTheme | null;
};

type AdminJournalTheme = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "active" | "archived";
  fallbackBackgroundColor: string;
};

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function bytesLabel(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminCapsuleDetailPage({ capsuleId }: { capsuleId: string }) {
  const [capsule, setCapsule] = useState<CapsuleDetail | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [confirmActivated, setConfirmActivated] = useState(false);
  const [themes, setThemes] = useState<AdminJournalTheme[]>([]);
  const [themeDraft, setThemeDraft] = useState("");
  const [themeBusy, setThemeBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/admin/capsules/${capsuleId}`);
    if (response.status === 401) {
      setMessage("Admin session required. Return to the capsule admin page.");
      return;
    }
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage("Capsule detail could not be loaded.");
      return;
    }
    setCapsule(result.capsule);
    setThemeDraft(result.capsule.journalTheme?.id ?? "");
    if (result.capsule.productType === "journal") {
      const themesResponse = await fetch("/api/admin/journal-themes");
      if (themesResponse.ok) {
        const themesResult = await themesResponse.json();
        setThemes(themesResult.themes ?? []);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsuleId]);

  const update = async (action: string) => {
    setMessage("");
    const response = await fetch(`/api/admin/capsules/${capsuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, confirmActivated }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(
        result.code === "ACTIVATED_CONFIRMATION_REQUIRED"
          ? "Disabling an activated capsule requires explicit confirmation."
          : result.code === "REASON_REQUIRED"
            ? "A disabled reason is required."
            : "The fulfilment status could not be updated.",
      );
      return;
    }
    setCapsule(result.capsule);
    setMessage("Capsule updated.");
    setReason("");
    setConfirmActivated(false);
  };

  const issueRecovery = async () => {
    setRecoveryCode("");
    setMessage("");
    const response = await fetch(`/api/admin/capsules/${capsuleId}/recovery`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage("Recovery Passcode could not be issued.");
      return;
    }
    setRecoveryCode(result.recoveryCode);
    setMessage("Recovery Passcode rotated. Save the new code now.");
    await load();
  };

  const updateTheme = async () => {
    if (!themeDraft || themeBusy) return;
    setThemeBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/capsules/${capsuleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_theme",
          journalThemeId: themeDraft,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(
          result.code === "JOURNAL_THEME_REQUIRED"
            ? "Choose a journal theme before saving."
            : result.code === "INVALID_JOURNAL_THEME"
              ? "That journal theme is not available for assignment."
              : "The journal theme could not be updated.",
        );
        return;
      }
      setCapsule(result.capsule);
      setThemeDraft(result.capsule.journalTheme?.id ?? "");
      setMessage("Journal theme updated.");
    } catch {
      setMessage("The journal theme could not be updated.");
    } finally {
      setThemeBusy(false);
    }
  };

  if (!capsule) {
    return (
      <main className="min-h-screen bg-leather px-3 py-8 font-sans text-paper sm:px-6 sm:py-12">
        {message || "Loading capsule…"}
      </main>
    );
  }

  const copyFullUrl = async () => {
    setCopied(false);
    await navigator.clipboard.writeText(capsule.capsuleUrl);
    setCopied(true);
  };

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="paper-surface mx-auto max-w-4xl space-y-8 bg-paper p-5 shadow-[0_16px_45px_rgba(23,18,15,0.2)] sm:p-8">
        <header className="border-b border-rule pb-6">
          <Link href="/admin/capsules" className="font-sans text-sm font-bold text-oxblood underline underline-offset-4">
            Back to admin
          </Link>
          <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
            Capsule detail
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink">{capsule.serialNumber}</h1>
          <p className="mt-2 font-sans text-sm text-ink-soft">
            {capsule.batchName} · {capsule.productType}
          </p>
        </header>

        {message ? <p className="font-sans text-sm text-oxblood">{message}</p> : null}
        {capsule.appBaseUrlWarning ? (
          <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
            {capsule.appBaseUrlWarning}
          </p>
        ) : null}
        {capsule.latestScanUrl ? (
          <p className="border border-rule bg-paper p-3 font-sans text-sm leading-6 text-ink-soft">
            {capsule.latestScanUrlMatchesExpected
              ? "Latest observed public open matches the expected URL."
              : "Latest observed public open does not match the expected URL."}
          </p>
        ) : (
          <p className="border border-rule bg-paper p-3 font-sans text-sm leading-6 text-ink-soft">
            No public open recorded yet. After writing a tag, open it once so the
            server can record the URL that reached this page. This is an
            observational check, not proof that the request came from NFC.
          </p>
        )}

        <section className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="grid gap-3 font-sans text-sm sm:grid-cols-2">
            <Info label="Public token" value={capsule.publicToken} />
            <Info label="Capsule path" value={capsule.capsulePath} />
            <Info label="Expected NFC / QR URL" value={capsule.capsuleUrl} />
            <Info
              label="Latest observed public URL"
              value={capsule.latestScanUrl ?? "No public open recorded yet"}
            />
            <Info label="Activation" value={capsule.activationStatus} />
            <Info label="Fulfilment" value={capsule.fulfillmentStatus} />
            <Info label="NFC write/test" value={capsule.nfcWriteStatus} />
            <Info label="Recovery" value={capsule.recoveryStatus.replace("_", " ")} />
            <Info label="Created" value={dateLabel(capsule.createdAt)} />
            <Info label="Latest observed open" value={dateLabel(capsule.latestScanAt)} />
            <Info label="Activated" value={dateLabel(capsule.activatedAt)} />
            <Info label="Written" value={dateLabel(capsule.writtenAt)} />
            <Info label="Tested" value={dateLabel(capsule.testedAt)} />
            <Info label="Memories" value={String(capsule.memoryCount)} />
            <Info label="Photos" value={String(capsule.photoCount)} />
            <Info label="Voice memos" value={String(capsule.voiceMemoCount)} />
            <Info label="Storage estimate" value={bytesLabel(capsule.storageEstimateBytes)} />
            {capsule.productType === "journal" ? (
              <Info label="Journal theme" value={capsule.journalTheme?.name ?? "Fallback default"} />
            ) : null}
          </div>
          <div className="space-y-3">
            <Image
              src={`/api/admin/capsules/${capsule.id}/qr?preview=1`}
              alt={`QR code for ${capsule.serialNumber}`}
              width={260}
              height={260}
              unoptimized
              className="w-full border border-rule bg-white p-3"
            />
            <a href={`/api/admin/capsules/${capsule.id}/qr`} className="block border border-oxblood px-3 py-2 text-center font-sans text-sm font-bold text-oxblood">
              Download QR SVG
            </a>
            <a href={`/api/admin/capsules/${capsule.id}/qr?format=png`} className="block border border-rule px-3 py-2 text-center font-sans text-sm font-bold text-ink">
              Download QR PNG
            </a>
            <button
              type="button"
              onClick={() => void copyFullUrl()}
              className="block w-full border border-rule px-3 py-2 text-center font-sans text-sm font-bold text-ink"
            >
              {copied ? "Copied URL" : "Copy URL"}
            </button>
          </div>
        </section>

        {capsule.productType === "journal" ? (
          <section className="space-y-4 border-t border-rule pt-6">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              Journal theme
            </h2>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block font-sans text-sm font-semibold">
                Assigned theme
                <select
                  value={themeDraft}
                  onChange={(event) => setThemeDraft(event.target.value)}
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                >
                  <option value="">Choose a journal theme</option>
                  {themes
                    .filter(
                      (theme) =>
                        theme.status !== "archived" ||
                        theme.id === capsule.journalTheme?.id,
                    )
                    .map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name} ({theme.slug})
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void updateTheme()}
                disabled={themeBusy || !themeDraft}
                className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper disabled:opacity-50"
              >
                {themeBusy ? "Saving..." : "Save theme"}
              </button>
            </div>
            {capsule.activationStatus === "active" ? (
              <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
                Changing the theme will update the customer-facing journal background.
              </p>
            ) : null}
            {capsule.journalTheme ? (
              <p className="font-sans text-sm text-ink-soft">
                Current theme: {capsule.journalTheme.name} · {capsule.journalTheme.slug}
              </p>
            ) : (
              <p className="font-sans text-sm text-ink-soft">
                This existing journal has no assigned theme and will use the safe fallback until one is saved.
              </p>
            )}
          </section>
        ) : null}

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            Fulfilment actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void update("mark_written")} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
              Mark written
            </button>
            <button onClick={() => void update("mark_tested")} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
              Mark tested
            </button>
            <a href={capsule.capsuleUrl} target="_blank" className="border border-rule px-4 py-2 font-sans text-sm font-bold text-ink">
              Open public URL
            </a>
          </div>
          <div className="space-y-3 border border-rule p-4">
            <label className="block font-sans text-sm font-semibold">
              Disabled reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 min-h-20 w-full border border-rule bg-paper px-3 py-2"
              />
            </label>
            {capsule.activationStatus === "active" ? (
              <label className="flex items-start gap-3 font-sans text-sm text-ink-soft">
                <input
                  checked={confirmActivated}
                  onChange={(event) => setConfirmActivated(event.target.checked)}
                  type="checkbox"
                  className="mt-1"
                />
                I understand this capsule is already activated and disabling it
                will make customer content inaccessible.
              </label>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void update("disable")} className="border border-oxblood px-4 py-2 font-sans text-sm font-bold text-oxblood">
                Disable capsule
              </button>
              <button onClick={() => void update("reenable")} className="border border-rule px-4 py-2 font-sans text-sm font-bold text-ink">
                Re-enable unactivated capsule
              </button>
            </div>
            {capsule.disabledReason ? (
              <p className="font-sans text-sm text-ink-soft">
                Internal disabled reason: {capsule.disabledReason}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            Recovery Passcode
          </h2>
          <p className="font-sans text-sm leading-6 text-ink-soft">
            Issuing or rotating a Recovery Passcode invalidates the previous one.
            Plaintext is shown once and is never stored.
          </p>
          <button onClick={() => void issueRecovery()} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
            Issue / rotate Recovery Passcode
          </button>
          {recoveryCode ? (
            <div className="border border-oxblood/40 bg-oxblood/5 p-4">
              <p className="font-sans text-sm font-bold text-oxblood">
                Sensitive one-time value
              </p>
              <p className="mt-2 font-mono text-lg">{recoveryCode}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-rule pb-2">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</div>
      <div className="mt-1 break-words text-ink">{value}</div>
    </div>
  );
}
