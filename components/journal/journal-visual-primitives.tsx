"use client";

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

import {
  IconButton,
  PaperPanel,
  RitualButton,
} from "@/components/journal/editorial-primitives";

type JournalStageOverlayProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant: "month-sheet" | "daily-detail";
};

export function JournalStageOverlay({
  children,
  className = "",
  variant,
  ...props
}: JournalStageOverlayProps) {
  return (
    <PaperPanel
      className={[
        "journal-stage-overlay",
        `journal-stage-overlay--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-journal-stage-overlay={variant}
      {...props}
    >
      {children}
    </PaperPanel>
  );
}

type JournalPrimaryCTAProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function JournalPrimaryCTA({
  children,
  className = "",
  ...props
}: JournalPrimaryCTAProps) {
  return (
    <RitualButton
      tone="home"
      className={["journal-primary-bottom-cta", className]
        .filter(Boolean)
        .join(" ")}
      data-journal-primary-cta="approved-playground"
      {...props}
    >
      {children}
    </RitualButton>
  );
}

type JournalShellIconButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  };

export function JournalShellIconButton({
  children,
  className = "",
  ...props
}: JournalShellIconButtonProps) {
  return (
    <IconButton
      className={["journal-shell-icon-button", className]
        .filter(Boolean)
        .join(" ")}
      data-journal-icon-button="approved-playground"
      {...props}
    >
      {children}
    </IconButton>
  );
}

type JournalActionTrayProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function JournalActionTray({
  children,
  className = "",
  ...props
}: JournalActionTrayProps) {
  return (
    <div
      className={["journal-action-tray", className].filter(Boolean).join(" ")}
      data-journal-action-tray="approved-playground"
      {...props}
    >
      {children}
    </div>
  );
}

type JournalActionTrayOptionProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    secondary?: boolean;
  };

export function JournalActionTrayOption({
  children,
  className = "",
  secondary = false,
  ...props
}: JournalActionTrayOptionProps) {
  return (
    <button
      className={[
        "journal-action-tray__option",
        secondary ? "journal-action-tray__option--secondary" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
