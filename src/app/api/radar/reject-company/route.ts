import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { setLearnedIntermediaries } from "@/lib/agency";
import { loadDeskMeta, saveDeskMeta } from "@/lib/desk-meta";
import { companyKey } from "@/lib/score";

const Body = z.object({
  company: z.string().min(1).max(160),
  /** true = terugzetten op Jobboards */
  undo: z.boolean().optional(),
});

/** Markeer / herstel: bedrijf is geen eindklant. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const name = parsed.data.company.trim();
  const key = companyKey(name);
  if (key.length < 2) return NextResponse.json({ error: "ongeldige naam" }, { status: 400 });

  const meta = await loadDeskMeta();

  if (parsed.data.undo) {
    const rejectedCompanies = { ...meta.rejectedCompanies };
    delete rejectedCompanies[key];
    // Ook op display-naam zoeken
    for (const [k, v] of Object.entries(rejectedCompanies)) {
      if (companyKey(v.name) === key || v.name.toLowerCase() === name.toLowerCase()) {
        delete rejectedCompanies[k];
      }
    }
    const next = await saveDeskMeta({}, { ...meta, rejectedCompanies });
    setLearnedIntermediaries(Object.values(next.rejectedCompanies).map((r) => r.name));
    return NextResponse.json({ ok: true, undone: true, key, name });
  }

  const next = await saveDeskMeta(
    {
      rejectedCompanies: {
        [key]: { name, at: new Date().toISOString(), by: session.email },
      },
    },
    meta
  );

  setLearnedIntermediaries(Object.values(next.rejectedCompanies).map((r) => r.name));

  return NextResponse.json({ ok: true, key, name });
}

/** Lijst handmatig verborgen bedrijven (zichtbaar in Instellingen). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = await loadDeskMeta();
  const list = Object.entries(meta.rejectedCompanies || {})
    .map(([key, v]) => ({ key, name: v.name, at: v.at, by: v.by }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  setLearnedIntermediaries(list.map((r) => r.name));

  return NextResponse.json({
    rejected: list,
    policy:
      "Jobboards toont alleen eindklanten. Bureaus/consultancies worden bij sync overgeslagen (zichtbaar in sync-resultaat). Handmatig verbergen staat hieronder — kun je terugzetten.",
  });
}
