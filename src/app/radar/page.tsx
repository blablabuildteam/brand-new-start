import type { Metadata } from "next";
import RadarApp from "../radar-app";

export const metadata: Metadata = {
  title: "Radar — Contracting",
  description: "Interim- en ZZP-opdrachten, hiring manager en voorstel.",
};

export default function RadarPage() {
  return <RadarApp />;
}
