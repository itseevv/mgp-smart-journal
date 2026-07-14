import type { Metadata } from "next";

import { ScrapDayV2Playground } from "./scrap-day-v2-playground";

export const metadata: Metadata = {
  title: "Scrap Day Visual Playground",
  description:
    "Local-only visual playground for Scrap Day app surfaces, Save/Share, and Daily Export directions.",
};

export default function ScrapDayV2DesignPage() {
  return <ScrapDayV2Playground />;
}
