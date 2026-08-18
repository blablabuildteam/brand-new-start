/**
 * Extra job boards — Indeed (Apify) + Freelance.nl (Firecrawl when key present).
 * LinkedIn remains primary; these fill ZZP/interim gaps.
 */

import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { detectRoleLabel, matchesContract, matchesRole } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";
import { recordSync, type SyncChannel, type SyncHit } from "@/lib/sync-log";
import { INGEST_POLICY } from "@/lib/costs";
import { extractOrgContext, orgContextToRaw } from "@/lib/org-context";

const INDEED_ACTOR = process.env.APIFY_INDEED_ACTOR || "misceres/indeed-scraper";

/** Board hunt terms — Indeed uses role; ZZP/interim filtered in-app + keyword variants. */
export const BOARD_QUERIES = [
  "Scrum Master",
  "Agile Coach",
  "Business Analist",
  "Business Analyst",
  "Product Owner",
  "DevOps Engineer",
  "Platform Engineer",
  "Test Lead",
  "Release Train Engineer",
  "Change Manager",
  "Solution Architect",
] as const;

type BoardJob = {
  company: string;
  title: string;
  description?: string;
  url?: string;
  location?: string;
  channel: SyncChannel;
  postedAt?: string;
  applicants?: number | null;
  companyLogo?: string | null;
  jobPosterName?: string | null;
  jobPosterTitle?: string | null;
  department?: string | null;
};

