/**
 * Extra job boards — Indeed (Apify) + Freelance.nl (Firecrawl when key present).
 * LinkedIn remains primary; these fill ZZP/interim gaps.
 */

import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { isAgencyName } from "@/lib/agency";
import { detectRoleLabel, matchesContract, matchesRole } from "@/lib/niche";
import { ingestSignal, isJunkCompanyName, isJunkJobTitle } from "@/lib/store";
import { recordSync, type SyncChannel, type SyncHit } from "@/lib/sync-log";
import { INGEST_POLICY } from "@/lib/costs";
import { DEFAULT_ROLES, huntRoles, huntSettings } from "@/lib/hunt";
import { extractOrgContext, orgContextToRaw } from "@/lib/org-context";

const INDEED_ACTOR = process.env.APIFY_INDEED_ACTOR || "misceres/indeed-scraper";

/** Fallback — live sync gebruikt huntRoles() uit Instellingen. */
export const BOARD_QUERIES = DEFAULT_ROLES;

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
    if (isJunkCompanyName(job.company) || isAgencyName(job.company)) {
      skipped += 1;
      hits.push({ company: job.company || "?", title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }
    if (isJunkJobTitle(job.title)) {
      skipped += 1;
      hits.push({ company: job.company, title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }
    const blob = `${job.title} ${job.description || ""}`;
    if (!matchesRole(blob)) {
      skipped += 1;
      hits.push({ company: job.company, title: job.title, url: job.url, kept: false, isNew: false });
      continue;
    }

    const contractish = matchesContract(blob) || /contract|interim|zzp|freelance|tijdelijk/i.test(blob);
    if (huntSettings().requireContract && !contractish) {
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
    huntRoles().length
  );
  const maxItems = opts?.maxItems ?? INGEST_POLICY.syncIndeedMax;
  const queries = huntRoles().slice(0, maxQueries);
  const perQuery = Math.max(4, Math.ceil(maxItems / Math.max(1, queries.length)));

  // Eén Apify-run met alle Indeed-URL’s (i.p.v. 12× sequential — timeout/leeg op Vercel)
  const suffix = huntSettings().requireContract ? " ZZP" : "";
  const searched = queries.map((role) => `Indeed NL · ${role}${suffix}`);
  const startUrls = queries.map((role) => ({
    url: `https://nl.indeed.com/jobs?q=${encodeURIComponent(`${role}${suffix}`)}&l=Nederland`,
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

/**
 * De zoek-URL /opdrachten?zoekwoord= is een statische marketingpagina zonder
 * vacatures. Open opdrachten staan in de sitemap; de pagina zelf noemt de
 * opdrachtgever meestal niet (die zit achter een gratis login).
 */
const FREELANCE_SITEMAP = "https://www.freelance.nl/sitemaps/sitemap-projects.xml.gz";
const FREELANCE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const FREELANCE_GENERIC = new Set([
  "onze",
  "ons",
  "een",
  "deze",
  "hun",
  "de",
  "het",
  "opdrachtgever",
  "eindklant",
  "klant",
  "organisatie",
  "grote",
  "publieke",
  "sector",
  "client",
  "our",
  "the",
  "opdracht",
  "project",
  "team",
  "nederland",
  "amsterdam",
  "rotterdam",
  "utrecht",
  "haag",
  "den",
]);

function roleNeedles(role: string): string[] {
  const slug = role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return [];
  const needles = [slug];
  if (slug.includes("analist")) needles.push(slug.replace(/analist/g, "analyst"));
  if (slug.includes("analyst")) needles.push(slug.replace(/analyst/g, "analist"));
  return needles;
}

function freelanceUrlMatchesRole(url: string, roles: string[]): boolean {
  const slug = (url.split("/opdracht/")[1] || "").toLowerCase();
  const needles = roles.flatMap(roleNeedles);
  return needles.some((n) => n.length >= 4 && slug.includes(n));
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldOf(html: string, label: string): string | null {
  const re = new RegExp(`<dt>\\s*${label}\\s*:?\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`, "i");
  const m = html.match(re);
  return m ? stripTags(m[1]) : null;
}

/** Alleen een echte organisatienaam. "Onze opdrachtgever" en "een klant" tellen niet. */
function extractNamedClient(text: string): string | null {
  // Geen /i op de hele regex: dan telt [A-Z] ook kleine letters en loopt de naam
  // door tot het eind van de zin.
  const name = String.raw`[A-ZÁÉÍÓÚÄËÏÖÜ][\w&.'’\-]+(?:\s+(?:van|de|het|der|&)\s+[A-ZÁÉÍÓÚÄËÏÖÜ][\w&.'’\-]+|\s+[A-ZÁÉÍÓÚÄËÏÖÜ][\w&.'’\-]+){0,3}`;
  const patterns = [
    new RegExp(String.raw`[Oo]pdrachtgever\s*[:|]\s*(${name})`),
    new RegExp(String.raw`\b(?:[Bb]ij|[Vv]oor)\s+(?:de\s+|het\s+)?(${name})`),
  ];
  for (const re of patterns) {
    const name = re.exec(text)?.[1]?.trim().replace(/\s+/g, " ");
    if (!name || name.length < 2 || name.length > 60) continue;
    const first = name.split(/\s+/)[0]?.toLowerCase() || "";
    if (FREELANCE_GENERIC.has(first)) continue;
    if (/freelance\.nl|zzp|interim|remote|engineer|analist|analyst|architect|scrum|owner/i.test(name)) {
      continue;
    }
    return name;
  }
  return null;
}

function parseFreelancePage(html: string, url: string): BoardJob | "closed" | "hidden" | null {
  const status = fieldOf(html, "Status");
  if (!status) return null;
  if (!/gepubliceerd/i.test(status)) return "closed";
  const title = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  if (!title || !matchesRole(title)) return null;
  const descMatch = html.match(
    /project-details__description[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i
  );
  const description = stripTags(descMatch?.[1] || "");
  const location = fieldOf(html, "Op locatie");
  const company = extractNamedClient(`${title}. ${description}`);
  if (!company) return "hidden";
  const posted = fieldOf(html, "Publicatiedatum");
  let postedAt: string | undefined;
  const dm = posted?.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dm) postedAt = new Date(Date.UTC(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]))).toISOString();
  return {
    company,
    title,
    description: [description, location ? `Locatie: ${location}` : ""].filter(Boolean).join(" ").slice(0, 1200),
    url: url.split("?")[0],
    location: location || undefined,
    channel: "freelance-nl",
    postedAt,
  };
}

async function loadFreelanceSitemap(): Promise<string[]> {
  const res = await fetch(FREELANCE_SITEMAP, {
    headers: { "User-Agent": FREELANCE_UA, Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const xml =
    buf[0] === 0x1f && buf[1] === 0x8b
      ? (await import("node:zlib")).gunzipSync(buf).toString("utf8")
      : buf.toString("utf8");
  return [...xml.matchAll(/<loc>([^<]*\/opdracht\/[^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function fetchFreelanceNlJobs(maxQueries = 12): Promise<{
  jobs: BoardJob[];
  detail: string;
  scanned: number;
}> {
  const roles = huntRoles().slice(0, maxQueries);
  const maxPages = Math.min(24, Math.max(16, maxQueries));
  let urls: string[] = [];
  try {
    const all = await loadFreelanceSitemap();
    urls = all
      .filter((u) => freelanceUrlMatchesRole(u, roles))
      .sort((a, b) => {
        const id = (u: string) => Number(u.match(/\/opdracht\/(\d+)/)?.[1] || 0);
        return id(b) - id(a);
      })
      .slice(0, maxPages);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : "sitemap-error";
    return { jobs: [], detail: `freelance:${msg}`, scanned: 0 };
  }

  let open = 0;
  let hidden = 0;
  const jobs: BoardJob[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": FREELANCE_UA, Accept: "text/html" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;
        const parsed = parseFreelancePage(await res.text(), url);
        if (parsed === "closed" || parsed === null) continue;
        open += 1;
        if (parsed === "hidden") {
          hidden += 1;
          continue;
        }
        jobs.push(parsed);
      } catch {
        // één pagina mag de run niet stoppen
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, () => worker()));

  const detail =
    jobs.length > 0
      ? `freelance:${jobs.length} met publieke opdrachtgever, ${hidden} achter login`
      : hidden > 0
        ? `opdrachtgever achter login, 0 van ${open}`
        : open === 0
          ? "freelance:geen open opdrachten in de ingestelde rollen"
          : "freelance:leeg";

  return { jobs, detail, scanned: open };
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
          : huntRoles().slice(0, maxIndeedQ).map((q) => `Indeed NL · ${q}`),
        hits: indeedIngest.hits,
      })
    : null;

  let flJobs: BoardJob[] = [];
  let flDetail = "freelance:skipped";
  let flScanned = 0;
  let flIngest = { scanned: 0, kept: 0, skipped: 0, hits: [] as Awaited<ReturnType<typeof ingestBoardJobs>>["hits"] };

  if (doFreelance) {
    try {
      const fl = await fetchFreelanceNlJobs(maxFl);
      flJobs = fl.jobs;
      flDetail = fl.detail;
      flScanned = fl.scanned;
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
          : flDetail.includes("error") || flDetail.includes("sitemap")
            ? "error"
            : "empty",
        detail: flDetail,
        fetched: Math.max(flScanned, flJobs.length),
        kept: flIngest.kept,
        skipped: flScanned - flJobs.length,
        searched: huntRoles().slice(0, maxFl).map((q) => `Freelance.nl · ${q}`),
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
    queries: [...huntRoles()],
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
