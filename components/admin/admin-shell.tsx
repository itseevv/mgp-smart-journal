"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAdminLocale } from "@/components/admin/admin-locale-provider";

export function AdminLanguageSwitcher() {
  const { locale, setLocale, t } = useAdminLocale();

  return (
    <div
      className="inline-flex border border-rule bg-paper"
      role="group"
      aria-label={t("languageLabel")}
    >
      {(["en", "zh-CN"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className={`px-3 py-2 font-sans text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood ${
            locale === option
              ? "bg-oxblood text-paper"
              : "bg-paper text-ink hover:bg-paper-deep/30"
          }`}
        >
          {option === "en" ? t("english") : t("chinese")}
        </button>
      ))}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useAdminLocale();

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="paper-surface mx-auto max-w-6xl bg-paper p-5 shadow-[0_16px_45px_rgba(23,18,15,0.2)] sm:p-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
          <nav
            aria-label={t("navigationLabel")}
            className="flex flex-wrap gap-4 font-sans text-sm font-bold"
          >
            <Link href="/admin/capsules" className="text-ink hover:text-oxblood">
              {t("navCapsules")}
            </Link>
            <Link
              href="/admin/journal-themes"
              className="text-ink hover:text-oxblood"
            >
              {t("navThemes")}
            </Link>
          </nav>
          <AdminLanguageSwitcher />
        </div>
        {children}
      </div>
    </main>
  );
}
