import { AdminJournalThemeEditPage } from "@/components/admin/admin-journal-themes-page";

export default async function Page({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId } = await params;
  return <AdminJournalThemeEditPage themeId={themeId} />;
}
