import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { matchesContract, matchesRole, detectRoleLabel } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";
import { recordSync, type SyncHit } from "@/lib/sync-log";
import { INGEST_POLICY } from "@/lib/costs";
import { extractOrgContext, orgContextToRaw } from "@/lib/org-context";

const JOBS_ACTOR =
  process.env.APIFY_JOBS_ACTOR || "curious_coder/linkedin-jobs-scraper";

export type MarketJob = {
  company: string;
  title: string;
  description?: string;
  url?: string;
  location?: string;
  employmentType?: string;
  postedAt?: string;
  applicants?: number | null;
  companyLogo?: string | null;
  jobPosterName?: string | null;
  jobPosterTitle?: string | null;
  jobPosterProfileUrl?: string | null;
  jobFunction?: string | null;
  department?: string | null;
};

function parseApplicants(item: Record<string, unknown>): number | null {
  const raw =
    item.applicantsCount ??
    item.applicationsCount ??
    item.numApplicants ??
    item.applicants ??
    item.numberOfApplicants ??
    item.applicantCount;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const m = raw.replace(/[.,\s]/g, " ").match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function parseLogo(item: Record<string, unknown>): string | null {
  const logo =
    (item.companyLogo as string) ||
    (item.companyLogoUrl as string) ||
    (item.logo as string) ||
    (item.logoUrl as string) ||
    ((item.company as { logo?: string; logoUrl?: string })?.logo) ||
    ((item.company as { logo?: string; logoUrl?: string })?.logoUrl) ||
    "";
  const s = String(logo || "").trim();
  if (!s) return null;
  if (s.startsWith("http") || s.startsWith("//")) return s.startsWith("//") ? `https:${s}` : s;
  return null;
}

function normalizeJobItem(item: Record<string, unknown>): MarketJob | null {
  const title =
    (item.title as string) ||
    (item.jobTitle as string) ||
    (item.position as string) ||
    "";
  const company =
    (item.companyName as string) ||
    (item.company as string) ||
    ((item.company as { name?: string })?.name) ||
    "";
  if (!title || !company) return null;

  return {
    company: String(company).trim(),
    title: String(title).trim(),
    description:
      (item.description as string) ||
      (item.jobDescription as string) ||
      (item.descriptionText as string) ||
      "",
    url:
      (item.link as string) ||
      (item.url as string) ||
      (item.jobUrl as string) ||
      (item.applyUrl as string) ||
      undefined,
    employmentType:
      (item.contractType as string) ||
      (item.employmentType as string) ||
      (item.workplaceType as string) ||
      "",
    location: (item.location as string) || (item.formattedLocation as string) || undefined,
    postedAt:
      (item.postedAt as string) ||
      (item.publishedAt as string) ||
      (item.postedDate as string) ||
      (item.postedTime as string) ||
      (item.postingDateParsed as string) ||
      undefined,
    applicants: parseApplicants(item),
    companyLogo: parseLogo(item),
    jobPosterName:
      (item.jobPosterName as string) ||
      (item.posterName as string) ||
      (item.postedBy as string) ||
      null,
    jobPosterTitle: (item.jobPosterTitle as string) || (item.posterTitle as string) || null,
    jobPosterProfileUrl:
      (item.jobPosterProfileUrl as string) || (item.posterProfileUrl as string) || null,
    jobFunction: (item.jobFunction as string) || null,
    department: (item.department as string) || (item.jobDepartment as string) || null,
  };
}

/** Fixed BNS hunt queries — not Jeffrey feed. Slimme NL contracting-search. */
export const MARKET_SEARCH_QUERIES = [
  { role: "Scrum Master", extras: ["ZZP", "interim", "contract"] },
  { role: "Scrummaster", extras: ["ZZP", "interim"] },
  { role: "Agile Coach", extras: ["ZZP", "interim"] },
  { role: "Business Analist", extras: ["ZZP", "interim"] },
  { role: "Business Analyst", extras: ["contract", "ZZP"] },
  { role: "Product Owner", extras: ["ZZP", "interim"] },
  { role: "DevOps Engineer", extras: ["contract", "ZZP"] },
  { role: "Platform Engineer", extras: ["contract", "interim"] },
  { role: "Project Manager", extras: ["interim", "ZZP"] },
  { role: "Test Lead", extras: ["interim", "ZZP"] },
  { role: "Release Train Engineer", extras: ["interim", "SAFe"] },
  { role: "Change Manager", extras: ["interim", "ZZP"] },
  { role: "Interim Manager", extras: ["agile", "digital"] },
  { role: "Node.js", extras: ["ZZP", "freelance"] },
  { role: "Solution Architect", extras: ["interim", "ZZP"] },
] as const;

/** Rotate role families daily so capped Apify runs still cover the niche. */
export function buildLinkedInJobSearchUrls(maxUrls = 8): { url: string; query: string }[] {
  const day = new Date().getUTCDay();
  const rotated = [
    ...MARKET_SEARCH_QUERIES.slice(day % MARKET_SEARCH_QUERIES.length),
    ...MARKET_SEARCH_QUERIES.slice(0, day % MARKET_SEARCH_QUERIES.length),
  ];

  const out: { url: string; query: string }[] = [];
  for (const q of rotated) {
    out.push({
      query: `${q.role} · contract NL`,
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q.role)}&location=Netherlands&f_JT=C&f_TPR=r2592000&sortBy=DD`,
    });
    if (out.length >= maxUrls) break;

    const extra = q.extras[0];
    out.push({
      query: `${q.role} ${extra} NL`,
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${q.role} ${extra}`)}&location=Netherlands&f_TPR=r2592000&sortBy=DD`,
    });
    if (out.length >= maxUrls) break;
  }
  return out.slice(0, maxUrls);
}

export async function ingestMarketJobs(
  jobs: MarketJob[],
  channelMeta?: { channel?: string }
) {
  let scanned = 0;
  let kept = 0;
  let skipped = 0;
  const hits: SyncHit[] = [];

  for (const job of jobs) {
    scanned += 1;
    const blob = `${job.title} ${job.description || ""} ${job.employmentType || ""}`;
    if (!matchesRole(blob)) {
      skipped += 1;
      hits.push({ company: job.company, title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }

    const contractish =
      matchesContract(blob) ||
      /contract|interim|zzp|temp|freelance/i.test(job.employmentType || "");
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
        jobPosterProfileUrl: job.jobPosterProfileUrl,
        jobFunction: job.jobFunction,
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
        market: true,
        channel: channelMeta?.channel || "linkedin-jobs",
        roleGuess: detectRoleLabel(blob),
        postedAt: job.postedAt || null,
        applicants: job.applicants ?? null,
        companyLogo: job.companyLogo || null,
        employmentType: job.employmentType || null,
        description: (job.description || "").slice(0, 2500) || null,
        jobPosterName: job.jobPosterName || null,
        jobPosterTitle: job.jobPosterTitle || null,
        jobPosterProfileUrl: job.jobPosterProfileUrl || null,
        jobFunction: job.jobFunction || null,
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

export async function syncMarketJobsFromLinkedIn(opts?: {
  maxUrls?: number;
  maxJobs?: number;
}) {
  const maxUrls = opts?.maxUrls ?? INGEST_POLICY.syncMarketUrls;
  const searches = buildLinkedInJobSearchUrls(maxUrls);
  const urls = searches.map((s) => s.url);

  if (!hasApifyToken()) {
    const run = await recordSync({
      channel: "linkedin-jobs",
      label: "LinkedIn Jobs",
      mode: "skipped",
      detail: "no-apify-token",
      fetched: 0,
      kept: 0,
      searched: searches.map((s) => s.query),
      hits: [],
    });
    return {
      mode: "skipped" as const,
      detail: "no-apify-token",
      urls,
      queries: searches,
      run,
      scanned: 0,
      kept: 0,
      skipped: 0,
      hits: [],
    };
  }

  try {
    const { items } = await runApifyActor<Record<string, unknown>>(JOBS_ACTOR, {
      urls,
      maxJobs: opts?.maxJobs ?? INGEST_POLICY.syncMarketJobs,
      count: opts?.maxJobs ?? INGEST_POLICY.syncMarketJobs,
      scrapeCompany: false,
    });

    const jobs: MarketJob[] = [];
    for (const item of items) {
      const j = normalizeJobItem(item);
      if (j) jobs.push(j);
      const nested = item.jobs;
      if (Array.isArray(nested)) {
        for (const n of nested) {
          const nj = normalizeJobItem(n as Record<string, unknown>);
          if (nj) jobs.push(nj);
        }
      }
    }

    const result = await ingestMarketJobs(jobs, { channel: "linkedin-jobs" });
    const run = await recordSync({
      channel: "linkedin-jobs",
      label: "LinkedIn Jobs",
      mode: "apify",
      detail: `actor=${JOBS_ACTOR}`,
      fetched: jobs.length,
      kept: result.kept,
      skipped: result.skipped,
      searched: searches.map((s) => s.query),
      hits: result.hits,
    });

    return {
      mode: "apify" as const,
      detail: run.detail,
      urls,
      queries: searches,
      run,
      ...result,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "apify-error";
    const run = await recordSync({
      channel: "linkedin-jobs",
      label: "LinkedIn Jobs",
      mode: "error",
      detail: msg,
      fetched: 0,
      kept: 0,
      searched: searches.map((s) => s.query),
      hits: [],
    });
    return {
      mode: "error" as const,
      detail: msg,
      urls,
      queries: searches,
      run,
      scanned: 0,
      kept: 0,
      skipped: 0,
      hits: [],
    };
  }
}
