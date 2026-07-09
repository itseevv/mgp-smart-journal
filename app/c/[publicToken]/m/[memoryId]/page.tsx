import { CapsulePage } from "@/components/capsule/capsule-page";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";

export default async function JournalMemoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string; memoryId: string }>;
  searchParams: Promise<{ create?: string }>;
}) {
  const { publicToken, memoryId } = await params;
  const { create } = await searchParams;
  const initialGate = await getCapsuleInitialGate(publicToken);
  return (
    <CapsulePage
      publicToken={publicToken}
      memoryId={memoryId}
      createIntent={create === "backfill" ? "backfill" : undefined}
      initialGate={initialGate}
    />
  );
}
