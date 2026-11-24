import type { ClientGuess } from "@/lib/end-client";
import {
  demoSeedWatchlist,
  listDemoSeedLeads,
  type AgencyLead,
  type LeadStatus,
} from "@/lib/opportunity";
import { listActionQueue, type CrmOpportunity } from "@/lib/crm";
import { PRODUCT } from "@/lib/product-brand";
import { SYNC_COST_PER_RUN, SYNC_LOCK_HOURS } from "@/lib/costs";
import type { SyncDeskSource } from "@/lib/sync-desk";
import { getDemoProspect } from "@/lib/demo-prospects";
import { buildProspectCrmItems } from "@/lib/demo-prospect-data";

type Review = { status: "confirmed" | "rejected"; clientName?: string };
type StoredAi = { guess: ClientGuess; at: string; model?: string };

type DemoState = {
  reviews: Record<string, Review>;
  ai: Record<string, StoredAi>;
};

const g = globalThis as unknown as { __scoutDemoWs?: DemoState };

/** Start met een paar bevestigde posts, zodat de feed én Kansen niet leeg zijn. */
const SEED_REVIEWS: Record<string, Review> = {
  demo_cf_booking: { status: "confirmed", clientName: "Booking.com" },
  demo_port_scrum: { status: "confirmed", clientName: "Havenbedrijf Rotterdam" },
  demo_moove_hypotheken: { status: "confirmed", clientName: "ASN Bank" },
  demo_spilberg_java: { status: "confirmed", clientName: "Adyen" },
};

