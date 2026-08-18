import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRadar } from "@/lib/store";
import { orgContextFromSignals } from "@/lib/org-context";
import { buildPlacement, placementFromSignals } from "@/lib/placement";

const DEMO = {
  company: "Politie Opleiding Centrum Zuid Nederland",
  openingTitle: "business analist XR",
  roleLabel: "Business Analist",
  department: "IV / opleidingen",
  summary:
    "Business analist voor XR-leermiddelen. Afdeling IV. Contract / ZZP / interim. Standplaats Zuid-Nederland.",
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const openingId = searchParams.get("opening");
  const rows = await listRadar();

  const rail = rows.flatMap((r) => {
    const openings = r.openings?.length
      ? r.openings
      : [{ id: r.id, openingTitle: r.openingTitle || r.roleLabel, roleLabel: r.roleLabel, kans: r.kans }];
    return openings.map((o) => ({
      companyId: r.id,
      openingId: o.id,
      company: r.company.name,
      title: o.openingTitle || o.roleLabel,
      kans: o.kans,
    }));
  });

  function demo() {
    return {
      rail,
      demo: true,
      opening: {
        companyId: "demo",
        openingId: "demo",
        company: DEMO.company,
        sector: "Overheid",
        title: DEMO.openingTitle,
        roleLabel: DEMO.roleLabel,
        kans: 46,
      },
      proposal: buildPlacement(DEMO),
    };
  }

  if (!rows.length) return NextResponse.json(demo());

  const row = id ? rows.find((r) => r.id === id) : rows[0];
  if (!row) return NextResponse.json({ error: "not found", rail }, { status: 404 });

  const openings = row.openings?.length
    ? row.openings
    : [
        {
          id: row.id,
          roleLabel: row.roleLabel,
          openingTitle: row.openingTitle || row.roleLabel,
          kans: row.kans,
          signals: row.signals,
          org: orgContextFromSignals(row.signals),
        },
      ];
  const opening = openings.find((o) => o.id === openingId) || openings[0];
  if (!opening) return NextResponse.json({ error: "not found", rail }, { status: 404 });

  const org = opening.org || orgContextFromSignals(opening.signals);
  const proposal = placementFromSignals({
    company: row.company.name,
    openingTitle: opening.openingTitle || opening.roleLabel,
    roleLabel: opening.roleLabel,
    org,
    signals: opening.signals,
  });

  return NextResponse.json({
    rail,
    demo: false,
    opening: {
      companyId: row.id,
      openingId: opening.id,
      company: row.company.name,
      sector: row.company.sector,
      title: opening.openingTitle || opening.roleLabel,
      roleLabel: opening.roleLabel,
      kans: opening.kans,
    },
    proposal,
  });
}
