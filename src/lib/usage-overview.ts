import { desc, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { activityEvents, syncRuns } from "@/lib/db/schema";
import { loadDeskMeta } from "@/lib/desk-meta";
import { loadPresence, type PresenceSession } from "@/lib/usage-presence";

const DAY = 86_400_000;
const SESSION_GAP_MS = 30 * 60_000;

export type UsageDay = {
  day: string;
  humanActions: number;
  reviews: number;
  hm: number;
  syncManual: number;
  errors: number;
  presenceMin: number;
};

export type UsageActor = {
  email: string;
  role: string | null;
  actions: number;
  lastAt: string | null;
  activeDays: number;
  presenceMin: number;
};

export type UsageFriction = {
  at: string;
  kind: string;
  summary: string;
  path: string | null;
  actorEmail: string | null;
};

export type UsageOverview = {
  generatedAt: string;
  windowDays: number;
  firstHumanAt: string | null;
  lastHumanAt: string | null;
  daysSinceLastHuman: number | null;
  humanActiveDays: number;
  totals: {
    leadConfirmed: number;
    leadRejected: number;
    hmSearches: number;
    crmStages: number;
    parked: number;
    rejectedCompanies: number;
    clientErrors: number;
    apiErrors: number;
    presenceMin: number;
    sessions: number;
  };
  actors: UsageActor[];
  days: UsageDay[];
  recentSessions: {
    email: string;
    startedAt: string;
    lastAt: string;
    minutes: number;
    paths: string[];
    pings: number;
  }[];
  friction: UsageFriction[];
  note: string;
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

function minutesBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));
}

function pushDay(map: Map<string, UsageDay>, day: string): UsageDay {
  let row = map.get(day);
  if (!row) {
    row = { day, humanActions: 0, reviews: 0, hm: 0, syncManual: 0, errors: 0, presenceMin: 0 };
    map.set(day, row);
  }
  return row;
}

function isCronSync(at: Date) {
  // Cron draait ~07:00 NL; handmatige sync zit verspreid over de dag.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "numeric", hour12: false }).format(at)
  );
  return hour === 7 || hour === 6;
}

