import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRadar } from "@/lib/store";
import { orgContextFromSignals } from "@/lib/org-context";
import { buildPlacement, placementFromSignals } from "@/lib/placement";
import type { PlacementProposal } from "@/lib/placement";

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
  proposal: PlacementProposal;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await listRadar();

  if (!rows.length) {
    const proposal = buildPlacement(DEMO);
    const item: DeskItem = {
      companyId: "demo",
      openingId: "demo",
      company: DEMO.company,
      sector: "Overheid",
      title: DEMO.openingTitle,
      roleLabel: DEMO.roleLabel,
      kans: 46,
      proposal,
    };
    return NextResponse.json({ items: [item], demo: true });
  }

  const items: DeskItem[] = [];
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
      items.push({
        companyId: r.id,
        openingId: opening.id,
        company: r.company.name,
        sector: r.company.sector,
        title: opening.openingTitle || opening.roleLabel,
        roleLabel: opening.roleLabel,
        kans: opening.kans,
        hmSearched: Boolean(org.hmHits?.length),
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

  return NextResponse.json({ items, demo: false });
}
