import { JournalDemoFlow } from "@/components/journal/journal-demo-flow";
import { JournalMobileShell } from "@/components/journal/journal-mobile-shell";

function demoPhotoCount(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), 9);
}

function createDemoPhotoCount(screen?: string, value?: string) {
  return screen === "create" && value ? demoPhotoCount(value) : 0;
}

export default async function JournalDemoPage({
  searchParams,
}: {
  searchParams: Promise<{
    screen?: string;
    photos?: string;
    scenario?: string;
    month?: string;
  }>;
}) {
  const { screen, photos, scenario, month } = await searchParams;
  return (
    <main className="journal-mobile-page">
      <JournalMobileShell>
        <JournalDemoFlow
          initialScreen={
            screen === "create" ||
            screen === "crop" ||
            screen === "sealed" ||
            screen === "detail"
              ? screen
              : "home"
          }
          detailPhotoCount={demoPhotoCount(photos)}
          createPhotoCount={createDemoPhotoCount(screen, photos)}
          scenario={
            scenario === "duplicate-today" || scenario === "backfill-may"
              ? scenario
              : undefined
          }
          initialMonth={month}
        />
      </JournalMobileShell>
    </main>
  );
}
