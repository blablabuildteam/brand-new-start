/**
 * Extra job boards — Indeed (Apify) + Freelance.nl (Firecrawl when key present).
 * LinkedIn remains primary; these fill ZZP/interim gaps.
 */

import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { detectRoleLabel, matchesContract, matchesRole } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";
import { recordSync, type SyncChannel, type SyncHit } from "@/lib/sync-log";
import { INGEST_POLICY } from "@/lib/costs";

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

    const result = await ingestSignal({
      source: "job-type",
      company: job.company,
      title: job.title,
      summary: (job.description || job.title).slice(0, 320),
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

  return {
    company,
    title,
    description: String(item.description || item.snippet || jobType || ""),
    url: String(item.url || item.jobUrl || item.externalApplyLink || "") || undefined,
    location: String(item.location || item.jobLocation || "") || undefined,
    channel: "indeed",
    postedAt: String(item.postedAt || item.postingDateParsed || item.pubDate || "") || undefined,
    applicants,
    companyLogo: logo.startsWith("http") ? logo : null,
  };
}

async function fetchIndeedJobs(maxItems = 12): Promise<{ jobs: BoardJob[]; detail: string }> {
  if (!hasApifyToken()) return { jobs: [], detail: "no-apify-token" };

  const day = new Date().getUTCDay();
  const role = BOARD_QUERIES[day % BOARD_QUERIES.length]!;
  // Alternate: plain role vs ZZP keyword (Indeed NL indexing)
  const position = day % 2 === 0 ? `${role} ZZP` : role;

  const { items } = await runApifyActor<Record<string, unknown>>(
    INDEED_ACTOR,
    {
      country: "NL",
      position,
      location: "Netherlands",
      maxItems,
      parseCompanyDetails: false,
      saveOnlyUniqueItems: true,
    },
    { waitSecs: 120 }
  );

  const jobs: BoardJob[] = [];
  for (const item of items) {
    const j = normalizeIndeedItem(item);
    if (j) jobs.push(j);
  }
  return { jobs, detail: `indeed:${position}→${jobs.length}` };
}

/** Freelance.nl is a Gatsby SPA — needs Firecrawl (or browser actor). */
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
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: { markdown?: string } };
      const md = data.data?.markdown || "";
      if (!matchesRole(md)) continue;

      // Pull likely assignment lines — skip UI chrome from SPA scrapes
      const lines = md
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").replace(/^[-*•]\s*/, "").trim())
        .filter(
          (l) =>
            l.length > 12 &&
            l.length < 100 &&
            matchesRole(l) &&
            !/sorteer|relevantie|filter|cookie|inloggen|registreer|opdrachtgever|bekijk alle|pagina \d/i.test(
              l
            )
        );

      for (const line of lines.slice(0, 3)) {
        jobs.push({
          company: "Freelance.nl opdrachtgever",
          title: line,
          description: `${q} · Freelance.nl · ZZP/interim opdracht`,
          url,
          channel: "freelance-nl",
        });
      }
    } catch {
      // per-query ignore
    }
  }

  return { jobs, detail: `freelance:firecrawl→${jobs.length}` };
}

export async function syncJobBoards(opts?: { maxIndeed?: number; maxFreelanceQueries?: number }) {
  const errors: string[] = [];
  const day = new Date().getUTCDay();
  const role = BOARD_QUERIES[day % BOARD_QUERIES.length]!;
  const indeedQuery = day % 2 === 0 ? `${role} ZZP` : role;
  const maxFl = opts?.maxFreelanceQueries ?? INGEST_POLICY.syncFreelanceQueries;

  let indeedJobs: BoardJob[] = [];
  let indeedDetail = "indeed:empty";
  try {
    const indeed = await fetchIndeedJobs(opts?.maxIndeed ?? INGEST_POLICY.syncIndeedMax);
    indeedJobs = indeed.jobs;
    indeedDetail = indeed.detail;
  } catch (e) {
    errors.push(e instanceof Error ? e.message.slice(0, 160) : "indeed-error");
    indeedDetail = "indeed:error";
  }

  const indeedIngest = await ingestBoardJobs(indeedJobs);
  const indeedRun = await recordSync({
    channel: "indeed",
    label: "Indeed",
    mode: indeedJobs.length ? "live" : errors.some((x) => x.includes("indeed")) ? "error" : "empty",
    detail: indeedDetail,
    fetched: indeedJobs.length,
    kept: indeedIngest.kept,
    skipped: indeedIngest.skipped,
    searched: [`Indeed NL · ${indeedQuery}`],
    hits: indeedIngest.hits,
  });

  let flJobs: BoardJob[] = [];
  let flDetail = "freelance:empty";
  try {
    const fl = await fetchFreelanceNlJobs(maxFl);
    flJobs = fl.jobs;
    flDetail = fl.detail;
  } catch (e) {
    errors.push(e instanceof Error ? e.message.slice(0, 160) : "freelance-error");
    flDetail = "freelance:error";
  }

  const flIngest = await ingestBoardJobs(flJobs);
  const freelanceRun = await recordSync({
    channel: "freelance-nl",
    label: "Freelance.nl",
    mode: flJobs.length
      ? "live"
      : flDetail.includes("needs-FIRECRAWL")
        ? "skipped"
        : "empty",
    detail: flDetail,
    fetched: flJobs.length,
    kept: flIngest.kept,
    skipped: flIngest.skipped,
    searched: BOARD_QUERIES.slice(0, maxFl).map((q) => `Freelance.nl · ${q}`),
    hits: flIngest.hits,
  });

  const kept = indeedIngest.kept + flIngest.kept;
  const skipped = indeedIngest.skipped + flIngest.skipped;
  const scanned = indeedIngest.scanned + flIngest.scanned;
  const hits = [...indeedIngest.hits, ...flIngest.hits];
  const runs = [indeedRun, freelanceRun];
  const mode = hits.length ? "live" : errors.length ? "empty-error" : "empty";

  return {
    mode,
    queries: [...BOARD_QUERIES],
    /** Primary run for backwards compat (Indeed) */
    run: indeedRun,
    runs,
    errors,
    scanned,
    kept,
    skipped,
    hits,
    searched: [
      ...(indeedRun.searched || []),
      ...(freelanceRun.searched || []),
    ],
  };
}
