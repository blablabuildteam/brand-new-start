import {
  CHANNEL_ACTION,
  INGEST_POLICY,
  PLATFORM_COST,
  ROI_MODEL,
  SYNC_COST_PER_RUN,
  estimateSpendFromRuns,
} from "@/lib/costs";
import { loadDeskMeta } from "@/lib/desk-meta";
import { loadHuntSettings } from "@/lib/hunt";
import { listAgencyLeads } from "@/lib/opportunity";
import { listSyncRuns } from "@/lib/sync-log";

type Range = { low: number; high: number };

const round = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

function addRange(a: Range, b: Range, times = 1): Range {
  return { low: a.low + b.low * times, high: a.high + b.high * times };
}

/** Zelfde regels als `estimateSpendFromRuns`, maar over een vrij venster. */
function spendSince(
  runs: { at: string; channel: string; mode?: string; fetched?: number }[],
  from: number
) {
  const lines = new Map<string, { label: string; count: number; eur: Range }>();
  let total: Range = { low: 0, high: 0 };
  let count = 0;
  for (const run of runs) {
    if (new Date(run.at).getTime() < from) continue;
    if (run.mode === "fresh" || run.mode === "skipped") continue;
    if ((run.fetched ?? 1) <= 0) continue;
    const actionId = CHANNEL_ACTION[run.channel];
    if (!actionId) continue;
    const action = SYNC_COST_PER_RUN.actions[actionId];
    if (action.eur.low === 0 && action.eur.high === 0) continue;
    count += 1;
    total = addRange(total, action.eur);
    const row = lines.get(actionId) || { label: action.label, count: 0, eur: { low: 0, high: 0 } };
    row.count += 1;
    row.eur = addRange(row.eur, action.eur);
    lines.set(actionId, row);
  }
  return { count, eur: total, lines: [...lines.values()] };
}

function aiRunsSince(at: string[], from: number) {
  return at.filter((t) => new Date(t).getTime() >= from).length;
}

function finalize(
  sync: ReturnType<typeof spendSince>,
  aiCount: number
): { count: number; eur: Range; lines: { label: string; count: number; eur: Range }[] } {
  const ai = SYNC_COST_PER_RUN.actions["ai-research"];
  const lines = [...sync.lines];
  let eur = sync.eur;
  if (aiCount) {
    const aiEur = { low: ai.eur.low * aiCount, high: ai.eur.high * aiCount };
    lines.push({ label: "AI eindklant zoeken", count: aiCount, eur: aiEur });
    eur = addRange(eur, aiEur);
  }
  return {
    count: sync.count + aiCount,
    eur: { low: round(eur.low), high: round(eur.high) },
    lines: lines
      .map((l) => ({ ...l, eur: { low: round(l.eur.low), high: round(l.eur.high) } }))
      .sort((a, b) => b.eur.high - a.eur.high),
  };
}

export async function buildCostsPayload() {
  await loadHuntSettings();
  const [runs, meta, leads] = await Promise.all([listSyncRuns(2000), loadDeskMeta(), listAgencyLeads()]);

  const aiAt = [
    ...Object.values(meta.aiGuesses).map((a) => a.at),
    ...Object.values(meta.aiMisses).map((a) => a.at),
  ].filter(Boolean);

  const firstAt = runs.length ? runs[runs.length - 1]!.at : null;
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const last30 = now - 30 * DAY;

  const allTime = finalize(spendSince(runs, 0), aiAt.length);
  const month = finalize(spendSince(runs, monthStart), aiRunsSince(aiAt, monthStart));
  const recent = finalize(spendSince(runs, last30), aiRunsSince(aiAt, last30));
  const forecast = estimateSpendFromRuns(runs).forecast;

  const recruiters = leads.watchlist.reduce((n, a) => n + a.recruiters.length, 0);
  const feedLive = leads.live.filter((l) => l.source === "feed");
  const posts30 = feedLive.filter((l) => l.postedAt && new Date(l.postedAt).getTime() >= last30).length;
  const confirmed30 = Object.values(meta.leadReviews).filter(
    (r) => r.status === "confirmed" && new Date(r.at).getTime() >= last30
  ).length;
  const feedRuns30 = runs.filter(
    (r) => r.channel === "recruiter-feed" && r.mode !== "fresh" && new Date(r.at).getTime() >= last30
  ).length;
  const boardRuns30 = runs.filter(
    (r) =>
      ["linkedin-jobs", "indeed", "freelance-nl"].includes(r.channel) &&
      r.mode !== "skipped" &&
      new Date(r.at).getTime() >= last30
  );
  const boardEur30 = boardRuns30.reduce<Range>((acc, r) => {
    const id = CHANNEL_ACTION[r.channel];
    return id ? addRange(acc, SYNC_COST_PER_RUN.actions[id].eur) : acc;
  }, { low: 0, high: 0 });

  const feedRun = SYNC_COST_PER_RUN.actions["recruiter-feeds"].eur;
  const perProfile = INGEST_POLICY.recruiterFeedMaxProfiles;

  return {
    since: firstAt,
    disclaimer: SYNC_COST_PER_RUN.disclaimer,
    allTime,
    month: { ...month, label: new Date(monthStart).toLocaleDateString("nl-NL", { month: "long" }), forecast },
    last30: recent,
    platform: {
      eur: {
        low: PLATFORM_COST.vercel.low + PLATFORM_COST.database.low,
        high: PLATFORM_COST.vercel.high + PLATFORM_COST.database.high,
      },
      note: `Vercel (${PLATFORM_COST.vercel.note.toLowerCase()}) + ${PLATFORM_COST.database.note}`,
    },
    /** Inputs voor de rekensom — gemeten over de laatste 30 dagen. */
    model: {
      recruiters,
      postsPerRecruiter30: recruiters ? round(posts30 / recruiters) : 0,
      feedRuns30,
      confirmed30,
      boardRuns30: boardRuns30.length,
      boardEur30: { low: round(boardEur30.low), high: round(boardEur30.high) },
      unit: {
        /** Eén recruiter-profiel ophalen = run-prijs / aantal profielen per run. */
        perRecruiterCheck: { low: round(feedRun.low / perProfile), high: round(feedRun.high / perProfile) },
        aiPerPost: SYNC_COST_PER_RUN.actions["ai-research"].eur,
        hmSearch: SYNC_COST_PER_RUN.actions["hm-search"].eur,
        lusha: SYNC_COST_PER_RUN.actions.lusha.eur,
      },
      aiDailyCap: INGEST_POLICY.feedAutoAiDailyEurMax,
      profilesPerRun: perProfile,
    },
    roi: {
      marginPerPlacement: ROI_MODEL.marginPerPlacement(),
      basis: `€20/u marge × ${ROI_MODEL.hoursPerWeek} u × 20 weken`,
    },
  };
}

export type CostsPayload = Awaited<ReturnType<typeof buildCostsPayload>>;
