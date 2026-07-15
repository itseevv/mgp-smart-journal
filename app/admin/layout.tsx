import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AdminLocaleProvider } from "@/components/admin/admin-locale-provider";
import {
  ADMIN_LOCALE_COOKIE,
  normalizeAdminLocale,
} from "@/lib/admin/i18n";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialLocale = normalizeAdminLocale(
    cookieStore.get(ADMIN_LOCALE_COOKIE)?.value,
  );

  return (
    <AdminLocaleProvider initialLocale={initialLocale}>
      {children}
    </AdminLocaleProvider>
  );
}