async function ingestBoardJobs(jobs: BoardJob[]) {
  let scanned = 0;
  let kept = 0;
  let skipped = 0;
  const hits: SyncHit[] = [];

  for (const job of jobs) {
    scanned += 1;
    const blob = `${job.title} ${job.description || ""}`;
    if (!matchesRole(blob)) {
      skipped += 1;
      hits.push({ company: job.company, title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }

    const contractish = matchesContract(blob) || /contract|interim|zzp|freelance|tijdelijk/i.test(blob);
    if (!contractish) {
      skipped += 1;
      hits.push({ company: job.company, title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }

    const org = extractOrgContext({
      text: blob,
      raw: {
        jobPosterName: job.jobPosterName,
        jobPosterTitle: job.jobPosterTitle,
        department: job.department,
      },
    });

    const result = await ingestSignal({
      source: "job-type",
      company: job.company,
      title: job.title,
      summary: (job.description || job.title).slice(0, 480),
      evidenceUrl: job.url,
      employmentHint: "contract",
      sector: job.location,
      seenAt: new Date(),
      raw: {
        board: true,
        channel: job.channel,
        roleGuess: detectRoleLabel(blob),
        postedAt: job.postedAt || null,
        applicants: job.applicants ?? null,
        companyLogo: job.companyLogo || null,
        description: (job.description || "").slice(0, 2500) || null,
        jobPosterName: job.jobPosterName || null,
        jobPosterTitle: job.jobPosterTitle || null,
        ...orgContextToRaw(org),
      },
    });
    const ok = Boolean(result.ok);
    if (ok) kept += 1;
    else skipped += 1;
    hits.push({
      company: job.company,
      title: job.title,
      url: job.url,
      kept: ok,
      isNew: Boolean(result.created),
    });
  }

  return { scanned, kept, skipped, hits };
}

function nestedStr(item: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "string" && v.trim().length >= 2) return v.trim();
    if (v && typeof v === "object" && "name" in (v as object)) {
      const n = (v as { name?: unknown }).name;
      if (typeof n === "string" && n.trim().length >= 2) return n.trim();
    }
  }
  return null;
}

function normalizeIndeedItem(item: Record<string, unknown>): BoardJob | null {
  const title = String(item.positionName || item.title || item.jobTitle || "")
    .replace(/^Vacature:\s*/i, "")
    .replace(/\s*-\s*View vacancy\s*$/i, "")
    .trim();
  let company = String(item.company || item.companyName || "").trim();
  company = company
    .replace(/^Bekijk bedrijf:\s*/i, "")
    .replace(/\s*-\s*View company\s*$/i, "")
    .trim();
  if (!title || !company) return null;
  const jobType = Array.isArray(item.jobType)
    ? (item.jobType as string[]).join(" ")
    : String(item.jobType || "");

  const applicantsRaw = item.applicationsCount ?? item.applicantsCount ?? item.applicants;
  let applicants: number | null = null;
  if (typeof applicantsRaw === "number" && Number.isFinite(applicantsRaw)) applicants = applicantsRaw;
  else if (typeof applicantsRaw === "string") {
    const m = applicantsRaw.match(/(\d+)/);
    if (m) applicants = Number(m[1]);
  }
  const logo = String(item.companyLogo || item.companyLogoUrl || "").trim();
  const description = String(
    item.description || item.descriptionHTML || item.snippet || jobType || ""
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    company,
    title,
    description,
    url: String(item.url || item.jobUrl || item.externalApplyLink || "") || undefined,
    location: String(item.location || item.jobLocation || "") || undefined,
    channel: "indeed",
    postedAt: String(item.postedAt || item.postingDateParsed || item.pubDate || "") || undefined,
    applicants,
    companyLogo: logo.startsWith("http") ? logo : null,
    jobPosterName:
      nestedStr(item, "recruiter", "hiringManager", "postedBy", "hiringInsights") || null,
    jobPosterTitle: nestedStr(item, "recruiterTitle", "hiringManagerTitle") || null,
    department: nestedStr(item, "department", "jobCategory") || null,
  };
}

async function fetchIndeedJobs(opts?: {
  maxItems?: number;
  maxQueries?: number;
}): Promise<{ jobs: BoardJob[]; detail: string; searched: string[] }> {
  if (!hasApifyToken()) return { jobs: [], detail: "no-apify-token", searched: [] };

  const maxQueries = Math.min(
    opts?.maxQueries ?? INGEST_POLICY.syncIndeedQueries,
    BOARD_QUERIES.length
  );
  const maxItems = opts?.maxItems ?? INGEST_POLICY.syncIndeedMax;
  const queries = BOARD_QUERIES.slice(0, maxQueries);
  const perQuery = Math.max(4, Math.ceil(maxItems / Math.max(1, queries.length)));

  // Eén Apify-run met alle Indeed-URL’s (i.p.v. 12× sequential — timeout/leeg op Vercel)
  const searched = queries.map((role) => `Indeed NL · ${role} ZZP`);
  const startUrls = queries.map((role) => ({
    url: `https://nl.indeed.com/jobs?q=${encodeURIComponent(`${role} ZZP`)}&l=Nederland`,
  }));

  try {
    const { items } = await runApifyActor<Record<string, unknown>>(
      INDEED_ACTOR,
      {
        country: "NL",
        location: "Nederland",
        startUrls,
        maxItemsPerSearch: perQuery,
        maxItems: maxItems,
        parseCompanyDetails: false,
        saveOnlyUniqueItems: true,
      },
      { waitSecs: 300 }
    );

    const jobs: BoardJob[] = [];
    const seenUrls = new Set<string>();
    for (const item of items) {
      const j = normalizeIndeedItem(item);
      if (!j) continue;
      const key = (j.url || `${j.company}|${j.title}`).toLowerCase();
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      jobs.push(j);
      if (jobs.length >= maxItems) break;
    }

    return {
      jobs,
      detail: jobs.length
        ? `indeed:${queries.length}urls→${jobs.length}`
        : `indeed:empty-dataset (${queries.length} urls, 0 items)`,
      searched,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 120) : "indeed-error";
    return { jobs: [], detail: `indeed:error ${msg}`, searched };
  }
}

/** Freelance.nl is a Gatsby SPA — needs Firecrawl (or browser actor). */
function cleanFreelanceTitle(raw: string): string {
  return raw
    .replace(/\\+/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^[-*•\d.]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isJunkFreelanceTitle(title: string): boolean {
  if (title.length < 8 || title.length > 140) return true;
  return /sorteer|relevantie|filter|cookie|inloggen|registreer|bekijk alle|pagina \d|opdrachtgever|nieuwste opdrachten|oudste opdrachten|^https?:\/\//i.test(
    title
  );
}

function extractFreelanceCompany(context: string): string | null {
  const patterns = [
    /opdrachtgever[:\s|*]+([A-ZÁÉÍÓÚÄËÏÖÜ0-9][\w&.'’\- ]{1,60})/i,
    /(?:^|\n)\s*\*?\*?([A-ZÁÉÍÓÚÄËÏÖÜ][\w&.'’\- ]{2,50})\*?\*?\s*(?:\n|$)/,
  ];
  for (const re of patterns) {
    const m = context.match(re);
    const name = m?.[1]?.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (/freelance\.nl|opdrachtgever|nederland|amsterdam|rotterdam|utrecht|remote|zzp|interim/i.test(name)) {
      continue;
    }
    if (name.length < 2 || name.length > 60) continue;
    return name;
  }
  return null;
}

function parseFreelanceMarkdown(md: string, query: string): BoardJob[] {
  const jobs: BoardJob[] = [];
  const seen = new Set<string>();
  const linkRe =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?freelance\.nl\/opdracht\/(\d+)[^)\s]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) {
    const title = cleanFreelanceTitle(m[1] || "");
    const url = (m[2] || "").split("?")[0];
    if (!url || seen.has(url)) continue;
    if (isJunkFreelanceTitle(title) || !matchesRole(title)) continue;

    const start = Math.max(0, m.index - 400);
    const end = Math.min(md.length, m.index + m[0].length + 500);
    const context = md.slice(start, end);
    const company = extractFreelanceCompany(context);
    // Zonder echte opdrachtgever niet onder “Freelance.nl” bundelen — skip.
    if (!company) continue;

    seen.add(url);
    jobs.push({
      company,
      title,
      description: context.replace(/\s+/g, " ").trim().slice(0, 1200),
      url,
      channel: "freelance-nl",
    });
  }
  return jobs;
}

async function scrapeFreelanceMarkdown(url: string, key: string): Promise<string> {
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
      waitFor: 2000,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { data?: { markdown?: string } };
  return data.data?.markdown || "";
}

/** Enkele opdracht-pagina’s voor contactpersoon / afdeling (niet alle hits). */
async function enrichFreelanceDetails(jobs: BoardJob[], maxDetails: number): Promise<BoardJob[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || maxDetails <= 0) return jobs;
  const targets = jobs.filter((j) => j.url).slice(0, maxDetails);
  const extra = new Map<string, string>();
  await Promise.all(
    targets.map(async (j) => {
      try {
        const md = await scrapeFreelanceMarkdown(j.url!, key);
        if (md.length > 40) extra.set(j.url!, md);
      } catch {
        // skip
      }
    })
  );
  return jobs.map((j) => {
    const md = j.url ? extra.get(j.url) : null;
    if (!md) return j;
    return { ...j, description: md.slice(0, 2500) };
  });
}

async function fetchFreelanceNlJobs(maxQueries = 2): Promise<{ jobs: BoardJob[]; detail: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    return { jobs: [], detail: "freelance:needs-FIRECRAWL_API_KEY" };
  }

  const jobs: BoardJob[] = [];
  const queries = BOARD_QUERIES.slice(0, maxQueries);

  for (const q of queries) {
    const url = `https://www.freelance.nl/opdrachten?zoekwoord=${encodeURIComponent(q)}`;
    try {
      const md = await scrapeFreelanceMarkdown(url, key);
      jobs.push(...parseFreelanceMarkdown(md, q));
    } catch {
      // per-query ignore
    }
  }

  const byUrl = new Map<string, BoardJob>();
  for (const j of jobs) {
    if (j.url) byUrl.set(j.url, j);
  }
  const unique = [...byUrl.values()];
  const enriched = await enrichFreelanceDetails(unique, INGEST_POLICY.syncFreelanceDetails);
  return {
    jobs: enriched,
    detail: `freelance:firecrawl→${enriched.length} (+${Math.min(INGEST_POLICY.syncFreelanceDetails, unique.length)} details)`,
  };
}

export async function syncJobBoards(opts?: {
  maxIndeed?: number;
  maxIndeedQueries?: number;
  maxFreelanceQueries?: number;
  /** Alleen één bron — losse sync-rondes */
  only?: "indeed" | "freelance-nl";
}) {
  const errors: string[] = [];
  const maxFl = opts?.maxFreelanceQueries ?? INGEST_POLICY.syncFreelanceQueries;
  const maxIndeedQ = opts?.maxIndeedQueries ?? INGEST_POLICY.syncIndeedQueries;
  const only = opts?.only;
  const doIndeed = !only || only === "indeed";
  const doFreelance = !only || only === "freelance-nl";

  let indeedJobs: BoardJob[] = [];
  let indeedDetail = "indeed:skipped";
  let indeedSearched: string[] = [];
  let indeedIngest = { scanned: 0, kept: 0, skipped: 0, hits: [] as Awaited<ReturnType<typeof ingestBoardJobs>>["hits"] };

  if (doIndeed) {
    try {
      const indeed = await fetchIndeedJobs({
        maxItems: opts?.maxIndeed ?? INGEST_POLICY.syncIndeedMax,
        maxQueries: maxIndeedQ,
      });
      indeedJobs = indeed.jobs;
      indeedDetail = indeed.detail;
      indeedSearched = indeed.searched;
    } catch (e) {
      errors.push(e instanceof Error ? e.message.slice(0, 160) : "indeed-error");
      indeedDetail = "indeed:error";
    }
    indeedIngest = await ingestBoardJobs(indeedJobs);
  }

  const indeedRun = doIndeed
    ? await recordSync({
        channel: "indeed",
        label: "Indeed",
        mode: indeedJobs.length
          ? "live"
          : indeedDetail.includes("error") || indeedDetail.includes("no-apify")
            ? "error"
            : "empty",
        detail: indeedDetail,
        fetched: indeedJobs.length,
        kept: indeedIngest.kept,
        skipped: indeedIngest.skipped,
        searched: indeedSearched.length
          ? indeedSearched
          : BOARD_QUERIES.slice(0, maxIndeedQ).map((q) => `Indeed NL · ${q} ZZP`),
        hits: indeedIngest.hits,
      })
    : null;

  let flJobs: BoardJob[] = [];
  let flDetail = "freelance:skipped";
  let flIngest = { scanned: 0, kept: 0, skipped: 0, hits: [] as Awaited<ReturnType<typeof ingestBoardJobs>>["hits"] };

  if (doFreelance) {
    try {
      const fl = await fetchFreelanceNlJobs(maxFl);
      flJobs = fl.jobs;
      flDetail = fl.detail;
    } catch (e) {
      errors.push(e instanceof Error ? e.message.slice(0, 160) : "freelance-error");
      flDetail = "freelance:error";
    }
    flIngest = await ingestBoardJobs(flJobs);
  }

  const freelanceRun = doFreelance
    ? await recordSync({
        channel: "freelance-nl",
        label: "Freelance.nl",
        mode: flJobs.length
          ? "live"
          : flDetail.includes("needs-FIRECRAWL")
            ? "skipped"
            : flDetail.includes("error")
              ? "error"
              : "empty",
        detail: flDetail,
        fetched: flJobs.length,
        kept: flIngest.kept,
        skipped: flIngest.skipped,
        searched: BOARD_QUERIES.slice(0, maxFl).map((q) => `Freelance.nl · ${q}`),
        hits: flIngest.hits,
      })
    : null;

  const runs = [indeedRun, freelanceRun].filter(Boolean) as NonNullable<typeof indeedRun>[];
  const kept = runs.reduce((a, r) => a + r.kept, 0);
  const skipped = (indeedIngest.skipped || 0) + (flIngest.skipped || 0);
  const scanned = (indeedIngest.scanned || 0) + (flIngest.scanned || 0);
  const hits = runs.flatMap((r) => r.hits);
  const mode = hits.length ? "live" : errors.length ? "empty-error" : "empty";

  return {
    mode,
    queries: [...BOARD_QUERIES],
    run: runs[0] || null,
    runs,
    errors,
    scanned,
    kept,
    skipped,
    hits,
    searched: runs.flatMap((r) => r.searched || []),
  };
}
