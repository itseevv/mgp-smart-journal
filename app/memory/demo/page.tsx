import { MemoryFlow } from "@/components/memory/memory-flow";

export default function MemoryDemoPage() {
  return <MemoryFlow initialCapturedAt={new Date().toISOString()} />;
}
