"use client";

import { useState, type ReactNode } from "react";

import {
  IconButton,
  TextLinkButton,
} from "@/components/journal/editorial-primitives";
import { MoreIcon } from "@/components/memory/memory-icons";
import { journalConfig } from "@/data/journal";

type JournalIdentityHeaderProps = {
  title: string;
  typography?: "quiet" | "home-variant-c";
  leftControl?: ReactNode;
  showSettings?: boolean;
  titleDraft?: string;
  isEditingTitle?: boolean;
  titleBusy?: boolean;
  titleError?: string;
  onTitleDraftChange?: (title: string) => void;
  onSaveTitle?: () => void;
  onCancelTitle?: () => void;
  onBeginRename?: () => void;
  onLock: () => void;
};

export function JournalIdentityHeader({
  title,
  typography = "quiet",
  leftControl,
  showSettings = true,
  titleDraft,
  isEditingTitle,
  titleBusy,
  titleError,
  onTitleDraftChange,
  onSaveTitle,
  onCancelTitle,
  onBeginRename,
  onLock,
}: JournalIdentityHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canRename =
    showSettings &&
    Boolean(onBeginRename) &&
    Boolean(onTitleDraftChange) &&
    Boolean(onSaveTitle) &&
    Boolean(onCancelTitle);
  const editingTitle = canRename && Boolean(isEditingTitle);

  const beginRename = () => {
    if (!onBeginRename) return;
    setSettingsOpen(false);
    onBeginRename();
  };
  const lock = () => {
    setSettingsOpen(false);
    onLock();
  };
  const rowMode = leftControl
    ? showSettings
      ? "left-title-settings"
      : "back-title-spacer"
    : "identity-settings";

  return (
    <header
      className={[
        "journal-identity-header mb-3 text-[var(--journal-text)]",
        typography === "home-variant-c"
          ? "journal-identity-header--home-variant-c"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={editingTitle ? undefined : "journal-title"}
      data-journal-identity-header="true"
      data-journal-identity-typography={typography}
    >
      {editingTitle ? (
        <div>
          <label htmlFor="journal-title-input" className="sr-only">
            Journal title
          </label>
          <input
            id="journal-title-input"
            value={titleDraft ?? title}
            maxLength={journalConfig.maxTitleLength}
            onChange={(event) => onTitleDraftChange?.(event.target.value)}
            className="w-full border-0 border-b border-[var(--journal-muted)] bg-transparent pb-1.5 font-serif text-[1.15rem] leading-tight text-[var(--journal-home-title)] outline-none placeholder:text-[var(--journal-muted)] focus:border-[var(--journal-accent-metal)]"
            autoFocus
          />
          <div className="mt-2 flex justify-center gap-4 font-sans text-[0.68rem]">
            <TextLinkButton
              type="button"
              onClick={onSaveTitle}
              disabled={titleBusy}
              className="font-semibold text-[var(--journal-text)] disabled:opacity-50"
            >
              {titleBusy ? "Saving..." : "Save title"}
            </TextLinkButton>
            <TextLinkButton
              type="button"
              onClick={onCancelTitle}
              disabled={titleBusy}
              className="text-[var(--journal-muted)] disabled:opacity-50"
            >
              Cancel
            </TextLinkButton>
          </div>
        </div>
      ) : (
        <div
          className="journal-identity-header__row"
          data-journal-header-row={rowMode}
        >
          <span className="journal-identity-header__left-control">
            {leftControl ?? (
              <span
                aria-hidden="true"
                className="journal-identity-header__spacer"
              />
            )}
          </span>
          <h1
            id="journal-title"
            className="journal-identity-header__title truncate text-center font-serif leading-tight text-[var(--journal-home-title)]"
            data-journal-title-align="centerline"
            title={title}
          >
            {title}
          </h1>
          {showSettings ? (
            <div className="journal-identity-header__settings relative">
              <IconButton
                type="button"
                aria-label="Journal settings"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                data-journal-settings-trigger="true"
                onClick={() => setSettingsOpen((current) => !current)}
                className="editorial-icon-button--leather journal-identity-header__settings-button"
              >
                <MoreIcon className="h-4 w-4" />
              </IconButton>
              {settingsOpen ? (
                <div
                  role="menu"
                  data-journal-settings-menu="true"
                  className="absolute right-0 top-full z-30 mt-2 min-w-36 border border-[var(--journal-photo-edge)] bg-[var(--journal-paper)] px-3 py-2 font-sans text-xs text-[var(--journal-paper-text)] shadow-[0_12px_28px_rgba(18,11,10,0.16)]"
                >
                  {canRename ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={beginRename}
                      className="block w-full py-2 text-left font-semibold"
                    >
                      Rename
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={lock}
                    className={`block w-full py-2 text-left ${
                      canRename
                        ? "border-t border-[var(--journal-photo-edge)]"
                        : ""
                    }`}
                  >
                    Lock journal
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <span
              aria-hidden="true"
              className="journal-identity-header__right-spacer"
              data-journal-header-right-spacer="balance"
            />
          )}
        </div>
      )}
      {titleError ? (
        <p className="mt-2 font-sans text-xs text-[var(--journal-text)]" role="alert">
          {titleError}
        </p>
      ) : null}
    </header>
  );
}
