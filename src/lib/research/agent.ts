import { z } from "zod";
import { aiJsonCompletion, hasAiKey } from "@/lib/ai-client";
import { isAgencyName } from "@/lib/agency";
import type { ClientGuess, Evidence } from "@/lib/end-client";
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

const SignalsSchema = z
  .object({
    job_title: z.string().optional().nullable(),
    seniority: z.string().optional().nullable(),
    technology: z.array(z.string()).optional().default([]),
    cloud: z.array(z.string()).optional().default([]),
    location: z
      .object({
        region: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
      })
      .optional()
      .default({}),
    industry: z.string().optional().nullable(),
    hours_per_week: z.union([z.string(), z.number()]).optional().nullable(),
    remote_policy: z.string().optional().nullable(),
    office_days: z.union([z.string(), z.number()]).optional().nullable(),
    start_date: z.string().optional().nullable(),
    interview_period: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    extension: z.string().optional().nullable(),
    team_size_signal: z.string().optional().nullable(),
    project_signals: z.array(z.string()).optional().default([]),
    language_requirements: z.array(z.string()).optional().default([]),
    recruiter: z.string().optional().nullable(),
    agency: z.string().optional().nullable(),
    hard_signals: z.array(z.string()).optional().default([]),
    search_queries: z.array(z.string()).max(12).optional().default([]),
  })
  .passthrough();

const ShortlistSchema = z
  .object({
    candidates: z
      .array(
        z.object({
          name: z.string().min(2).max(100),
          rationale: z.string().max(400).optional().default(""),
        })
      )
      .max(8)
      .optional()
      .default([]),
    open_questions: z.array(z.string().max(200)).max(6).optional().default([]),
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
          name: z.string().min(1).max(100),
          confidence: z.coerce.number().min(0).max(100),
          why: z.string().max(700),
          whyLower: z.string().max(400).optional().nullable(),
          evidence: z
            .array(
              z.object({
                claim: z.string().max(260),
                strength: z.enum(["high", "medium", "low"]).optional().default("medium"),
                source: z.string().max(300).optional().nullable(),
                factor: z.enum(FACTORS).optional().nullable(),
              })
            )
            .optional()
            .default([]),
          counterEvidence: z.array(z.string().max(260)).optional().default([]),
        })
      )
      .min(1)
      .max(6),
    why: z.string().max(1000),
    counterEvidence: z.array(z.string().max(300)).optional().default([]),
    timeline: z.array(z.string().max(300)).optional().default([]),
    openQuestions: z.array(z.string().max(220)).optional().default([]),
    scoringNotes: z.string().max(600).optional().nullable(),
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
search_queries[] (4–6 korte webzoekopdrachten; bedrijfsnamen ALTIJD tussen "quotes";
combineer 3–4 harde signalen; vermijd losse woorden die homoniemen geven).

Verzin niets. Laat velden leeg als de tekst ze niet bevat.`,
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
}): Promise<{ names: string[]; openQuestions: string[] }> {
  const res = await aiJsonCompletion({
    system: `Je maakt een SHORTLIST van mogelijke eindklanten (NL) op basis van eerste zoekresultaten.
Nog niet scoren, nog niet kiezen. Doel: 3–5 bedrijven die het waard zijn om te verifiëren.

Regels:
- Het bureau (${opts.agency}) en andere detacheerders/bureaus zijn NOOIT kandidaat.
- Alleen echte, bestaande Nederlandse organisaties die bij de signalen passen.
- Liever een plausibele kandidaat met een verifieerbaar spoor dan een wilde gok.
- open_questions[]: wat moet er nog gecheckt worden om te kunnen kiezen.

JSON: { candidates: [{name, rationale}], open_questions: [] }`,
    user: `Signalen:
${opts.signalsText}

Eerste webresultaten:
${opts.serp || "(geen)"}

Eigen eerdere vacatures (desk-geheugen):
${opts.internal}`,
    temperature: 0.25,
    maxTokens: 900,
  });

  if (!res.json) return { names: [], openQuestions: [] };
  const parsed = ShortlistSchema.safeParse(res.json);
  if (!parsed.success) return { names: [], openQuestions: [] };

  const names: string[] = [];
  for (const c of parsed.data.candidates) {
    const name = cleanName(c.name);
    if (name.length < 2 || isAgencyName(name)) continue;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    names.push(name);
  }
  return { names: names.slice(0, 5), openQuestions: parsed.data.open_questions };
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

  // ── Round 2: shortlist → targeted verification + falsification ──
  let openQuestions: string[] = [];
  if (depth !== "quick") {
    rounds = 2;
    const sl = await shortlist({
      agency,
      signalsText,
      serp: serpBlock(hits, 14),
      internal: internalText,
    });
    openQuestions = sl.openQuestions;

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

Werkwijze:
1. Neem 3–5 serieuze kandidaten.
2. Onderbouw elk met concreet bewijs uit de aangeleverde bronnen.
3. Zoek per kandidaat ACTIEF tegenbewijs. Een kandidaat zonder tegenbewijs-check is niet af.
4. ranking[0] = sterkste kandidaat. Alternatieven krijgen whyLower (waarom lager).

Bewijsregels:
- Het bureau (${agency}) is NOOIT de eindklant. Andere detacheerders ook niet.
- Tag elk bewijs met factor uit: ${FACTORS.join(", ")}.
- strength: high = officiële bron of expliciete naam; medium = sterke indirecte match; low = zwakke hint.
- source = URL of "EIGEN n" van de gebruikte bron. Geen bron = geen high.
- [PAGINA]-blokken wegen zwaarder dan [SERP]-snippets; tier 1 zwaarder dan tier 3/4.
- [EIGEN n] = onze eigen eerder gesynchroniseerde vacatures. Een eerdere, minder geanonimiseerde
  vacature van hetzelfde bureau met dezelfde stack/plaats is sterk bewijs (factor recruiter_history).
- Verzin nooit een bron. Vind je geen spoor, zet dat in counterEvidence (factor no_public_trace).

Vul confidence naar eigen inzicht in; het systeem herberekent met vaste gewichten.
timeline[]: chronologie van publieke gebeurtenissen die de opdracht verklaren.
openQuestions[]: wat een mens nog moet checken.

JSON: { ranking: [{name, confidence, why, whyLower, evidence: [{claim, strength, source, factor}], counterEvidence: []}], why, counterEvidence: [], timeline: [], openQuestions: [], scoringNotes }`,
    user: `Bureau: ${agency}${recruiter ? `\nRecruiter: ${recruiter}` : ""}

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
    maxTokens: 3000,
  });

  const model = analyze.model || extracted.model;
  if (!analyze.json) {
    return { guess: null, model, detail: analyze.detail, report: null };
  }

  const parsed = ReportSchema.safeParse(analyze.json);
  if (!parsed.success) {
    return {
      guess: null,
      model,
      detail: `Research-schema: ${parsed.error.issues[0]?.message || "ongeldig"}`,
      report: null,
    };
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
    return { guess: null, model, detail: "Geen bruikbare kandidaten na research", report: null };
  }

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
