import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

type StepDef = { id: string; label: string; sec: number };

const PIPELINE: Record<ResearchDepth, StepDef[]> = {
  quick: [{ id: "read", label: "Tekst lezen", sec: 4 }],
  standard: [{ id: "read", label: "Tekst lezen", sec: 5 }],
  deep: [
    { id: "signals", label: "Vacature ontleden", sec: 8 },
    { id: "search", label: "Web zoeken", sec: 14 },
    { id: "read", label: "1 pagina lezen", sec: 8 },
    { id: "analyze", label: "Analyse", sec: 16 },
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
