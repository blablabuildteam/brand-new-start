/**
 * Bureau-lane: scrape LinkedIn feeds of watched recruiters.
 * Vacancy/kans-posts → signals (agency as company) → Bureaus desk → eindklant raden.
 * Niet op Radar als “directe eindklant”.
 */

import { watchedAgencies, watchedRecruitersFor, type Agency } from "@/lib/agency";
import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { INGEST_POLICY } from "@/lib/costs";
import { loadDeskMeta, saveDeskMeta, type FeedCheck } from "@/lib/desk-meta";
import { isVacancyPost, type LinkedInPost } from "@/lib/ingest/linkedin";
import { detectRoleLabel, looksLikePermanent, matchesRole } from "@/lib/niche";
import { ingestSignal, listAgencySignals } from "@/lib/store";
import { recordSync, type SyncHit } from "@/lib/sync-log";
import { plainLinkedIn } from "@/lib/plain-text";

const POSTS_ACTOR = process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-posts";

export type FeedRecruiter = {
  agency: Agency;
  name: string;
  title?: string;
  brand?: string;
  linkedinUrl: string;
};

/** Recruiters op de watchlist die nog nooit zijn opgehaald. Een nieuwe naam hoort hier, niet bij "al gecheckt". */
export function pendingFeedRecruiters(checks: Record<string, { at?: string | null } | undefined>) {
  const seen = checkedProfileUrls(checks);
  return listFeedRecruiters()
    .filter((r) => !seen.has(r.linkedinUrl))
    .map((r) => ({ name: r.name, agency: r.agency.name }));
}

function checkedProfileUrls(checks: Record<string, { at?: string | null } | undefined>) {
  const seen = new Set<string>();
  for (const [key, check] of Object.entries(checks || {})) {
    if (!check?.at) continue;
    const norm = normalizeProfileUrl(key);
    if (norm) seen.add(norm);
  }
  return seen;
}

function checkedAt(checks: Record<string, FeedCheck>, url: string): string | undefined {
  if (checks[url]?.at) return checks[url].at;
  const norm = normalizeProfileUrl(url);
  if (!norm) return undefined;
  for (const [key, check] of Object.entries(checks)) {
    if (check?.at && normalizeProfileUrl(key) === norm) return check.at;
  }
  return undefined;
}

export function listFeedRecruiters(): FeedRecruiter[] {
  const out: FeedRecruiter[] = [];
  for (const agency of watchedAgencies()) {
    for (const r of watchedRecruitersFor(agency)) {
      const url = normalizeProfileUrl(r.linkedinUrl);
      if (!url) continue;
      out.push({
        agency,
        name: r.name,
        title: r.title,
        brand: r.brand,
        linkedinUrl: url,
      });
    }
  }
  return out;
}

function normalizeProfileUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (!/linkedin\.com\/in\//i.test(u)) return null;
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (!/^\/in\/[^/]+/i.test(path)) return null;
    return `https://www.linkedin.com${path}/`;
  } catch {
    return null;
  }
}

function normalizeApifyItem(item: Record<string, unknown>): LinkedInPost | null {
  const text =
    (item.text as string) ||
    (item.content as string) ||
    (item.postText as string) ||
    (item.commentary as string) ||
    "";
  if (!text?.trim()) return null;
  const postedRaw = item.postedAt ?? item.publishedAt;
  let postedAt: string | undefined;
  if (typeof postedRaw === "string") postedAt = postedRaw;
  else if (postedRaw && typeof postedRaw === "object") {
    const o = postedRaw as { date?: string; timestamp?: number };
    if (typeof o.date === "string") postedAt = o.date;
    else if (typeof o.timestamp === "number") postedAt = new Date(o.timestamp).toISOString();
  }
  return {
    text: text.trim(),
    url:
      (item.linkedinUrl as string) ||
      (item.url as string) ||
      (item.postUrl as string) ||
      (item.shareLinkedinUrl as string) ||
      undefined,
    postedAt,
    raw: item,
  };
}

function postTitle(text: string): string {
  const plain = plainLinkedIn(text);
  const role = detectRoleLabel(plain);
  const line = plain.split(/\n/).map((l) => l.trim()).find((l) => l.length > 12) || plain;
  const snippet = line.replace(/\s+/g, " ").slice(0, 90);
  if (role && !snippet.toLowerCase().includes(role.toLowerCase().slice(0, 8))) {
    return `${role} — ${snippet}`;
  }
  return snippet;
}

