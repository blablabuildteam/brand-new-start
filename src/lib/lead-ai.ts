import { researchEndClient } from "@/lib/end-client-research";
import { INGEST_POLICY, SYNC_COST_PER_RUN } from "@/lib/costs";
import { aiDaySlotsLeft, bumpAiDaySpend } from "@/lib/desk-meta";
import { hasWebProof, leadSourceForAi, listAgencyLeads, reviewLead, saveAiGuess, saveAiMiss, type AgencyLead } from "@/lib/opportunity";
import { skipBatchResearch } from "@/lib/research/first-pass";
import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

export type LeadAiResult = {
  ok: boolean;
  detail: string;
  lead: AgencyLead | null;
  model?: string;
  report?: unknown;
  status?: number;
  error?: string;
};

export async function identifyLead(
  id: string,
  depth: ResearchDepth = "standard",
  onProgress?: (p: ResearchProgress) => void
): Promise<LeadAiResult> {
  const src = await leadSourceForAi(id);
  if (!src) return { ok: false, detail: "niet gevonden", lead: null, status: 404, error: "niet gevonden" };
  if (src.lead.status === "confirmed" || src.lead.status === "rejected") {
    return { ok: false, detail: "al beoordeeld", lead: src.lead, status: 400, error: "al beoordeeld" };
  }

  const result = await researchEndClient({
    title: src.title,
    text: src.text,
    agencyName: src.agencyName,
    recruiterName: src.lead.recruiter.name || undefined,
    signalId: src.lead.signalId || undefined,
    depth,
    onProgress,
    memory: src.memory,
    brand: src.brand,
  });

  // Telt mee voor het dagplafond — ook als de hit leeg is (zoekkosten).
  await bumpAiDaySpend(1).catch(() => undefined);

  // Search results differ per run: never let a weaker rerun erase a find we already proved online.
  const prior = src.lead.aiGuess ? src.lead.guess : null;
  if (prior && hasWebProof(prior) && (!result.guess || result.guess.confidence < prior.confidence)) {
    const now = result.guess ? `${result.guess.name} ${result.guess.confidence}%` : "niets";
    return {
      ok: true,
      detail: `Eerdere vondst met online bewijs blijft staan (nieuwe zoekronde gaf ${now}).`,
      model: result.model,
      lead: src.lead,
    };
  }

  if (!result.guess) {
    // Remember the miss so "AI alle open" doesn't pay for the same empty post again.
    const notAssignment = Boolean(result.notAssignment);
    if (result.model) await saveAiMiss(id, result.detail, notAssignment);
    const lead = notAssignment ? await reviewLead(id, "rejected") : src.lead;
    const base = lead || src.lead;
    return {
      ok: false,
      detail: result.detail,
      model: result.model,
      lead: { ...base, aiMiss: { detail: result.detail, notAssignment, at: new Date().toISOString() } },
    };
  }

  const lead = await saveAiGuess(id, result.guess, { model: result.model });
  return { ok: true, detail: result.detail, model: result.model, report: result.report, lead };
}

/** Leads the batch/auto run may still spend a search on. */
export function needsAi(l: AgencyLead) {
  return !skipBatchResearch(l) && !l.aiMiss && !l.aiGuess;
}

/**
 * After a feed sync (or catch-up): identify clients on open posts.
 * Caps: per-run max, daily € budget (conservative), wall-clock deadline.
 */
export async function autoIdentifyOpenLeads(opts: { max: number; deadline: number; parallel?: number }) {
  const slots = await aiDaySlotsLeft({
    maxEur: INGEST_POLICY.feedAutoAiDailyEurMax,
    eurPerRunHigh: SYNC_COST_PER_RUN.actions["ai-research"].eur.high,
  });
  const { live } = await listAgencyLeads();
  const open = live.filter(needsAi);
  const max = Math.min(opts.max, slots.left);
  const queue = [
    ...open.filter((l) => !l.guess),
    ...open.filter((l) => l.guess),
  ].slice(0, max);
  const out: {
    tried: number;
    found: number;
    left: number;
    max: number;
    dayUsed: number;
    dayCap: number;
    stopped: "daily-budget" | "deadline" | null;
  } = {
    tried: 0,
    found: 0,
    left: Math.max(0, open.length - queue.length),
    max,
    dayUsed: slots.used,
    dayCap: slots.cap,
    stopped: max === 0 ? "daily-budget" : null,
  };
  if (!queue.length) return out;

  const worker = async () => {
    while (queue.length && Date.now() < opts.deadline) {
      const slotsNow = await aiDaySlotsLeft({
        maxEur: INGEST_POLICY.feedAutoAiDailyEurMax,
        eurPerRunHigh: SYNC_COST_PER_RUN.actions["ai-research"].eur.high,
      });
      if (slotsNow.left <= 0) {
        out.stopped = "daily-budget";
        queue.length = 0;
        break;
      }
      const lead = queue.shift()!;
      out.tried += 1;
      const r = await identifyLead(lead.id, "standard").catch(() => null);
      if (r?.ok) out.found += 1;
    }
  };
  await Promise.all(Array.from({ length: opts.parallel ?? 3 }, worker));
  out.left += queue.length;
  if (!out.stopped && queue.length && Date.now() >= opts.deadline) out.stopped = "deadline";
  return out;
}
