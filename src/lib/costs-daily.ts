import { CHANNEL_ACTION, SYNC_COST_PER_RUN, eurMid, type CostPart } from "@/lib/costs";
import { amsterdamDay, loadSpendLedger, type SpendDay } from "@/lib/spend-ledger";
import type { SyncRun } from "@/lib/sync-log";

/**
 * Kosten per dag en per sync. Apify = echte run-kosten uit de Apify-API
 * (als de token werkt), AI = gemeten tokens sinds de ledger bestaat,
 * de rest een schatting op basis van de sync-caps.
 */

const USD_EUR = 0.92;
const FIRECRAWL_SEARCH_USD = 0.01;
const FIRECRAWL_SCRAPE_USD = 0.005;
const DAY = 86_400_000;

const CHANNEL_PART: Record<string, CostPart> = {
  "linkedin-jobs": "boards",
  indeed: "boards",
  "freelance-nl": "boards",
  "firecrawl-careers": "boards",
  "recruiter-feed": "feed",
  "hm-search": "hm",
  lusha: "hm",
};

type ApifyRun = { startedAt: string; usd: number };

async function fetchApifyRuns(since: number): Promise<{ runs: ApifyRun[]; error: string | null }> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) return { runs: [], error: "geen APIFY_TOKEN" };
  const runs: ApifyRun[] = [];
  try {
    for (let offset = 0; offset < 3000; offset += 1000) {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs?desc=1&limit=1000&offset=${offset}&token=${encodeURIComponent(token)}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return { runs: [], error: res.status === 401 ? "Apify-token ongeldig" : `Apify ${res.status}` };
      const j = (await res.json()) as {
        data?: { items?: { startedAt?: string; usageTotalUsd?: number }[] };
      };
      const items = j.data?.items || [];
      let older = false;
      for (const it of items) {
        if (!it.startedAt) continue;
        if (new Date(it.startedAt).getTime() < since) {
          older = true;
          continue;
        }
        if (typeof it.usageTotalUsd === "number") runs.push({ startedAt: it.startedAt, usd: it.usageTotalUsd });
      }
      if (older || items.length < 1000) break;
    }
    return { runs, error: null };
  } catch (e) {
    return { runs: [], error: e instanceof Error ? e.message : "Apify niet bereikbaar" };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function paid(run: SyncRun) {
  if (["fresh", "skipped", "error"].includes(run.mode)) return false;
  return (run.fetched ?? 1) > 0 || run.channel === "hm-search";
}

function estimateFor(channel: string) {
  const id = CHANNEL_ACTION[channel];
  return id ? eurMid(SYNC_COST_PER_RUN.actions[id].eur) : 0;
}

export type DailyCostRow = {
  day: string;
  parts: Record<CostPart, number>;
  total: number;
  /** true = Apify én AI van deze dag zijn gemeten, niet geschat */
  measured: boolean;
  syncs: number;
};

export type SyncCostRow = {
  id: string;
  at: string;
  channel: string;
  label: string;
  kept: number;
  fetched: number;
  mode: string;
  eur: number;
  measured: boolean;
};

export async function buildDailyCosts(opts: {
  runs: SyncRun[];
  aiAt: string[];
  days?: number;
}) {
  const days = opts.days ?? 30;
  const today = amsterdamDay();
  const start = Date.now() - (days - 1) * DAY;
  const dayList = Array.from({ length: days }, (_, i) => amsterdamDay(start + i * DAY));
  const from = new Date(`${dayList[0]}T00:00:00+01:00`).getTime() - DAY;

  const [apify, ledger] = await Promise.all([fetchApifyRuns(from), loadSpendLedger()]);
  const apifyOk = !apify.error;

  const windowRuns = opts.runs
    .filter((r) => new Date(r.at).getTime() >= from)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Elke Apify-run hoort bij de eerste sync die binnen 10 min na de start eindigde.
  const measuredBySync = new Map<string, number>();
  const unmatchedByDay = new Map<string, number>();
  for (const a of apify.runs) {
    const t = new Date(a.startedAt).getTime();
    const sync = windowRuns.find((r) => {
      const at = new Date(r.at).getTime();
      return at >= t - 5_000 && at - t <= 10 * 60_000;
    });
    const eur = a.usd * USD_EUR;
    if (sync) measuredBySync.set(sync.id, (measuredBySync.get(sync.id) || 0) + eur);
    else {
      const d = amsterdamDay(a.startedAt);
      unmatchedByDay.set(d, (unmatchedByDay.get(d) || 0) + eur);
    }
  }

  const syncs: SyncCostRow[] = windowRuns.map((r) => {
    const isApify = r.channel !== "lusha" && r.channel !== "freelance-nl";
    const measured = apifyOk && isApify;
    const eur = measured ? measuredBySync.get(r.id) || 0 : paid(r) ? estimateFor(r.channel) : 0;
    return {
      id: r.id,
      at: r.at,
      channel: r.channel,
      label: r.label,
      kept: r.kept,
      fetched: r.fetched,
      mode: r.mode,
      eur: round2(eur),
      measured,
    };
  });

  const aiEstimate = eurMid(SYNC_COST_PER_RUN.actions["ai-research"].eur);
  const aiCountByDay = new Map<string, number>();
  for (const at of opts.aiAt) {
    const d = amsterdamDay(at);
    aiCountByDay.set(d, (aiCountByDay.get(d) || 0) + 1);
  }

  const rows: DailyCostRow[] = dayList.map((day) => {
    const parts: Record<CostPart, number> = { boards: 0, feed: 0, ai: 0, hm: 0, other: 0 };
    let n = 0;
    for (const s of syncs) {
      if (amsterdamDay(s.at) !== day) continue;
      parts[CHANNEL_PART[s.channel] || "other"] += s.eur;
      if (s.eur > 0 || s.mode === "error") n += 1;
    }
    parts.other += unmatchedByDay.get(day) || 0;

    const led: SpendDay | undefined = ledger.days[day];
    if (led) {
      parts.ai +=
        ((led.aiUsd || 0) +
          (led.fcSearches || 0) * FIRECRAWL_SEARCH_USD +
          (led.fcScrapes || 0) * FIRECRAWL_SCRAPE_USD) *
        USD_EUR;
    } else {
      parts.ai += (aiCountByDay.get(day) || 0) * aiEstimate;
    }

    for (const k of Object.keys(parts) as CostPart[]) parts[k] = round2(parts[k]);
    const total = round2(Object.values(parts).reduce((a, b) => a + b, 0));
    return { day, parts, total, measured: apifyOk && Boolean(led || !aiCountByDay.get(day)), syncs: n };
  });

  const total = round2(rows.reduce((a, r) => a + r.total, 0));
  const activeDays = rows.filter((r) => r.total > 0).length;

  const SOURCES: { channel: string; label: string }[] = [
    { channel: "linkedin-jobs", label: "LinkedIn Jobs" },
    { channel: "indeed", label: "Indeed NL" },
    { channel: "recruiter-feed", label: "Recruiter feed" },
    { channel: "hm-search", label: "Managers zoeken" },
  ];
  const perSource = SOURCES.map((s) => {
    const list = syncs.filter((r) => r.channel === s.channel && r.eur > 0);
    const sum = list.reduce((a, r) => a + r.eur, 0);
    const kept = list.reduce((a, r) => a + r.kept, 0);
    return {
      ...s,
      runs: list.length,
      avg: list.length ? round2(sum / list.length) : estimateFor(s.channel),
      total: round2(sum),
      perKept: kept ? round2(sum / kept) : null,
      measured: list.length > 0 && list.every((r) => r.measured),
    };
  });

  const ledgerToday = ledger.days[today];
  return {
    days: rows,
    syncs: syncs.slice(-40).reverse(),
    perSource,
    total,
    avgPerDay: round2(total / days),
    avgPerActiveDay: activeDays ? round2(total / activeDays) : 0,
    activeDays,
    apify: { measured: apifyOk, error: apify.error },
    aiToday: ledgerToday
      ? {
          calls: ledgerToday.aiCalls || 0,
          webSearches: ledgerToday.webSearches || 0,
          eur: round2((ledgerToday.aiUsd || 0) * USD_EUR),
        }
      : null,
    ledgerSince: Object.keys(ledger.days).sort()[0] || null,
  };
}

export type DailyCosts = Awaited<ReturnType<typeof buildDailyCosts>>;
