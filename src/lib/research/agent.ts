import { z } from "zod";
import { aiJsonCompletion, hasAiKey } from "@/lib/ai-client";
import { isAgencyName } from "@/lib/agency";
import { guessEndClient, type ClientGuess, type Evidence } from "@/lib/end-client";
import { findRelatedJobs, relatedJobsBlock, type RelatedJob } from "@/lib/research/corpus";
import { candidateQueries, discoveryQueries, falsificationQueries } from "@/lib/research/queries";
import { scoreCandidates, scoringExplainer } from "@/lib/research/scoring";
import type {
  JobSignals,
  ResearchCandidate,
  ResearchDepth,
  ResearchReport,
  ResearchSource,
  SearchHit,
  SourceTier,
} from "@/lib/research/types";
import { hasWeb, makeBudget, multiSearch, scrapeBest, tierFor } from "@/lib/research/web";

/**
 * End-client Intelligence agent.
 *
 * Rounds: extract signals → discovery search + own-desk memory → shortlist →
 * per-candidate verification + falsification → deterministic scoring.
 * The LLM supplies evidence; scoring.ts owns the numbers.
 */

/**
 * Models drift: a field documented as a string comes back as
 * {date, event} or {title, url}. Flatten instead of rejecting the whole report.
 */
function flatten(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const preferred = ["claim", "text", "event", "description", "title", "label", "name", "url", "source", "date"];
    const parts = preferred.filter((k) => typeof o[k] === "string" && (o[k] as string).trim()).map((k) => o[k] as string);
    if (parts.length) return parts.join(" — ").trim();
    return Object.values(o).map(flatten).filter(Boolean).join(" · ");
  }
  return "";
}

/** Accept whatever the model sends, hand a string to the schema. */
const flexString = (max: number) =>
  z.preprocess((v) => flatten(v).slice(0, max), z.string());

const flexStringArray = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return [];
      const arr = Array.isArray(v) ? v : [v];
      return arr.map((x) => flatten(x).slice(0, max)).filter(Boolean);
    },
    z.array(z.string())
  );

const SignalsSchema = z
  .object({
    job_title: flexString(160).optional(),
    seniority: flexString(80).optional(),
    technology: flexStringArray(60).optional().default([]),
    cloud: flexStringArray(40).optional().default([]),
    location: z
      .object({
        region: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
      })
      .optional()
      .default({}),
    industry: flexString(120).optional(),
    hours_per_week: flexString(40).optional(),
    remote_policy: flexString(80).optional(),
    office_days: flexString(40).optional(),
    start_date: flexString(60).optional(),
    interview_period: flexString(60).optional(),
    end_date: flexString(60).optional(),
    extension: flexString(60).optional(),
    team_size_signal: flexString(80).optional(),
    project_signals: flexStringArray(200).optional().default([]),
    language_requirements: flexStringArray(40).optional().default([]),
    recruiter: flexString(80).optional(),
    agency: flexString(80).optional(),
    hard_signals: flexStringArray(160).optional().default([]),
    reference_code: flexString(60).optional(),
    client_name_leak: flexString(80).optional(),
    search_queries: flexStringArray(160).optional().default([]),
  })
  .passthrough();

