import { pgTable, text, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sector: text("sector"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    source: text("source").notNull(), // tender | job-type | pulse | hm-post | stale-job | agency-swarm
    title: text("title").notNull(),
    roleLabel: text("role_label").notNull(),
    summary: text("summary").notNull(),
    evidenceUrl: text("evidence_url"),
    employmentHint: text("employment_hint"), // contract | interim | zzp | unknown
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    fingerprint: text("fingerprint").notNull(),
  },
  (t) => [
    uniqueIndex("signals_fingerprint_idx").on(t.fingerprint),
    index("signals_company_idx").on(t.companyId),
    index("signals_seen_idx").on(t.seenAt),
  ]
);

export const radarEntries = pgTable(
  "radar_entries",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    roleLabel: text("role_label").notNull(),
    status: text("status").notNull(), // hot | warm | watch | cold
    kans: integer("kans").notNull(),
    hiringManager: text("hiring_manager"),
    angle: text("angle"),
    sources: jsonb("sources").$type<string[]>().notNull(),
    factors: jsonb("factors").$type<{ label: string; points: number; source?: string }[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("radar_company_idx").on(t.companyId)]
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull(),
    label: text("label").notNull(),
    mode: text("mode").notNull(),
    detail: text("detail"),
    fetched: integer("fetched").notNull(),
    kept: integer("kept").notNull(),
    skipped: integer("skipped"),
    searched: jsonb("searched").$type<string[]>(),
    hits: jsonb("hits")
      .$type<{ company: string; title: string; url?: string | null; kept: boolean; isNew?: boolean }[]>()
      .notNull(),
  },
  (t) => [index("sync_runs_at_idx").on(t.at)]
);

/** Admin audittrail — desk-acties + API-fouten (blablabuild ops). */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    actorEmail: text("actor_email"),
    actorRole: text("actor_role"),
    level: text("level").notNull(), // info | warn | error
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    path: text("path"),
    status: integer("status"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("activity_events_at_idx").on(t.at),
    index("activity_events_level_idx").on(t.level),
    index("activity_events_kind_idx").on(t.kind),
  ]
);

export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<{
    name: string;
    market: string;
    roles: string[];
    requireContract: boolean;
    employmentKinds?: string[];
    agencies?: unknown[];
    companyIds?: string[];
    agencyIds?: string[];
    recruiterIds?: string[];
  }>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("waitlist_email_idx").on(t.email), index("waitlist_created_idx").on(t.createdAt)]
);

/** Per-prospect demo analytics (personalized /demo/[slug] links). */
export const demoAnalytics = pgTable(
  "demo_analytics",
  {
    slug: text("slug").primaryKey(),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    visitCount: integer("visit_count").notNull().default(0),
    totalSeconds: integer("total_seconds").notNull().default(0),
    clickedIds: jsonb("clicked_ids").$type<Record<string, number>>().notNull().default({}),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("demo_analytics_last_visit_idx").on(t.lastVisitAt)]
);

export type Company = typeof companies.$inferSelect;
export type DemoAnalyticsRow = typeof demoAnalytics.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type RadarEntry = typeof radarEntries.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
