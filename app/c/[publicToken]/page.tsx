import { CapsulePage } from "@/components/capsule/capsule-page";
import { capsuleScanUrlFromHeaders } from "@/lib/capsule/scan-url";
import { getCapsuleInitialGate } from "@/lib/capsule/server-gate";
import { headers } from "next/headers";

export default async function PublicCapsulePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { publicToken } = await params;
  const { month } = await searchParams;
  const scanUrl = capsuleScanUrlFromHeaders(
    await headers(),
    `/c/${publicToken}`,
    { month },
  );
  const initialGate = await getCapsuleInitialGate(publicToken, { scanUrl });
  return (
    <CapsulePage
      publicToken={publicToken}
      initialGate={initialGate}
      initialMonth={month}
    />
  );
}
