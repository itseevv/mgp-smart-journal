import { CapsulePage } from "@/components/capsule/capsule-page";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";

export default async function JournalMemoryRoute({
  params,
}: {
  params: Promise<{ publicToken: string; memoryId: string }>;
}) {
  const { publicToken, memoryId } = await params;
  const initialGate = await getCapsuleInitialGate(publicToken);
  return (
    <CapsulePage
      publicToken={publicToken}
      memoryId={memoryId}
      initialGate={initialGate}
    />
  );
}
