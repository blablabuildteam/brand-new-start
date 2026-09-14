import type { ResearchDepth, SearchHit, SourceTier } from "@/lib/research/types";

/**
 * Firecrawl-backed web layer with a hard budget, junk filtering and
 * source tiering. Search results are never trusted blindly: tier drives weight.
 */

const JUNK =
  /(yahoo\.com|facebook\.com|pinterest\.|tiktok\.|instagram\.|x\.com\/|twitter\.com|reddit\.com|quora\.com|imdb\.com|net-worth|networth|spielberg|celebrity|lyrics|pinterest)/i;

/** Aggregators that mostly re-post: usable as leads, weak as proof. */
const TIER3 =
  /(trabajo\.org|talent\.com|jobleads|jooble|neuvoo|careerjet|whatjobs|jobrapido|adzuna|werkzoeken\.nl|nationalevacaturebank|joblift|glassdoor)/i;

const TIER2 = /(linkedin\.com|indeed\.|freelance\.nl|hoofdkraan|striive|select\?|flextender)/i;

const TIER1_HINT = /(\/careers|\/vacatures|\/jobs|\/werken-bij|\/engineering|\/blog|aws\.amazon\.com\/solutions\/case-studies|microsoft\.com\/.*customer|tenderned|pianoo)/i;

export function tierFor(url: string): SourceTier {
  if (TIER3.test(url)) return 3;
  if (TIER2.test(url)) return 2;
  if (TIER1_HINT.test(url)) return 1;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Company-owned domains (short, non-aggregator) count as official-ish
    const parts = host.split(".");
    if (parts.length <= 3 && !TIER2.test(host) && !TIER3.test(host)) return 1;
  } catch {
    return 4;
  }
  return 4;
}

export function tierWeight(tier: SourceTier): number {
  return tier === 1 ? 1 : tier === 2 ? 0.8 : tier === 3 ? 0.45 : 0.25;
}

export type WebBudget = {
  maxSearches: number;
  maxScrapes: number;
  searches: number;
  scrapes: number;
  queries: string[];
};

export function makeBudget(depth: ResearchDepth): WebBudget {
  const caps =
    depth === "deep"
      ? { maxSearches: 26, maxScrapes: 10 }
      : depth === "standard"
        ? { maxSearches: 14, maxScrapes: 5 }
        : { maxSearches: 7, maxScrapes: 2 };
  return { ...caps, searches: 0, scrapes: 0, queries: [] };
}

export function hasWeb() {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

export async function webSearch(
  query: string,
  budget: WebBudget,
  limit = 5
): Promise<SearchHit[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return [];
  if (budget.searches >= budget.maxSearches) return [];
  budget.searches += 1;
  budget.queries.push(query);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        location: "Netherlands",
        lang: "nl",
        country: "nl",
        timeout: 20000,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { title?: string; url?: string; description?: string }[];
      web?: { title?: string; url?: string; description?: string }[];
    };
    const rows = data.data || data.web || [];
    return rows
      .filter((r) => r.url && !JUNK.test(`${r.url} ${r.title || ""}`))
      .map((r) => ({
        title: (r.title || r.url || "").slice(0, 180),
        url: r.url!,
        description: (r.description || "").slice(0, 360),
        tier: tierFor(r.url!),
      }));
  } catch {
    return [];
  }
}

export async function webScrape(url: string, budget: WebBudget): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return null;
  if (budget.scrapes >= budget.maxScrapes) return null;
  budget.scrapes += 1;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 25000,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { markdown?: string } };
    const md = data.data?.markdown?.trim();
    if (!md || md.length < 120) return null;
    return md.replace(/\n{3,}/g, "\n\n").slice(0, 4000);
  } catch {
    return null;
  }
}

/** Run several queries in parallel, dedupe by URL, keep the best tiers first. */
export async function multiSearch(
  queries: string[],
  budget: WebBudget,
  opts?: { perQuery?: number; seen?: Set<string> }
): Promise<SearchHit[]> {
  const seen = opts?.seen ?? new Set<string>();
  const perQuery = opts?.perQuery ?? 5;
  const runnable = queries.filter((q) => q.trim().length >= 10).slice(0, budget.maxSearches - budget.searches);
  if (!runnable.length) return [];

  const batches = await Promise.all(runnable.map((q) => webSearch(q, budget, perQuery)));
  const out: SearchHit[] = [];
  for (const batch of batches) {
    for (const hit of batch) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      out.push(hit);
    }
  }
  return out.sort((a, b) => a.tier - b.tier);
}

/** Scrape the most promising hits (best tier first) in parallel. */
export async function scrapeBest(
  hits: SearchHit[],
  budget: WebBudget,
  max: number
): Promise<SearchHit[]> {
  const targets = hits
    .filter((h) => !h.scraped && h.tier <= 2)
    .slice(0, Math.max(0, Math.min(max, budget.maxScrapes - budget.scrapes)));
  if (!targets.length) return [];

  const bodies = await Promise.all(targets.map((h) => webScrape(h.url, budget)));
  const done: SearchHit[] = [];
  targets.forEach((h, i) => {
    const body = bodies[i];
    if (!body) return;
    h.scraped = true;
    h.body = body;
    done.push(h);
  });
  return done;
}
