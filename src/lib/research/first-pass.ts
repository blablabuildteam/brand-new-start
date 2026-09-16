import {
  guessEndClient,
  huntSignals,
  type ClientGuess,
  type Evidence,
} from "@/lib/end-client";
import type {
  JobSignals,
  ResearchDepth,
  ResearchReport,
  ResearchSource,
  SearchHit,
  SourceTier,
} from "@/lib/research/types";

/**
 * Eerste research-hit: zo snel + goedkoop mogelijk de juiste opdrachtgever.
 *
 * Trap:
 * 1. Regels/naamlek ≥85 → klaar (€0, instant)
 * 2. Geen jachtspoor → niet betalen voor hallucinaties
 * 3. Firecrawl-snippets die de regel-hypothese herhalen → klaar (geen Claude)
 * 4. Anders → 1× Claude-analyse (standaard) / diepere LLM-extract alleen bij deep
 */

function band(confidence: number): ResearchReport["confidenceBand"] {
  if (confidence >= 85) return "very_high";
  if (confidence >= 70) return "high";
  if (confidence >= 50) return "medium";
  if (confidence >= 30) return "low";
  return "very_low";
}

function bandLabel(b: ResearchReport["confidenceBand"]) {
  return {
    very_high: "Zeer hoog",
    high: "Hoog",
    medium: "Gemiddeld",
    low: "Laag",
    very_low: "Zeer laag",
  }[b];
}