const ShortlistSchema = z
  .object({
    candidates: z
      .preprocess(
        (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
        z.array(
          z.object({
            name: flexString(100),
            rationale: flexString(400).optional().default(""),
          })
        )
      )
      .optional()
      .default([]),
    open_questions: flexStringArray(200).optional().default([]),
  })
  .passthrough();

const FACTORS = [
  "stack_match",
  "cloud_match",
  "city_match",
  "sector_match",
  "recruiter_history",
  "project_match",
  "timeline_match",
  "hybrid_match",
  "multi_hire",
  "modernization",
  "explicit_name",
  "cloud_mismatch",
  "city_mismatch",
  "sector_mismatch",
  "stack_mismatch",
  "timeline_conflict",
  "office_mismatch",
  "no_public_trace",
] as const;

const ReportSchema = z
  .object({
    ranking: z
      .array(
        z.object({
          name: flexString(100),
          confidence: z.coerce.number().min(0).max(100).catch(40),
          why: flexString(700),
          whyLower: flexString(400).optional(),
          evidence: z
            .preprocess(
              (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
              z.array(
                z.object({
                  claim: flexString(260),
                  strength: z.enum(["high", "medium", "low"]).catch("medium"),
                  source: flexString(300).optional(),
                  factor: z.enum(FACTORS).nullish().catch(null),
                })
              )
            )
            .optional()
            .default([]),
          counterEvidence: flexStringArray(260).optional().default([]),
        })
      )
      .min(1)
      .max(6),
    why: flexString(1000),
    counterEvidence: flexStringArray(300).optional().default([]),
    timeline: flexStringArray(300).optional().default([]),
    openQuestions: flexStringArray(220).optional().default([]),
    scoringNotes: flexString(600).optional(),
  })
  .passthrough();

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function band(confidence: number): ResearchReport["confidenceBand"] {
  if (confidence >= 85) return "very_high";
  if (confidence >= 70) return "high";
  if (confidence >= 50) return "medium";
  if (confidence >= 30) return "low";
  return "very_low";
}

export function bandLabel(b: ResearchReport["confidenceBand"]) {
  return {
    very_high: "Zeer hoog",
    high: "Hoog",
    medium: "Gemiddeld",
    low: "Laag",
    very_low: "Zeer laag",
  }[b];
}

function serpBlock(hits: SearchHit[], max: number) {
  if (!hits.length) return "";
  return hits
    .slice(0, max)
    .map(
      (h, i) =>
        `[SERP ${i + 1} · tier ${h.tier}] ${h.title}\nURL: ${h.url}\n${h.description}`
    )
    .join("\n\n");
}

function scrapeBlock(hits: SearchHit[]) {
  const scraped = hits.filter((h) => h.body);
  if (!scraped.length) return "";
  return scraped
    .map((h) => `[PAGINA · tier ${h.tier}] ${h.title}\nURL: ${h.url}\n${h.body}`)
    .join("\n\n---\n\n");
}

/** The rule engine already reads explicit names and job codes — don't waste that. */
function priorBlock(prior: ClientGuess | null, leak?: string | null) {
  const lines: string[] = [];
  if (leak) {
    lines.push(`Naamlek uit titel/code/URL: "${leak}" — dit is doorgaans de eindklant, tenzij het een bureau is.`);
  }
  if (prior) {
    lines.push(
      `Regel-hypothese: ${prior.name} (${prior.confidence}%) — ${prior.evidence.map((e) => e.label).join("; ")}`
    );
    if (prior.alternatives.length) {
      lines.push(`Regel-alternatieven: ${prior.alternatives.map((a) => `${a.name} (${a.confidence}%)`).join(", ")}`);
    }
  }
  if (!lines.length) return "(geen lokale hypothese — regels vonden niets)";
  return `${lines.join("\n")}\n\nVerifieer dit, neem het niet blind over: de regels kennen maar een beperkte catalogus.`;
}

function signalsBlock(signals: JobSignals | null, queries: string[], agency: string, recruiter: string) {
  if (!signals) return "(signal-extract mislukt — werk vanuit de ruwe vacature)";
  return JSON.stringify(
    {
      ...signals,
      recruiter: signals.recruiter || recruiter || null,
      agency: signals.agency || agency,
      queries_used: queries,
    },
    null,
    2
  );
}

async function extractSignals(opts: {
  blob: string;
  agency: string;
  recruiter: string;
}): Promise<{ signals: JobSignals | null; model: string; detail: string }> {
  const res = await aiJsonCompletion({
    system: `Je bent een OSINT-analist voor Nederlandse IT-contracting.
Je leest een (deels geanonimiseerde) bureau-vacature en haalt er harde signalen uit.
Het bureau (${opts.agency}) is NOOIT de eindklant.

Geef JSON met: job_title, seniority, technology[], cloud[], location{region,city}, industry,
hours_per_week, remote_policy, office_days, start_date, interview_period, end_date, extension,
team_size_signal, project_signals[] (concrete programma-/projectbeschrijvingen),
language_requirements[], recruiter, agency,
hard_signals[] (zeldzame, onderscheidende details: eigen tooling, domeinjargon, certificeringen,
specifieke systemen, ongebruikelijke combinaties),
reference_code (opdracht-/vacaturenummer of projectcode),
client_name_leak (naam die doorschemert in de titel, een opdrachtcode, URL, e-mailadres,
bestandsnaam of projectnaam — bureaus laten die vaak per ongeluk staan, bv. "Booking — 12785 — SE2"),
search_queries[] (4–6 korte webzoekopdrachten; bedrijfsnamen ALTIJD tussen "quotes";
combineer 3–4 harde signalen; vermijd losse woorden die homoniemen geven).

Verzin niets. Laat velden leeg als de tekst ze niet bevat.
Let extra op de TITEL: die is vaak minder geanonimiseerd dan de vacaturetekst.`,
    user: `Bureau: ${opts.agency}${opts.recruiter ? `\nRecruiter: ${opts.recruiter}` : ""}

Vacature:
"""
${opts.blob}
"""`,
    temperature: 0.1,
    maxTokens: 1600,
  });

  if (!res.json) return { signals: null, model: res.model, detail: res.detail };
  const parsed = SignalsSchema.safeParse(res.json);
  if (!parsed.success) return { signals: null, model: res.model, detail: "signal-schema ongeldig" };
  return { signals: parsed.data as JobSignals, model: res.model, detail: res.detail };
}

async function shortlist(opts: {
  agency: string;
  signalsText: string;
  serp: string;
  internal: string;
  prior: string;
}): Promise<{ names: string[]; openQuestions: string[]; rationales: Map<string, string> }> {
  const res = await aiJsonCompletion({
    system: `Je maakt een SHORTLIST van mogelijke eindklanten (NL) op basis van eerste zoekresultaten.
Nog niet scoren, nog niet kiezen. Doel: 3–5 bedrijven die het waard zijn om te verifiëren.

Regels:
- Het bureau (${opts.agency}) en andere detacheerders/bureaus zijn NOOIT kandidaat.
- Alleen echte, bestaande Nederlandse organisaties die bij de signalen passen.
- Liever een plausibele kandidaat met een verifieerbaar spoor dan een wilde gok.
- Staat er een naamlek of regel-hypothese? Neem die ALTIJD als kandidaat mee, ook om hem te kunnen uitsluiten.
- open_questions[]: wat moet er nog gecheckt worden om te kunnen kiezen.

JSON: { candidates: [{name, rationale}], open_questions: [] }`,
    user: `Lokale hypothese:
${opts.prior}

Signalen:
${opts.signalsText}

Eerste webresultaten:
${opts.serp || "(geen)"}

Eigen eerdere vacatures (desk-geheugen):
${opts.internal}`,
    temperature: 0.25,
    maxTokens: 900,
  });

  const empty = { names: [] as string[], openQuestions: [] as string[], rationales: new Map<string, string>() };
  if (!res.json) return empty;
  const parsed = ShortlistSchema.safeParse(res.json);
  if (!parsed.success) return empty;

  const names: string[] = [];
  for (const c of parsed.data.candidates) {
    const name = cleanName(c.name);
    if (name.length < 2 || isAgencyName(name)) continue;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    names.push(name);
  }
  const rationales = new Map<string, string>();
  for (const c of parsed.data.candidates) {
    rationales.set(cleanName(c.name), (c.rationale || "").trim());
  }
  return { names: names.slice(0, 5), openQuestions: parsed.data.open_questions, rationales };
}

function nameLooksLike(a: string, b: string) {
  const n = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(b\.?v\.?|n\.?v\.?|holdings?|group|nederland|netherlands|com)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const x = n(a);
  const y = n(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Promote a title/code leak or rule hit to hard evidence the scorer understands. */
function injectHardLeaks(
  ranking: ResearchCandidate[],
  opts: { leak?: string | null; prior: ClientGuess | null; title: string }
) {
  for (const r of ranking) {
    const hasExplicit = r.evidence.some((e) => e.factor === "explicit_name");
    if (opts.leak && nameLooksLike(r.name, opts.leak) && !hasExplicit) {
      r.evidence.unshift({
        claim: `Naamlek in titel/opdrachtcode: “${opts.leak}”`,
        strength: "high",
        source: opts.title.slice(0, 120),
        factor: "explicit_name",
      });
    } else if (
      opts.prior &&
      nameLooksLike(r.name, opts.prior.name) &&
      opts.prior.confidence >= 80 &&
      !hasExplicit
    ) {
      const quote = opts.prior.evidence[0]?.quote || opts.prior.evidence[0]?.label || opts.title;
      r.evidence.unshift({
        claim: `Regel-engine: eindklant met naam genoemd of in de referentie (${opts.prior.name})`,
        strength: "high",
        source: String(quote).slice(0, 160),
        factor: "explicit_name",
      });
    }
  }
}

/**
 * Degraded result from the shortlist round. The final write-up can fail
 * (token limits, schema drift) while the research itself was fine — in that
 * case a humble, clearly-labelled shortlist beats an empty screen.
 */
function shortlistFallback(opts: {
  names: string[];
  why: Map<string, string>;
  reason: string;
  hits: SearchHit[];
  related: RelatedJob[];
  depth: ResearchDepth;
  budget: ReturnType<typeof makeBudget>;
  rounds: number;
  openQuestions: string[];
}): { guess: ClientGuess; detail: string; report: ResearchReport } | null {
  if (!opts.names.length) return null;

  const ranking: ResearchCandidate[] = opts.names.slice(0, 4).map((name, i) => ({
    name,
    confidence: Math.max(22, 42 - i * 6),
    why: opts.why.get(name) || "Shortlist-kandidaat op basis van de eerste zoekronde.",
    whyLower: i === 0 ? undefined : "Lager: minder overlap met de signalen uit de shortlist.",
    evidence: [],
    counterEvidence: ["Niet geverifieerd — de eindanalyse is niet afgerond."],
  }));

  const top = ranking[0]!;
  const report: ResearchReport = {
    method: "deep",
    depth: opts.depth,
    confidenceBand: band(top.confidence),
    hypothesis: `${top.name} is een onverifieerde shortlist-kandidaat — behandel dit als richting, niet als conclusie.`,
    why: `De eindanalyse is niet afgerond (${opts.reason}). Dit is de ruwe shortlist uit de eerste zoekronde.`,
    ranking,
    counterEvidence: ["Geen bewijsweging uitgevoerd: scores zijn bewust laag gehouden."],
    timeline: [],
    sources: opts.hits
      .slice(0, 10)
      .map((h) => ({ title: h.title, url: h.url, snippet: h.description, tier: h.tier, scraped: Boolean(h.body) })),
    openQuestions: opts.openQuestions.slice(0, 5),
    scoringNotes: scoringExplainer({
      queries: opts.budget.queries.length,
      searches: opts.budget.searches,
      scrapes: opts.budget.scrapes,
      internalMatches: opts.related.length,
      rounds: opts.rounds,
    }),
    trace: {
      rounds: opts.rounds,
      queries: opts.budget.queries.slice(0, 20),
      searches: opts.budget.searches,
      scrapes: opts.budget.scrapes,
      internalMatches: opts.related.length,
    },
  };

  return {
    guess: {
      name: top.name,
      confidence: top.confidence,
      evidence: [{ label: top.why.slice(0, 180), weight: top.confidence }],
      alternatives: ranking.slice(1).map((r) => ({ name: r.name, confidence: r.confidence })),
      report,
      source: "deep",
    },
    detail: `Shortlist zonder eindanalyse · ${opts.reason}`,
    report,
  };
}

export async function researchEndClient(opts: {
  title: string;
  text: string;
  agencyName: string;
  recruiterName?: string;
  signalId?: string;
  depth?: ResearchDepth;
}): Promise<{ guess: ClientGuess | null; model: string; detail: string; report: ResearchReport | null }> {
  if (!hasAiKey()) {
    return { guess: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt", report: null };
  }

  const depth: ResearchDepth = opts.depth || "standard";
  const blob = `${opts.title}\n\n${opts.text}`.slice(0, 8000);
  const agency = opts.agencyName;
  const recruiter = opts.recruiterName || "";
  const budget = makeBudget(depth);
  let rounds = 1;

  // ── Round 1: signals + own desk memory (parallel, corpus needs no LLM) ──
  const extracted = await extractSignals({ blob, agency, recruiter });
  if (!extracted.signals && !extracted.model) {
    return { guess: null, model: extracted.model, detail: extracted.detail, report: null };
  }
  const signals = extracted.signals;

  const [related, discovery] = await Promise.all([
    findRelatedJobs({
      currentId: opts.signalId,
      agencyName: agency,
      recruiterName: recruiter,
      signals,
      title: opts.title,
      limit: depth === "deep" ? 8 : 5,
    }),
    (async () => {
      const queries = discoveryQueries({ agency, recruiter, signals, depth });
      const seen = new Set<string>();
      const hits = await multiSearch(queries, budget, { perQuery: depth === "quick" ? 4 : 5, seen });
      return { hits, seen };
    })(),
  ]);

  const seenUrls = discovery.seen;
  const hits: SearchHit[] = [...discovery.hits];

  // Read the most promising pages instead of trusting SERP snippets
  await scrapeBest(hits, budget, depth === "deep" ? 5 : depth === "standard" ? 3 : 1);

  const internalText = relatedJobsBlock(related);
  const signalsText = signalsBlock(signals, budget.queries, agency, recruiter);
  const prior = guessEndClient({ title: opts.title, text: opts.text });
  const priorText = priorBlock(prior, signals?.client_name_leak);

  // A name leaked in the title/code is the strongest lead we have — chase it.
  if (signals?.client_name_leak && !isAgencyName(signals.client_name_leak)) {
    const leakHits = await multiSearch(
      candidateQueries({ candidate: signals.client_name_leak, signals, agency }).slice(0, 2),
      budget,
      { perQuery: 4, seen: seenUrls }
    );
    hits.push(...leakHits);
    await scrapeBest(leakHits, budget, 1);
  }

  // ── Round 2: shortlist → targeted verification + falsification ──
  let openQuestions: string[] = [];
  let shortlistNames: string[] = [];
  let shortlistWhy = new Map<string, string>();
  if (depth !== "quick") {
    rounds = 2;
    const sl = await shortlist({
      agency,
      signalsText,
      serp: serpBlock(hits, 14),
      internal: internalText,
      prior: priorText,
    });
    openQuestions = sl.openQuestions;
    shortlistNames = sl.names;
    shortlistWhy = sl.rationales;

    const probeNames = sl.names.slice(0, depth === "deep" ? 4 : 2);
    if (probeNames.length) {
      rounds = 3;
      const queries = probeNames.flatMap((name) => [
        ...candidateQueries({ candidate: name, signals, agency }).slice(0, depth === "deep" ? 3 : 2),
        ...(depth === "deep" ? falsificationQueries({ candidate: name, signals }).slice(0, 2) : []),
      ]);
      const more = await multiSearch(queries, budget, { perQuery: 4, seen: seenUrls });
      hits.push(...more);
      await scrapeBest(more, budget, depth === "deep" ? 4 : 2);
    }
  }

  const scrapedCount = hits.filter((h) => h.body).length;

  // ── Round 3: evidence-based ranking with mandatory falsification ──
  const analyze = await aiJsonCompletion({
    system: `Je doet End-client Intelligence voor NL IT-contracting: welke eindklant zit achter deze bureau-vacature?

Productdoel: niet de naamlek (die is triviaal → factor explicit_name). Het product is anonieme
vacatures met hoge zekerheid via onderscheidende publieke signalen.

Werkwijze:
1. Neem 3–5 serieuze kandidaten.
2. Onderbouw elk met concreet bewijs uit de aangeleverde bronnen.
3. Zoek per kandidaat ACTIEF tegenbewijs. Een kandidaat zonder tegenbewijs-check is niet af.
4. ranking[0] = sterkste kandidaat. Alternatieven krijgen whyLower (waarom lager).

Bewijsregels:
- Het bureau (${agency}) is NOOIT de eindklant. Andere detacheerders ook niet.
- Naamlek in titel/code/URL → factor explicit_name (hoog). Klaar — geen theater nodig.
- Zonder naamlek: weeg zwaar op project_signals / hard_signals (programmanamen, domeinjargon,
  zeldzame combinaties). Tag die als project_match of modernization met strength high als de
  bron het programma of traject bij die organisatie noemt.
- Drie onafhankelijke families (project + plaats + stack/sector of historie) = sterke anonieme case.
- Standplaats is een harde eis: geen vestiging in de genoemde stad → city_mismatch.
- Tag elk bewijs met factor uit: ${FACTORS.join(", ")}.
- strength: high = officiële bron of hard programma-bewijs; medium = sterke indirecte match; low = hint.
- source = URL of "EIGEN n". Geen bron = geen high.
- [PAGINA] weegt zwaarder dan [SERP]; tier 1 zwaarder dan tier 3/4.
- [EIGEN n] = eerdere vacatures (factor recruiter_history).
- Verzin nooit een bron. Geen spoor → counterEvidence (no_public_trace).

Vul confidence naar eigen inzicht in; het systeem herberekent met vaste gewichten.
Zonder naamlek mag confidence hoog zijn (80–90+) als meerdere onderscheidende signalen kloppen.

Houd het compact: max 4 bewijsregels per kandidaat, claims van één zin, geen herhaling.

JSON: { ranking: [{name, confidence, why, whyLower, evidence: [{claim, strength, source, factor}], counterEvidence: []}], why, counterEvidence: [], timeline: [], openQuestions: [], scoringNotes }`,
    user: `Bureau: ${agency}${recruiter ? `\nRecruiter: ${recruiter}` : ""}

=== LOKALE HYPOTHESE (regels + naamlek) ===
${priorText}

=== GEËXTRAHEERDE SIGNALEN ===
${signalsText}

=== EIGEN DESK-GEHEUGEN (eerdere vacatures) ===
${internalText}

=== WEBRESULTATEN ===
${
  serpBlock(hits, depth === "deep" ? 22 : 14) ||
  (hasWeb() ? "(geen bruikbare hits — wees conservatief)" : "(geen websearch beschikbaar)")
}

${scrapedCount ? `=== PAGINA-INHOUD ===\n${scrapeBlock(hits)}` : ""}

${openQuestions.length ? `=== OPENSTAANDE VRAGEN UIT SHORTLIST ===\n${openQuestions.map((o) => `- ${o}`).join("\n")}` : ""}

=== ORIGINELE VACATURE ===
"""
${blob.slice(0, 3500)}
"""`,
    temperature: 0.12,
    maxTokens: 8000,
  });

  const model = analyze.model || extracted.model;
  const parsed = analyze.json ? ReportSchema.safeParse(analyze.json) : null;

  if (!parsed?.success) {
    const reason =
      parsed && !parsed.success
        ? `Research-schema: ${parsed.error.issues[0]?.message || "ongeldig"}`
        : analyze.detail;
    // Don't throw away a usable shortlist because the final write-up failed.
    const fallback = shortlistFallback({
      names: shortlistNames,
      why: shortlistWhy,
      reason,
      hits,
      related,
      depth,
      budget,
      rounds,
      openQuestions,
    });
    return fallback
      ? { ...fallback, model }
      : { guess: null, model, detail: reason, report: null };
  }

  const raw = parsed.data;
  const rawRanking: ResearchCandidate[] = raw.ranking
    .map((r) => ({
      name: cleanName(r.name),
      confidence: Math.round(r.confidence),
      why: r.why.trim(),
      whyLower: r.whyLower?.trim() || undefined,
      evidence: (r.evidence || []).slice(0, 8).map((e) => ({
        claim: e.claim.trim(),
        strength: e.strength || ("medium" as const),
        source: e.source || undefined,
        factor: e.factor || undefined,
      })),
      counterEvidence: (r.counterEvidence || []).slice(0, 5),
    }))
    .filter((r) => r.name.length >= 2 && !isAgencyName(r.name));

  if (!rawRanking.length) {
    const fallback = shortlistFallback({
      names: shortlistNames,
      why: shortlistWhy,
      reason: "Geen bruikbare kandidaten in de eindanalyse",
      hits,
      related,
      depth,
      budget,
      rounds,
      openQuestions,
    });
    return fallback
      ? { ...fallback, model }
      : { guess: null, model, detail: "Geen bruikbare kandidaten na research", report: null };
  }

  // Don't leave a name-leak as a soft "project_match" — the vacancy itself is the source.
  injectHardLeaks(rawRanking, {
    leak: signals?.client_name_leak,
    prior,
    title: opts.title,
  });

  // ── Round 4: deterministic scoring ──
  const tierByUrl = new Map<string, SourceTier>(hits.map((h) => [h.url, h.tier]));
  const tierBySource = (source?: string): SourceTier => {
    if (!source) return 4;
    if (/^EIGEN\s*\d/i.test(source.trim())) return 2;
    const direct = tierByUrl.get(source.trim());
    if (direct) return direct;
    for (const [url, tier] of tierByUrl) {
      if (source.includes(url) || url.includes(source)) return tier;
    }
    return /^https?:\/\//.test(source) ? tierFor(source) : 4;
  };

  const ranking = scoreCandidates(rawRanking, {
    tierBySource,
    hasWebEvidence: hits.length > 0,
    hasInternalEvidence: related.length > 0,
    cityKnown: Boolean(signals?.location?.city || signals?.location?.region),
  });

  const top = ranking[0]!;
  const conf = top.confidence;
  const b = band(conf);

  const evidence: Evidence[] = top.evidence.slice(0, 5).map((e) => ({
    label: e.claim.slice(0, 180),
    quote: e.source?.slice(0, 240),
    weight:
      e.strength === "high" ? Math.min(92, conf + 5) : e.strength === "low" ? Math.max(20, conf - 25) : Math.max(30, conf - 8),
  }));
  if (!evidence.length) {
    evidence.push({ label: top.why.slice(0, 180), weight: Math.max(25, conf) });
  }

  const sources: ResearchSource[] = [
    ...hits
      .slice(0, 14)
      .map((h) => ({ title: h.title, url: h.url, snippet: h.description, tier: h.tier, scraped: Boolean(h.body) })),
    ...related.slice(0, 4).map((r: RelatedJob) => ({
      title: `Eigen desk: ${r.title}${r.company ? ` — ${r.company}` : ""}`,
      url: r.url,
      snippet: `Gezien ${r.seenAt} · overlap ${[...r.overlap.tech, ...r.overlap.place].join("/") || "bureau"} · p=${r.sameProjectProbability}`,
      tier: 2 as SourceTier,
      internal: true,
    })),
  ];

  const report: ResearchReport = {
    method: "deep",
    depth,
    confidenceBand: b,
    hypothesis: `${top.name} is op basis van de openbare aanwijzingen de waarschijnlijkste eindklant (${bandLabel(b)} · ±${conf}%).`,
    why: raw.why.trim(),
    ranking,
    counterEvidence: (raw.counterEvidence || []).slice(0, 6),
    timeline: (raw.timeline || []).slice(0, 8),
    sources,
    openQuestions: [...new Set([...(raw.openQuestions || []), ...openQuestions])].slice(0, 6),
    scoringNotes:
      `${raw.scoringNotes?.trim() ? `${raw.scoringNotes.trim()} ` : ""}` +
      scoringExplainer({
        queries: budget.queries.length,
        searches: budget.searches,
        scrapes: budget.scrapes,
        internalMatches: related.length,
        rounds,
      }),
    signalsSummary: [
      signals?.job_title,
      [...(signals?.technology || []), ...(signals?.cloud || [])].slice(0, 5).join(" · "),
      [signals?.location?.city, signals?.location?.region].filter(Boolean).join(", "),
      signals?.industry,
    ]
      .filter(Boolean)
      .join(" · "),
    trace: {
      rounds,
      queries: budget.queries.slice(0, 20),
      searches: budget.searches,
      scrapes: budget.scrapes,
      internalMatches: related.length,
    },
  };

  const guess: ClientGuess = {
    name: top.name,
    confidence: conf,
    evidence,
    alternatives: ranking.slice(1, 5).map((r) => ({ name: r.name, confidence: r.confidence })),
    report,
    source: "deep",
  };

  return {
    guess,
    model,
    detail: `${rounds} rondes · ${budget.searches} searches · ${scrapedCount} pagina's · ${related.length} eigen matches · ${bandLabel(b)}`,
    report,
  };
}
