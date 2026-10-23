import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { loadDeskMeta, saveDeskMeta } from "@/lib/desk-meta";
import { activeParked, parkedKey } from "@/lib/parked";

const Body = z.object({
  company: z.string().min(2).max(160),
  /** Aantal dagen niet interessant; null = altijd. */
  days: z.number().int().min(1).max(730).nullable().optional(),
  undo: z.boolean().optional(),
});

/** Eindklant tijdelijk of voorgoed "niet interessant": weg uit feed + Jobboards, sync slaat hem over. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const name = parsed.data.company.trim();
  const key = parkedKey(name);
  if (key.length < 2) return NextResponse.json({ error: "ongeldige naam" }, { status: 400 });

  const meta = await loadDeskMeta();

  if (parsed.data.undo) {
    const parkedCompanies = { ...meta.parkedCompanies };
    for (const [k, v] of Object.entries(parkedCompanies)) {
      if (k === key || parkedKey(v.name) === key) delete parkedCompanies[k];
    }
    await saveDeskMeta({}, { ...meta, parkedCompanies });
    logFromSession(session, {
      kind: "company.unpark",
      summary: `Weer interessant · ${name.slice(0, 80)}`,
      path: "/api/companies/park",
      status: 200,
      detail: { key, name },
    });
    return NextResponse.json({ ok: true, undone: true, key, name });
  }

  const days = parsed.data.days === undefined ? 90 : parsed.data.days;
  const until = days == null ? null : new Date(Date.now() + days * 86_400_000).toISOString();
  await saveDeskMeta(
    { parkedCompanies: { [key]: { name, at: new Date().toISOString(), by: session.email, until } } },
    meta
  );
  logFromSession(session, {
    kind: "company.park",
    summary: `Niet interessant${days ? ` (${days}d)` : " (altijd)"} · ${name.slice(0, 80)}`,
    path: "/api/companies/park",
    status: 200,
    detail: { key, name, days },
  });
  return NextResponse.json({ ok: true, key, name, until });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadDeskMeta();
  return NextResponse.json({
    parked: activeParked().map((r) => ({ key: r.key, name: r.name, at: r.at, until: r.until, by: r.by })),
  });
}
