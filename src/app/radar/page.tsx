import type { Metadata } from "next";
import RadarApp from "../radar-app";
import { readSessionRadarPayload } from "@/lib/desk-payloads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobboards — Contracting",
  description: "Interim- en ZZP-opdrachten, hiring manager en voorstel.",
};

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; opening?: string; q?: string }>;
}) {
  const params = await searchParams;
  const raw = await readSessionRadarPayload().catch(() => null);
  const initial = raw ? JSON.parse(JSON.stringify(raw)) : null;
  return (
    <RadarApp
      initialId={params.id || null}
      initialOpening={params.opening || null}
      initialQuery={params.q || null}
      initial={initial}
    />
  );
}
