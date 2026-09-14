import type { ClientGuess, Evidence } from "@/lib/end-client";
import { isAgencyName } from "@/lib/agency";
import { aiJsonCompletion, hasAiKey } from "@/lib/ai-client";
import { z } from "zod";

export type ResearchSource = {
  title: string;
  url?: string;
  snippet?: string;
};

export type ResearchCandidate = {
  name: string;
  confidence: number;
  why: string;
  whyLower?: string;
  evidence: { claim: string; strength: "high" | "medium" | "low"; source?: string }[];
  counterEvidence: string[];
};

export type ResearchReport = {
  method: "rules" | "ai" | "deep";
  confidenceBand: "very_high" | "high" | "medium" | "low" | "very_low";
  hypothesis: string;
  why: string;
  ranking: ResearchCandidate[];
  counterEvidence: string[];
  timeline: string[];
  sources: ResearchSource[];
  scoringNotes: string;
  signalsSummary?: string;
};

type SearchHit = {
  title: string;
  url: string;
  description: string;
};

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

function band(confidence: number): ResearchReport["confidenceBand"] {
  if (confidence >= 85) return "very_high";
  if (confidence >= 70) return "high";
  if (confidence >= 50) return "medium";
  if (confidence >= 30) return "low";
  return "very_low";
}

function bandLabel(b: ResearchReport["confidenceBand"]) {
  return (
    {
      very_high: "Very high",
      high: "High",
      medium: "Medium",
      low: "Low",
      very_low: "Very low",
    } as const
  )[b];
}

async function firecrawlSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        location: "Netherlands",
        lang: "nl",
        country: "nl",
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { title?: string; url?: string; description?: string }[];
      web?: { title?: string; url?: string; description?: string }[];
    };
    const rows = data.data || data.web || [];
    return rows
      .filter((r) => r.url)
      .map((r) => ({
        title: (r.title || r.url || "").slice(0, 160),
        url: r.url!,
        description: (r.description || "").slice(0, 320),
      }));
  } catch {
    return [];
  }
}

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
      .optional(),
    industry: z.string().optional().nullable(),
    hours_per_week: z.union([z.string(), z.number()]).optional().nullable(),
    remote_policy: z.string().optional().nullable(),
    office_days: z.union([z.string(), z.number()]).optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    project_signals: z.array(z.string()).optional().default([]),
    recruiter: z.string().optional().nullable(),
    agency: z.string().optional().nullable(),
    hard_signals: z.array(z.string()).optional().default([]),
    search_queries: z.array(z.string()).max(12).optional().default([]),
  })
  .passthrough();

const ReportSchema = z
  .object({
    ranking: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          confidence: z.coerce.number().min(0).max(100),
          why: z.string().max(600),
          whyLower: z.string().max(400).optional().nullable(),
          evidence: z
            .array(
              z.object({
                claim: z.string().max(240),
                strength: z.enum(["high", "medium", "low"]).optional().default("medium"),
                source: z.string().max(200).optional().nullable(),
              })
            )
            .optional()
            .default([]),
          counterEvidence: z.array(z.string().max(240)).optional().default([]),
        })
      )
      .min(1)
      .max(6),
    why: z.string().max(900),
    counterEvidence: z.array(z.string().max(280)).optional().default([]),
    timeline: z.array(z.string().max(280)).optional().default([]),
    scoringNotes: z.string().max(500).optional().nullable(),
  })
  .passthrough();

/**
 * Deep end-client research: parse → search → rank with falsification.
 * Not a single LLM→company name hop.
 */
