import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

type StepDef = { id: string; label: string; sec: number };

const PIPELINE: Record<ResearchDepth, StepDef[]> = {
  quick: [
    { id: "signals", label: "Vacature ontleden", sec: 10 },
    { id: "search", label: "Web zoeken", sec: 12 },
    { id: "read", label: "Pagina’s lezen", sec: 8 },
    { id: "analyze", label: "Eindanalyse", sec: 18 },
    { id: "score", label: "Score zetten", sec: 2 },
  ],
  standard: [
    { id: "signals", label: "Vacature ontleden", sec: 10 },
    { id: "search", label: "Web zoeken + desk-geheugen", sec: 14 },
    { id: "read", label: "Pagina’s lezen", sec: 12 },
    { id: "shortlist", label: "Shortlist maken", sec: 12 },
    { id: "verify", label: "Kandidaten checken", sec: 16 },
    { id: "analyze", label: "Eindanalyse", sec: 22 },
    { id: "score", label: "Score zetten", sec: 2 },
  ],
  deep: [
    { id: "signals", label: "Vacature ontleden", sec: 12 },
    { id: "search", label: "Web zoeken + desk-geheugen", sec: 22 },
    { id: "read", label: "Bronnen lezen", sec: 24 },
    { id: "leak", label: "Naamsporen volgen", sec: 12 },
    { id: "shortlist", label: "Shortlist maken", sec: 15 },
    { id: "verify", label: "Kandidaten verifiëren + tegenbewijs", sec: 35 },
    { id: "analyze", label: "Eindanalyse", sec: 32 },
    { id: "score", label: "Score zetten", sec: 2 },
  ],
};

export const RESEARCH_TYPICAL_SEC: Record<ResearchDepth, number> = {
  quick: PIPELINE.quick.reduce((s, x) => s + x.sec, 0),
  standard: PIPELINE.standard.reduce((s, x) => s + x.sec, 0),
  deep: PIPELINE.deep.reduce((s, x) => s + x.sec, 0),
};

export function startingProgress(depth: ResearchDepth): ResearchProgress {
  return {
    step: "start",
    label: "Research starten",
    pct: 4,
    etaSec: RESEARCH_TYPICAL_SEC[depth],
  };
}

export function createResearchProgress(
  depth: ResearchDepth,
  emit?: (p: ResearchProgress) => void
) {
  const steps = PIPELINE[depth];
  const total = steps.reduce((s, x) => s + x.sec, 0);
  const started = Date.now();
  let idx = 0;

  function report(step: StepDef, detail?: string) {
    const done = steps.slice(0, idx).reduce((s, x) => s + x.sec, 0);
    const pct = Math.min(96, Math.max(6, Math.round(((done + step.sec * 0.15) / total) * 100)));
    const plannedLeft = steps.slice(idx).reduce((s, x) => s + x.sec, 0);
    const elapsed = (Date.now() - started) / 1000;
    let eta = plannedLeft;
    if (pct > 8 && elapsed > 6) {
      const projected = elapsed * ((100 - pct) / Math.max(pct, 1));
      eta = Math.round(plannedLeft * 0.55 + projected * 0.45);
    }
    emit?.({
      step: step.id,
      label: step.label,
      detail,
      pct,
      etaSec: Math.max(4, Math.round(eta)),
    });
  }

  return {
    start(id: string, detail?: string) {
      const i = steps.findIndex((s) => s.id === id);
      if (i >= 0) idx = i;
      const step = steps[idx] ?? steps[0]!;
      report(step, detail);
    },
    done() {
      emit?.({ step: "done", label: "Klaar", pct: 100, etaSec: 0 });
    },
  };
}
