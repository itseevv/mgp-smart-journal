"use client";

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

type PaperPanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function PaperPanel({
  children,
  className = "",
  ...props
}: PaperPanelProps) {
  return (
    <section
      className={["editorial-paper-panel", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "paper" | "leather" | "home";
};

export function RitualButton({
  className = "",
  tone = "paper",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "editorial-ritual-button",
        `editorial-ritual-button--${tone}`,
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

export function TextLinkButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={["editorial-text-link", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={["editorial-icon-button", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
