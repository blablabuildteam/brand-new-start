import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { databaseUrl, getDb } from "@/lib/db/client";
import { demoAnalytics, type DemoAnalyticsRow } from "@/lib/db/schema";
import { getDemoProspect, listDemoProspects } from "@/lib/demo-prospects";
import { postAlertWebhook } from "@/lib/alert-webhook";

async function ensureTable() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const sql = neon(url);
  await sql`
    CREATE TABLE IF NOT EXISTS demo_analytics (
      slug TEXT PRIMARY KEY,
      first_visit_at TIMESTAMPTZ,
      last_visit_at TIMESTAMPTZ,
      visit_count INTEGER NOT NULL DEFAULT 0,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      clicked_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
      notified_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS demo_analytics_last_visit_idx ON demo_analytics (last_visit_at DESC)`;
}

function engagementScore(row: DemoAnalyticsRow | null | undefined) {
  if (!row || !row.visitCount) return 0;
  const clicks = Object.values(row.clickedIds || {}).reduce((s, n) => s + n, 0);
  const minutes = Math.floor((row.totalSeconds || 0) / 60);
  return row.visitCount * 2 + clicks * 5 + minutes;
}

export type DemoDashboardRow = {
  slug: string;
  agencyName: string;
  contactFirstName: string;
  niche: string;
  city: string;
  opened: boolean;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  visitCount: number;
  totalSeconds: number;
  clickCount: number;
  clickedIds: Record<string, number>;
  engagement: number;
  engagementLabel: "geen" | "kort" | "actief" | "diep";
};

function labelFor(score: number, opened: boolean): DemoDashboardRow["engagementLabel"] {
  if (!opened) return "geen";
  if (score >= 20) return "diep";
  if (score >= 8) return "actief";
  return "kort";
}

export async function recordDemoVisit(slug: string): Promise<{ first: boolean }> {
  await ensureTable();
  const db = getDb();
  const now = new Date();
  const existing = await db.select().from(demoAnalytics).where(eq(demoAnalytics.slug, slug)).limit(1);
  const row = existing[0];

  if (!row) {
    await db.insert(demoAnalytics).values({
      slug,
      firstVisitAt: now,
      lastVisitAt: now,
      visitCount: 1,
      totalSeconds: 0,
      clickedIds: {},
      notifiedAt: null,
    });
    return { first: true };
  }

  await db
    .update(demoAnalytics)
    .set({
      lastVisitAt: now,
      visitCount: (row.visitCount || 0) + 1,
    })
    .where(eq(demoAnalytics.slug, slug));
  return { first: false };
}

export async function notifyFirstDemoVisit(slug: string) {
  const prospect = getDemoProspect(slug);
  if (!prospect) return;

  await ensureTable();
  const db = getDb();
  const existing = await db.select().from(demoAnalytics).where(eq(demoAnalytics.slug, slug)).limit(1);
  const row = existing[0];
  if (row?.notifiedAt) return;

  await postAlertWebhook({
    title: "Demo geopend",
    body: `${prospect.contactFirstName} · ${prospect.agencyName} (${slug})\n${prospect.niche} · ${prospect.city}`,
    href: `/admin/demos`,
  });

  await db
    .update(demoAnalytics)
    .set({ notifiedAt: new Date() })
    .where(eq(demoAnalytics.slug, slug));
}

export async function addDemoSeconds(slug: string, seconds: number) {
  if (!slug || seconds <= 0 || seconds > 120) return;
  await ensureTable();
  const db = getDb();
  const existing = await db.select().from(demoAnalytics).where(eq(demoAnalytics.slug, slug)).limit(1);
  const row = existing[0];
  if (!row) return;
  await db
    .update(demoAnalytics)
    .set({
      totalSeconds: (row.totalSeconds || 0) + seconds,
      lastVisitAt: new Date(),
    })
    .where(eq(demoAnalytics.slug, slug));
}

export async function trackDemoClick(slug: string, kansId: string) {
  if (!slug || !kansId) return;
  await ensureTable();
  const db = getDb();
  const existing = await db.select().from(demoAnalytics).where(eq(demoAnalytics.slug, slug)).limit(1);
  const row = existing[0];
  const clicks = { ...(row?.clickedIds || {}) };
  clicks[kansId] = (clicks[kansId] || 0) + 1;

  if (!row) {
    await db.insert(demoAnalytics).values({
      slug,
      firstVisitAt: new Date(),
      lastVisitAt: new Date(),
      visitCount: 1,
      totalSeconds: 0,
      clickedIds: clicks,
      notifiedAt: null,
    });
    return;
  }

  await db
    .update(demoAnalytics)
    .set({ clickedIds: clicks, lastVisitAt: new Date() })
    .where(eq(demoAnalytics.slug, slug));
}

export async function listDemoDashboard(): Promise<DemoDashboardRow[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db.select().from(demoAnalytics);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return listDemoProspects()
    .map((p) => {
      const row = bySlug.get(p.slug) || null;
      const clickCount = Object.values(row?.clickedIds || {}).reduce((s, n) => s + n, 0);
      const opened = Boolean(row?.visitCount);
      const engagement = engagementScore(row);
      return {
        slug: p.slug,
        agencyName: p.agencyName,
        contactFirstName: p.contactFirstName,
        niche: p.niche,
        city: p.city,
        opened,
        firstVisitAt: row?.firstVisitAt?.toISOString() || null,
        lastVisitAt: row?.lastVisitAt?.toISOString() || null,
        visitCount: row?.visitCount || 0,
        totalSeconds: row?.totalSeconds || 0,
        clickCount,
        clickedIds: row?.clickedIds || {},
        engagement,
        engagementLabel: labelFor(engagement, opened),
      };
    })
    .sort((a, b) => {
      if (a.opened !== b.opened) return a.opened ? -1 : 1;
      return (b.lastVisitAt || "").localeCompare(a.lastVisitAt || "");
    });
}
