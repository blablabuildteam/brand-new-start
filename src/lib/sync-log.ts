import { desc } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/schema";

export type SyncChannel =
  | "linkedin-jobs"
  | "indeed"
  | "freelance-nl"
  | "firecrawl-careers"
  | "tenderned"
  | "pulse"
  | "seed"
  | "specialty"
  | "hm-search";

export type SyncHit = {
  company: string;
  title: string;
  url?: string | null;
  kept: boolean;
  /** True when newly created this run (not a refresh of existing fingerprint). */
  isNew?: boolean;
};

export type SyncRun = {
  id: string;
  at: string;
  channel: SyncChannel;
  label: string;
  mode: string;
  detail?: string;
  fetched: number;
  kept: number;
  skipped?: number;
  /** Bronnen / queries die deze run heeft doorzocht */
  searched?: string[];
  hits: SyncHit[];
};

type SyncState = {
  runs: SyncRun[];
};

const g = globalThis as unknown as { __bnsSyncLog?: SyncState };

function state(): SyncState {
  if (!g.__bnsSyncLog) g.__bnsSyncLog = { runs: [] };
  return g.__bnsSyncLog;
}

function toSyncRun(row: {
  id: string;
  at: Date;
  channel: string;
  label: string;
  mode: string;
  detail: string | null;
  fetched: number;
  kept: number;
  skipped: number | null;
  searched: string[] | null;
  hits: SyncHit[];
}): SyncRun {
  return {
    id: row.id,
    at: row.at.toISOString(),
    channel: row.channel as SyncChannel,
    label: row.label,
    mode: row.mode,
    detail: row.detail || undefined,
    fetched: row.fetched,
    kept: row.kept,
    skipped: row.skipped ?? undefined,
    searched: row.searched || undefined,
    hits: row.hits || [],
  };
}

export async function recordSync(run: Omit<SyncRun, "id" | "at"> & { at?: string }) {
  const cleanHits = (run.hits || []).filter((h) => !h.kept || isCleanSyncHit(h));
  const keptClean = cleanHits.filter((h) => h.kept).length;
  const entry: SyncRun = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: run.at || new Date().toISOString(),
    channel: run.channel,
    label: run.label,
    mode: run.mode,
    detail: run.detail,
    fetched: run.fetched,
    kept: Math.min(run.kept, keptClean),
    skipped: run.skipped,
    searched: run.searched?.slice(0, 24),
    hits: cleanHits.slice(0, 40),
  };

  if (hasDatabase()) {
    const db = getDb();
    await db.insert(syncRuns).values({
      id: entry.id,
      at: new Date(entry.at),
      channel: entry.channel,
      label: entry.label,
      mode: entry.mode,
      detail: entry.detail || null,
      fetched: entry.fetched,
      kept: entry.kept,
      skipped: entry.skipped ?? null,
      searched: entry.searched || null,
      hits: entry.hits,
    });
    return entry;
  }

  const s = state();
  s.runs.unshift(entry);
  s.runs = s.runs.slice(0, 20);
  return entry;
}

export async function listSyncRuns(limit = 8) {
  if (hasDatabase()) {
    const db = getDb();
    const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.at)).limit(limit);
    return rows.map(toSyncRun).map(sanitizeSyncRun);
  }
  return state().runs.slice(0, limit).map(sanitizeSyncRun);
}

export async function lastSyncByChannel() {
  const runs = await listSyncRuns(40);
  const map: Partial<Record<SyncChannel, SyncRun>> = {};
  for (const run of runs) {
    if (!map[run.channel]) map[run.channel] = run;
  }
  return map;
}

export async function lastSyncOverall() {
  const runs = await listSyncRuns(1);
  return runs[0] || null;
}

export function channelLabel(ch: SyncChannel | string) {
  const labels: Record<string, string> = {
    "linkedin-jobs": "LinkedIn Jobs",
    indeed: "Indeed",
    "freelance-nl": "Freelance.nl",
    "firecrawl-careers": "Careers (Firecrawl)",
    tenderned: "TenderNed",
    pulse: "Team-melding",
    seed: "Demo-seed",
    specialty: "Specialisatie (eenmalig kader)",
    "hm-search": "Hiring manager zoeken",
  };
  return labels[ch] || ch;
}

/** Filter UI-/placeholder-rommel uit sync-hits (o.a. oude Freelance.nl scrapes). */
export function isCleanSyncHit(h: SyncHit): boolean {
  const company = (h.company || "").trim();
  const title = (h.title || "").trim();
  if (!title || title.length < 8 || title.length > 160) return false;
  if (/freelance\.nl|via freelance\.nl/i.test(company)) return false;
  if (
    /sorteer|relevantie|filter|cookie|inloggen|registreer|bekijk alle|pagina \d|nieuwste opdrachten|oudste opdrachten|\\\\/.test(
      title
    )
  ) {
    return false;
  }
  if (h.url && /freelance\.nl\/opdrachten\?/i.test(h.url)) return false;
  return true;
}

export function sanitizeSyncRun(run: SyncRun): SyncRun {
  const cleanHits = (run.hits || []).filter(isCleanSyncHit);
  // Oude Freelance.nl-runs: kept/fetched telden junk mee — toon schone aantallen.
  if (run.channel === "freelance-nl" && (run.hits?.length || 0) > cleanHits.length) {
    return {
      ...run,
      hits: cleanHits,
      kept: cleanHits.length,
      fetched: Math.max(run.fetched, cleanHits.length),
      detail: cleanHits.length
        ? `freelance:clean→${cleanHits.length}`
        : "freelance:geen bruikbare hits (alleen UI-rommel)",
    };
  }
  return { ...run, hits: cleanHits.length ? cleanHits : run.hits };
}
