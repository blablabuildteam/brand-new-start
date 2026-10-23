import { NextResponse } from "next/server";
import { getSession, isAdmin, type SessionUser } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { ingestFromTenderNed, ingestJobPayload } from "@/lib/ingest/tenderned";
import {
  learnSpecialtyFromPosts,
  syncJeffreySpecialty,
  getSpecialty,
  type LinkedInPost,
} from "@/lib/ingest/linkedin";
import { scrapeCareersWithFirecrawl, syncPlatformCareers } from "@/lib/ingest/firecrawl";
import { syncMarketJobsFromLinkedIn } from "@/lib/ingest/market-jobs";
import { syncJobBoards } from "@/lib/ingest/boards";
import { syncRecruiterFeeds, listFeedRecruiters } from "@/lib/ingest/recruiter-feeds";
import { enabledPlatforms } from "@/lib/platforms";
import { ingestSignal, resetStore, stats } from "@/lib/store";
import { INGEST_POLICY } from "@/lib/costs";
import { loadHuntSettings } from "@/lib/hunt";
import { pushAlert } from "@/lib/desk-meta";
import { z } from "zod";
import { hasAiKey } from "@/lib/ai-client";
import { autoIdentifyOpenLeads } from "@/lib/lead-ai";

function logSyncRun(
  session: SessionUser | null | undefined,
  action: string,
  summary: string,
  detail?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
  status = 200
) {
  logFromSession(session, {
    level,
    kind: level === "error" ? "api.error" : "sync.run",
    summary,
    path: "/api/ingest",
    status,
    detail: { action, ...detail },
  });
}

/** Apify Indeed/LinkedIn kan lang duren */
export const maxDuration = 300;

/** Lichte cron-caps — goedkoop houden, radar + bureau-feeds vers. */
const CRON_MARKET = { maxUrls: 8, maxJobs: 24 } as const;
const CRON_FEEDS = { maxRecruiters: 4, maxPostsPerProfile: 8 } as const;

/** Name the client of fresh feed posts before anyone opens the desk; stops well inside maxDuration. */
async function identifyFresh(startedAt: number) {
  if (!hasAiKey()) return null;
  return autoIdentifyOpenLeads({
    max: INGEST_POLICY.feedAutoAiMax,
    deadline: startedAt + 200_000,
  }).catch(() => null);
}

async function authorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const session = await getSession();
  // Iedereen die is ingelogd mag syncen. Reset blijft admin. Cron gebruikt het secret.
  return { ok: isCron || Boolean(session), isCron, session };
}

async function alertNewHits(opts: {
  kind: string;
  kept: number;
  hits?: { company: string; title: string; kept: boolean; isNew?: boolean }[];
}) {
  // `kept` counts re-seen vacancies too, so alerting on it produced a "nieuwe
  // hits" notification on every cron run even when nothing changed.
  const neu = (opts.hits || []).filter((h) => h.kept && h.isNew);
  if (!neu.length) return;
  const sample = neu
    .slice(0, 3)
    .map((h) => `${h.company}: ${h.title}`)
    .join(" · ");
  await pushAlert({
    kind: "sync",
    title: `${neu.length} ${neu.length === 1 ? "nieuwe hit" : "nieuwe hits"} (${opts.kind})`,
    body: sample || "Open Jobboards voor details.",
    href: "/radar",
  });
}

