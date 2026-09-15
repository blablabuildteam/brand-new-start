import type { ClientGuess } from "@/lib/end-client";
import { band } from "@/lib/research/agent";
import type { ResearchCandidate, ResearchReport } from "@/lib/research/types";

/**
 * Public surface of End-client Intelligence.
 * Implementation lives in src/lib/research/* (web, corpus, scoring, agent).
 */
export { researchEndClient } from "@/lib/research/agent";
export type {
  ResearchCandidate,
  ResearchDepth,
  ResearchProgress,
  ResearchReport,
  ResearchSource,
  ScoreLine,
} from "@/lib/research/types";

/** Wrap a rule/catalog match in the same report shape as a deep research run. */
export function rulesReport(guess: ClientGuess): ResearchReport {
  const top = guess.evidence[0];
  const tip = top
    ? top.quote
      ? `${guess.name} — ${top.label}: “${top.quote.replace(/\s+/g, " ").trim().slice(0, 120)}”`
      : `${guess.name} — ${top.label}`
    : `${guess.name} komt uit lokale regels/catalogus`;
  return {
    method: "rules",
    confidenceBand: band(guess.confidence),
    hypothesis: tip,
    why: "Eerste hypothese uit de vacaturetekst of catalogus-tags (locatie, sector, stack). Geen webresearch — gebruik AI voor diepere check.",
    ranking: [
      {
        name: guess.name,
        confidence: guess.confidence,
        why: guess.evidence.map((e) => e.label).join("; ") || "Catalogus-match",
        evidence: guess.evidence.map((e) => ({
          claim: e.label,
          strength: e.weight >= 70 ? ("high" as const) : e.weight >= 40 ? ("medium" as const) : ("low" as const),
          source: e.quote,
        })),
        counterEvidence: [],
      },
      ...guess.alternatives.map((a) => ({
        name: a.name,
        confidence: a.confidence,
        why: "Alternatieve catalogus-match",
        whyLower: "Lagere tag-overlap of minder zwaar bewijs",
        evidence: [] as ResearchCandidate["evidence"],
        counterEvidence: [] as string[],
      })),
    ],
    counterEvidence: ["Nog geen webresearch of tegenbewijs — start AI-research voor een diepere check."],
    timeline: [],
    sources: [],
    scoringNotes:
      "Regel-score = zwaarste bewijs + 15% van het tweede bewijs. ≥80 Voorstel, 45–79 Review, <45 Te dun. De catalogus is beperkt; AI-research weegt zwaarder.",
  };
}
