import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { activityEvents } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth";

export type ActivityLevel = "info" | "warn" | "error";

export type ActivityKind =
  | "lead.confirm"
  | "lead.reject"
  | "lead.reopen"
  | "lead.ai"
  | "hm.search"
  | "hm.contact"
  | "crm.stage"
  | "radar.dismiss"
  | "radar.reject-company"
  | "company.park"
  | "company.unpark"
  | "sync.run"
  | "api.error"
  | "client.error"
  | string;

export type ActivityEvent = {
  id: string;
  at: string;
  actorEmail: string | null;
  actorRole: string | null;
  level: ActivityLevel;
  kind: string;
  summary: string;
  path: string | null;
  status: number | null;
  detail: Record<string, unknown> | null;
};

type MemState = { events: ActivityEvent[] };
const g = globalThis as unknown as { __bnsActivityLog?: MemState };

function mem(): MemState {
  if (!g.__bnsActivityLog) g.__bnsActivityLog = { events: [] };
  return g.__bnsActivityLog;
}

function sanitizeDetail(detail?: Record<string, unknown> | null) {
  if (!detail) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (v === undefined) continue;
    if (typeof v === "string") {
      out[k] = v.replace(/\u0000/g, "").slice(0, 400);
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((item) =>
        typeof item === "string" ? item.slice(0, 120) : item
      );
    } else if (typeof v === "object") {
      try {
        out[k] = JSON.parse(JSON.stringify(v).slice(0, 800));
      } catch {
        out[k] = "[object]";
      }
    }
  }
  return out;
}

export type LogActivityInput = {
  actorEmail?: string | null;
  actorRole?: string | null;
  level?: ActivityLevel;
  kind: ActivityKind;
  summary: string;
  path?: string | null;
  status?: number | null;
  detail?: Record<string, unknown> | null;
};

/** Fire-and-forget — mag nooit de request laten falen. */
export function logActivity(input: LogActivityInput): void {
  void writeActivity(input).catch((e) => {
    console.error("logActivity failed", e instanceof Error ? e.message : e);
  });
}

export function logFromSession(
  session: SessionUser | null | undefined,
  input: Omit<LogActivityInput, "actorEmail" | "actorRole">
): void {
  logActivity({
    ...input,
    actorEmail: session?.email ?? null,
    actorRole: session?.role ?? null,
  });
}

async function writeActivity(input: LogActivityInput): Promise<ActivityEvent> {
  const entry: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actorEmail: input.actorEmail?.slice(0, 120) ?? null,
    actorRole: input.actorRole?.slice(0, 40) ?? null,
    level: input.level || "info",
    kind: String(input.kind).slice(0, 80),
    summary: (input.summary || "").replace(/\u0000/g, "").slice(0, 280),
    path: input.path?.slice(0, 200) ?? null,
    status: input.status ?? null,
    detail: sanitizeDetail(input.detail),
  };

  if (hasDatabase()) {
    try {
      const db = getDb();
      await db.insert(activityEvents).values({
        id: entry.id,
        at: new Date(entry.at),
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        level: entry.level,
        kind: entry.kind,
        summary: entry.summary,
        path: entry.path,
        status: entry.status,
        detail: entry.detail,
      });
    } catch (e) {
      console.error("activity_events insert failed", e instanceof Error ? e.message : e);
      const s = mem();
      s.events.unshift(entry);
      s.events = s.events.slice(0, 500);
    }
    return entry;
  }

  const s = mem();
  s.events.unshift(entry);
  s.events = s.events.slice(0, 500);
  return entry;
}

export type ListActivityOpts = {
  limit?: number;
  level?: ActivityLevel | "all";
  actor?: string;
  kind?: string;
};

export async function listActivity(opts: ListActivityOpts = {}): Promise<ActivityEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const level = opts.level && opts.level !== "all" ? opts.level : null;
  const actor = opts.actor?.trim().toLowerCase() || null;
  const kind = opts.kind?.trim() || null;

  if (hasDatabase()) {
    const db = getDb();
    const clauses = [];
    if (level) clauses.push(eq(activityEvents.level, level));
    if (actor) clauses.push(sql`lower(${activityEvents.actorEmail}) = ${actor}`);
    if (kind) clauses.push(eq(activityEvents.kind, kind));

    const rows = await db
      .select()
      .from(activityEvents)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(activityEvents.at))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      level: r.level as ActivityLevel,
      kind: r.kind,
      summary: r.summary,
      path: r.path,
      status: r.status,
      detail: r.detail,
    }));
  }

  let list = mem().events.slice();
  if (level) list = list.filter((e) => e.level === level);
  if (actor) list = list.filter((e) => (e.actorEmail || "").toLowerCase() === actor);
  if (kind) list = list.filter((e) => e.kind === kind);
  return list.slice(0, limit);
}
