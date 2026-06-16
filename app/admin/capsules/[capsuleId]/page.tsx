import { AdminCapsuleDetailPage } from "@/components/admin/admin-capsule-detail-page";

export default async function AdminCapsuleDetailRoute({
  params,
}: {
  params: Promise<{ capsuleId: string }>;
}) {
  const { capsuleId } = await params;
  return <AdminCapsuleDetailPage capsuleId={capsuleId} />;
}
