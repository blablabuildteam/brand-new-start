import type { Metadata } from "next";
import RadarApp from "../radar-app";

export const metadata: Metadata = {
  title: "Radar — Contracting",
  description: "Interim- en ZZP-opdrachten, hiring manager en voorstel.",
};

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; opening?: string; q?: string }>;
}) {
  const params = await searchParams;
  return (
    <RadarApp
      initialId={params.id || null}
      initialOpening={params.opening || null}
      initialQuery={params.q || null}
    />
  );
}
