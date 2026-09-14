import { tierWeight } from "@/lib/research/web";
import type {
  CandidateEvidence,
  ResearchCandidate,
  ScoreFactorId,
  ScoreLine,
  SourceTier,
} from "@/lib/research/types";

/**
 * Deterministic scoring.
 *
 * Product thesis: a name-leak is trivial (~100%). The tool earns its keep when
 * the vacancy is anonymous and we still reach high confidence from distinctive
 * public signals (programme name, rare stack+city+sector, bureau history).
 */

const WEIGHTS: Record<ScoreFactorId, { points: number; label: string }> = {
  // Trivial path — not what we optimise for.
  explicit_name: { points: 100, label: "Eindklant met naam / naamlek" },

  // Anonymous path — this is the product.
  project_match: { points: 28, label: "Onderscheidend project/programma" },
  modernization: { points: 22, label: "Publiek moderniseringstraject" },
  stack_match: { points: 18, label: "Exacte stack-match" },
  city_match: { points: 18, label: "Exacte stad" },
  sector_match: { points: 18, label: "Zelfde sector" },
  recruiter_history: { points: 20, label: "Bureau/recruiter-historie" },
  cloud_match: { points: 14, label: "Cloudprovider bevestigd" },
  timeline_match: { points: 10, label: "Tijdlijn past" },
  hybrid_match: { points: 5, label: "Hybride/kantoorbeleid past" },
  multi_hire: { points: 5, label: "Meerdere developers gezocht" },

  cloud_mismatch: { points: -25, label: "Andere cloudprovider" },
  stack_mismatch: { points: -20, label: "Technologie wijkt af" },
  no_public_trace: { points: -25, label: "Geen publiek spoor gevonden" },
  city_mismatch: { points: -18, label: "Verkeerde stad" },
  sector_mismatch: { points: -15, label: "Verkeerde sector" },
  timeline_conflict: { points: -15, label: "Tijdlijn conflicteert" },
  office_mismatch: { points: -5, label: "Kantoorbeleid wijkt af" },
};

const STRENGTH_MULTIPLIER = { high: 1, medium: 0.75, low: 0.4 } as const;

/**
 * Anonymous-only curve (name-leaks bypass this and go to ~100).
 * Distinctive programme + city + stack (~64) → ~88.
 * Three solid signals (~50) → ~82. Thin single hint stays <55.
 */
