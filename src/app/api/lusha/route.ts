import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listRadar, patchSignalRaw } from "@/lib/store";
import { orgContextFromSignals, type HmHit, type OrgContext } from "@/lib/org-context";
import { buildApproach, companyLinkedinFromSignals } from "@/lib/approach";
import { recordSync } from "@/lib/sync-log";
import { enrichByLinkedin, hasLushaKey, normalizeLinkedinProfile } from "@/lib/lusha";

export const maxDuration = 30;

const Body = z.object({
  companyId: z.string().min(1),
  openingId: z.string().min(1),
  linkedinUrl: z.string().min(8),
});

function payload(org: OrgContext, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    org,
    people: org.hmHits || [],
    targets: [] as ReturnType<typeof buildApproach>["targets"],
    ...extra,
  };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const { companyId, openingId, linkedinUrl } = parsed.data;
  const profile = normalizeLinkedinProfile(linkedinUrl);
  if (!profile) return NextResponse.json({ error: "geen LinkedIn-profiel" }, { status: 400 });
  if (!hasLushaKey()) {
    return NextResponse.json({ error: "LUSHA_API_KEY ontbreekt", detail: "no-lusha-key" }, { status: 503 });
  }

  const rows = await listRadar();
  const row = rows.find((r) => r.id === companyId);
  if (!row) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  const opening = (row.openings || []).find((o) => o.id === openingId);
  if (!opening) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });

  const org = opening.org || orgContextFromSignals(opening.signals);
  const hits = [...(org.hmHits || [])];
  const idx = hits.findIndex((h) => normalizeLinkedinProfile(h.url) === profile);
  if (idx < 0) {
    return NextResponse.json({ error: "eerst een naam zoeken" }, { status: 400 });
  }

  const existing = hits[idx]!;
  if (existing.lushaAt && (existing.email || existing.phone || existing.lushaStatus)) {
    const nextOrg = { ...org, hmHits: hits };
    const companyUrl = companyLinkedinFromSignals(opening.signals);
    return NextResponse.json({
      ...payload(nextOrg, { cached: true }),
      targets: buildApproach({
        company: row.company.name,
        roleLabel: opening.roleLabel,
        openingTitle: opening.openingTitle,
        org: nextOrg,
        companyLinkedinUrl: companyUrl,
        sector: row.company.sector,
      }).targets,
    });
  }

  try {
    const found = await enrichByLinkedin(profile);
    const nextHit: HmHit = {
      ...existing,
      email: found.email,
      phone: found.phone,
      lushaAt: new Date().toISOString(),
      lushaStatus: found.status,
    };
    hits[idx] = nextHit;
    const nextOrg: OrgContext = { ...org, hmHits: hits };

    await recordSync({
      channel: "lusha",
      label: "Lusha contact",
      mode: "lusha",
      detail: `${found.detail} · ${found.creditsCharged} cr`,
      fetched: 1,
      kept: found.status === "ok" ? 1 : 0,
      searched: [existing.name],
      hits: [
        {
          company: row.company.name,
          title: `${existing.name} · ${found.email || found.phone || found.detail}`,
          url: profile,
          kept: found.status === "ok",
          isNew: true,
        },
      ],
    });

    const signalId = opening.signals[0]?.id;
    if (signalId) {
      await patchSignalRaw(signalId, { hmHits: hits });
    }

    const companyUrl = companyLinkedinFromSignals(opening.signals);
    return NextResponse.json({
      ...payload(nextOrg, {
        cached: false,
        creditsCharged: found.creditsCharged,
        detail: found.detail,
      }),
      targets: buildApproach({
        company: row.company.name,
        roleLabel: opening.roleLabel,
        openingTitle: opening.openingTitle,
        org: nextOrg,
        companyLinkedinUrl: companyUrl,
        sector: row.company.sector,
      }).targets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "Lusha-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
