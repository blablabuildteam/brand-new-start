import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasApifyToken } from "@/lib/apify";
import { searchHiringManagers } from "@/lib/ingest/people-search";
import { listAgencyLeads } from "@/lib/opportunity";
import { listCrmOpportunities } from "@/lib/crm";
import { loadDeskMeta, pushAlert, saveDeskMeta } from "@/lib/desk-meta";
import { patchSignalRaw } from "@/lib/store";
import { recordSync } from "@/lib/sync-log";
import { kansenHref } from "@/lib/desk-links";

export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * Bureau-lane HM hunt — does not require a Radar opening.
 * Uses the confirmed eindklant + vacancy role from the lead/CRM row.
 */
const Body = z.object({
  /** CRM id: crm_bureau_<leadId> or crm_direct_<openingId> */
  crmId: z.string().min(1).optional(),
  /** Agency lead id (when calling from Bureaus before CRM open) */
  leadId: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasApifyToken()) {
    return NextResponse.json(
      { error: "APIFY_TOKEN ontbreekt — LinkedIn people-search niet beschikbaar", detail: "no-apify-token" },
      { status: 503 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const force = Boolean(parsed.data.force);
  let crmId = parsed.data.crmId || "";
  let company = "";
  let roleLabel = "";
  let openingTitle = "";
  let signalId: string | null = null;
  let sector: string | null = null;

  if (parsed.data.leadId) {
    const leads = await listAgencyLeads();
    const lead = [...leads.live, ...leads.demo].find((l) => l.id === parsed.data.leadId);
    if (!lead) return NextResponse.json({ error: "lead niet gevonden" }, { status: 404 });
    if (lead.status !== "confirmed") {
      return NextResponse.json({ error: "eerst eindklant bevestigen" }, { status: 400 });
    }
    company = lead.confirmedClient || lead.guess?.name || "";
    if (!company) return NextResponse.json({ error: "geen eindklant" }, { status: 400 });
    roleLabel = lead.roleLabel;
    openingTitle = lead.title;
    signalId = lead.signalId || null;
    crmId = `crm_bureau_${lead.id}`;
  } else if (crmId) {
    const items = await listCrmOpportunities();
    const item = items.find((i) => i.id === crmId);
    if (!item) return NextResponse.json({ error: "kans niet gevonden" }, { status: 404 });
    company = item.endClient;
    roleLabel = item.roleLabel;
    openingTitle = item.title;
    if (item.lane === "bureau" && crmId.startsWith("crm_bureau_")) {
      const leadId = crmId.replace("crm_bureau_", "");
      const leads = await listAgencyLeads();
      const lead = [...leads.live, ...leads.demo].find((l) => l.id === leadId);
    signalId = lead?.signalId || null;
    }
  } else {
    return NextResponse.json({ error: "crmId of leadId verplicht" }, { status: 400 });
  }

  const meta = await loadDeskMeta();
  const cached = meta.hmGuesses[crmId];
  if (!force && cached?.hits?.length) {
    return NextResponse.json({
      ok: true,
      cached: true,
      crmId,
      company,
      hiringManager: cached.hiringManager,
      hiringManagerTitle: cached.hiringManagerTitle,
      hits: cached.hits,
      planKeywords: cached.planKeywords,
      detail: cached.detail,
    });
  }

  try {
    const result = await searchHiringManagers({
      company,
      roleLabel,
      openingTitle,
      sector,
    });

    await recordSync({
      channel: "hm-search",
      label: "Hiring manager (bureau)",
      mode: result.detail.startsWith("no-apify") ? "skipped" : "apify",
      detail: result.detail,
      fetched: result.fetched,
      kept: result.people.length,
      searched: [result.plan.keywords],
      hits: result.people.map((p) => ({
        company,
        title: `${p.name} · ${p.title || result.plan.hint}`,
        url: p.url || undefined,
        kept: true,
        isNew: true,
      })),
    });

    const top = result.people[0] || null;
    const row = {
      hiringManager: top?.name || null,
      hiringManagerTitle: top?.title || null,
      hiringManagerUrl: top?.url || null,
      hits: result.people.slice(0, 5).map((p) => ({
        name: p.name,
        title: p.title,
        url: p.url,
        score: p.score,
      })),
      planKeywords: result.plan.keywords,
      detail: result.detail,
      at: new Date().toISOString(),
    };

    await saveDeskMeta({
      hmGuesses: { [crmId]: row },
      ...(top ? { crmStages: { [crmId]: "hm" as const } } : {}),
    });

    if (signalId) {
      await patchSignalRaw(signalId, {
        bureauHm: row,
        ...(top ? { crmStage: "hm" } : {}),
      });
    }

    if (top) {
      await pushAlert({
        kind: "hm",
        title: `HM: ${top.name}`,
        body: `${top.title || "Hiring manager"} bij ${company} · ${roleLabel}`,
        href: kansenHref(crmId),
      });
    }

    return NextResponse.json({
      ok: true,
      cached: false,
      crmId,
      company,
      empty: !top,
      hiringManager: row.hiringManager,
      hiringManagerTitle: row.hiringManagerTitle,
      hits: row.hits,
      planKeywords: row.planKeywords,
      detail: row.detail || result.detail,
      planHint: result.plan.hint,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "HM-zoekfout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
