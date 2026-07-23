"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  IconButton,
  TextLinkButton,
} from "@/components/journal/editorial-primitives";
import {
  LockIcon,
  MoreIcon,
  PencilIcon,
} from "@/components/memory/memory-icons";
import { DailyStampEmojiText } from "@/components/stamp/daily-stamp-emoji-text";
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
  const settingsMenuId = useId();
  const settingsTriggerId = useId();
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsRootRef = useRef<HTMLDivElement>(null);
  const titleInputHintId = "journal-title-input-hint";
  const displayTitle = title;
  const editableTitle = titleDraft ?? displayTitle;
  const titleLength = editableTitle.length;
  const canRename =
    showSettings &&
    Boolean(onBeginRename) &&
    Boolean(onTitleDraftChange) &&
    Boolean(onSaveTitle) &&
    Boolean(onCancelTitle);
  const editingTitle = canRename && Boolean(isEditingTitle);

  useEffect(() => {
    if (!settingsOpen) return;

    const firstMenuItem = settingsMenuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    firstMenuItem?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        settingsMenuRef.current?.contains(event.target) ||
        settingsRootRef.current?.contains(event.target)
      ) {
        return;
      }
      setSettingsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSettingsOpen(false);
      settingsRootRef.current
        ?.querySelector<HTMLButtonElement>(
          '[data-journal-settings-trigger="true"]',
        )
        ?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  const navigateSettingsMenu = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    );
    if (!menuItems.length) return;

    event.preventDefault();
    const currentIndex = menuItems.findIndex(
      (menuItem) => menuItem === document.activeElement,
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? menuItems.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % menuItems.length
            : (currentIndex - 1 + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  };

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
            value={editableTitle}
            maxLength={journalConfig.maxTitleLength}
            aria-describedby={titleInputHintId}
            onChange={(event) => onTitleDraftChange?.(event.target.value)}
            placeholder={`Up to ${journalConfig.maxTitleLength} characters`}
            className="w-full border-0 border-b border-[var(--journal-muted)] bg-transparent pb-1.5 font-serif text-[1.15rem] leading-tight text-[var(--journal-home-title)] outline-none placeholder:text-[var(--journal-muted)] focus:border-[var(--journal-accent-metal)]"
            autoFocus
          />
          <p
            id={titleInputHintId}
            className="mt-1 flex items-center justify-between gap-3 font-sans text-[0.62rem] font-medium text-[var(--journal-muted)]"
          >
            <span>Up to {journalConfig.maxTitleLength} characters</span>
            <span>
              {titleLength}/{journalConfig.maxTitleLength}
            </span>
          </p>
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
            className="journal-identity-header__title text-center font-serif leading-tight text-[var(--journal-home-title)]"
            data-journal-title-align="centerline"
            data-journal-title-lines="2"
            title={title}
          >
            <DailyStampEmojiText value={displayTitle} />
          </h1>
          {showSettings ? (
            <div
              ref={settingsRootRef}
              className="journal-identity-header__settings relative"
            >
              <IconButton
                id={settingsTriggerId}
                type="button"
                aria-label="Journal settings"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                aria-controls={settingsMenuId}
                data-journal-settings-trigger="true"
                onClick={() => setSettingsOpen((current) => !current)}
                className="editorial-icon-button--leather journal-identity-header__settings-button"
              >
                <MoreIcon className="h-4 w-4" />
              </IconButton>
              {settingsOpen ? (
                <div
                  id={settingsMenuId}
                  ref={settingsMenuRef}
                  role="menu"
                  aria-labelledby={settingsTriggerId}
                  aria-orientation="vertical"
                  onKeyDown={navigateSettingsMenu}
                  data-journal-settings-menu="true"
                  data-journal-settings-menu-treatment="compact-theme-aware"
                  className="journal-identity-header__settings-menu"
                >
                  {canRename ? (
                    <button
                      type="button"
                      role="menuitem"
                      data-journal-settings-menu-item="rename"
                      onClick={beginRename}
                      className="journal-identity-header__settings-menu-item"
                    >
                      <PencilIcon className="journal-identity-header__settings-menu-icon" />
                      <span>Rename</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    data-journal-settings-menu-item="lock"
                    onClick={lock}
                    className="journal-identity-header__settings-menu-item journal-identity-header__settings-menu-item--lock"
                  >
                    <LockIcon className="journal-identity-header__settings-menu-icon" />
                    <span>Lock journal</span>
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
