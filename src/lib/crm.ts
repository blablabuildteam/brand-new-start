import { listAgencyLeads } from "@/lib/opportunity";
import { listRadar, listSignals } from "@/lib/store";
import { channelLabel } from "@/lib/sync-log";

export type CrmLane = "bureau" | "direct";

export type CrmOpportunity = {
  id: string;
  lane: CrmLane;
  endClient: string;
  roleLabel: string;
  title: string;
  kans: number | null;
  sources: string[];
  /** Short label for the CRM table, e.g. "LinkedIn Jobs" or "Bureau · Yacht". */
  bronLabel: string;
  /** Extra line under bron, e.g. recruiter name or extra channels. */
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

function formatDay(isoStr: string | null) {
  if (!isoStr) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(isoStr));
  } catch {
    return "—";
  }
}

export { formatDay };

/** Bevestigde bureau-kansen + warme/directe radar-kansen. */
export async function listCrmOpportunities(): Promise<CrmOpportunity[]> {
  const [leads, radar, signals] = await Promise.all([
    listAgencyLeads(),
    listRadar(),
    listSignals(500),
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

    const boardSources = sourceLabels([...(opening?.sources || []), ...(sig?.source ? [sig.source] : [])]).filter(
      (s) => s !== "Bureau"
    );
    out.push({
      id: `crm_bureau_${lead.id}`,
      lane: "bureau",
      endClient,
      roleLabel: lead.roleLabel,
      title: lead.title,
      kans: typeof opening?.kans === "number" ? opening.kans : null,
      sources: sourceLabels([...(opening?.sources || []), ...(sig?.source ? [sig.source] : []), "bureau"]),
      bronLabel: `Bureau · ${lead.agency.name}`,
      bronDetail: [lead.recruiter.name, boardSources[0]].filter(Boolean).join(" · ") || null,
      foundAt,
      lastSeenAt,
      ...fresh,
      hiringManager: opening?.org?.hiringManager || opening?.hiringManager || null,
      hiringManagerTitle: opening?.org?.hiringManagerTitle || null,
      agencyName: lead.agency.name,
      recruiterName: lead.recruiter.name,
      confirmedAt: review?.at || null,
      evidenceUrl: lead.evidenceUrl,
      href: match
        ? `/regie?id=${encodeURIComponent(match.id)}&opening=${encodeURIComponent(opening?.id || "")}`
        : lead.evidenceUrl,
      companyId: match?.id || null,
      openingId: opening?.id || null,
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

      out.push({
        id: `crm_direct_${o.id}`,
        lane: "direct",
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
        hiringManager: o.org?.hiringManager || o.hiringManager || null,
        hiringManagerTitle: o.org?.hiringManagerTitle || null,
        agencyName: null,
        recruiterName: null,
        confirmedAt: null,
        evidenceUrl: sigs.find((s) => s.evidenceUrl)?.evidenceUrl || null,
        href: `/regie?id=${encodeURIComponent(row.id)}&opening=${encodeURIComponent(o.id)}`,
        companyId: row.id,
        openingId: o.id,
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
