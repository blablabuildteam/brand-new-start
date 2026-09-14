import { z } from "zod";
import { isAgencyName } from "@/lib/agency";
import type { ClientGuess, Evidence } from "@/lib/end-client";
import { leadStatusFromGuess } from "@/lib/end-client";
import { aiJsonCompletion, hasAiKey, hasOpenAiKey } from "@/lib/ai-client";

export { hasAiKey, hasOpenAiKey };

const EvidenceItem = z.preprocess(
  (v) => {
    if (typeof v === "string") return { label: v };
    return v;
  },
  z.object({
    label: z.string().min(1).max(200),
    quote: z.string().max(280).optional().nullable(),
  })
);

const AltItem = z.object({
  name: z.string().min(1).max(120),
  confidence: z.coerce.number().min(0).max(100),
});

/** Loose schema — models often drift on types / nulls / extra keys. */
const AiPayload = z
  .object({
    name: z.union([z.string(), z.null()]).optional(),
    confidence: z.coerce.number().min(0).max(100).optional().default(0),
    evidence: z.array(EvidenceItem).max(8).optional().default([]),
    alternatives: z.array(AltItem).max(5).optional().default([]),
    unknown: z.union([z.boolean(), z.string()]).optional(),
  })
  .passthrough();

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

function normalizeAlts(
  raw: { name: string; confidence: number }[],
  agencyName: string,
  primary?: string
) {
  const seen = new Set<string>();
  const out: { name: string; confidence: number }[] = [];
  for (const a of raw) {
    const n = cleanName(a.name);
    const key = n.toLowerCase();
    if (n.length < 2 || isAgencyName(n) || key === agencyName.toLowerCase()) continue;
    if (primary && key === primary.toLowerCase()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: n, confidence: Math.round(Number(a.confidence) || 0) });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * On-demand eindklant-hypothese via Claude Sonnet.
 * Geen hiring managers, geen telefoons — alleen organisatie + bewijs.
 * Bij twijfel: meerdere kandidaten i.p.v. hard falen.
 */
export async function aiGuessEndClient(opts: {
  title: string;
  text: string;
  agencyName: string;
}): Promise<{ guess: ClientGuess | null; model: string; detail: string }> {
  if (!hasAiKey()) {
    return { guess: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt" };
  }

  const blob = `${opts.title}\n\n${opts.text}`.slice(0, 6000);

  const system = `Je helpt Nederlandse IT-contracting recruiters.
Taak: raad de EINDklant (organisatie waar de ZZP'er/interim gaat werken) uit een bureau-vacature.
Regels:
- De poster/agency (${opts.agencyName}) is NOOIT de eindklant.
- Verzin geen personen, telefoonnummers of e-mails.
- Alleen organisaties. Gebruik alleen aanwijzingen in de tekst (locatie, sector, programma, stack, expliciete namen).
- Bij twijfel: zet unknown=true, geef wél 2–4 alternatives (meest waarschijnlijke eerst), elk met confidence.
- evidence: array van {label, quote?}. label = korte NL-reden. quote = letterlijk fragment uit de tekst.
- confidence 0–100: 80+ alleen bij sterke match (naam genoemd of unieke combi).
Antwoord als JSON met keys: name (string|null), confidence (number), evidence (array), alternatives (array), unknown (boolean).`;

  const user = `Bureau/poster: ${opts.agencyName}

Vacature:
"""
${blob}
"""`;

  const result = await aiJsonCompletion({
    system,
    user,
    temperature: 0.15,
    maxTokens: 1200,
  });

  if (!result.json) {
    return { guess: null, model: result.model, detail: result.detail };
  }

  const parsed = AiPayload.safeParse(result.json);
  if (!parsed.success) {
    // Last-resort salvage: sometimes the model nests under data/result
    const raw = result.json as Record<string, unknown>;
    const nested = raw?.data ?? raw?.result ?? raw?.guess;
    const retry = nested ? AiPayload.safeParse(nested) : null;
    if (!retry?.success) {
      return {
        guess: null,
        model: result.model,
        detail: `AI-schema klopt niet (${parsed.error.issues[0]?.path.join(".") || "?"}: ${parsed.error.issues[0]?.message || "ongeldig"})`,
      };
    }
    return buildGuess(retry.data, opts.agencyName, result.model, result.detail);
  }

  return buildGuess(parsed.data, opts.agencyName, result.model, result.detail);
}

function buildGuess(
  p: z.infer<typeof AiPayload>,
  agencyName: string,
  model: string,
  detail: string
): { guess: ClientGuess | null; model: string; detail: string } {
  const unknown = asBool(p.unknown);
  const conf = Math.round(Number(p.confidence) || 0);
  const rawName = typeof p.name === "string" ? cleanName(p.name) : "";
  const alts = normalizeAlts(p.alternatives || [], agencyName, rawName || undefined);

  // Uncertain but has candidates → surface as multi-option review
  if (unknown || !rawName || conf < 20) {
    const pool = [
      ...(rawName && rawName.length >= 2 && !isAgencyName(rawName)
        ? [{ name: rawName, confidence: conf }]
        : []),
      ...alts,
    ];
    if (!pool.length) {
      return { guess: null, model, detail: "AI: te weinig zekerheid — geen kandidaten" };
    }
    const primary = pool[0]!;
    const rest = normalizeAlts(pool.slice(1), agencyName, primary.name);
    const guess = makeGuess({
      name: primary.name,
      confidence: Math.min(primary.confidence, 55),
      evidence: p.evidence || [],
      alternatives: rest,
      fallbackEvidence: "AI: meerdere mogelijke eindklanten — kies of vul zelf in",
    });
    void leadStatusFromGuess(guess);
    return { guess, model, detail: `${detail} · meerdere opties` };
  }

  if (rawName.length < 2 || isAgencyName(rawName)) {
    if (alts.length) {
      const primary = alts[0]!;
      const guess = makeGuess({
        name: primary.name,
        confidence: Math.min(primary.confidence, 60),
        evidence: p.evidence || [],
        alternatives: alts.slice(1),
        fallbackEvidence: "AI: primaire naam ongeldig, kandidaten uit alternatives",
      });
      void leadStatusFromGuess(guess);
      return { guess, model, detail };
    }
    return { guess: null, model, detail: "AI gaf agency of lege naam" };
  }

  const guess = makeGuess({
    name: rawName,
    confidence: conf,
    evidence: p.evidence || [],
    alternatives: alts,
    fallbackEvidence: "AI-hypothese op basis van vacaturetekst",
  });
  void leadStatusFromGuess(guess);
  return { guess, model, detail };
}

function makeGuess(opts: {
  name: string;
  confidence: number;
  evidence: { label: string; quote?: string | null }[];
  alternatives: { name: string; confidence: number }[];
  fallbackEvidence: string;
}): ClientGuess {
  const evidence: Evidence[] = opts.evidence
    .filter((e) => e.label?.trim())
    .slice(0, 4)
    .map((e) => ({
      label: e.label.trim().slice(0, 160),
      quote: e.quote?.trim().slice(0, 220) || undefined,
      weight: Math.min(90, Math.max(30, Math.round(opts.confidence))),
    }));

  if (!evidence.length) {
    evidence.push({
      label: opts.fallbackEvidence,
      weight: Math.round(opts.confidence),
    });
  }

  return {
    name: opts.name,
    confidence: Math.round(opts.confidence),
    evidence,
    alternatives: opts.alternatives.slice(0, 4),
  };
}