export async function researchEndClient(opts: {
  title: string;
  text: string;
  agencyName: string;
  recruiterName?: string;
  depth?: "standard" | "deep";
}): Promise<{ guess: ClientGuess | null; model: string; detail: string; report: ResearchReport | null }> {
  if (!hasAiKey()) {
    return { guess: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt", report: null };
  }

  const depth = opts.depth || "standard";
  const blob = `${opts.title}\n\n${opts.text}`.slice(0, 7000);
  const agency = opts.agencyName;
  const recruiter = opts.recruiterName || "";

  // ── Step 1: normalize signals + query queries ──
  const parse = await aiJsonCompletion({
    system: `Je bent een OSINT research-assistent voor NL contracting-recruitment.
Haal signalen uit een (deels) anonieme bureau-vacature.
Agency (${agency}) is NOOIT de eindklant.
Geef JSON met: job_title, seniority, technology[], cloud[], location{region,city}, industry,
hours_per_week, remote_policy, office_days, start_date, end_date, project_signals[],
recruiter, agency, hard_signals[] (zeldzame onderscheidende kenmerken),
search_queries[] (6–10 korte webzoekopdrachten in NL/EN om de eindklant te vinden —
combinaties van stack+stad+bureau+projectfrases; géén queries die alleen de agency zoeken).`,
    user: `Bureau: ${agency}${recruiter ? `\nRecruiter: ${recruiter}` : ""}

Vacature:
"""
${blob}
"""`,
    temperature: 0.1,
    maxTokens: 1400,
  });

  if (!parse.json) {
    return { guess: null, model: parse.model, detail: parse.detail, report: null };
  }

  const signalsParsed = SignalsSchema.safeParse(parse.json);
  const signals = signalsParsed.success ? signalsParsed.data : null;

  const queries = [
    ...(signals?.search_queries || []),
    [agency, signals?.technology?.[0], signals?.location?.city || signals?.location?.region, "opdracht"]
      .filter(Boolean)
      .join(" "),
    [signals?.cloud?.[0], signals?.technology?.[0], signals?.location?.region, "freelance"].filter(Boolean).join(" "),
    recruiter ? `"${recruiter}" ${signals?.technology?.[0] || ""} ${signals?.cloud?.[0] || ""}`.trim() : "",
  ]
    .map((q) => q.trim())
    .filter((q) => q.length > 8)
    .slice(0, depth === "deep" ? 10 : 6);

  // ── Step 2: web search (Firecrawl) when available ──
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    const batch = await firecrawlSearch(q, depth === "deep" ? 5 : 4);
    for (const h of batch) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      hits.push(h);
      if (hits.length >= (depth === "deep" ? 28 : 16)) break;
    }
    if (hits.length >= (depth === "deep" ? 28 : 16)) break;
  }

  const sourcesBlock =
    hits.length > 0
      ? hits
          .slice(0, 22)
          .map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.description}`)
          .join("\n\n")
      : "(Geen websearch-resultaten — FIRECRAWL_API_KEY ontbreekt of zoek leverde niets. Redeneer uitsluitend op vacature + algemene NL-marktkennis, en wees conservatief met confidence.)";

  const signalsBlock = signals
    ? JSON.stringify(
        {
          job_title: signals.job_title,
          seniority: signals.seniority,
          technology: signals.technology,
          cloud: signals.cloud,
          location: signals.location,
          industry: signals.industry,
          hours: signals.hours_per_week,
          remote: signals.remote_policy,
          office_days: signals.office_days,
          start: signals.start_date,
          end: signals.end_date,
          project_signals: signals.project_signals,
          hard_signals: signals.hard_signals,
          recruiter: signals.recruiter || recruiter,
          agency: signals.agency || agency,
        },
        null,
        2
      )
    : "(signal extract mislukt — werk vanuit ruwe vacature)";

  // ── Step 3: investigate + falsify + rank ──
  const analyze = await aiJsonCompletion({
    system: `Je doet End-client Intelligence voor NL IT-contracting.
NIET: één bedrijfsnaam raden zonder onderzoek.
WEL: 3–5 serieuze kandidaten, scoren, tegenbewijs zoeken, transparant uitleggen.

Scoring (richtlijn, geen nep-precisie):
+ exact stack match, cloud match, stad, sector, recruiter-historie, projectbeschrijving, tijdlijn
− andere cloud, verkeerde stad/sector, tech mismatch

Regels:
- Agency (${agency}) is NOOIT eindklant.
- Formuleer als hypothese: "waarschijnlijkste kandidaat op basis van openbare aanwijzingen".
- Zonder sterke multi-signal match: confidence ≤ 55.
- High (≥70) alleen bij meerdere onafhankelijke signalen (locatie+stack+sector of expliciete naam + verificatie).
- Nooit hallucineren: als bronnen geen bewijs geven, zeg dat in counterEvidence.
- ranking[0] = beste kandidaat. Alternatieven moeten whyLower hebben.

JSON keys: ranking[{name,confidence,why,whyLower,evidence[{claim,strength,source}],counterEvidence[]}],
why, counterEvidence[], timeline[], scoringNotes.`,
    user: `Bureau: ${agency}${recruiter ? `\nRecruiter: ${recruiter}` : ""}

