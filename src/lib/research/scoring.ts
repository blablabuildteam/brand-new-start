import { tierWeight } from "@/lib/research/web";
import type {
  CandidateEvidence,
  ResearchCandidate,
  ScoreFactorId,
  ScoreLine,
  SourceTier,
} from "@/lib/research/types";

/**
 * Deterministic scoring. The model supplies evidence, the code supplies the
 * weights — so a number can always be explained and stays comparable
 * between runs.
 */

const WEIGHTS: Record<ScoreFactorId, { points: number; label: string }> = {
  explicit_name: { points: 42, label: "Eindklant expliciet genoemd / naamlek" },
  project_match: { points: 20, label: "Projectbeschrijving matcht" },
  stack_match: { points: 20, label: "Exacte stack-match" },
  cloud_match: { points: 15, label: "Cloudprovider bevestigd" },
  city_match: { points: 15, label: "Exacte stad" },
  sector_match: { points: 15, label: "Zelfde sector" },
  recruiter_history: { points: 15, label: "Bureau/recruiter-historie" },
  modernization: { points: 15, label: "Publiek moderniseringstraject" },
  timeline_match: { points: 10, label: "Tijdlijn past" },
  hybrid_match: { points: 5, label: "Hybride/kantoorbeleid past" },
  multi_hire: { points: 5, label: "Meerdere developers gezocht" },

  cloud_mismatch: { points: -25, label: "Andere cloudprovider" },
  stack_mismatch: { points: -20, label: "Technologie wijkt af" },
  no_public_trace: { points: -20, label: "Geen publiek spoor gevonden" },
  city_mismatch: { points: -15, label: "Verkeerde stad" },
  sector_mismatch: { points: -15, label: "Verkeerde sector" },
  timeline_conflict: { points: -15, label: "Tijdlijn conflicteert" },
  office_mismatch: { points: -5, label: "Kantoorbeleid wijkt af" },
};

const STRENGTH_MULTIPLIER = { high: 1, medium: 0.7, low: 0.4 } as const;

/**
 * Raw points → confidence.
 * Design: a name-leak alone (~35) should already feel strong (~78).
 * Name + city/stack (~65) → mid-80s. Multi-signal without a name (~50) → ~72.
 * Thin hints stay in the 30–50 band.
 */
