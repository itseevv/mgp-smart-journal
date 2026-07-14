import { CapsulePage } from "@/components/capsule/capsule-page";
import { capsuleScanUrlFromHeaders } from "@/lib/capsule/scan-url";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";
import { headers } from "next/headers";

export default async function JournalMemoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string; memoryId: string }>;
  searchParams: Promise<{ create?: string }>;
}) {
  const { publicToken, memoryId } = await params;
  const { create } = await searchParams;
  const scanUrl = capsuleScanUrlFromHeaders(
    await headers(),
    `/c/${publicToken}/m/${memoryId}`,
    { create },
  );
  const initialGate = await getCapsuleInitialGate(publicToken, { scanUrl });
  const createIntent =
    create === "today" || create === "backfill" ? create : undefined;
  return (
    <CapsulePage
      publicToken={publicToken}
      memoryId={memoryId}
      createIntent={createIntent}
      initialGate={initialGate}
    />
  );
}
