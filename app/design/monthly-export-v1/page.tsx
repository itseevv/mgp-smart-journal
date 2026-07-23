import type { Metadata } from "next";

import { MonthlyExportV1Playground } from "./monthly-export-v1-playground";

export const metadata: Metadata = {
  title: "Monthly Sheet Export V1 Playground",
  description:
    "Playground-only review surface for a complete 31-stamp Monthly Sheet long-image artifact.",
};

export default function MonthlyExportV1DesignPage() {
  return <MonthlyExportV1Playground />;
}