function state(): DemoState {
  if (!g.__scoutDemoWs) g.__scoutDemoWs = { reviews: { ...SEED_REVIEWS }, ai: {} };
  return g.__scoutDemoWs;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function listDemoLeads(): AgencyLead[] {
  const s = state();
  return listDemoSeedLeads({ reviews: s.reviews, ai: s.ai }).map((l) => ({
    ...l,
    // In de demo-desk gedragen sample-posts zich als echte posts.
    demo: false,
    postedAt: l.postedAt || daysAgo(2 + (l.id.length % 5)),
  }));
}

export function getDemoLeadsPayload() {
  const live = listDemoLeads();
  return {
    watchlist: demoSeedWatchlist(),
    live,
    demo: [] as AgencyLead[],
    parkedHidden: 0,
    persistence: "demo" as const,
    demoMode: true as const,
    sync: {
      lastFeed: { at: daysAgo(1), kept: live.length, fetched: live.length + 2, mode: "demo" },
      last: { at: daysAgo(1), channel: "recruiter-feed", label: "Recruiter-feeds" },
      checkedAt: daysAgo(1),
      pending: 0,
      log: [
        {
          at: daysAgo(1),
          kept: live.length,
          fetched: live.length + 2,
          mode: "demo",
          detail: "Sample data voor de demo",
          people: demoSeedWatchlist().flatMap((a) =>
            a.recruiters.slice(0, 1).map((r) => ({ name: r.name, agency: a.name }))
          ),
          posts: live.slice(0, 4).map((l) => l.title),
        },
      ],
    },
  };
}

export function getDemoRadarPayload(session: { email: string; role: string }) {
  return {
    user: { email: session.email, role: session.role },
    demoMode: true as const,
    stats: { companies: 0, openings: 0, hot: 0, warm: 0 },
    radar: [],
    agencyOpenings: [],
    feed: [],
    workspace: {
      name: PRODUCT.name,
      market: "NL · interim & ZZP",
      roles: ["Scrum Master", "Java Developer", "Cloud Engineer", "Data Engineer"],
      requireContract: true,
      employmentKinds: ["zzp", "interim", "contract"],
      agencies: [],
    },
    sync: {
      last: {
        id: "demo-sync",
        at: daysAgo(1),
        channel: "recruiter-feed",
        label: "Recruiter-feeds",
        mode: "demo",
        fetched: 12,
        kept: 8,
      },
      byChannel: {},
      recent: [],
      permanentFiltered: 0,
      agencySuggestions: 0,
      huntQueries: ["Scrum Master", "Java Developer", "Cloud Engineer"],
      boardQueries: ["Scrum Master", "Java Developer", "Cloud Engineer"],
      platformsEnabled: 0,
    },
  };
}

export function getDemoSyncPayload() {
  const cost = SYNC_COST_PER_RUN.actions;
  const sources: SyncDeskSource[] = [
    {
      id: "market",
      channel: "linkedin-jobs",
      label: "LinkedIn Jobs",
      lastAt: daysAgo(2),
      kept: 4,
      fetched: 18,
      locked: true,
      lockedUntil: null,
      costEur: cost.market.eur,
      auto: null,
      error: null,
      note: "Demo · sync uitgeschakeld",
    },
    {
      id: "indeed",
      channel: "indeed",
      label: "Indeed NL",
      lastAt: null,
      kept: null,
      fetched: null,
      locked: false,
      lockedUntil: null,
      costEur: cost.indeed.eur,
      auto: null,
      error: null,
      note: "Demo · sync uitgeschakeld",
    },
    {
      id: "freelance-nl",
      channel: "freelance-nl",
      label: "Freelance.nl",
      lastAt: daysAgo(3),
      kept: 0,
      fetched: 0,
      locked: false,
      lockedUntil: null,
      costEur: cost["freelance-nl"].eur,
      auto: null,
      error: null,
      note: "Demo · sync uitgeschakeld",
    },
    {
      id: "recruiter-feeds",
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      lastAt: daysAgo(1),
      kept: 8,
      fetched: 12,
      locked: true,
      lockedUntil: null,
      costEur: cost["recruiter-feeds"].eur,
      auto: null,
      error: null,
      note: "Demo · sample data, geen live scrape",
    },
  ];
  return {
    lockHours: SYNC_LOCK_HOURS,
    disclaimer: "Demo-omgeving: syncs draaien niet. Je ziet sample-data om de desk te verkennen.",
    demoMode: true as const,
    health: [
      { id: "apify", label: "Apify", ok: true, detail: "demo" },
      { id: "ai", label: "AI (Claude)", ok: true, detail: "demo" },
      { id: "firecrawl", label: "Online zoeken", ok: true, detail: "demo" },
    ],
    sources,
    spent: { count: 0, eur: { low: 0, high: 0 }, lines: [], forecast: null },
    recent: [],
  };
}

function demoCrmItem(
  partial: Pick<
    CrmOpportunity,
    | "id"
    | "lane"
    | "stage"
    | "endClient"
    | "roleLabel"
    | "title"
    | "kans"
    | "hiringManager"
    | "hiringManagerTitle"
    | "hiringManagerUrl"
    | "hiringManagerEmail"
    | "hiringManagerPhone"
    | "lushaStatus"
    | "hmHits"
    | "agencyName"
    | "recruiterName"
    | "evidenceUrl"
    | "foundAt"
    | "deal"
  > &
    Partial<CrmOpportunity>
): CrmOpportunity {
  const foundAt = partial.foundAt || daysAgo(3);
  return {
    stillLive: true,
    sector: null,
    kansFactors: [{ label: "Opdracht in post", points: 20 }, { label: "Match online", points: 35 }],
    openingCount: 1,
    sources: ["Recruiter feed"],
    bronLabel: "Recruiter feed",
    bronDetail: partial.agencyName || null,
    lastSeenAt: foundAt,
    freshness: "actueel",
    freshnessLabel: "Gevonden <10 dagen",
    confirmedAt: foundAt,
    href: `/bericht?id=${encodeURIComponent(partial.id)}`,
    companyId: null,
    openingId: null,
    extractSummary: null,
    logoUrl: null,
    sourceChannel: "agency-swarm",
    demo: false,
    ...partial,
  };
}

/** Sample-kansen in elke stap van de flow, zodat de demo niet leeg oogt. */
export function listDemoCrmItems(demoSlug?: string | null): CrmOpportunity[] {
  const prospect = getDemoProspect(demoSlug);
  if (prospect) return buildProspectCrmItems(prospect);

  return [
    demoCrmItem({
      id: "crm_bureau_demo_cf_booking",
      lane: "bureau",
      stage: "bevestigd",
      endClient: "Booking.com",
      roleLabel: "GenAI Developer",
      title: "Booking — 12785 — SE2 GenAI",
      kans: 95,
      hiringManager: null,
      hiringManagerTitle: null,
      hiringManagerUrl: null,
      hiringManagerEmail: null,
      hiringManagerPhone: null,
      lushaStatus: null,
      hmHits: [],
      agencyName: "SThree / Computer Futures",
      recruiterName: "Frederik Weulen Kranenberg",
      evidenceUrl: "https://www.computerfutures.com/",
      foundAt: daysAgo(2),
      deal: null,
    }),
    demoCrmItem({
      id: "crm_bureau_demo_port_scrum",
      lane: "bureau",
      stage: "hm",
      endClient: "Havenbedrijf Rotterdam",
      roleLabel: "Scrum Master",
      title: "Scrum Master · SAP ERP-transformatie",
      kans: 86,
      hiringManager: "Sanne de Vries",
      hiringManagerTitle: "IT Delivery Lead",
      hiringManagerUrl: "https://www.linkedin.com/in/example-sanne",
      hiringManagerEmail: null,
      hiringManagerPhone: null,
      lushaStatus: null,
      hmHits: [
        {
          name: "Sanne de Vries",
          title: "IT Delivery Lead",
          url: "https://www.linkedin.com/in/example-sanne",
          score: 82,
          why: "Leidt SAP-trajecten bij dezelfde klant",
        },
        {
          name: "Tom Bakker",
          title: "Chapter Lead Agile",
          url: "https://www.linkedin.com/in/example-tom",
          score: 71,
          why: "Scrum Masters in hetzelfde domein",
        },
      ],
      agencyName: "Vibe Group",
      recruiterName: "Britt",
      evidenceUrl: null,
      foundAt: daysAgo(4),
      deal: null,
      sector: "Haven & logistiek",
    }),
    demoCrmItem({
      id: "crm_bureau_demo_spilberg_java",
      lane: "bureau",
      stage: "hm",
      endClient: "Adyen",
      roleLabel: "Senior Software Engineer",
      title: "Senior Software Engineer — Backend",
      kans: 88,
      hiringManager: "Lisa Hofmann",
      hiringManagerTitle: "Engineering Manager",
      hiringManagerUrl: "https://www.linkedin.com/in/example-lisa",
      hiringManagerEmail: "l.hofmann@example.com",
      hiringManagerPhone: "+31 6 12 34 56 78",
      lushaStatus: "ok",
      hmHits: [
        {
          name: "Lisa Hofmann",
          title: "Engineering Manager",
          url: "https://www.linkedin.com/in/example-lisa",
          score: 90,
          why: "Backend-teams in Amsterdam",
          email: "l.hofmann@example.com",
          phone: "+31 6 12 34 56 78",
          lushaStatus: "ok",
        },
      ],
      agencyName: "Spilberg",
      recruiterName: "Nicky Klaver",
      evidenceUrl: "https://spilberg.com/",
      foundAt: daysAgo(5),
      deal: null,
      sector: "Fintech",
    }),
    demoCrmItem({
      id: "crm_bureau_demo_moove_hypotheken",
      lane: "bureau",
      stage: "outreach",
      endClient: "ASN Bank",
      roleLabel: "Functioneel Tester",
      title: "Freelance Functioneel Tester (Hypotheken)",
      kans: 74,
      hiringManager: "Mark Jansen",
      hiringManagerTitle: "Test Lead Hypotheken",
      hiringManagerUrl: "https://www.linkedin.com/in/example-mark",
      hiringManagerEmail: "m.jansen@example.com",
      hiringManagerPhone: null,
      lushaStatus: "ok",
      hmHits: [
        {
          name: "Mark Jansen",
          title: "Test Lead Hypotheken",
          url: "https://www.linkedin.com/in/example-mark",
          score: 84,
          email: "m.jansen@example.com",
          lushaStatus: "ok",
        },
      ],
      agencyName: "The Next Moove",
      recruiterName: "Bo Verschuren",
      evidenceUrl: null,
      foundAt: daysAgo(8),
      deal: {
        endClient: "ASN Bank",
        title: "Freelance Functioneel Tester (Hypotheken)",
        roleLabel: "Functioneel Tester",
        lane: "bureau",
        agencyName: "The Next Moove",
        contactedAt: daysAgo(1),
        contactedBy: "demo@blablabuild.com",
        updatedAt: daysAgo(1),
      },
      sector: "Bank",
    }),
    demoCrmItem({
      id: "crm_direct_demo_alliander",
      lane: "direct",
      stage: "won",
      endClient: "Alliander",
      roleLabel: "Data Engineer",
      title: "Senior Data Engineer Snowflake / Matillion",
      kans: 90,
      hiringManager: "Eva Noordman",
      hiringManagerTitle: "Teamlead Data Platform",
      hiringManagerUrl: "https://www.linkedin.com/in/example-eva",
      hiringManagerEmail: "e.noordman@example.com",
      hiringManagerPhone: "+31 6 98 76 54 32",
      lushaStatus: "ok",
      hmHits: [],
      agencyName: null,
      recruiterName: null,
      evidenceUrl: "https://inhuurdesk.nl/",
      foundAt: daysAgo(40),
      sources: ["Indeed", "Inhuurdesk"],
      bronLabel: "Jobboards",
      bronDetail: "Indeed · Inhuurdesk",
      sourceChannel: "indeed",
      deal: {
        endClient: "Alliander",
        title: "Senior Data Engineer Snowflake / Matillion",
        roleLabel: "Data Engineer",
        lane: "direct",
        contactedAt: daysAgo(30),
        wonAt: daysAgo(12),
        closedBy: "demo@blablabuild.com",
        marginPerHour: 18,
        hoursPerWeek: 36,
        weeks: 26,
        dealEur: 16848,
        note: "ZZP · 6 maanden",
        updatedAt: daysAgo(12),
      },
      sector: "Energie",
    }),
  ];
}

export function getDemoCrmPayload(demoSlug?: string | null) {
  const items = listDemoCrmItems(demoSlug);
  const pending = listDemoLeads().filter((l) => l.status !== "confirmed" && l.status !== "rejected").length;
  const actionQueue = listActionQueue(items);
  const contacted = items.filter((i) => i.deal?.contactedAt || i.stage === "outreach" || i.stage === "won").length;
  const won = items.filter((i) => i.stage === "won").length;
  return {
    items,
    actionQueue,
    backlog: { feedPending: pending, feedReady: pending, boardBelow: 2, boardThreshold: 55 },
    results: {
      contacted,
      won,
      lost: 0,
      wonEur: items.reduce((s, i) => s + (i.deal?.dealEur || 0), 0),
      conversion: contacted ? Math.round((won / contacted) * 100) : null,
    },
    counts: {
      all: items.length,
      bureau: items.filter((i) => i.lane === "bureau").length,
      direct: items.filter((i) => i.lane === "direct").length,
      withHm: items.filter((i) => i.hiringManager).length,
      byStage: {
        nieuw: items.filter((i) => i.stage === "nieuw").length,
        bevestigd: items.filter((i) => i.stage === "bevestigd").length,
        hm: items.filter((i) => i.stage === "hm").length,
        outreach: items.filter((i) => i.stage === "outreach").length,
        won: items.filter((i) => i.stage === "won").length,
        lost: items.filter((i) => i.stage === "lost").length,
      },
    },
    lusha: true,
    demoMode: true as const,
    demoSlug: demoSlug || null,
  };
}

export function reviewDemoLead(
  id: string,
  action: "confirmed" | "rejected" | "reopen",
  clientName?: string
): AgencyLead | null {
  const s = state();
  if (action === "reopen") {
    delete s.reviews[id];
  } else {
    s.reviews[id] = { status: action, clientName: clientName?.trim() || undefined };
  }
  return listDemoLeads().find((l) => l.id === id) || null;
}

export function saveDemoAiGuess(id: string, guess: ClientGuess, model?: string): AgencyLead | null {
  const s = state();
  s.ai[id] = { guess, at: new Date().toISOString(), model };
  return listDemoLeads().find((l) => l.id === id) || null;
}

export function demoLeadStatus(id: string): LeadStatus | null {
  return listDemoLeads().find((l) => l.id === id)?.status ?? null;
}
