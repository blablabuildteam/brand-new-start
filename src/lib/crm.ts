import { listAgencyLeads } from "@/lib/opportunity";
import { listAgencySignals, listRadar, patchSignalRaw } from "@/lib/store";
import { channelLabel } from "@/lib/sync-log";
import { scoreSignals } from "@/lib/score";
import { regieHref } from "@/lib/desk-links";
import {
  CRM_STAGE_NL,
  loadDeskMeta,
  saveDeskMeta,
  type CrmStage,
  type HmGuessRow,
  type HmHitStored,
} from "@/lib/desk-meta";

export type CrmLane = "bureau" | "direct";
export type { CrmStage };
export { CRM_STAGE_NL };

export type CrmOpportunity = {
  id: string;
  lane: CrmLane;
  stage: CrmStage;
  /** Seeded example, not a real lead — never spend API credits on these. */
  demo?: boolean;
  /** Still appearing in syncs (vacancy not filled yet). */
  stillLive?: boolean;
  endClient: string;
  /** Client sector when known — drives public-sector HM search wording. */
  sector?: string | null;
  roleLabel: string;
  title: string;
  kans: number | null;
  /** Bewijs achter de score, zodat "55" navraagbaar is. */
  kansFactors: { label: string; points: number }[];
  sources: string[];
  bronLabel: string;
  bronDetail: string | null;
  foundAt: string | null;
  lastSeenAt: string | null;
  freshness: "vers" | "actueel" | "ouder" | "onbekend";
  freshnessLabel: string;
  hiringManager: string | null;
  hiringManagerTitle: string | null;
  hiringManagerUrl: string | null;
  hiringManagerEmail: string | null;
  hiringManagerPhone: string | null;
  lushaStatus: "ok" | "empty" | "restricted" | null;
  hmHits: HmHitStored[];
  agencyName: string | null;
  recruiterName: string | null;
  confirmedAt: string | null;
  evidenceUrl: string | null;
  href: string | null;
  companyId: string | null;
  openingId: string | null;
  extractSummary: string | null;
  /** Company logo when scraped with the vacancy. */
  logoUrl: string | null;
  /** Primary ingest channel for SourceLogo (linkedin-jobs, indeed, …). */
  sourceChannel: string | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return t.toISOString();
}

/**
 * Freshness = how long ago we FIRST saw it. `lastSeenAt` only means "still
 * live"; using it would make a three-month-old vacancy read as brand new after
 * every sync, which is exactly backwards for a head start.
 */
