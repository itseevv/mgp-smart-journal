"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminLocale } from "@/components/admin/admin-locale-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { formatArchiveCapacity, type ArchiveQuotaSummary } from "@/data/archive-quota";
import type { AdminTranslationKey } from "@/lib/admin/i18n";

type CapsuleDetail = {
  id: string;
  batchName: string;
  serialNumber: string;
  productType: "journal" | "bookmark";
  publicToken: string;
  capsulePath: string;
  capsuleUrl: string;
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
  archiveQuota: ArchiveQuotaSummary | null;
  archiveId?: string | null;
  archiveOwnerAuthUserId?: string | null;
  archiveGrantHistory?: Array<{
    id: string;
    grantKind: "starter" | "expansion" | "adjustment";
    grantedBytes: number;
    createdAt: string;
  }>;
  journalTheme?: AdminJournalTheme | null;
};

type AdminJournalTheme = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "active" | "archived";
  fallbackBackgroundColor: string;
};

export function AdminCapsuleDetailPage({ capsuleId }: { capsuleId: string }) {
  const { t, statusLabel, formatDate, formatNumber } = useAdminLocale();
  const [capsule, setCapsule] = useState<CapsuleDetail | null>(null);
  const [messageKey, setMessageKey] = useState<AdminTranslationKey | null>(null);
  const [reason, setReason] = useState("");
  const [confirmActivated, setConfirmActivated] = useState(false);
  const [themes, setThemes] = useState<AdminJournalTheme[]>([]);
  const [themeDraft, setThemeDraft] = useState("");
  const [themeBusy, setThemeBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copied, setCopied] = useState(false);

  const dateLabel = (value?: string | null) =>
    value ? formatDate(value) : t("notYet");

  const load = async () => {
    const response = await fetch(`/api/admin/capsules/${capsuleId}`);
    if (response.status === 401) {
      setMessageKey("adminSessionRequired");
      return;
    }
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessageKey("capsuleLoadFailed");
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
    setMessageKey(null);
    const response = await fetch(`/api/admin/capsules/${capsuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, confirmActivated }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessageKey(
        result.code === "ACTIVATED_CONFIRMATION_REQUIRED"
          ? "activatedConfirmationRequired"
          : result.code === "REASON_REQUIRED"
            ? "disabledReasonRequired"
            : "fulfilmentUpdateFailed",
      );
      return;
    }
    setCapsule(result.capsule);
    setMessageKey("capsuleUpdated");
    setReason("");
    setConfirmActivated(false);
  };

  const issueRecovery = async () => {
    setRecoveryCode("");
    setMessageKey(null);
    const response = await fetch(`/api/admin/capsules/${capsuleId}/recovery`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessageKey("recoveryIssueFailed");
      return;
    }
    setRecoveryCode(result.recoveryCode);
    setMessageKey("recoveryRotated");
    await load();
  };

  const updateTheme = async () => {
    if (!themeDraft || themeBusy) return;
    setThemeBusy(true);
    setMessageKey(null);
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
        setMessageKey(
          result.code === "JOURNAL_THEME_REQUIRED"
            ? "themeAssignmentRequired"
            : result.code === "INVALID_JOURNAL_THEME"
              ? "invalidThemeAssignment"
              : "themeUpdateFailed",
        );
        return;
      }
      setCapsule(result.capsule);
      setThemeDraft(result.capsule.journalTheme?.id ?? "");
      setMessageKey("themeUpdated");
    } catch {
      setMessageKey("themeUpdateFailed");
    } finally {
      setThemeBusy(false);
    }
  };

  if (!capsule) {
    return (
      <AdminShell>
        <p className="font-sans text-sm text-ink-soft">
          {messageKey ? t(messageKey) : t("loadingCapsule")}
        </p>
      </AdminShell>
    );
  }

  const copyFullUrl = async () => {
    setCopied(false);
    await navigator.clipboard.writeText(capsule.capsuleUrl);
    setCopied(true);
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-rule pb-6">
          <Link href="/admin/capsules" className="font-sans text-sm font-bold text-oxblood underline underline-offset-4">
            {t("backToAdmin")}
          </Link>
          <p className="mt-6 font-sans text-xs font-bold uppercase tracking-[0.22em] text-oxblood">
            {t("capsuleDetailEyebrow")}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink">{capsule.serialNumber}</h1>
          <p className="mt-2 font-sans text-sm text-ink-soft">
            {capsule.batchName} · {statusLabel(capsule.productType)}
          </p>
        </header>

        {messageKey ? <p className="font-sans text-sm text-oxblood">{t(messageKey)}</p> : null}
        {capsule.appBaseUrlWarning ? (
          <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
            {t("appBaseUrlWarning")}
          </p>
        ) : null}
        <section className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="grid gap-3 font-sans text-sm sm:grid-cols-2">
            <Info label={t("publicToken")} value={capsule.publicToken} />
            <Info label={t("capsulePath")} value={capsule.capsulePath} />
            <Info label={t("expectedNfcUrl")} value={capsule.capsuleUrl} />
            <Info label={t("activation")} value={statusLabel(capsule.activationStatus)} />
            <Info label={t("fulfilment")} value={statusLabel(capsule.fulfillmentStatus)} />
            <Info label={t("nfcWriteTest")} value={statusLabel(capsule.nfcWriteStatus)} />
            <Info label={t("recovery")} value={statusLabel(capsule.recoveryStatus)} />
            <Info label={t("created")} value={dateLabel(capsule.createdAt)} />
            <Info label={t("activated")} value={dateLabel(capsule.activatedAt)} />
            <Info label={t("written")} value={dateLabel(capsule.writtenAt)} />
            <Info label={t("tested")} value={dateLabel(capsule.testedAt)} />
            <Info label={t("memories")} value={formatNumber(capsule.memoryCount)} />
            <Info label={t("photos")} value={formatNumber(capsule.photoCount)} />
            <Info label={t("voiceMemos")} value={formatNumber(capsule.voiceMemoCount)} />
            {!capsule.archiveQuota ? (
              <Info label={t("storageEstimate")} value={formatArchiveCapacity(capsule.storageEstimateBytes)} />
            ) : null}
            {capsule.productType === "journal" ? (
              <Info label={t("journalTheme")} value={capsule.journalTheme?.name ?? t("fallbackDefault")} />
            ) : null}
          </div>
          <div className="space-y-3">
            <Image
              src={`/api/admin/capsules/${capsule.id}/qr?preview=1`}
              alt={t("qrAlt", { serial: capsule.serialNumber })}
              width={260}
              height={260}
              unoptimized
              className="w-full border border-rule bg-white p-3"
            />
            <a href={`/api/admin/capsules/${capsule.id}/qr`} className="block border border-oxblood px-3 py-2 text-center font-sans text-sm font-bold text-oxblood">
              {t("downloadQrSvg")}
            </a>
            <a href={`/api/admin/capsules/${capsule.id}/qr?format=png`} className="block border border-rule px-3 py-2 text-center font-sans text-sm font-bold text-ink">
              {t("downloadQrPng")}
            </a>
            <button
              type="button"
              onClick={() => void copyFullUrl()}
              className="block w-full border border-rule px-3 py-2 text-center font-sans text-sm font-bold text-ink"
            >
              {copied ? t("copiedUrl") : t("copyUrl")}
            </button>
          </div>
        </section>

        {capsule.archiveQuota ? (
          <section className="space-y-4 border-t border-rule pt-6">
            <div>
              <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
                {t("archiveStorage")}
              </h2>
              <p className="mt-1 font-sans text-sm text-ink-soft">{t("archiveStorageReadOnly")}</p>
            </div>
            <div className="grid gap-3 font-sans text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Info label={t("archiveId")} value={capsule.archiveId ?? capsule.archiveQuota.archiveId} />
              <Info label={t("archiveOwner")} value={capsule.archiveOwnerAuthUserId ?? t("notYet")} />
              <Info label={t("linkedChips")} value={formatNumber(capsule.archiveQuota.linkedChipCount)} />
              <Info label={t("archiveUsed")} value={formatArchiveCapacity(capsule.archiveQuota.usedBytes)} />
              <Info label={t("archiveGranted")} value={formatArchiveCapacity(capsule.archiveQuota.grantedBytes)} />
              <Info label={t("archivePercentage")} value={`${capsule.archiveQuota.percentage}%`} />
              <Info label={t("archiveStatus")} value={capsule.archiveQuota.storageStatus} />
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-ink">{t("archiveGrantHistory")}</h3>
              <ul className="mt-2 space-y-2 font-sans text-sm text-ink-soft">
                {(capsule.archiveGrantHistory ?? []).map((grant) => (
                  <li key={grant.id} className="flex flex-wrap justify-between gap-2 border-b border-rule pb-2">
                    <span>{grant.grantKind}</span>
                    <span>{formatArchiveCapacity(grant.grantedBytes)} · {dateLabel(grant.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {capsule.productType === "journal" ? (
          <section className="space-y-4 border-t border-rule pt-6">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {t("journalTheme")}
            </h2>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block font-sans text-sm font-semibold">
                {t("assignedTheme")}
                <select
                  value={themeDraft}
                  onChange={(event) => setThemeDraft(event.target.value)}
                  className="mt-2 w-full border border-rule bg-paper px-3 py-2"
                >
                  <option value="">{t("chooseJournalTheme")}</option>
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
                {themeBusy ? t("saving") : t("saveTheme")}
              </button>
            </div>
            {capsule.activationStatus === "active" ? (
              <p className="border border-oxblood/30 bg-oxblood/5 p-3 font-sans text-sm leading-6 text-oxblood">
                {t("activeThemeChangeWarning")}
              </p>
            ) : null}
            {capsule.journalTheme ? (
              <p className="font-sans text-sm text-ink-soft">
                {t("currentTheme", {
                  name: capsule.journalTheme.name,
                  slug: capsule.journalTheme.slug,
                })}
              </p>
            ) : (
              <p className="font-sans text-sm text-ink-soft">
                {t("noAssignedTheme")}
              </p>
            )}
          </section>
        ) : null}

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            {t("fulfilmentActions")}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void update("mark_written")} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
              {t("markWritten")}
            </button>
            <button onClick={() => void update("mark_tested")} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
              {t("markTested")}
            </button>
            <a href={capsule.capsuleUrl} target="_blank" className="border border-rule px-4 py-2 font-sans text-sm font-bold text-ink">
              {t("openPublicUrl")}
            </a>
          </div>
          <div className="space-y-3 border border-rule p-4">
            <label className="block font-sans text-sm font-semibold">
              {t("disabledReason")}
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
                {t("disableActivatedConfirmation")}
              </label>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void update("disable")} className="border border-oxblood px-4 py-2 font-sans text-sm font-bold text-oxblood">
                {t("disableCapsule")}
              </button>
              <button onClick={() => void update("reenable")} className="border border-rule px-4 py-2 font-sans text-sm font-bold text-ink">
                {t("reenableCapsule")}
              </button>
            </div>
            {capsule.disabledReason ? (
              <p className="font-sans text-sm text-ink-soft">
                {t("internalDisabledReason", { reason: capsule.disabledReason })}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 border-t border-rule pt-6">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink">
            {t("recoveryPasscode")}
          </h2>
          <p className="font-sans text-sm leading-6 text-ink-soft">
            {t("recoveryDescription")}
          </p>
          <button onClick={() => void issueRecovery()} className="bg-oxblood px-4 py-2 font-sans text-sm font-bold text-paper">
            {t("issueOrRotateRecovery")}
          </button>
          {recoveryCode ? (
            <div className="border border-oxblood/40 bg-oxblood/5 p-4">
              <p className="font-sans text-sm font-bold text-oxblood">
                {t("sensitiveOneTimeValue")}
              </p>
              <p className="mt-2 font-mono text-lg">{recoveryCode}</p>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
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
