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
  | "specialty";

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
  const entry: SyncRun = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: run.at || new Date().toISOString(),
    channel: run.channel,
    label: run.label,
    mode: run.mode,
    detail: run.detail,
    fetched: run.fetched,
    kept: run.kept,
    skipped: run.skipped,
    searched: run.searched?.slice(0, 24),
    hits: run.hits.slice(0, 40),
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
    return rows.map(toSyncRun);
  }
  return state().runs.slice(0, limit);
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
    "freelance-nl": "Freelancer.nl",
    "firecrawl-careers": "Careers (Firecrawl)",
    tenderned: "TenderNed",
    pulse: "Team-melding",
    seed: "Demo-seed",
    specialty: "Specialisatie (eenmalig kader)",
  };
  return labels[ch] || ch;
}
