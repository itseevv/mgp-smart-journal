"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  adminErrorMessage,
  adminStatusLabel,
  adminTextureWarning,
  ADMIN_LOCALE_COOKIE,
  formatAdminDate,
  formatAdminDateOnly,
  formatAdminNumber,
  normalizeAdminLocale,
  translateAdmin,
  type AdminLocale,
  type AdminTranslationKey,
  type AdminTranslationVariables,
} from "@/lib/admin/i18n";

type AdminLocaleContextValue = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (
    key: AdminTranslationKey,
    variables?: AdminTranslationVariables,
  ) => string;
  statusLabel: (value: string) => string;
  errorMessage: (code: unknown) => string;
  textureWarning: (warning: string) => string;
  formatDate: (value: Date | string) => string;
  formatDateOnly: (value: Date | string) => string;
  formatNumber: (value: number) => string;
};

const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(null);

export function AdminLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AdminLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AdminLocale>(() =>
    normalizeAdminLocale(initialLocale),
  );

  const setLocale = useCallback((nextLocale: AdminLocale) => {
    const normalized = normalizeAdminLocale(nextLocale);
    setLocaleState(normalized);
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${encodeURIComponent(normalized)}; Path=/admin; Max-Age=31536000; SameSite=Strict`;
  }, []);

  const value = useMemo<AdminLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, variables) => translateAdmin(locale, key, variables),
      statusLabel: (status) => adminStatusLabel(locale, status),
      errorMessage: (code) => adminErrorMessage(locale, code),
      textureWarning: (warning) => adminTextureWarning(locale, warning),
      formatDate: (date) => formatAdminDate(locale, date),
      formatDateOnly: (date) => formatAdminDateOnly(locale, date),
      formatNumber: (number) => formatAdminNumber(locale, number),
    }),
    [locale, setLocale],
  );

  return (
    <AdminLocaleContext.Provider value={value}>
      {children}
    </AdminLocaleContext.Provider>
  );
}

export function useAdminLocale() {
  const context = useContext(AdminLocaleContext);
  if (!context) {
    throw new Error("useAdminLocale must be used inside AdminLocaleProvider");
  }
  return context;
}