function hay(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Alleen volledige namen/aliassen — geen losse eerste woorden ("Gemeente", "Havenbedrijf"). */
function nameVariants(name: string): string[] {
  const base = name.trim();
  if (!base) return [];
  const out = new Set<string>([base]);
  const lower = base.toLowerCase();
  if (lower.includes("havenbedrijf") && lower.includes("rotterdam")) {
    out.add("Port of Rotterdam");
    out.add("Havenbedrijf Rotterdam");
  }
  if (lower.includes("booking")) {
    out.add("Booking.com");
    out.add("Booking");
  }
  // Korte unieke merknamen (ING, CCV) mogen alleen als hele naam ≥3 chars.
  if (!/\s/.test(base) && base.length >= 3) out.add(base);
  return [...out].filter((v) => v.trim().length >= 3);
}

function mentionInHit(hit: SearchHit, name: string): boolean {
  const blob = hay(`${hit.title} ${hit.description}`);
  return nameVariants(name).some((v) => {
    const needle = hay(v);
    if (needle.length < 3) return false;
    // Woordgrens-achtig: vermijd "ING" in "booking" / "training".
    if (needle.length <= 4) {
      return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(blob);
    }
    return blob.includes(needle);
  });
}

/** Context uit regels (plaats/programma) moet in dezelfde hit meekomen. */
function contextTokens(prior: ClientGuess): string[] {
  const raw = [
    ...prior.evidence.map((e) => e.quote || ""),
    ...prior.evidence.map((e) => e.label),
  ]
    .join(" ")
    .toLowerCase();
  const tokens = raw.match(
    /\b(rotterdam|amsterdam|utrecht|den haag|arnhem|diemen|asset life cycle|alc|s\/4hana|sap|gis|iot|servicenow|cedar|hypotheek|azure|aws)\b/g
  );
  return [...new Set(tokens || [])].slice(0, 8);
}

function hitHasContext(hit: SearchHit, tokens: string[]): boolean {
  if (!tokens.length) return true; // naamlek-achtige priors zonder tags: naam alleen mag
  const blob = hay(`${hit.title} ${hit.description}`);
  return tokens.some((t) => blob.includes(hay(t)));
}

/** Hoe vaak noemen SERP-titels/snippets deze kandidaat (streng)? */
export function serpMentionCount(hits: SearchHit[], name: string): number {
  return hits.filter((h) => mentionInHit(h, name)).length;
}

export function isStrongNameHit(prior: ClientGuess | null): boolean {
  if (!prior || prior.confidence < 85) return false;
  return prior.evidence.some((e) =>
    /naam|referentie|opdrachtgever|noemt|klantnaam/i.test(e.label)
  );
}

/** Stap 1: geen Firecrawl/Claude nodig. */
export function shouldSkipPaidResearch(prior: ClientGuess | null): boolean {
  if (!prior) return false;
  if (isStrongNameHit(prior)) return true;
  return prior.confidence >= 90;
}

/**
 * Stap 3: SERP bevestigt de regel-hypothese hard genoeg.
 * Eisen: prior ≥65, ≥2 volledige-naam hits, ≥1 betere bron (tier 1–2),
 * context (plaats/programma) in minstens één hit, geen nabije rival.
 */
export function serpConfirmsPrior(prior: ClientGuess | null, hits: SearchHit[]): boolean {
  if (!prior || prior.confidence < 65 || hits.length < 3) return false;

  const rival = prior.alternatives[0];
  if (rival && prior.confidence - rival.confidence < 12) return false;

  const supporting = hits.filter((h) => mentionInHit(h, prior.name));
  if (supporting.length < 2) return false;

  const quality = supporting.filter((h) => h.tier <= 2);
  if (!quality.length) return false;

  const ctx = contextTokens(prior);
  if (ctx.length && !supporting.some((h) => hitHasContext(h, ctx))) return false;

  return true;
}

export function cheapSignalsToJobSignals(
  cheap: ReturnType<typeof huntSignals>,
  agency: string,
  recruiter: string
): JobSignals {
  return {
    job_title: null,
    technology: cheap.technology,
    cloud: cheap.cloud,
    location: cheap.location,
    industry: null,
    project_signals: cheap.project_signals,
    hard_signals: cheap.hard_signals,
    language_requirements: [],
    agency,
    recruiter: recruiter || null,
    client_name_leak: cheap.client_name_leak,
    search_queries: [],
  };
}

export function buildRulesOnlyResult(prior: ClientGuess, reason: string) {
  const report: ResearchReport = {
    method: "rules",
    depth: "standard",
    confidenceBand: band(prior.confidence),
    hypothesis: `${prior.name} — ${reason}`,
    why: prior.evidence.map((e) => e.label).join("; ") || reason,
    ranking: [
      {
        name: prior.name,
        confidence: prior.confidence,
        why: reason,
        evidence: prior.evidence.map((e) => ({
          claim: e.label,
          strength: (e.weight >= 80 ? "high" : e.weight >= 50 ? "medium" : "low") as
            | "high"
            | "medium"
            | "low",
          source: e.quote,
          factor: (/naam|referentie|noemt/i.test(e.label)
            ? "explicit_name"
            : "project_match") as "explicit_name" | "project_match",
        })),
        counterEvidence: [],
      },
      ...prior.alternatives.map((a) => ({
        name: a.name,
        confidence: a.confidence,
        why: "Alternatieve catalogus-match",
        evidence: [],
        counterEvidence: [] as string[],
      })),
    ],
    counterEvidence: [],
    timeline: [],
    sources: [],
    scoringNotes: reason,
    trace: { rounds: 0, queries: [], searches: 0, scrapes: 0, internalMatches: 0 },
  };
  return {
    guess: { ...prior, report, source: "rules" as const },
    model: "",
    detail: reason,
    report,
  };
}

export function buildSerpConfirmResult(opts: {
  prior: ClientGuess;
  hits: SearchHit[];
  depth: ResearchDepth;
  searches: number;
  queries: string[];
}) {
  const mentions = serpMentionCount(opts.hits, opts.prior.name);
  // Geen kunstmatige floor op 72 — blijf dicht bij de regel-score + bescheiden boost.
  const confidence = Math.min(88, opts.prior.confidence + Math.min(10, mentions * 3));
  const supporting = opts.hits.filter((h) => mentionInHit(h, opts.prior.name));

  const evidence: Evidence[] = [
    ...opts.prior.evidence.slice(0, 2),
    {
      label: `${mentions} zoekresultaten noemen ${opts.prior.name}`,
      quote: supporting[0]?.title?.slice(0, 140),
      weight: Math.min(85, 50 + mentions * 6),
    },
  ];

  const sources: ResearchSource[] = opts.hits.slice(0, 10).map((h) => ({
    title: h.title,
    url: h.url,
    snippet: h.description,
    tier: h.tier as SourceTier,
    scraped: false,
  }));

  const report: ResearchReport = {
    method: "serp",
    depth: opts.depth,
    confidenceBand: band(confidence),
    hypothesis: `${opts.prior.name} bevestigd via zoekresultaten (${bandLabel(band(confidence))} · ±${confidence}%).`,
    why: `Lokale hypothese + ${mentions} zoekvermeldingen — geen Claude, geen scrape.`,
    ranking: [
      {
        name: opts.prior.name,
        confidence,
        why: `Regels ${opts.prior.confidence}% + ${mentions}× in zoekresultaten`,
        evidence: evidence.map((e) => ({
          claim: e.label,
          strength: (e.weight >= 75 ? "high" : "medium") as "high" | "medium",
          source: e.quote,
          factor: "project_match" as const,
        })),
        counterEvidence: [],
      },
      ...opts.prior.alternatives.slice(0, 2).map((a) => ({
        name: a.name,
        confidence: a.confidence,
        why: "Alternatief uit regels — minder steun in zoekresultaten",
        evidence: [],
        counterEvidence: [] as string[],
      })),
    ],
    counterEvidence: [],
    timeline: [],
    sources,
    scoringNotes:
      "Eerste hit: zoek-snippets bevestigen regel-hypothese — Claude overgeslagen.",
    trace: {
      rounds: 1,
      queries: opts.queries.slice(0, 12),
      searches: opts.searches,
      scrapes: 0,
      internalMatches: 0,
    },
  };

  const guess: ClientGuess = {
    name: opts.prior.name,
    confidence,
    evidence,
    alternatives: opts.prior.alternatives,
    report,
    source: "serp",
  };

  return {
    guess,
    model: "",
    detail: `Zoekbevestiging · ${opts.searches} searches · ${mentions} vermeldingen · geen Claude`,
    report,
  };
}

/** Mag batch-"AI alle open" deze lead overslaan? */
export function skipBatchResearch(lead: {
  status: string;
  guess: ClientGuess | null;
  aiGuess?: boolean;
}): boolean {
  if (lead.status === "confirmed" || lead.status === "rejected") return true;
  if (lead.guess && shouldSkipPaidResearch(lead.guess)) return true;
  // Alleen echte Claude/deep met hoge score skippen — SERP-only mag opnieuw.
  if (
    lead.aiGuess &&
    lead.guess &&
    (lead.guess.source === "deep" || lead.guess.source === "ai") &&
    lead.guess.confidence >= 85
  ) {
    return true;
  }
  return false;
}

export function needsClaudeAnalyze(opts: {
  prior: ClientGuess | null;
  hits: SearchHit[];
  depth: ResearchDepth;
}): boolean {
  if (opts.depth === "deep") return true;
  if (serpConfirmsPrior(opts.prior, opts.hits)) return false;
  // Standaard: nooit Claude zonder webhits — voorkomt catalogus-hallucinaties.
  if (!opts.hits.length) return false;
  return true;
}

export { guessEndClient, huntSignals };
