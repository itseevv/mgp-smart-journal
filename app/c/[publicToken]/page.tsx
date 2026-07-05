import { CapsulePage } from "@/components/capsule/capsule-page";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";

export default async function PublicCapsulePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { publicToken } = await params;
  const { month } = await searchParams;
  const initialGate = await getCapsuleInitialGate(publicToken);
  return (
    <CapsulePage
      publicToken={publicToken}
      initialGate={initialGate}
      initialMonth={month}
    />
  );
}
