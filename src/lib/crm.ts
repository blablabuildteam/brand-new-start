import { listAgencyLeads } from "@/lib/opportunity";
import { listRadar, listSignals, patchSignalRaw } from "@/lib/store";
import { channelLabel } from "@/lib/sync-log";
import { radarHref, regieHref } from "@/lib/desk-links";
import {
  CRM_STAGE_NL,
  loadDeskMeta,
  saveDeskMeta,
  type CrmStage,
} from "@/lib/desk-meta";

export type CrmLane = "bureau" | "direct";
export type { CrmStage };
export { CRM_STAGE_NL };

export type CrmOpportunity = {
  id: string;
  lane: CrmLane;
  stage: CrmStage;
  endClient: string;
  roleLabel: string;
  title: string;
  kans: number | null;
  sources: string[];
  bronLabel: string;
  bronDetail: string | null;
  foundAt: string | null;
  lastSeenAt: string | null;
  freshness: "vers" | "actueel" | "ouder" | "onbekend";
  freshnessLabel: string;
  hiringManager: string | null;
  hiringManagerTitle: string | null;
  agencyName: string | null;
  recruiterName: string | null;
  confirmedAt: string | null;
  evidenceUrl: string | null;
  href: string | null;
  companyId: string | null;
  openingId: string | null;
  extractSummary: string | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return t.toISOString();
}

function freshnessOf(foundAt: string | null, lastSeenAt: string | null): {
  freshness: CrmOpportunity["freshness"];
  freshnessLabel: string;
} {
  const ref = lastSeenAt || foundAt;
  if (!ref) return { freshness: "onbekend", freshnessLabel: "Onbekend" };
  const ageH = (Date.now() - new Date(ref).getTime()) / 3600000;
  if (ageH < 24) return { freshness: "vers", freshnessLabel: "Laatste 24u" };
  if (ageH < 72) return { freshness: "actueel", freshnessLabel: "Laatste 3 dagen" };
  if (ageH < 240) return { freshness: "actueel", freshnessLabel: "Laatste 10 dagen" };
  const days = Math.floor(ageH / 24);
  return { freshness: "ouder", freshnessLabel: `${days}d geleden` };
}

function normName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceLabels(raw: string[]) {
  return [...new Set(raw.map((s) => channelLabel(s) || s).filter(Boolean))];
}

function inferStage(opts: {
  stored?: CrmStage | null;
  lane: CrmLane;
  hiringManager: string | null;
}): CrmStage {
  if (opts.stored) return opts.stored;
  if (opts.hiringManager) return "hm";
  if (opts.lane === "bureau") return "bevestigd";
  return "nieuw";
}

function extractSummaryFromRaw(raw: Record<string, unknown> | undefined): string | null {
  const v = raw?.vacancyExtract;
  if (!v || typeof v !== "object") return null;
  const o = v as { summary?: string; role?: string };
  return o.summary || o.role || null;
}

