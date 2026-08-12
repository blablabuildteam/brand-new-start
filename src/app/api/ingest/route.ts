import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
import { enabledPlatforms } from "@/lib/platforms";
import { ingestSignal, resetStore, stats } from "@/lib/store";
import { INGEST_POLICY } from "@/lib/costs";
import { z } from "zod";

async function authorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const session = await getSession();
  return { ok: isCron || Boolean(session), isCron };
}

/** Daily cron: LinkedIn market only. Boards = handmatig / ~1×/3d (duurder, alle rollen). */
export async function GET(req: Request) {
  const { ok } = await authorized(req);
  if (!ok && process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const market = await syncMarketJobsFromLinkedIn({
    maxUrls: INGEST_POLICY.syncMarketUrls,
    maxJobs: INGEST_POLICY.syncMarketJobs,
  });
  const specialty = await syncJeffreySpecialty(20);
  const tender = await ingestFromTenderNed();
  return NextResponse.json({
    ok: true,
    market,
    specialty,
    tender,
    boards: {
      skipped: true,
      reason: `Boards (Indeed + Freelance.nl) niet in dagelijkse cron — advies 1×/${INGEST_POLICY.boardsCadenceDays} dagen handmatig of latere cron.`,
    },
    stats: await stats(),
  });
}

export async function POST(req: Request) {
  const { ok } = await authorized(req);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action || "market";

  if (action === "reset") {
    return NextResponse.json({
      ok: true,
      stats: await resetStore(),
      specialty: getSpecialty(),
    });
  }

  if (action === "market" || action === "jobs-market") {
    const maxUrls = Number((body as { maxUrls?: number }).maxUrls) || INGEST_POLICY.syncMarketUrls;
    const maxJobs = Number((body as { maxJobs?: number }).maxJobs) || INGEST_POLICY.syncMarketJobs;
    const result = await syncMarketJobsFromLinkedIn({ maxUrls, maxJobs });
    return NextResponse.json({ ok: true, kind: "market", ...result, stats: await stats() });
  }

  if (action === "boards" || action === "indeed" || action === "freelance") {
    const result = await syncJobBoards({
      maxIndeed: Number((body as { maxIndeed?: number }).maxIndeed) || INGEST_POLICY.syncIndeedMax,
      maxIndeedQueries:
        Number((body as { maxIndeedQueries?: number }).maxIndeedQueries) ||
        INGEST_POLICY.syncIndeedQueries,
      maxFreelanceQueries:
        Number((body as { maxFreelanceQueries?: number }).maxFreelanceQueries) ||
        INGEST_POLICY.syncFreelanceQueries,
    });
    return NextResponse.json({ ok: true, kind: "boards", ...result, stats: await stats() });
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
      return NextResponse.json({ ok: true, kind: "careers", ...result, stats: await stats() });
    }

    const result = await syncPlatformCareers();
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
    return NextResponse.json({ ok: true, ...result, stats: await stats() });
  }

  if (action === "linkedin" || action === "specialty") {
    const maxPosts = Number((body as { maxPosts?: number }).maxPosts) || 40;
    const specialty = await syncJeffreySpecialty(maxPosts);
    return NextResponse.json({ ok: true, kind: "specialty", ...specialty, stats: await stats() });
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
