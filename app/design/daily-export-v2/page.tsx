import type { Metadata } from "next";

import { DailyExportV2Playground } from "./daily-export-v2-playground";

export const metadata: Metadata = {
  title: "Daily Export V2 Playground",
  description:
    "Playground-only review surface for the Save/Share modal chrome and Daily 9:16 export artifact.",
};

export default function DailyExportV2DesignPage() {
  return <DailyExportV2Playground />;
}