/** Bevestigde bureau-kansen + warme/directe radar-kansen. */
export async function listCrmOpportunities(): Promise<CrmOpportunity[]> {
  const [leads, radar, signals, meta] = await Promise.all([
    listAgencyLeads(),
    listRadar(),
    listSignals(500),
    loadDeskMeta(),
  ]);

  const signalById = new Map(signals.map((s) => [s.id, s]));
  const radarByCompany = new Map(radar.map((r) => [normName(r.company.name), r] as const));
  const out: CrmOpportunity[] = [];

  for (const lead of [...leads.live, ...leads.demo]) {
    if (lead.status !== "confirmed") continue;
    const endClient = lead.confirmedClient || lead.guess?.name;
    if (!endClient) continue;

    const sig = lead.signalId ? signalById.get(lead.signalId) : undefined;
    const raw = (sig?.raw && typeof sig.raw === "object" ? sig.raw : {}) as Record<string, unknown>;
    const review = raw.leadReview as { at?: string } | undefined;
    const foundAt = iso(sig?.firstSeenAt) || iso(sig?.seenAt) || review?.at || null;
    const lastSeenAt = iso(sig?.seenAt) || foundAt;
    const fresh = freshnessOf(foundAt, lastSeenAt);

    const match = radarByCompany.get(normName(endClient));
    const openings = match?.openings || [];
    const opening =
      openings.find((o) =>
        normName(o.roleLabel).includes(normName(lead.roleLabel).slice(0, 12))
      ) || openings[0];

    const id = `crm_bureau_${lead.id}`;
    const hiringManager = opening?.org?.hiringManager || opening?.hiringManager || null;
    const storedStage =
      (typeof raw.crmStage === "string" ? (raw.crmStage as CrmStage) : null) ||
      meta.crmStages[id] ||
      null;
    const boardSources = sourceLabels([
      ...(opening?.sources || []),
      ...(sig?.source ? [sig.source] : []),
    ]).filter((s) => s !== "Bureau");

    out.push({
      id,
      lane: "bureau",
      stage: inferStage({ stored: storedStage, lane: "bureau", hiringManager }),
      endClient,
      roleLabel: lead.roleLabel,
      title: lead.title,
      kans: typeof opening?.kans === "number" ? opening.kans : null,
      sources: sourceLabels([
        ...(opening?.sources || []),
        ...(sig?.source ? [sig.source] : []),
        "bureau",
      ]),
      bronLabel: `Bureau · ${lead.agency.name}`,
      bronDetail: [lead.recruiter.name, boardSources[0]].filter(Boolean).join(" · ") || null,
      foundAt,
      lastSeenAt,
      ...fresh,
      hiringManager,
      hiringManagerTitle: opening?.org?.hiringManagerTitle || null,
      agencyName: lead.agency.name,
      recruiterName: lead.recruiter.name,
      confirmedAt: review?.at || meta.leadReviews[lead.id]?.at || null,
      evidenceUrl: lead.evidenceUrl,
      href: match
        ? regieHref({ companyId: match.id, openingId: opening?.id || null })
        : lead.evidenceUrl,
      companyId: match?.id || null,
      openingId: opening?.id || null,
      extractSummary: extractSummaryFromRaw(raw),
    });
  }

  for (const row of radar) {
    for (const o of row.openings || []) {
      if (o.status !== "hot" && o.status !== "warm") continue;
      const sigs = o.signals || [];
      const firsts = sigs
        .map((s) => iso(s.firstSeenAt) || iso(s.seenAt))
        .filter(Boolean) as string[];
      const lasts = sigs.map((s) => iso(s.seenAt)).filter(Boolean) as string[];
      const foundAt = firsts.sort()[0] || null;
      const lastSeenAt = lasts.sort().reverse()[0] || foundAt;
      const fresh = freshnessOf(foundAt, lastSeenAt);
      const boards = sourceLabels([...(o.sources || []), ...sigs.map((s) => s.source)]);
      const primary = boards[0] || "Directe vacature";
      const id = `crm_direct_${o.id}`;
      const hiringManager = o.org?.hiringManager || o.hiringManager || null;
      const raw0 = (sigs[0]?.raw && typeof sigs[0].raw === "object" ? sigs[0].raw : {}) as Record<
        string,
        unknown
      >;
      const storedStage =
        (typeof raw0.crmStage === "string" ? (raw0.crmStage as CrmStage) : null) ||
        meta.crmStages[id] ||
        null;

      out.push({
        id,
        lane: "direct",
        stage: inferStage({ stored: storedStage, lane: "direct", hiringManager }),
        endClient: row.company.name,
        roleLabel: o.roleLabel,
        title: o.openingTitle || o.roleLabel,
        kans: o.kans,
        sources: boards,
        bronLabel: primary,
        bronDetail: boards.length > 1 ? boards.slice(1).join(" · ") : "Direct bij eindklant",
        foundAt,
        lastSeenAt,
        ...fresh,
        hiringManager,
        hiringManagerTitle: o.org?.hiringManagerTitle || null,
        agencyName: null,
        recruiterName: null,
        confirmedAt: null,
        evidenceUrl: sigs.find((s) => s.evidenceUrl)?.evidenceUrl || null,
        href: regieHref({ companyId: row.id, openingId: o.id }),
        companyId: row.id,
        openingId: o.id,
        extractSummary: extractSummaryFromRaw(raw0),
      });
    }
  }

  out.sort((a, b) => {
    const ak = a.kans ?? -1;
    const bk = b.kans ?? -1;
    if (bk !== ak) return bk - ak;
    return (b.lastSeenAt || b.foundAt || "").localeCompare(a.lastSeenAt || a.foundAt || "");
  });

  return out;
}

export function listActionQueue(items: CrmOpportunity[]) {
  return items
    .filter((i) => i.stage !== "won" && i.stage !== "lost")
    .map((i) => {
      let next = "Open detail";
      let href = `/kansen?id=${encodeURIComponent(i.id)}`;
      if (!i.hiringManager) {
        next = "Zoek hiring manager";
        href = radarHref({
          companyId: i.companyId,
          openingId: i.openingId,
          q: i.companyId ? null : i.endClient,
        });
      } else if (i.stage === "hm" || i.stage === "bevestigd" || i.stage === "nieuw") {
        next = "Open voorstel";
        href = i.href || href;
      } else if (i.stage === "outreach") {
        next = "Follow-up";
        href = i.href || href;
      }
      return { ...i, nextAction: next, nextHref: href };
    })
    .slice(0, 8);
}

export async function setCrmStage(id: string, stage: CrmStage): Promise<CrmOpportunity | null> {
  const items = await listCrmOpportunities();
  const item = items.find((i) => i.id === id);
  if (!item) return null;

  await saveDeskMeta({ crmStages: { [id]: stage } });

  if (item.lane === "bureau" && id.startsWith("crm_bureau_")) {
    const leadId = id.replace("crm_bureau_", "");
    const leads = await listAgencyLeads();
    const lead = [...leads.live, ...leads.demo].find((l) => l.id === leadId);
    if (lead?.signalId) await patchSignalRaw(lead.signalId, { crmStage: stage });
  } else if (item.openingId) {
    const signals = await listSignals(500);
    const hit = signals.find((s) => {
      const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
      return s.id === item.openingId || raw.openingId === item.openingId;
    });
    if (hit) await patchSignalRaw(hit.id, { crmStage: stage });
  }

  return { ...item, stage };
}