function isRecruiterVacancyPost(text: string): boolean {
  if (looksLikePermanent(text)) return false;
  if (isVacancyPost(text)) return true;
  const t = text.toLowerCase();
  // Typische bureau-recruiter taal
  const hiringIntent =
    /zoek ik|zoeken we|zoeken wij|zijn we op zoek|op zoek naar|looking for|gezocht|vacature|opdrachtgever|opdrachtomschrijving|voor (een |deze )?positie|freelance |zzp|interim|inhuur|#vacature|#interim|#zzp|uurtarief|uren per week|start:\s*|inzet:/i.test(
      t
    );
  if (!hiringIntent) return false;
  // Rol in post óf software/contracting-keywords (bureau-posts noemen vaak .NET/Azure i.p.v. BA)
  if (matchesRole(t)) return true;
  return /\b(\.net|dotnet|java|python|azure|aws|devops|developer|engineer|analist|analyst|scrum|agile|architect|tester|po\b|product owner)\b/i.test(
    t
  );
}

/** Binnen dit venster is een profiel "net gecheckt": een tweede klik haalt niets op. */
const FRESH_MS = 20 * 60 * 60 * 1000;

async function fetchPostsForUrls(
  urls: string[],
  maxPosts: number,
  postedLimit: "week" | "year"
): Promise<{ posts: LinkedInPost[]; detail: string; mode: string }> {
  if (!urls.length) {
    return { posts: [], detail: "no-recruiter-urls", mode: "skipped" };
  }
  if (!hasApifyToken()) {
    return { posts: [], detail: "no-apify-token", mode: "skipped" };
  }

  const { items } = await runApifyActor<Record<string, unknown>>(
    POSTS_ACTOR,
    {
      targetUrls: urls,
      maxPosts,
      postedLimit,
    },
    { waitSecs: 180 }
  );

  const posts = items
    .map((item) => normalizeApifyItem(item))
    .filter((p): p is LinkedInPost => Boolean(p?.text));

  return {
    posts,
    detail: `actor=${POSTS_ACTOR} profiles=${urls.length} posts=${posts.length}`,
    mode: "apify",
  };
}

/** Attribute a post to a recruiter when the actor returns author URL or we ran one profile. */
function matchRecruiter(
  post: LinkedInPost,
  recruiters: FeedRecruiter[],
  single?: FeedRecruiter
): FeedRecruiter | null {
  if (single) return single;
  const raw = post.raw || {};
  const authorUrl =
    (typeof raw.authorProfileUrl === "string" && raw.authorProfileUrl) ||
    (typeof raw.authorUrl === "string" && raw.authorUrl) ||
    (typeof raw.profileUrl === "string" && raw.profileUrl) ||
    (typeof raw.url === "string" && /\/in\//i.test(raw.url) && !/activity|posts/i.test(raw.url)
      ? raw.url
      : null) ||
    null;
  const norm = normalizeProfileUrl(authorUrl);
  if (norm) {
    const hit = recruiters.find((r) => normalizeProfileUrl(r.linkedinUrl) === norm);
    if (hit) return hit;
  }
  // Fallback: if only one recruiter in this batch, attribute to them
  if (recruiters.length === 1) return recruiters[0]!;
  return null;
}

