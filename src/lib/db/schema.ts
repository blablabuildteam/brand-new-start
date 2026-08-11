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
  (t) => [uniqueIndex("radar_company_role_idx").on(t.companyId, t.roleLabel)]
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

export type Company = typeof companies.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type RadarEntry = typeof radarEntries.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;
