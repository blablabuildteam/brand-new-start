/**
 * Bureau-lane: scrape LinkedIn feeds of watched recruiters.
 * Vacancy/kans-posts → signals (agency as company) → Bureaus desk → eindklant raden.
 * Niet op Radar als “directe eindklant”.
 */

import { watchedAgencies, watchedRecruitersFor, type Agency } from "@/lib/agency";
import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { INGEST_POLICY } from "@/lib/costs";
import { isVacancyPost, type LinkedInPost } from "@/lib/ingest/linkedin";
import { detectRoleLabel, matchesRole } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";
import { recordSync, type SyncHit } from "@/lib/sync-log";

const POSTS_ACTOR = process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-posts";

export type FeedRecruiter = {
  agency: Agency;
  name: string;
  title?: string;
  brand?: string;
  linkedinUrl: string;
};

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
  return {
    text: text.trim(),
    url: (item.url as string) || (item.postUrl as string) || undefined,
    postedAt: (item.postedAt as string) || (item.publishedAt as string) || undefined,
    raw: item,
  };
}

function postTitle(text: string): string {
  const role = detectRoleLabel(text);
  const line = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 12) || text;
  const snippet = line.replace(/\s+/g, " ").slice(0, 90);
  if (role && !snippet.toLowerCase().includes(role.toLowerCase().slice(0, 8))) {
    return `${role} — ${snippet}`;
  }
  return snippet;
}

function isRecruiterVacancyPost(text: string): boolean {
  if (isVacancyPost(text)) return true;
  const t = text.toLowerCase();
  // Typische bureau-recruiter taal (niet alleen Jeffrey/BNS)
  if (
    /#(vacature|interim|zzp|freelance)|opdracht|beschikbaar|per direct|startdatum|uren per week|uurtarief/i.test(
      t
    ) &&
    matchesRole(t)
  ) {
    return true;
  }
  return matchesRole(t) && /interim|zzp|freelance|contract|detach|inhuur|zoeken|gevraagd/i.test(t);
}

async function fetchPostsForUrls(
  urls: string[],
  maxPosts: number
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
      postedLimit: "month",
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
  run: Awaited<ReturnType<typeof recordSync>>;
}> {
  const maxRecruiters = opts?.maxRecruiters ?? INGEST_POLICY.recruiterFeedMaxProfiles;
  const maxPosts = opts?.maxPostsPerProfile ?? INGEST_POLICY.recruiterFeedMaxPosts;
  const all = listFeedRecruiters();
  const withUrl = all.length;
  const batch = all.slice(0, maxRecruiters);
  const searched = batch.map((r) => `${r.name} · ${r.agency.name}`);

  if (!batch.length) {
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
      run,
    };
  }

  try {
    // One profile per Apify call keeps attribution reliable (actor often omits author URL).
    const hits: SyncHit[] = [];
    let scanned = 0;
    let kept = 0;
    let skipped = 0;
    let vacancies = 0;
    const details: string[] = [];

    for (const rec of batch) {
      const fetched = await fetchPostsForUrls([rec.linkedinUrl], maxPosts);
      details.push(fetched.detail);
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
          run,
        };
      }

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
          });
        }
      }
    }

    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "apify",
      detail: details.slice(0, 3).join(" · "),
      fetched: scanned,
      kept,
      skipped,
      searched,
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
      searched,
      run,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "apify-error";
    const run = await recordSync({
      channel: "recruiter-feed",
      label: "Recruiter-feeds",
      mode: "error",
      detail: msg,
      fetched: 0,
      kept: 0,
      searched,
      hits: [],
    });
    return {
      mode: "error",
      detail: msg,
      scanned: 0,
      kept: 0,
      skipped: 0,
      vacancies: 0,
      recruiters: all.length,
      withUrl,
      hits: [],
      searched,
      run,
    };
  }
}
