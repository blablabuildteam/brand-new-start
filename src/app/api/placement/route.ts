import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRadar } from "@/lib/store";
import { orgContextFromSignals } from "@/lib/org-context";
import { buildPlacement, placementFromSignals } from "@/lib/placement";
import type { PlacementProposal } from "@/lib/placement";
import { listCrmOpportunities } from "@/lib/crm";
import { loadDeskMeta } from "@/lib/desk-meta";
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

  const [rows, crm, meta] = await Promise.all([
    listRadar(),
    listCrmOpportunities(),
    loadDeskMeta(),
  ]);

  const items: DeskItem[] = [];
  const seenCompanies = new Set<string>();

  for (const r of rows) {
    const openings = r.openings?.length
      ? r.openings
      : [
          {
            id: r.id,
            roleLabel: r.roleLabel,
            openingTitle: r.openingTitle || r.roleLabel,
            kans: r.kans,
            signals: r.signals,
            org: orgContextFromSignals(r.signals),
          },
        ];
    for (const opening of openings) {
      const org = opening.org || orgContextFromSignals(opening.signals);
      seenCompanies.add(r.company.name.toLowerCase());
      items.push({
        companyId: r.id,
        openingId: opening.id,
        company: r.company.name,
        sector: r.company.sector,
        title: opening.openingTitle || opening.roleLabel,
        roleLabel: opening.roleLabel,
        kans: opening.kans,
        hmSearched: Boolean(org.hmHits?.length),
        sampleBench: true,
        proposal: placementFromSignals({
          company: r.company.name,
          openingTitle: opening.openingTitle || opening.roleLabel,
          roleLabel: opening.roleLabel,
          org,
          sector: r.company.sector,
          signals: opening.signals,
        }),
      });
    }
  }

  // Bureau-confirmed eindklanten without a Radar row still need a Voorstel.
  for (const c of crm) {
    if (c.lane !== "bureau") continue;
    if (c.demo) continue;
    if (seenCompanies.has(c.endClient.toLowerCase())) continue;
    seenCompanies.add(c.endClient.toLowerCase());

    const hm = meta.hmGuesses[c.id];
    items.unshift({
      companyId: c.id,
      openingId: c.id,
      company: c.endClient,
      sector: null,
      title: c.title,
      roleLabel: c.roleLabel,
      kans: c.kans ?? 40,
      hmSearched: Boolean(c.hiringManager || hm?.hits?.length),
      sampleBench: true,
      bureauLane: true,
      proposal: buildPlacement({
        company: c.endClient,
        openingTitle: c.title,
        roleLabel: c.roleLabel,
        hiringManager: c.hiringManager || hm?.hiringManager || undefined,
        hiringManagerTitle: c.hiringManagerTitle || hm?.hiringManagerTitle || undefined,
        contactUrl: c.hiringManagerUrl || hm?.hiringManagerUrl || undefined,
        hmHits: (c.hmHits?.length ? c.hmHits : hm?.hits || []).map((h) => ({
          name: h.name,
          title: h.title,
          url: h.url,
        })),
        summary: c.extractSummary || c.title,
      }),
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
      sampleBench: true,
      proposal,
    };
    return NextResponse.json({ items: [item], demo: true });
  }

  return NextResponse.json({ items, demo: false });
}
