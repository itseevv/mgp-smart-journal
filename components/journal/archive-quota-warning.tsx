"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";

import { ChevronRightIcon, CloseIcon } from "@/components/memory/memory-icons";
import { JournalShellIconButton } from "@/components/journal/journal-visual-primitives";
import {
  archiveQuotaNoticeLevel,
  formatArchiveCapacity,
  getArchiveExpansionUrl,
  type ArchiveQuotaSummary,
} from "@/data/archive-quota";

type ArchiveQuotaWarningProps = {
  quota: ArchiveQuotaSummary;
};

const subscribeToClientHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function readStoredPreference(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function ArchiveQuotaWarning({ quota }: ArchiveQuotaWarningProps) {
  const noticeLevel = archiveQuotaNoticeLevel(quota);
  const expansionUrl = getArchiveExpansionUrl();
  const isFull = noticeLevel === "FULL";
  const bodyId = useId();
  const storageKey = useMemo(
    () =>
      `momento:archive-quota:v2:${quota.archiveId}:${quota.grantedBytes}:${noticeLevel}`,
    [noticeLevel, quota.archiveId, quota.grantedBytes],
  );
  const isClient = useSyncExternalStore(
    subscribeToClientHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [preferenceOverrides, setPreferenceOverrides] = useState<
    Record<string, string>
  >({});
  const preference = preferenceOverrides[storageKey] ??
    (isClient ? readStoredPreference(storageKey) : null);
  const dismissed = preference === "dismissed";
  const collapsed = preference === "collapsed";

  if (noticeLevel === "NONE" || !isClient || (!isFull && dismissed)) {
    return null;
  }

  const percentage = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(Math.max(0, quota.percentage));
  const title = isFull
    ? "This Momento is full of memories."
    : noticeLevel === "NINETY_FIVE"
      ? "Your Momento is almost full of days worth keeping."
      : "Your Momento has gathered so much already.";
  const body = isFull
    ? "Everything you’ve kept remains here. Make a little room, or add more space when you’re ready to continue."
    : noticeLevel === "NINETY_FIVE"
      ? "There’s just a little room left. Everything you’ve already saved remains safe."
      : `It’s now ${percentage}% full of days, voices, and moments worth keeping. There’s still room for more.`;

  const rememberPreference = (preference: "dismissed" | "collapsed" | "expanded") => {
    try {
      window.localStorage.setItem(storageKey, preference);
    } catch {
      // The current view still responds even when storage preferences are unavailable.
    }
  };

  const dismiss = () => {
    setPreferenceOverrides((current) => ({
      ...current,
      [storageKey]: "dismissed",
    }));
    rememberPreference("dismissed");
  };

  const toggleCollapsed = () => {
    const nextCollapsed = !collapsed;
    setPreferenceOverrides((current) => ({
      ...current,
      [storageKey]: nextCollapsed ? "collapsed" : "expanded",
    }));
    rememberPreference(nextCollapsed ? "collapsed" : "expanded");
  };

  return (
    <aside
      className={`relative mb-4 min-h-[3.5rem] bg-[var(--journal-paper)] p-3 pr-16 font-sans text-xs text-[var(--journal-paper-muted-text)] ${
        isFull && collapsed ? "flex items-center" : ""
      }`}
      role="status"
      data-archive-quota-warning="true"
      data-archive-quota-status={isFull ? "FULL" : "WARNING"}
      data-archive-quota-level={noticeLevel}
      data-archive-quota-collapsed={isFull ? String(collapsed) : undefined}
    >
      <p className="font-semibold text-[var(--journal-paper-text)]">
        {title}
      </p>
      <div id={bodyId} hidden={isFull && collapsed}>
          <p className="mt-1 leading-relaxed">{body}</p>
          <p className="mt-1 text-[0.68rem] leading-relaxed">
            {formatArchiveCapacity(quota.usedBytes, {
              unit: "GB",
              maximumFractionDigits: 2,
            })} of {formatArchiveCapacity(quota.grantedBytes, {
              unit: "GB",
              maximumFractionDigits: 2,
            })} used.
          </p>
          {expansionUrl ? (
            <a
              href={expansionUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-semibold text-[var(--journal-paper-text)] underline underline-offset-4"
              data-archive-quota-expand="true"
            >
              Expand your Archive
            </a>
          ) : null}
      </div>
      <JournalShellIconButton
        type="button"
        onClick={isFull ? toggleCollapsed : dismiss}
        aria-label={
          isFull
            ? collapsed
              ? "Expand Archive capacity notice"
              : "Collapse Archive capacity notice"
            : "Dismiss Archive capacity notice"
        }
        aria-expanded={isFull ? !collapsed : undefined}
        aria-controls={isFull ? bodyId : undefined}
        className="archive-quota-notice-button absolute right-2 top-2"
      >
        {isFull ? (
          <ChevronRightIcon
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-90" : "-rotate-90"}`}
          />
        ) : (
          <CloseIcon className="h-4 w-4" />
        )}
      </JournalShellIconButton>
    </aside>
  );
}