Geëxtraheerde signalen:
${signalsBlock}

Webbronnen / zoekhits:
${sourcesBlock}

Originele vacature (uittreksel):
"""
${blob.slice(0, 3500)}
"""`,
    temperature: 0.12,
    maxTokens: 2200,
  });

  if (!analyze.json) {
    return { guess: null, model: analyze.model || parse.model, detail: analyze.detail, report: null };
  }

  const reportParsed = ReportSchema.safeParse(analyze.json);
  if (!reportParsed.success) {
    return {
      guess: null,
      model: analyze.model || parse.model,
      detail: `Research-schema: ${reportParsed.error.issues[0]?.message || "ongeldig"}`,
      report: null,
    };
  }

  const raw = reportParsed.data;
  const ranking: ResearchCandidate[] = raw.ranking
    .map((r) => ({
      name: cleanName(r.name),
      confidence: Math.round(r.confidence),
      why: r.why.trim(),
      whyLower: r.whyLower?.trim() || undefined,
      evidence: (r.evidence || []).slice(0, 6).map((e) => ({
        claim: e.claim.trim(),
        strength: e.strength || ("medium" as const),
        source: e.source || undefined,
      })),
      counterEvidence: (r.counterEvidence || []).slice(0, 4),
    }))
    .filter((r) => r.name.length >= 2 && !isAgencyName(r.name));

  if (!ranking.length) {
    return {
      guess: null,
      model: analyze.model || parse.model,
      detail: "Geen bruikbare kandidaten na research",
      report: null,
    };
  }

  // Soft-cap overconfidence without web evidence
  if (hits.length === 0) {
    for (const r of ranking) {
      r.confidence = Math.min(r.confidence, 58);
    }
  }

  const top = ranking[0]!;
  const conf = top.confidence;
  const b = band(conf);

  const evidence: Evidence[] = top.evidence.slice(0, 5).map((e) => ({
    label: e.claim.slice(0, 160),
    quote: e.source?.slice(0, 220),
    weight:
      e.strength === "high" ? Math.min(90, conf) : e.strength === "low" ? Math.max(25, conf - 25) : Math.max(35, conf - 10),
  }));

  if (!evidence.length) {
    evidence.push({
      label: top.why.slice(0, 160),
      weight: Math.max(30, conf),
    });
  }

  const report: ResearchReport = {
    method: "deep",
    confidenceBand: b,
    hypothesis: `${top.name} is op basis van de openbare aanwijzingen momenteel de waarschijnlijkste kandidaat (${bandLabel(b)} · ±${conf}%).`,
    why: raw.why.trim(),
    ranking,
    counterEvidence: (raw.counterEvidence || []).slice(0, 6),
    timeline: (raw.timeline || []).slice(0, 8),
    sources: hits.slice(0, 12).map((h) => ({ title: h.title, url: h.url, snippet: h.description })),
    scoringNotes:
      raw.scoringNotes?.trim() ||
      `Scores zijn probabilistische inschattingen op signalen${hits.length ? ` + ${hits.length} zoekhits` : " (zonder websearch)"}; geen statistisch bewezen kansen.`,
    signalsSummary: [
      signals?.job_title,
      [...(signals?.technology || []), ...(signals?.cloud || [])].slice(0, 5).join(" · "),
      [signals?.location?.city, signals?.location?.region].filter(Boolean).join(", "),
      signals?.industry,
    ]
      .filter(Boolean)
      .join(" · "),
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
    model: analyze.model || parse.model,
    detail: `Deep research · ${hits.length} bronnen · ${bandLabel(b)}`,
    report,
  };
}

export function rulesReport(guess: ClientGuess): ResearchReport {
  return {
    method: "rules",
    confidenceBand: band(guess.confidence),
    hypothesis: `${guess.name} komt uit lokale regels/catalogus (geen webresearch).`,
    why: "Eerste eindklant-hypothese: expliciete naam in de tekst, of matching tags (locatie/sector/stack) uit de interne catalogus.",
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
    counterEvidence: ["Nog geen webresearch of tegenbewijs — gebruik AI research voor diepere check."],
    timeline: [],
    sources: [],
    scoringNotes:
      "Regel-score = zwaarste bewijs + 15% van tweede. ≥80 Voorstel, 45–79 Review, <45 Te dun. Catalogus is beperkt — AI research is sterker.",
  };
}
