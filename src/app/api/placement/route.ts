import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRadar } from "@/lib/store";
import { buildPlacement } from "@/lib/placement";
import type { PlacementProposal } from "@/lib/placement";
import { listCrmOpportunities, readyToMessage } from "@/lib/crm";
import { companyLinkedinFromSignals } from "@/lib/approach";
import { loadHuntSettings } from "@/lib/hunt";

const DEMO = {
  company: "Politie Opleiding Centrum Zuid Nederland",
  openingTitle: "business analist XR",
  roleLabel: "Business Analist",
  department: "IV / opleidingen",
  summary:
    "Business analist voor XR-leermiddelen. Afdeling IV. Contract / ZZP / interim. Standplaats Zuid-Nederland.",
};

export type DeskItem = {
  companyId: string;
  openingId: string;
  company: string;
  sector: string | null;
  title: string;
  roleLabel: string;
  kans: number;
  hmSearched?: boolean;
  /** Fictieve demo-opening als radar leeg is */
  demoOpening?: boolean;
  /** Shortlist uit voorbeeld-bench (niet echte CRM) */
  sampleBench?: boolean;
  /** From bureau lane without a Radar company row */
  bureauLane?: boolean;
  proposal: PlacementProposal;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await loadHuntSettings();

  const [rows, crm] = await Promise.all([listRadar(), listCrmOpportunities()]);

  // Elke Bericht-rij komt rechtstreeks uit een Kansen-rij op stap 4. Zo laat de
  // sidebar precies dezelfde kansen zien als de "Bericht"-knop op Kansen.
  const radarById = new Map(rows.map((r) => [r.id, r] as const));
  const items: DeskItem[] = [];

  for (const c of crm) {
    if (!readyToMessage(c)) continue;

    const radar = c.companyId ? radarById.get(c.companyId) : undefined;
    const opening = radar && c.openingId
      ? (radar.openings || []).find((o) => o.id === c.openingId)
      : undefined;

    const proposal = buildPlacement({
      company: c.endClient,
      openingTitle: c.title,
      roleLabel: c.roleLabel,
      // Lead data over wat er in signals stond — Lusha/handmatig vullen op Kansen
      // hoort hier bindend te zijn, anders mist Bericht de mail/tel die net binnenkwam.
      hiringManager: c.hiringManager,
      hiringManagerTitle: c.hiringManagerTitle || undefined,
      contactUrl: c.hiringManagerUrl || undefined,
      hmHits: c.hmHits,
      summary: c.extractSummary || c.title,
      sector: c.sector || radar?.company.sector || null,
      companyLinkedinUrl: opening ? companyLinkedinFromSignals(opening.signals) : null,
    });

    items.push({
      companyId: c.companyId || c.id,
      openingId: c.openingId || c.id,
      company: c.endClient,
      sector: c.sector || radar?.company.sector || null,
      title: c.title,
      roleLabel: c.roleLabel,
      kans: c.kans ?? 40,
      hmSearched: true,
      sampleBench: false,
      bureauLane: c.lane === "bureau" && !radar,
      proposal,
    });
  }

  if (!items.length) {
    const proposal = buildPlacement(DEMO);
    const item: DeskItem = {
      companyId: "demo",
      openingId: "demo",
      company: DEMO.company,
      sector: "Overheid",
      title: DEMO.openingTitle,
      roleLabel: DEMO.roleLabel,
      kans: 46,
      demoOpening: true,
      sampleBench: false,
      proposal,
    };
    return NextResponse.json({ items: [item], demo: true });
  }

  return NextResponse.json({ items, demo: false });
}