export async function buildUsageOverview(windowDays = 60): Promise<UsageOverview> {
  const since = new Date(Date.now() - windowDays * DAY);
  const meta = await loadDeskMeta();
  const presence = await loadPresence();

  const dayMap = new Map<string, UsageDay>();
  const actorMap = new Map<string, UsageActor>();
  const humanTimes: number[] = [];
  const friction: UsageFriction[] = [];

  function touchActor(email: string, role: string | null, at: string, actions = 1, presenceMin = 0) {
    const key = email.toLowerCase();
    let a = actorMap.get(key);
    if (!a) {
      a = { email, role, actions: 0, lastAt: null, activeDays: 0, presenceMin: 0 };
      actorMap.set(key, a);
    }
    a.actions += actions;
    a.presenceMin += presenceMin;
    if (role && !a.role) a.role = role;
    if (!a.lastAt || at > a.lastAt) a.lastAt = at;
  }

  // —— Desk-meta (historisch, vóór activity-log) ——
  let leadConfirmed = 0;
  let leadRejected = 0;
  for (const r of Object.values(meta.leadReviews || {})) {
    const at = r.at;
    if (!at || new Date(at) < since) continue;
    if (r.status === "confirmed") leadConfirmed++;
    else if (r.status === "rejected") leadRejected++;
    else continue;
    humanTimes.push(new Date(at).getTime());
    const day = pushDay(dayMap, dayKey(at));
    day.humanActions++;
    day.reviews++;
    touchActor("recruiter@brandnewstart.nl", "recruiter", at);
  }

  let hmSearches = 0;
  for (const g of Object.values(meta.hmGuesses || {})) {
    const at = g.at;
    if (!at || new Date(at) < since) continue;
    hmSearches++;
    humanTimes.push(new Date(at).getTime());
    const day = pushDay(dayMap, dayKey(at));
    day.humanActions++;
    day.hm++;
    touchActor("recruiter@brandnewstart.nl", "recruiter", at);
  }

  const crmStages = Object.keys(meta.crmStages || {}).length;
  const parked = Object.keys(meta.parkedCompanies || {}).length;
  const rejectedCompanies = Object.keys(meta.rejectedCompanies || {}).length;
  for (const r of Object.values(meta.rejectedCompanies || {})) {
    if (r.at && new Date(r.at) >= since) {
      humanTimes.push(new Date(r.at).getTime());
      pushDay(dayMap, dayKey(r.at)).humanActions++;
      if (r.by) touchActor(r.by, null, r.at);
    }
  }

  // —— Activity events ——
  let clientErrors = 0;
  let apiErrors = 0;
  if (hasDatabase()) {
    const rows = await getDb()
      .select()
      .from(activityEvents)
      .where(sql`${activityEvents.at} >= ${since}`)
      .orderBy(desc(activityEvents.at))
      .limit(2000);

    for (const e of rows) {
      const at = e.at.toISOString();
      const day = pushDay(dayMap, dayKey(at));
      const human = Boolean(e.actorEmail) && e.kind !== "sync.run";
      if (human) {
        humanTimes.push(e.at.getTime());
        day.humanActions++;
        touchActor(e.actorEmail!, e.actorRole, at);
      }
      if (e.kind === "client.error" || e.kind === "api.error" || e.level === "error") {
        if (e.kind === "client.error") clientErrors++;
        if (e.kind === "api.error") apiErrors++;
        day.errors++;
        if (friction.length < 40) {
          friction.push({
            at,
            kind: e.kind,
            summary: e.summary,
            path: e.path,
            actorEmail: e.actorEmail,
          });
        }
      }
    }

    const syncs = await getDb()
      .select({ at: syncRuns.at, channel: syncRuns.channel })
      .from(syncRuns)
      .where(sql`${syncRuns.at} >= ${since}`)
      .orderBy(desc(syncRuns.at))
      .limit(500);

    for (const s of syncs) {
      if (s.channel === "hm-search") continue; // al via hmGuesses
      if (isCronSync(s.at)) continue;
      const at = s.at.toISOString();
      humanTimes.push(s.at.getTime());
      const day = pushDay(dayMap, dayKey(at));
      day.humanActions++;
      day.syncManual++;
      touchActor("recruiter@brandnewstart.nl", "recruiter", at);
    }
  }

  // —— Presence (vanaf nu) ——
  let presenceMin = 0;
  const recentSessions = presence.sessions
    .filter((s) => new Date(s.lastAt) >= since)
    .slice()
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  for (const s of recentSessions) {
    const mins = Math.max(1, minutesBetween(s.startedAt, s.lastAt) || s.pings);
    presenceMin += mins;
    const day = pushDay(dayMap, dayKey(s.startedAt));
    day.presenceMin += mins;
    touchActor(s.email, s.role, s.lastAt, 0, mins);
    humanTimes.push(new Date(s.lastAt).getTime());
  }

  for (const a of actorMap.values()) {
    const days = new Set<string>();
    for (const s of recentSessions) {
      if (s.email.toLowerCase() === a.email.toLowerCase()) days.add(dayKey(s.startedAt));
    }
    // Historisch: één recruiter-account — actieve dagen met desk-acties tellen mee.
    if (a.actions > 0) {
      for (const [day, row] of dayMap) {
        if (row.humanActions > 0) days.add(day);
      }
    }
    a.activeDays = days.size;
  }

  const humanActiveDays = [...dayMap.values()].filter((d) => d.humanActions > 0 || d.presenceMin > 0).length;
  const firstHumanAt = humanTimes.length ? new Date(Math.min(...humanTimes)).toISOString() : null;
  const lastHumanAt = humanTimes.length ? new Date(Math.max(...humanTimes)).toISOString() : null;
  const daysSinceLastHuman =
    lastHumanAt == null ? null : Math.floor((Date.now() - new Date(lastHumanAt).getTime()) / DAY);

  const days = [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, windowDays);
  const actors = [...actorMap.values()].sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    firstHumanAt,
    lastHumanAt,
    daysSinceLastHuman,
    humanActiveDays,
    totals: {
      leadConfirmed,
      leadRejected,
      hmSearches,
      crmStages,
      parked,
      rejectedCompanies,
      clientErrors,
      apiErrors,
      presenceMin,
      sessions: recentSessions.length,
    },
    actors,
    days,
    recentSessions: recentSessions.slice(0, 30).map((s) => ({
      email: s.email,
      startedAt: s.startedAt,
      lastAt: s.lastAt,
      minutes: Math.max(1, minutesBetween(s.startedAt, s.lastAt) || s.pings),
      paths: Object.keys(s.paths).sort((a, b) => (s.paths[b] || 0) - (s.paths[a] || 0)).slice(0, 6),
      pings: s.pings,
    })),
    friction: friction.slice(0, 25),
    note:
      "Menselijke desk-acties uit reviews/HM/sync + presence-pings. Cron-sync telt niet als gebruik. Presence bestaat pas vanaf deze release.",
  };
}

export function clusterSessionsFromEvents(
  events: { at: string; email: string }[],
  gapMs = SESSION_GAP_MS
): PresenceSession[] {
  const byEmail = new Map<string, { at: string }[]>();
  for (const e of events) {
    const list = byEmail.get(e.email) || [];
    list.push({ at: e.at });
    byEmail.set(e.email, list);
  }
  const out: PresenceSession[] = [];
  for (const [email, list] of byEmail) {
    list.sort((a, b) => a.at.localeCompare(b.at));
    let cur: PresenceSession | null = null;
    for (const item of list) {
      if (!cur || new Date(item.at).getTime() - new Date(cur.lastAt).getTime() > gapMs) {
        cur = {
          id: `sess_${email}_${item.at}`,
          email,
          role: null,
          startedAt: item.at,
          lastAt: item.at,
          paths: {},
          pings: 1,
        };
        out.push(cur);
      } else {
        cur.lastAt = item.at;
        cur.pings++;
      }
    }
  }
  return out;
}
