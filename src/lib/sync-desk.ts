import {
  CHANNEL_ACTION,
  SYNC_COST_PER_RUN,
  SYNC_LOCK_HOURS,
  estimateSpendFromRuns,
  syncStillLocked,
} from "@/lib/costs";
import {
  channelLabel,
  lastSyncByChannel,
  listSyncRuns,
  type SyncChannel,
  type SyncRun,
} from "@/lib/sync-log";

export type SyncDeskAction =
  | "market"
  | "indeed"
  | "freelance-nl"
  | "recruiter-feeds"
  | "platforms";

export type SyncDeskSource = {
  id: SyncDeskAction;
  channel: SyncChannel;
  label: string;
  secondary: boolean;
  lastAt: string | null;
  kept: number | null;
  fetched: number | null;
  locked: boolean;
  lockedUntil: string | null;
  costEur: { low: number; high: number };
};

export type SyncDeskRecent = {
  id: string;
  at: string;
  channel: string;
  label: string;
  kept: number;
  fetched: number;
  costEur: { low: number; high: number } | null;
};

const DESK_SOURCES: {
  id: SyncDeskAction;
  channel: SyncChannel;
  label: string;
  secondary?: boolean;
}[] = [
  { id: "market", channel: "linkedin-jobs", label: "LinkedIn Jobs" },
  { id: "indeed", channel: "indeed", label: "Indeed NL" },
  { id: "freelance-nl", channel: "freelance-nl", label: "Freelance.nl" },
  { id: "recruiter-feeds", channel: "recruiter-feed", label: "Recruiter-feeds" },
  {
    id: "platforms",
    channel: "firecrawl-careers",
    label: "Careers / platforms",
    secondary: true,
  },
];

function lockedUntilIso(lastAt: string | null): string | null {
  if (!lastAt || !syncStillLocked(lastAt)) return null;
  const t = new Date(lastAt).getTime() + SYNC_LOCK_HOURS * 3_600_000;
  return new Date(t).toISOString();
}

function costForChannel(channel: string): { low: number; high: number } | null {
  const actionId = CHANNEL_ACTION[channel];
  if (!actionId) return null;
  return SYNC_COST_PER_RUN.actions[actionId].eur;
}

export async function buildSyncDeskPayload() {
  const [byChannel, recentRuns] = await Promise.all([
    lastSyncByChannel(),
    listSyncRuns(40),
  ]);
  const spent = estimateSpendFromRuns(recentRuns);

  const sources: SyncDeskSource[] = DESK_SOURCES.map((s) => {
    const run = byChannel[s.channel] || null;
    const lastAt = run?.at ?? null;
    const cost = SYNC_COST_PER_RUN.actions[s.id].eur;
    return {
      id: s.id,
      channel: s.channel,
      label: s.label,
      secondary: Boolean(s.secondary),
      lastAt,
      kept: run ? run.kept : null,
      fetched: run ? run.fetched : null,
      locked: syncStillLocked(lastAt),
      lockedUntil: lockedUntilIso(lastAt),
      costEur: cost,
    };
  });

  const recent: SyncDeskRecent[] = recentRuns.slice(0, 15).map((r: SyncRun) => ({
    id: r.id,
    at: r.at,
    channel: r.channel,
    label: channelLabel(r.channel) || r.label,
    kept: r.kept,
    fetched: r.fetched,
    costEur: costForChannel(r.channel),
  }));

  return {
    lockHours: SYNC_LOCK_HOURS,
    disclaimer: SYNC_COST_PER_RUN.disclaimer,
    sources,
    spent,
    recent,
  };
}
