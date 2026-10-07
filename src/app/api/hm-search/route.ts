import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listRadar, patchSignalRaw } from "@/lib/store";
import { namedManagerFromVacancy, orgContextFromSignals } from "@/lib/org-context";
import { buildApproach, companyLinkedinFromSignals } from "@/lib/approach";
import { searchHiringManagers } from "@/lib/ingest/people-search";
import { recordSync } from "@/lib/sync-log";
import { HM_SEARCH_VER } from "@/lib/hm-hunt";
import { loadHuntSettings } from "@/lib/hunt";

export const maxDuration = 120;

const Body = z.object({
  companyId: z.string().min(1),
  openingId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await loadHuntSettings();

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const { companyId, openingId, force } = parsed.data;
  if (companyId === "demo") {
    return NextResponse.json({ ok: true, cached: true, empty: true, detail: "demo", targets: [], people: [] });
  }
  const rows = await listRadar();
  const row = rows.find((r) => r.id === companyId);
  if (!row) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });

  const opening = (row.openings || []).find((o) => o.id === openingId);
  if (!opening) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });

  const company = row;
  const vacancy = opening;
  const org = vacancy.org || orgContextFromSignals(vacancy.signals);
  const companyUrl = companyLinkedinFromSignals(vacancy.signals);

  function payload(nextOrg: typeof org, cached: boolean) {
    const targets = buildApproach({
      company: company.company.name,
      roleLabel: vacancy.roleLabel,
      openingTitle: vacancy.openingTitle,
      org: nextOrg,
      companyLinkedinUrl: companyUrl,
      sector: company.company.sector,
    }).targets;
    return { ok: true, cached, org: nextOrg, targets, people: nextOrg.hmHits || [] };
  }

  if (!force && org.hmHits?.length) {
    return NextResponse.json(payload(org, true));
  }
  if (!force && org.hiringManager && !org.hmHits?.length) {
    return NextResponse.json(payload(org, true));
  }

  const blob = vacancy.signals.map((s) => s.summary || s.title).join("\n");
  const poster = vacancy.signals
    .map((s) => s.raw || {})
    .find((r) => typeof r.jobPosterName === "string");
  const namedPerson = namedManagerFromVacancy({
    text: blob,
    posterName: typeof poster?.jobPosterName === "string" ? poster.jobPosterName : null,
    posterTitle: typeof poster?.jobPosterTitle === "string" ? poster.jobPosterTitle : null,
  });

  try {
    const result = await searchHiringManagers({
      company: company.company.name,
      roleLabel: vacancy.roleLabel,
      openingTitle: vacancy.openingTitle,
      department: org.department,
      sector: company.company.sector,
      companyLinkedinUrl: companyUrl,
      namedPerson,
      vacancyText: blob,
    });

    await recordSync({
      channel: "hm-search",
      label: "Hiring manager",
      mode: result.detail.startsWith("no-apify") ? "skipped" : "apify",
      detail: result.detail,
      fetched: result.fetched,
      kept: result.people.length,
      searched: [result.plan.keywords],
      hits: result.people.map((p) => ({
        company: company.company.name,
        title: `${p.name} · ${p.title || result.plan.hint}`,
        url: p.url,
        kept: true,
        isNew: true,
      })),
    });

    if (!result.people.length) {
      return NextResponse.json({
        ...payload(org, false),
        empty: true,
        detail: result.detail,
      });
    }

    const hmHits = result.people.map((p) => ({
      name: p.name,
      title: p.title,
      url: p.url,
      company: p.company,
      score: p.score,
      why: p.why?.length ? p.why.join(" · ") : undefined,
    }));
    const chosen = result.namedMatch
      ? hmHits.find(
          (p) =>
            namedPerson &&
            (p.name.toLowerCase() === namedPerson.toLowerCase() ||
              p.name.toLowerCase().startsWith(namedPerson.toLowerCase()))
        ) || hmHits[0]
      : null;
    const nextOrg = {
      ...org,
      hiringManager: chosen?.name || null,
      hiringManagerTitle: chosen?.title || org.hiringManagerTitle,
      contactUrl: chosen?.url || org.contactUrl,
      hmHits,
    };

    // Must be this opening's own vacancy signal. signals[0] is the newest of a
    // bundle that also carries company-wide pulse/tender signals, so writing
    // there leaked this manager onto every other opening at the client.
    const signalId =
      vacancy.signals.find((s) => s.source === "job-type")?.id || vacancy.signals[0]?.id;
    if (signalId) {
      await patchSignalRaw(signalId, {
        hiringManager: nextOrg.hiringManager,
        hiringManagerTitle: nextOrg.hiringManagerTitle,
        contactUrl: nextOrg.contactUrl,
        hmHits,
        hmSearchVer: HM_SEARCH_VER,
      });
    }

    return NextResponse.json(payload(nextOrg, false));
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "zoek-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