/** Vercel Cron: lichte LinkedIn-market sync (~1×/3d). */
export async function GET(req: Request) {
  const startedAt = Date.now();
  const { ok, isCron } = await authorized(req);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Handmatige health-check zonder scrape (browser/admin zonder cron-header)
  if (!isCron && req.headers.get("x-cron-run") !== "1") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        "Geen scrape. Cron draait automatisch; of POST met action=market / Sync & meer (admin).",
      stats: await stats(),
    });
  }

  await loadHuntSettings();
  const market = await syncMarketJobsFromLinkedIn(CRON_MARKET);
  await alertNewHits({
    kind: "LinkedIn",
    kept: market.kept,
    hits: market.hits,
  });

  const feeds = await syncRecruiterFeeds(CRON_FEEDS);
  await alertNewHits({
    kind: "Recruiter-feeds",
    kept: feeds.kept,
    hits: feeds.hits,
  });
  const detective = await identifyFresh(startedAt);

  logSyncRun(null, "cron", `Cron market+feeds · ${market.kept + feeds.kept} gehouden`, {
    marketKept: market.kept,
    feedsKept: feeds.kept,
  });

  return NextResponse.json({
    ok: true,
    kind: "cron-market+feeds",
    market,
    feeds,
    detective,
    stats: await stats(),
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const { ok, session } = await authorized(req);
  if (!ok) {
    return NextResponse.json(
      { error: "unauthorized", message: "Log in om te syncen." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action || "market";
  await loadHuntSettings();

  if (action === "reset") {
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "unauthorized", message: "Reset alleen voor admin." }, { status: 401 });
    }
    const storeStats = await resetStore();
    logSyncRun(session, action, "Store reset", {});
    return NextResponse.json({
      ok: true,
      stats: storeStats,
      specialty: getSpecialty(),
    });
  }

  if (action === "market" || action === "jobs-market") {
    const maxUrls = Number((body as { maxUrls?: number }).maxUrls) || INGEST_POLICY.syncMarketUrls;
    const maxJobs = Number((body as { maxJobs?: number }).maxJobs) || INGEST_POLICY.syncMarketJobs;
    const result = await syncMarketJobsFromLinkedIn({ maxUrls, maxJobs });
    await alertNewHits({ kind: "LinkedIn", kept: result.kept, hits: result.hits });
    logSyncRun(session, "market", `Sync LinkedIn · ${result.kept} gehouden`, {
      scanned: "scanned" in result ? result.scanned : undefined,
      kept: result.kept,
    });
    return NextResponse.json({ ok: true, kind: "market", ...result, stats: await stats() });
  }

  if (action === "boards" || action === "indeed" || action === "freelance" || action === "freelance-nl") {
    const only =
      action === "indeed"
        ? ("indeed" as const)
        : action === "freelance" || action === "freelance-nl"
          ? ("freelance-nl" as const)
          : undefined;
    const result = await syncJobBoards({
      only,
      maxIndeed: Number((body as { maxIndeed?: number }).maxIndeed) || INGEST_POLICY.syncIndeedMax,
      maxIndeedQueries:
        Number((body as { maxIndeedQueries?: number }).maxIndeedQueries) ||
        INGEST_POLICY.syncIndeedQueries,
      maxFreelanceQueries:
        Number((body as { maxFreelanceQueries?: number }).maxFreelanceQueries) ||
        INGEST_POLICY.syncFreelanceQueries,
    });
    await alertNewHits({
      kind: only === "indeed" ? "Indeed" : only === "freelance-nl" ? "Freelance.nl" : "Boards",
      kept: result.kept,
      hits: result.hits,
    });
    logSyncRun(session, only || "boards", `Sync ${only || "boards"} · ${result.kept} gehouden`, {
      scanned: result.scanned,
      kept: result.kept,
    });
    return NextResponse.json({
      ok: true,
      kind: only || "boards",
      ...result,
      stats: await stats(),
    });
  }

  if (action === "platforms" || action === "careers") {
    const schema = z.object({
      urls: z.array(z.string().url()).optional(),
      usePlatforms: z.boolean().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.urls?.length && parsed.data.usePlatforms === false) {
      const result = await scrapeCareersWithFirecrawl(parsed.data.urls);
      logSyncRun(session, "careers", `Sync careers · ${result.kept ?? 0} gehouden`, {
        kept: result.kept,
        scanned: "scanned" in result ? result.scanned : undefined,
      });
      return NextResponse.json({ ok: true, kind: "careers", ...result, stats: await stats() });
    }

    const result = await syncPlatformCareers();
    logSyncRun(session, "platforms", `Sync platforms · ${result.kept ?? 0} gehouden`, {
      kept: result.kept,
      scanned: "scanned" in result ? result.scanned : undefined,
    });
    return NextResponse.json({
      ok: true,
      kind: "platforms",
      ...result,
      platforms: enabledPlatforms().map((p) => ({
        id: p.id,
        company: p.company,
        careersUrl: p.careersUrl,
      })),
      stats: await stats(),
    });
  }

  if (action === "tenderned") {
    const result = await ingestFromTenderNed();
    logSyncRun(session, action, `Sync TenderNed · ${result.kept ?? 0} gehouden`, {
      fetched: result.fetched,
      kept: result.kept,
    });
    return NextResponse.json({ ok: true, ...result, stats: await stats() });
  }

  if (action === "linkedin" || action === "specialty") {
    const maxPosts = Number((body as { maxPosts?: number }).maxPosts) || 40;
    const specialty = await syncJeffreySpecialty(maxPosts);
    logSyncRun(session, "specialty", "Sync specialty", { maxPosts });
    return NextResponse.json({ ok: true, kind: "specialty", ...specialty, stats: await stats() });
  }

  if (
    action === "recruiter-feeds" ||
    action === "bureau-feeds" ||
    action === "feeds" ||
    action === "recruiters"
  ) {
    const result = await syncRecruiterFeeds({
      maxRecruiters:
        Number((body as { maxRecruiters?: number }).maxRecruiters) ||
        INGEST_POLICY.recruiterFeedMaxProfiles,
      maxPostsPerProfile:
        Number((body as { maxPostsPerProfile?: number }).maxPostsPerProfile) ||
        INGEST_POLICY.recruiterFeedMaxPosts,
      offset: Number((body as { offset?: number }).offset) || 0,
      force: Boolean((body as { force?: boolean }).force),
    });
    await alertNewHits({ kind: "Recruiter-feeds", kept: result.kept, hits: result.hits });
    const detective = await identifyFresh(startedAt);
    logSyncRun(session, "recruiter-feeds", `Sync recruiter-feeds · ${result.kept} gehouden`, {
      scanned: result.scanned,
      kept: result.kept,
      force: Boolean((body as { force?: boolean }).force),
    });
    return NextResponse.json({
      ok: true,
      kind: "recruiter-feeds",
      feedRecruiters: listFeedRecruiters().length,
      ...result,
      detective,
      stats: await stats(),
    });
  }

  /** Inhaal-AI op open posts — zelfde caps als na feed-sync (N + €/dag · ≤15d). */
  if (action === "ai-catchup") {
    if (!hasAiKey()) {
      logSyncRun(session, action, "AI-catchup · key ontbreekt", { detail: "no-anthropic-key" }, "error", 503);
      return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt", detail: "no-anthropic-key" }, { status: 503 });
    }
    try {
      const detective = await autoIdentifyOpenLeads({
        max: INGEST_POLICY.feedAutoAiMax,
        deadline: startedAt + 280_000,
        parallel: 3,
      });
      let storeStats = null;
      try {
        storeStats = await stats();
      } catch (e) {
        storeStats = { error: e instanceof Error ? e.message : "stats-failed" };
      }
      logSyncRun(session, action, "AI-catchup klaar", {
        identified: (detective as { identified?: number } | null)?.identified,
      });
      return NextResponse.json({ ok: true, kind: "ai-catchup", detective, stats: storeStats });
    } catch (e) {
      const message = e instanceof Error ? e.message : "ai-catchup-failed";
      const stack = e instanceof Error ? e.stack?.split("\n").slice(0, 6) : undefined;
      console.error("ai-catchup failed", message, stack);
      logSyncRun(session, action, `AI-catchup mislukt · ${message.slice(0, 120)}`, { error: message, stack }, "error", 500);
      return NextResponse.json({ ok: false, error: message, stack }, { status: 500 });
    }
  }

  if (action === "linkedin-paste") {
    const schema = z.object({
      posts: z.array(
        z.object({
          text: z.string().min(20),
          url: z.string().optional(),
          postedAt: z.string().optional(),
        })
      ),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const specialty = learnSpecialtyFromPosts(parsed.data.posts as LinkedInPost[], {
      mode: "paste",
    });
    return NextResponse.json({ ok: true, kind: "specialty", ...specialty, stats: await stats() });
  }

  if (action === "jobs") {
    const schema = z.object({
      jobs: z.array(
        z.object({
          company: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          url: z.string().optional(),
          employmentType: z.string().optional(),
        })
      ),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await ingestJobPayload(parsed.data.jobs);
    return NextResponse.json({ ok: true, ...result, stats: await stats() });
  }

  if (action === "pulse") {
    const schema = z.object({
      company: z.string().min(1),
      note: z.string().min(1),
      roleHint: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await ingestSignal({
      source: "pulse",
      company: parsed.data.company,
      title: `Pulse: ${parsed.data.roleHint || "rol"} · ${parsed.data.company}`,
      summary: parsed.data.note,
    });
    return NextResponse.json({ ok: true, result, stats: await stats() });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