function freshnessOf(foundAt: string | null, lastSeenAt: string | null): {
  freshness: CrmOpportunity["freshness"];
  freshnessLabel: string;
  stillLive: boolean;
} {
  const ref = foundAt || lastSeenAt;
  const stillLive = lastSeenAt
    ? (Date.now() - new Date(lastSeenAt).getTime()) / 3600000 <= 96
    : false;
  if (!ref) return { freshness: "onbekend", freshnessLabel: "Onbekend", stillLive };
  const ageH = (Date.now() - new Date(ref).getTime()) / 3600000;
  if (ageH < 24) return { freshness: "vers", freshnessLabel: "Nieuw · <24u", stillLive };
  if (ageH < 72) return { freshness: "actueel", freshnessLabel: "Gevonden <3 dagen", stillLive };
  if (ageH < 240) return { freshness: "actueel", freshnessLabel: "Gevonden <10 dagen", stillLive };
  const days = Math.floor(ageH / 24);
  return {
    freshness: "ouder",
    freshnessLabel: stillLive ? `${days}d open, nog live` : `${days}d geleden`,
    stillLive,
  };
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

function profileKey(url: string | null | undefined) {
  if (!url) return "";
  return url.split("?")[0].replace(/\/+$/, "").toLowerCase();
}

function contactFrom(row: HmGuessRow | null | undefined, extraHits?: HmHitStored[]) {
  const hits = [...(row?.hits || []), ...(extraHits || [])];
  const key = profileKey(row?.hiringManagerUrl);
  const hit = key
    ? hits.find((h) => profileKey(h.url) === key)
    : hits.find((h) => row?.hiringManager && h.name === row.hiringManager && (h.email || h.phone));
  return {
    hiringManagerEmail: row?.hiringManagerEmail || hit?.email || null,
    hiringManagerPhone: row?.hiringManagerPhone || hit?.phone || null,
    lushaStatus: row?.lushaStatus || hit?.lushaStatus || null,
    hits: (row?.hits?.length ? row.hits : extraHits || []).slice(0, 5),
  };
}

function needsContact(item: Pick<CrmOpportunity, "hiringManager" | "hiringManagerUrl" | "hiringManagerEmail" | "hiringManagerPhone" | "lushaStatus">) {
  if (!item.hiringManager || !item.hiringManagerUrl) return false;
  if (item.hiringManagerEmail || item.hiringManagerPhone) return false;
  if (item.lushaStatus === "empty" || item.lushaStatus === "restricted") return false;
  return true;
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

import { resolveCompanyLogo } from "@/lib/company-logo";

function extractSummaryFromRaw(raw: Record<string, unknown> | undefined): string | null {
  const v = raw?.vacancyExtract;
  if (!v || typeof v !== "object") return null;
  const o = v as { summary?: string; role?: string };
  return o.summary || o.role || null;
}

function sourceChannelOf(labels: string[]): string | null {
  for (const s of labels) {
    const k = s.toLowerCase();
    if (k.includes("linkedin") || k === "linkedin-jobs") return "linkedin-jobs";
    if (k.includes("indeed") || k === "indeed") return "indeed";
    if (k.includes("freelance") || k === "freelance-nl") return "freelance-nl";
  }
  return null;
}

/**
 * Waarom een kans nog niet in de lijst staat. Zonder deze cijfers lijkt een
 * lijst van drie een bug, terwijl de rest gewoon nog een stap mist.
 */
export type CrmBacklog = {
  /** Feed-posts zonder bevestigde opdrachtgever. */
  feedPending: number;
  /** Jobboard-vacatures onder de kansdrempel. */
  boardBelow: number;
  /** Score die een jobboard-vacature nodig heeft. */
  boardThreshold: number;
};

type CrmInputs = {
  leads: Awaited<ReturnType<typeof listAgencyLeads>>;
  radar: Awaited<ReturnType<typeof listRadar>>;
  signals: Awaited<ReturnType<typeof listAgencySignals>>;
  meta: Awaited<ReturnType<typeof loadDeskMeta>>;
};

async function loadCrmInputs(): Promise<CrmInputs> {
  const [leads, radar, signals, meta] = await Promise.all([
    listAgencyLeads(),
    listRadar(),
    // Uncapped on purpose: a recency cap dropped older confirmed leads, which
    // then lost their review timestamp and stored stage.
    listAgencySignals(),
    loadDeskMeta(),
  ]);
  return { leads, radar, signals, meta };
}

export async function listCrmDesk(): Promise<{ items: CrmOpportunity[]; backlog: CrmBacklog }> {
  const inputs = await loadCrmInputs();
  const feedPending = inputs.leads.live.filter(
    (l) => l.status !== "confirmed" && l.status !== "rejected"
  ).length;
  const boardBelow = inputs.radar
    .flatMap((r) => r.openings || [])
    .filter((o) => o.status !== "hot" && o.status !== "warm").length;
  return {
    items: buildCrm(inputs),
    backlog: { feedPending, boardBelow, boardThreshold: 55 },
  };
}

/** Bevestigde bureau-kansen + warme/jobboard-radar-kansen. */
export async function listCrmOpportunities(): Promise<CrmOpportunity[]> {
  return buildCrm(await loadCrmInputs());
}

type ScoredOpening = { kans?: number | null; factors?: { label: string; points: number }[] };

function scoreOf(
  opening: ScoredOpening | undefined,
  sig: Parameters<typeof scoreSignals>[0][number] | undefined
): { kans: number | null; kansFactors: { label: string; points: number }[] } {
  if (typeof opening?.kans === "number") {
    return { kans: opening.kans, kansFactors: opening.factors || [] };
  }
  if (!sig) return { kans: null, kansFactors: [] };
  const scored = scoreSignals([sig]);
  return { kans: scored.kans, kansFactors: scored.factors };
}

function buildCrm({ leads, radar, signals, meta }: CrmInputs): CrmOpportunity[] {

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
    // Only borrow kans/hiring-manager from an opening that is actually the same
    // role. Falling back to openings[0] showed the manager of an unrelated
    // vacancy at the same client.
    const opening = openings.find((o) =>
      normName(o.roleLabel).includes(normName(lead.roleLabel).slice(0, 12))
    );
    const anyOpening = opening || openings[0];

    const id = `crm_bureau_${lead.id}`;
    const hmStored = meta.hmGuesses[id];
    const rawHm = raw.bureauHm as HmGuessRow | undefined;
    const hiringManager =
      hmStored?.hiringManager ||
      rawHm?.hiringManager ||
      opening?.org?.hiringManager ||
      opening?.hiringManager ||
      null;
    const hiringManagerTitle =
      hmStored?.hiringManagerTitle ||
      rawHm?.hiringManagerTitle ||
      opening?.org?.hiringManagerTitle ||
      null;
    const hiringManagerUrl = hmStored?.hiringManagerUrl || rawHm?.hiringManagerUrl || null;
    const contact = contactFrom(
      hmStored ? { ...hmStored, hiringManagerUrl } : rawHm ? { ...rawHm, hiringManagerUrl } : null,
      opening?.org?.hmHits
    );
    const storedStage =
      (typeof raw.crmStage === "string" ? (raw.crmStage as CrmStage) : null) ||
      meta.crmStages[id] ||
      null;
    const boardSources = sourceLabels([
      ...(anyOpening?.sources || []),
      ...(sig?.source ? [sig.source] : []),
    ]).filter((s) => s !== "Bureau");
    const allSources = sourceLabels([
      ...(anyOpening?.sources || []),
      ...(sig?.source ? [sig.source] : []),
      "bureau",
    ]);

    out.push({
      id,
      lane: "bureau",
      demo: lead.demo || undefined,
      stage: inferStage({ stored: storedStage, lane: "bureau", hiringManager }),
      endClient,
      sector: match?.company.sector || null,
      roleLabel: lead.roleLabel,
      title: lead.title,
      // Een feed-kans heeft geen jobboard-vacature om op te scoren; dan scoren we
      // de recruiter-post zelf, zodat de kolom nooit leeg blijft.
      ...scoreOf(opening, sig),
      sources: allSources,
      bronLabel: `Bureau · ${lead.agency.name}`,
      bronDetail: [lead.recruiter.name, boardSources[0]].filter(Boolean).join(" · ") || null,
      foundAt,
      lastSeenAt,
      ...fresh,
      hiringManager,
      hiringManagerTitle,
      hiringManagerUrl,
      hiringManagerEmail: contact.hiringManagerEmail,
      hiringManagerPhone: contact.hiringManagerPhone,
      lushaStatus: contact.lushaStatus,
      hmHits: contact.hits,
      agencyName: lead.agency.name,
      recruiterName: lead.recruiter.name,
      confirmedAt: review?.at || meta.leadReviews[lead.id]?.at || null,
      evidenceUrl: lead.evidenceUrl,
      // Without a matching opening, send Voorstel to the bureau lead itself
      // rather than to an unrelated vacancy at the same client.
      href:
        match && opening
          ? regieHref({ companyId: match.id, openingId: opening.id })
          : regieHref({ companyId: id }),
      companyId: opening ? match?.id || null : null,
      openingId: opening?.id || null,
      extractSummary: extractSummaryFromRaw(raw),
      logoUrl: resolveCompanyLogo({
        raw,
        signals: [
          ...(opening?.signals || []),
          ...(anyOpening?.signals || []),
          ...((match?.openings || []).flatMap((o) => o.signals || [])),
        ],
        companyName: endClient,
        allowGuess: true,
      }),
      sourceChannel: sourceChannelOf(boardSources) || sourceChannelOf(allSources),
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
      const idHm = meta.hmGuesses[id];
      const hmName = idHm?.hiringManager || hiringManager;
      const raw0 = (sigs[0]?.raw && typeof sigs[0].raw === "object" ? sigs[0].raw : {}) as Record<
        string,
        unknown
      >;
      const storedStage =
        (typeof raw0.crmStage === "string" ? (raw0.crmStage as CrmStage) : null) ||
        meta.crmStages[id] ||
        null;
      const contact = contactFrom(idHm, o.org?.hmHits);

      out.push({
        id,
        lane: "direct",
        stage: inferStage({ stored: storedStage, lane: "direct", hiringManager: hmName }),
        endClient: row.company.name,
        sector: row.company.sector,
        roleLabel: o.roleLabel,
        title: o.openingTitle || o.roleLabel,
        kans: o.kans,
        kansFactors: o.factors || [],
        sources: boards,
        bronLabel: primary,
        bronDetail: boards.length > 1 ? boards.slice(1).join(" · ") : "Direct bij eindklant",
        foundAt,
        lastSeenAt,
        ...fresh,
        hiringManager: hmName,
        hiringManagerTitle: idHm?.hiringManagerTitle || o.org?.hiringManagerTitle || null,
        hiringManagerUrl: idHm?.hiringManagerUrl || null,
        hiringManagerEmail: contact.hiringManagerEmail,
        hiringManagerPhone: contact.hiringManagerPhone,
        lushaStatus: contact.lushaStatus,
        hmHits: contact.hits.length ? contact.hits : (o.org?.hmHits || []).slice(0, 5),
        agencyName: null,
        recruiterName: null,
        confirmedAt: null,
        evidenceUrl: sigs.find((s) => s.evidenceUrl)?.evidenceUrl || null,
        href: regieHref({ companyId: row.id, openingId: o.id }),
        companyId: row.id,
        openingId: o.id,
        extractSummary: extractSummaryFromRaw(raw0),
        logoUrl: resolveCompanyLogo({
          raw: raw0,
          signals: sigs,
          companyName: row.company.name,
          allowGuess: true,
        }),
        sourceChannel: sourceChannelOf(boards),
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
      // Zelfde woorden als de knop op Kansen — anders lijkt het een andere actie.
      let next = "Open detail";
      let href = `/kansen?id=${encodeURIComponent(i.id)}`;
      if (!i.hiringManager) {
        next = "Zoek manager";
        href = `/kansen?id=${encodeURIComponent(i.id)}&hm=1`;
      } else if (needsContact(i)) {
        next = "Haal contact";
        href = `/kansen?id=${encodeURIComponent(i.id)}`;
      } else if (i.stage === "hm" || i.stage === "bevestigd" || i.stage === "nieuw") {
        next = "Bericht";
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
    // openingId is a rad_* id, never a signal id — resolve the opening first and
    // patch its own vacancy signal so the stage survives a desk-meta reset.
    const radar = await listRadar();
    const opening = radar
      .flatMap((r) => r.openings || [])
      .find((o) => o.id === item.openingId);
    const sig =
      opening?.signals.find((s) => s.source === "job-type") || opening?.signals[0];
    if (sig) await patchSignalRaw(sig.id, { crmStage: stage });
  }

  return { ...item, stage };
}