function rawToConfidence(raw: number): number {
  if (raw <= 0) return 12;
  const table: [number, number][] = [
    [0, 12],
    [15, 38],
    [25, 52],
    [35, 78],
    [50, 84],
    [65, 88],
    [85, 91],
    [110, 94],
  ];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1]!;
    const [x2, y2] = table[i]!;
    if (raw <= x2) {
      const t = (raw - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return 95;
}

export type ScoredCandidate = ResearchCandidate & {
  score: { raw: number; lines: ScoreLine[] };
};

function scoreOne(
  evidence: CandidateEvidence[],
  counterEvidence: string[],
  tierBySource: (source?: string) => SourceTier
): { raw: number; lines: ScoreLine[]; positives: number; bestTier: SourceTier } {
  const lines: ScoreLine[] = [];
  const seen = new Map<ScoreFactorId, number>();
  let raw = 0;
  let positives = 0;
  let bestTier: SourceTier = 4;

  for (const e of evidence) {
    const factor = e.factor && WEIGHTS[e.factor] ? e.factor : inferFactor(e.claim);
    if (!factor) continue;

    // Diminishing returns instead of a hard dedupe: repeating an argument adds
    // a little, but a third phrasing of the same point adds nothing.
    const times = seen.get(factor) ?? 0;
    const repeat = times === 0 ? 1 : times === 1 ? 0.35 : 0;
    if (repeat === 0) continue;
    seen.set(factor, times + 1);

    const base = WEIGHTS[factor];
    const strength = STRENGTH_MULTIPLIER[e.strength] ?? 0.7;
    const tier = tierBySource(e.source);
    if (tier < bestTier) bestTier = tier;

    // An explicit name in the vacancy needs no external source — we hold the
    // primary document. Everything else is discounted by source reliability,
    // but never below half: a weak citation is still an argument.
    const reliability =
      base.points <= 0 || factor === "explicit_name" ? 1 : Math.max(0.5, tierWeight(tier));
    const points = Math.round(base.points * strength * reliability * repeat);
    if (points > 0) positives += 1;
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

  return { raw, lines, positives, bestTier };
}

const FACTOR_HINTS: [RegExp, ScoreFactorId][] = [
  [/expliciet|met naam genoemd|noemt de (?:eind)?klant/i, "explicit_name"],
  [/azure|aws|gcp|google cloud/i, "cloud_match"],
  [/\.net|java|python|sap|salesforce|kubernetes|stack/i, "stack_match"],
  [/arnhem|amsterdam|utrecht|rotterdam|den haag|eindhoven|stad|locatie|gevestigd/i, "city_match"],
  [/sector|branche|financ|zorg|overheid|energie|payments|retail/i, "sector_match"],
  [/recruiter|bureau|eerder(?:e)? (?:vacature|opdracht)|historie/i, "recruiter_history"],
  [/programma|platform|project|migratie|opschaling/i, "project_match"],
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

/**
 * Score + normalise a candidate set.
 * `hasWebEvidence` gates the high bands: no public trace, no high confidence.
 */
export function scoreCandidates(
  candidates: ResearchCandidate[],
  opts: {
    tierBySource: (source?: string) => SourceTier;
    hasWebEvidence: boolean;
    hasInternalEvidence: boolean;
    /** Set when the vacancy names a city/region — then location is a hard filter. */
    cityKnown?: boolean;
  }
): ScoredCandidate[] {
  const scored = candidates.map((c) => ({
    c,
    ...scoreOne(c.evidence, c.counterEvidence, opts.tierBySource),
  }));

  // Standplaats is a hard requirement in NL contracting — but only penalise a
  // missing city when someone else *did* match it. Otherwise the signal is
  // simply absent and deflating everyone equally tells us nothing.
  const cityDiscriminates =
    Boolean(opts.cityKnown) && scored.some((s) => s.lines.some((l) => l.factor === "city_match"));
  if (cityDiscriminates) {
    for (const s of scored) {
      if (s.lines.some((l) => l.factor === "city_match" || l.factor === "city_mismatch")) continue;
      s.lines.push({
        factor: "city_mismatch",
        label: "Standplaats niet bevestigd",
        points: -12,
        note: "Geen bron koppelt deze organisatie aan de genoemde stad/regio",
      });
      s.raw -= 12;
    }
  }

  const masses = scored.map((s) => Math.max(0, s.raw));
  const total = masses.reduce((a, b) => a + b, 0);
  const bestRaw = Math.max(0, ...masses);
  const secondRaw = [...masses].sort((a, b) => b - a)[1] ?? 0;
  const clearLeader = bestRaw > 0 && bestRaw >= secondRaw + 18;

  const out: ScoredCandidate[] = scored.map((s, i) => {
    const modelConf = Math.round(s.c.confidence);
    const detConf = rawToConfidence(s.raw);
    const share = total > 0 ? (masses[i]! / total) * 100 : 100 / Math.max(1, scored.length);
    const named = s.lines.some((l) => l.factor === "explicit_name" && l.points > 0);
    const independent = s.positives >= 2;
    const strongCase = named || (independent && s.raw >= 45);
    const isLeader = clearLeader && masses[i] === bestRaw;

    // Strong evidence is owned by the deterministic score. Share only separates
    // near-ties; the model may nudge, but never pull a name-leak down into "review".
    let confidence = strongCase
      ? 0.72 * detConf + 0.18 * Math.max(share, isLeader ? 70 : share) + 0.1 * modelConf
      : 0.5 * detConf + 0.25 * share + 0.25 * modelConf;

    if (named && isLeader) confidence = Math.max(confidence, 82);
    if (named && independent && isLeader) confidence = Math.max(confidence, 88);
    if (!named && independent && isLeader && s.raw >= 50) confidence = Math.max(confidence, 74);

    // Guardrails against confident nonsense — not against good hits.
    const officialish = s.bestTier <= 2 || named;
    if (!opts.hasWebEvidence && !opts.hasInternalEvidence && !named) confidence = Math.min(confidence, 52);
    if (!independent && !named) confidence = Math.min(confidence, 58);
    if (!officialish) confidence = Math.min(confidence, 72);
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
    `Score = vaste gewichten per bewijsfactor (expliciete naam/naamlek +42, projectmatch +20, stack +20, cloud/stad/sector/bureau-historie +15; tegenbewijs: andere cloud −25, tech −20, geen publiek spoor −20).`,
    `Een duidelijke naamlek of multi-signal match mag hoog scoren (80–90+). Dunne hints blijven in de 30–55-band.`,
    `Bronbetrouwbaarheid weegt mee (Tier 1 officieel, Tier 2 platform, Tier 3 aggregator, Tier 4 onbekend), met een bodem van 50%.`,
    `Standplaats geldt als harde eis: matcht een andere kandidaat de stad wel, dan kost dat −12.`,
    `Onderzoek: ${opts.rounds} rondes · ${opts.queries} queries · ${opts.searches} searches · ${opts.scrapes} pagina's gelezen · ${opts.internalMatches} eigen vacature-matches.`,
    `Percentages zijn inschattingen op publieke signalen — geen bewezen kansen.`,
  ].join(" ");
}
