import type { ClientGuess } from "@/lib/end-client";
import {
  demoSeedWatchlist,
  listDemoSeedLeads,
  type AgencyLead,
  type LeadStatus,
} from "@/lib/opportunity";
import { PRODUCT } from "@/lib/product-brand";
import { SYNC_COST_PER_RUN, SYNC_LOCK_HOURS } from "@/lib/costs";
import type { SyncDeskSource } from "@/lib/sync-desk";

type Review = { status: "confirmed" | "rejected"; clientName?: string };
type StoredAi = { guess: ClientGuess; at: string; model?: string };

type DemoState = {
  reviews: Record<string, Review>;
  ai: Record<string, StoredAi>;
};

const g = globalThis as unknown as { __scoutDemoWs?: DemoState };

function state(): DemoState {
  if (!g.__scoutDemoWs) g.__scoutDemoWs = { reviews: {}, ai: {} };
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

export function getDemoCrmPayload() {
  const leads = listDemoLeads().filter((l) => l.status === "confirmed");
  const items = leads.map((lead) => {
    const endClient = lead.confirmedClient || lead.guess?.name || "Onbekend";
    return {
      id: `crm_bureau_${lead.id}`,
      lane: "bureau" as const,
      stage: "bevestigd" as const,
      title: lead.title,
      roleLabel: lead.roleLabel,
      company: endClient,
      agency: lead.agency.name,
      evidenceUrl: lead.evidenceUrl,
      hiringManager: lead.hiringManager || null,
      hiringManagerTitle: lead.hiringManagerTitle || null,
      hiringManagerUrl: lead.hiringManagerUrl || null,
      hiringManagerEmail: null,
      hiringManagerPhone: null,
      lushaStatus: null,
      kans: lead.guess?.confidence ?? null,
      kansFactors: [],
      foundAt: lead.postedAt,
      lastSeenAt: lead.postedAt,
      freshness: "warm" as const,
      leadId: lead.id,
      demo: false,
      source: "feed" as const,
    };
  });
  return {
    items,
    actionQueue: [],
    backlog: { feedPending: listDemoLeads().filter((l) => l.status !== "confirmed" && l.status !== "rejected").length, feedReady: 0, boardBelow: 0, boardThreshold: 55 },
    results: { placed: 0, margin: 0 },
    counts: {
      all: items.length,
      bureau: items.length,
      direct: 0,
      withHm: items.filter((i) => i.hiringManager).length,
      byStage: {
        nieuw: 0,
        bevestigd: items.length,
        hm: 0,
        outreach: 0,
        won: 0,
        lost: 0,
      },
    },
    lusha: false,
    demoMode: true as const,
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