export async function syncRecruiterFeeds(opts?: {
  maxRecruiters?: number;
  maxPostsPerProfile?: number;
  /** Sla de eerste N recruiters over — zo haal je een watchlist in meerdere runs binnen de tijdslimiet. */
  offset?: number;
  /** Negeer de 20u-profielcache (Sync “Toch ophalen”). */
  force?: boolean;
}): Promise<{
  mode: string;
  detail: string;
  scanned: number;
  kept: number;
  skipped: number;
  vacancies: number;
  recruiters: number;
  withUrl: number;
  hits: SyncHit[];
  searched: string[];
  /** Profielen die binnen 20 uur al gecheckt waren en daarom niet opnieuw zijn opgehaald. */
  unchanged: number;
  run: Awaited<ReturnType<typeof recordSync>>;
}> {
  const maxRecruiters = opts?.maxRecruiters ?? INGEST_POLICY.recruiterFeedMaxProfiles;
  const maxPosts = opts?.maxPostsPerProfile ?? INGEST_POLICY.recruiterFeedMaxPosts;
  const all = listFeedRecruiters();
  const withUrl = all.length;
  const offset = Math.max(0, opts?.offset ?? 0);
  const pool = all.slice(offset);
  const meta = await loadDeskMeta();
  const known = await knownNewestByProfile(meta.feedChecks);
  const now = Date.now();
  const freshAt = (url: string) => {
    if (opts?.force) return null;
    const at = checkedAt(meta.feedChecks, url);
    if (!at) return null;
    const t = new Date(at).getTime();
    if (Number.isNaN(t) || now - t >= FRESH_MS) return null;
    return t;
  };
  // Eerst wie nog nooit is opgehaald, anders telt een nieuwe recruiter mee als "al gecheckt"
  // zodra de batch van 8 vol zit met mensen die er al stonden.
  const never = pool.filter((r) => !checkedAt(meta.feedChecks, r.linkedinUrl));
  const due = pool
    .filter((r) => checkedAt(meta.feedChecks, r.linkedinUrl) && freshAt(r.linkedinUrl) == null)
    .sort((a, b) => {
      const ta = new Date(checkedAt(meta.feedChecks, a.linkedinUrl) || 0).getTime();
      const tb = new Date(checkedAt(meta.feedChecks, b.linkedinUrl) || 0).getTime();
      return ta - tb;
    });
  const unchanged = opts?.force ? 0 : pool.filter((r) => freshAt(r.linkedinUrl) != null).length;
  const batch = [...never, ...due].slice(0, maxRecruiters);
  const searched = batch.map((r) => `${r.name} · ${r.agency.name}`);

  if (!pool.length) {
    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "skipped",
      detail: withUrl === 0 ? "geen LinkedIn-URL’s op watchlist-recruiters" : "lege batch",
      fetched: 0,
      kept: 0,
      searched,
      hits: [],
    });
    return {
      mode: "skipped",
      detail: run.detail || "skipped",
      scanned: 0,
      kept: 0,
      skipped: 0,
      vacancies: 0,
      recruiters: all.length,
      withUrl,
      hits: [],
      searched,
      unchanged: 0,
      run,
    };
  }

  if (!batch.length) {
    const detail = `Niemand opgehaald. De ${pool.length} recruiters die er al stonden zijn in de afgelopen 20 uur gecheckt.`;
    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "fresh",
      detail,
      fetched: 0,
      kept: 0,
      searched: [],
      hits: [],
    });
    return {
      mode: "fresh",
      detail,
      scanned: 0,
      kept: 0,
      skipped: 0,
      vacancies: 0,
      recruiters: all.length,
      withUrl,
      hits: [],
      searched: [],
      unchanged,
      run,
    };
  }

  const hits: SyncHit[] = [];
  let scanned = 0;
  let kept = 0;
  let skipped = 0;
  let vacancies = 0;

  try {
    // One profile per Apify call keeps attribution reliable (actor often omits author URL).
    const checks: Record<string, FeedCheck> = {};
    const pulled: string[] = [];

    for (const rec of batch) {
      const light = known.has(rec.linkedinUrl);
      const window = light ? "week" : "year";
      const fetched = await fetchPostsForUrls(
        [rec.linkedinUrl],
        light ? Math.min(4, maxPosts) : maxPosts,
        window
      );
      pulled.push(`${rec.name} · ${rec.agency.name} · ${window} · ${fetched.posts.length}`);
      if (fetched.mode === "skipped") {
        const run = await recordSync({
          channel: "recruiter-feed",
          label: "Recruiter-feeds",
          mode: "skipped",
          detail: fetched.detail,
          fetched: 0,
          kept: 0,
          searched,
          hits: [],
        });
        return {
          mode: "skipped",
          detail: fetched.detail,
          scanned: 0,
          kept: 0,
          skipped: 0,
          vacancies: 0,
          recruiters: all.length,
          withUrl,
          hits: [],
          searched,
          unchanged,
          run,
        };
      }

      checks[rec.linkedinUrl] = {
        at: new Date().toISOString(),
        newestUrl: fetched.posts[0]?.url || known.get(rec.linkedinUrl) || null,
      };

      for (const post of fetched.posts) {
        scanned += 1;
        const owner = matchRecruiter(post, batch, rec) || rec;
        if (!isRecruiterVacancyPost(post.text)) {
          skipped += 1;
          hits.push({
            company: owner.agency.name,
            title: post.text.slice(0, 60),
            url: post.url,
            kept: false,
            isNew: false,
            reason: looksLikePermanent(post.text)
              ? "vast dienstverband (interne werving)"
              : "geen vacature/kans-post",
          });
          continue;
        }
        vacancies += 1;
        const title = postTitle(post.text);
        const result = await ingestSignal({
          source: "agency-swarm",
          company: owner.agency.name,
          sector: "Recruitment",
          title,
          summary: post.text.slice(0, 1200),
          evidenceUrl: post.url || owner.linkedinUrl,
          employmentHint: "interim",
          seenAt: post.postedAt ? new Date(post.postedAt) : new Date(),
          raw: {
            channel: "recruiter-feed",
            recruiterFeed: true,
            agencyId: owner.agency.id,
            agencyName: owner.agency.name,
            jobPosterName: owner.name,
            jobPosterTitle: owner.title || owner.brand || "Recruiter",
            jobPosterProfileUrl: owner.linkedinUrl,
            description: post.text,
            postedAt: post.postedAt,
          },
        });

        if (result.ok) {
          kept += 1;
          hits.push({
            company: owner.agency.name,
            title,
            url: post.url,
            kept: true,
            isNew: Boolean(result.created),
          });
        } else {
          skipped += 1;
          hits.push({
            company: owner.agency.name,
            title,
            url: post.url,
            kept: false,
            isNew: false,
            reason:
              result.reason === "no-contract-zzp"
                ? "geen externe plaatsing (ZZP/interim/contract)"
                : result.reason === "outside-niche"
                  ? "rol buiten Instellingen"
                  : result.reason || "niet opgenomen",
          });
        }
      }
    }

    if (Object.keys(checks).length) await saveDeskMeta({ feedChecks: checks });

    const firstCount = batch.filter((r) => !known.has(r.linkedinUrl)).length;
    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "apify",
      detail: [
        firstCount ? `${firstCount} voor het eerst, posts van het afgelopen jaar` : "",
        batch.length - firstCount ? `${batch.length - firstCount} alleen posts van de laatste week` : "",
        unchanged ? `${unchanged} recent al gecheckt, niet opnieuw` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      fetched: scanned,
      kept,
      skipped,
      searched: pulled,
      hits,
    });

    return {
      mode: "apify",
      detail: run.detail || "ok",
      scanned,
      kept,
      skipped,
      vacancies,
      recruiters: all.length,
      withUrl,
      hits,
      searched: pulled,
      unchanged,
      run,
    };
  } catch (e) {
    // Drizzle zet de echte reden (constraint, encoding, type) in `cause`. Die
    // moet vooraan staan, anders verdwijnt hij achter de querytekst.
    const cause = (e as { cause?: { message?: string; detail?: string } })?.cause;
    const causeMsg = [cause?.message, cause?.detail].filter(Boolean).join(" · ");
    const base = e instanceof Error ? e.message : "apify-error";
    const msg = (causeMsg ? `${causeMsg} — ${base}` : base).slice(0, 300);
    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "error",
      detail: msg,
      fetched: scanned,
      kept,
      skipped,
      searched,
      hits,
    });
    return {
      mode: "error",
      detail: msg,
      scanned,
      kept,
      skipped,
      vacancies,
      recruiters: all.length,
      withUrl,
      hits,
      searched,
      unchanged,
      run,
    };
  }
}

/** Newest post we already stored per recruiter, so a later sync does not pull a year again. */
async function knownNewestByProfile(checks: Record<string, FeedCheck>) {
  const map = new Map<string, string | null>();
  for (const [url, check] of Object.entries(checks)) {
    const key = normalizeProfileUrl(url);
    if (key) map.set(key, check.newestUrl || null);
  }
  const signals = await listAgencySignals();
  for (const s of signals) {
    const raw = (s.raw || {}) as { jobPosterProfileUrl?: string };
    const url = normalizeProfileUrl(raw.jobPosterProfileUrl);
    if (!url || map.has(url)) continue;
    map.set(url, s.evidenceUrl || null);
  }
  return map;
}