function anonymousRawToConfidence(raw: number): number {
  if (raw <= 0) return 12;
  const table: [number, number][] = [
    [0, 12],
    [15, 40],
    [28, 58],
    [40, 72],
    [55, 82],
    [70, 88],
    [90, 92],
    [110, 95],
  ];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1]!;
    const [x2, y2] = table[i]!;
    if (raw <= x2) {
      const t = (raw - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return 96;
}

export type ScoredCandidate = ResearchCandidate & {
  score: { raw: number; lines: ScoreLine[] };
};

function scoreOne(
  evidence: CandidateEvidence[],
  counterEvidence: string[],
  tierBySource: (source?: string) => SourceTier
): { raw: number; lines: ScoreLine[]; positives: number; bestTier: SourceTier; named: boolean } {
  const lines: ScoreLine[] = [];
  const seen = new Map<ScoreFactorId, number>();
  let raw = 0;
  let positives = 0;
  let bestTier: SourceTier = 4;
  let named = false;

  for (const e of evidence) {
    const factor = e.factor && WEIGHTS[e.factor] ? e.factor : inferFactor(e.claim);
    if (!factor) continue;

    const times = seen.get(factor) ?? 0;
    // Anonymous cases need stacking room: second independent claim of the same
    // kind still counts (e.g. two different project phrases).
    const repeat = times === 0 ? 1 : times === 1 ? 0.45 : 0;
    if (repeat === 0) continue;
    seen.set(factor, times + 1);

    const base = WEIGHTS[factor];
    const strength = STRENGTH_MULTIPLIER[e.strength] ?? 0.75;
    const tier = tierBySource(e.source);
    if (tier < bestTier) bestTier = tier;

    const reliability =
      base.points <= 0 || factor === "explicit_name" ? 1 : Math.max(0.55, tierWeight(tier));
    const points = Math.round(base.points * strength * reliability * repeat);
    if (points > 0) positives += 1;
    if (factor === "explicit_name" && points > 0) named = true;
    raw += points;
    lines.push({
      factor,
      label: base.label,
      points,
      note: e.claim.slice(0, 160),
    });
  }

  for (const c of counterEvidence) {
    const factor = inferFactor(c, true);
    if (!factor || seen.has(factor)) continue;
    seen.set(factor, 1);
    const base = WEIGHTS[factor];
    if (!base || base.points >= 0) continue;
    raw += base.points;
    lines.push({ factor, label: base.label, points: base.points, note: c.slice(0, 160) });
  }

  return { raw, lines, positives, bestTier, named };
}

const FACTOR_HINTS: [RegExp, ScoreFactorId][] = [
  [/expliciet|met naam genoemd|naamlek|noemt de (?:eind)?klant/i, "explicit_name"],
  [/azure|aws|gcp|google cloud/i, "cloud_match"],
  [/\.net|java|python|sap|salesforce|kubernetes|stack/i, "stack_match"],
  [/arnhem|amsterdam|utrecht|rotterdam|den haag|eindhoven|stad|locatie|gevestigd/i, "city_match"],
  [/sector|branche|financ|zorg|overheid|energie|payments|retail|haven/i, "sector_match"],
  [/recruiter|bureau|eerder(?:e)? (?:vacature|opdracht)|historie|eigen desk/i, "recruiter_history"],
  [/programma|platform|project|migratie|opschaling|asset life|alc\b|fuse/i, "project_match"],
  [/moderniser|modernization|transformat/i, "modernization"],
  [/timing|tijdlijn|startdatum|periode|looptijd/i, "timeline_match"],
  [/hybride|kantoordag|dagen op kantoor|remote/i, "hybrid_match"],
  [/meerdere (?:developers|engineers|mensen)|team ?uitbreiding/i, "multi_hire"],
];

const COUNTER_HINTS: [RegExp, ScoreFactorId][] = [
  [/azure in plaats van aws|andere cloud|gebruikt (?:juist )?azure|geen aws|wel azure/i, "cloud_mismatch"],
  [/andere (?:stad|locatie)|niet in |verkeerde stad/i, "city_mismatch"],
  [/andere sector|verkeerde sector|niet actief in/i, "sector_mismatch"],
  [/andere (?:stack|technolog)|geen \.net|geen java/i, "stack_mismatch"],
  [/tijdlijn|timing (?:klopt|past) niet|conflict/i, "timeline_conflict"],
  [/kantoorbeleid|volledig remote|5 dagen/i, "office_mismatch"],
  [/geen (?:publiek|openbaar) (?:spoor|bewijs)|niets gevonden|geen bronnen|niet gevonden/i, "no_public_trace"],
];

function inferFactor(text: string, counter = false): ScoreFactorId | null {
  const hints = counter ? COUNTER_HINTS : FACTOR_HINTS;
  for (const [re, id] of hints) {
    if (re.test(text)) return id;
  }
  if (counter) return null;
  return "project_match";
}

/** Count how many independent anonymous signal families fire. */
function anonymousFamilies(lines: ScoreLine[]): number {
  const families = new Set<string>();
  for (const l of lines) {
    if (l.points <= 0) continue;
    if (l.factor === "explicit_name") continue;
    if (l.factor === "project_match" || l.factor === "modernization") families.add("project");
    else if (l.factor === "stack_match" || l.factor === "cloud_match") families.add("stack");
    else if (l.factor === "city_match") families.add("place");
    else if (l.factor === "sector_match") families.add("sector");
    else if (l.factor === "recruiter_history") families.add("history");
    else families.add(l.factor);
  }
  return families.size;
}

/**
 * Score + normalise a candidate set.
 * Name-leak → ~100. Anonymous multi-signal → high. Thin hints stay low.
 */
export function scoreCandidates(
  candidates: ResearchCandidate[],
  opts: {
    tierBySource: (source?: string) => SourceTier;
    hasWebEvidence: boolean;
    hasInternalEvidence: boolean;
    cityKnown?: boolean;
  }
): ScoredCandidate[] {
  const scored = candidates.map((c) => ({
    c,
    ...scoreOne(c.evidence, c.counterEvidence, opts.tierBySource),
  }));

  const cityDiscriminates =
    Boolean(opts.cityKnown) && scored.some((s) => s.lines.some((l) => l.factor === "city_match"));
  if (cityDiscriminates) {
    for (const s of scored) {
      if (s.named || s.lines.some((l) => l.factor === "city_match" || l.factor === "city_mismatch")) continue;
      s.lines.push({
        factor: "city_mismatch",
        label: "Standplaats niet bevestigd",
        points: -12,
        note: "Geen bron koppelt deze organisatie aan de genoemde stad/regio",
      });
      s.raw -= 12;
    }
  }

  // For anonymous scoring, strip the explicit_name weight out of the raw used
  // for ranking against others — name-leak cases are handled separately below.
  const anonRaw = (s: (typeof scored)[number]) =>
    s.named ? Math.max(0, s.raw - (WEIGHTS.explicit_name.points || 100)) : s.raw;

  const masses = scored.map((s) => Math.max(0, s.named ? 1000 + anonRaw(s) : anonRaw(s)));
  const total = masses.reduce((a, b) => a + b, 0);
  const bestAnon = Math.max(0, ...scored.map(anonRaw));
  const secondAnon = [...scored.map(anonRaw)].sort((a, b) => b - a)[1] ?? 0;
  const clearAnonLeader = bestAnon > 0 && bestAnon >= secondAnon + 15;

  const out: ScoredCandidate[] = scored.map((s, i) => {
    const modelConf = Math.round(s.c.confidence);
    const families = anonymousFamilies(s.lines);
    const share = total > 0 ? (masses[i]! / total) * 100 : 100 / Math.max(1, scored.length);
    const isAnonLeader = clearAnonLeader && anonRaw(s) === bestAnon && !s.named;
    const isNamedLeader = s.named && masses[i] === Math.max(...masses);

    // ── Trivial path: naamlek / expliciete naam ──
    if (s.named && isNamedLeader) {
      return {
        ...s.c,
        modelConfidence: modelConf,
        confidence: 100,
        score: { raw: s.raw, lines: s.lines },
      };
    }
    if (s.named) {
      // Named but not the top name-leak (shouldn't happen often)
      return {
        ...s.c,
        modelConfidence: modelConf,
        confidence: Math.min(95, Math.max(70, Math.round(0.5 * modelConf + 40))),
        score: { raw: s.raw, lines: s.lines },
      };
    }

    // ── Product path: anonymous OSINT ──
    const detConf = anonymousRawToConfidence(anonRaw(s));
    const gap = isAnonLeader ? bestAnon - secondAnon : 0;
    let confidence = 0.65 * detConf + 0.2 * share + 0.15 * modelConf;

    const hasProjectHigh = s.lines.some(
      (l) => (l.factor === "project_match" || l.factor === "modernization") && l.points >= 18
    );
    const hasPlace = s.lines.some((l) => l.factor === "city_match" && l.points > 0);
    const hasStackOrSector = s.lines.some(
      (l) => (l.factor === "stack_match" || l.factor === "sector_match" || l.factor === "cloud_match") && l.points > 0
    );

    // High anonymous confidence only when the lead is decisive *and* distinctive.
    // A thin 3-family match with a close runner-up must NOT get a 88% floor.
    if (isAnonLeader && hasProjectHigh && hasPlace && hasStackOrSector && gap >= 22) {
      confidence = Math.max(confidence, 86);
    }
    if (isAnonLeader && hasProjectHigh && hasPlace && families >= 4 && gap >= 28) {
      confidence = Math.max(confidence, 90);
    }

    // Guardrails — keep thin / contested guesses humble
    if (!opts.hasWebEvidence && !opts.hasInternalEvidence) confidence = Math.min(confidence, 55);
    if (families < 2) confidence = Math.min(confidence, 55);
    if (families < 3) confidence = Math.min(confidence, 68);
    if (!hasProjectHigh) confidence = Math.min(confidence, 72);
    if (isAnonLeader && gap < 12) confidence = Math.min(confidence, 70);
    if (s.bestTier > 2 && !hasProjectHigh) confidence = Math.min(confidence, 65);
    if (s.raw <= 0) confidence = Math.min(confidence, 25);

    return {
      ...s.c,
      modelConfidence: modelConf,
      confidence: Math.max(5, Math.min(95, Math.round(confidence))),
      score: { raw: s.raw, lines: s.lines },
    };
  });

  return out.sort((a, b) => b.confidence - a.confidence);
}

export function scoringExplainer(opts: {
  queries: number;
  searches: number;
  scrapes: number;
  internalMatches: number;
  rounds: number;
}) {
  return [
    `Naamlek/expliciete naam = 100% (triviaal). De productscore is de anonieme route: onderscheidend programma +28, modernisering +22, bureau-historie +20, stad/sector/stack +18.`,
    `Drie onafhankelijke signaalfamilies (project + plaats + stack/sector) bij een duidelijke koploper → ≥85–90%. Dunne hints blijven <60%.`,
    `Onderzoek: ${opts.rounds} rondes · ${opts.queries} queries · ${opts.searches} searches · ${opts.scrapes} pagina's · ${opts.internalMatches} eigen matches.`,
  ].join(" ");
}
