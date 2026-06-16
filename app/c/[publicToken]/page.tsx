import { CapsulePage } from "@/components/capsule/capsule-page";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";

export default async function PublicCapsulePage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const initialGate = await getCapsuleInitialGate(publicToken);
  return <CapsulePage publicToken={publicToken} initialGate={initialGate} />;
}
