import type { Metadata } from "next";
import DemoGate from "./demo-gate";

export const metadata: Metadata = {
  title: "Demo — Recruitment Scout",
  description: "Kijk rond in de Recruitment Scout desk met sample data.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoGate />;
}
