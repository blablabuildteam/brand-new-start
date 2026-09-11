import { z } from "zod";
import { isAgencyName } from "@/lib/agency";
import type { ClientGuess, Evidence } from "@/lib/end-client";
import { leadStatusFromGuess } from "@/lib/end-client";
import { aiJsonCompletion, hasAiKey, hasOpenAiKey } from "@/lib/ai-client";

export { hasAiKey, hasOpenAiKey };

const AiPayload = z.object({
  name: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  evidence: z
    .array(
      z.object({
        label: z.string().min(1).max(160),
        quote: z.string().max(220).optional(),
      })
    )
    .max(5),
  alternatives: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        confidence: z.number().min(0).max(100),
      })
    )
    .max(3)
    .optional(),
  unknown: z.boolean().optional(),
});

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * On-demand eindklant-hypothese via Claude Sonnet.
 * Geen hiring managers, geen telefoons — alleen organisatie + bewijs.
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
Taak: raad de EINDklant (de organisatie waar de ZZP'er/interim gaat werken) uit een bureau-vacature.
Regels:
- De poster/agency (${opts.agencyName}) is NOOIT de eindklant.
- Verzin geen personen, telefoonnummers of e-mails.
- Alleen organisaties. Gebruik alleen aanwijzingen in de tekst (locatie, sector, programma, stack, expliciete namen).
- Als de tekst te vaag is: name=null, confidence laag, unknown=true.
- evidence.label = korte NL-reden. quote = letterlijk fragment uit de tekst als dat kan.
- confidence 0–100: 80+ alleen bij sterke match (naam genoemd of unieke combi).
JSON keys: name, confidence, evidence, alternatives, unknown.`;

  const user = `Bureau/poster: ${opts.agencyName}

Vacature:
"""
${blob}
"""`;

  const result = await aiJsonCompletion({
    system,
    user,
    temperature: 0.15,
    maxTokens: 1000,
  });

  if (!result.json) {
    return { guess: null, model: result.model, detail: result.detail };
  }

  const parsed = AiPayload.safeParse(result.json);
  if (!parsed.success) {
    return { guess: null, model: result.model, detail: "AI-schema klopt niet" };
  }

  const p = parsed.data;
  if (p.unknown || !p.name || p.confidence < 20) {
    return { guess: null, model: result.model, detail: "AI: te weinig zekerheid" };
  }

  const name = cleanName(p.name);
  if (name.length < 2 || isAgencyName(name)) {
    return { guess: null, model: result.model, detail: "AI gaf agency of lege naam" };
  }

  const evidence: Evidence[] = p.evidence
    .filter((e) => e.label.trim())
    .slice(0, 4)
    .map((e) => ({
      label: e.label.trim().slice(0, 160),
      quote: e.quote?.trim().slice(0, 220) || undefined,
      weight: Math.min(90, Math.max(30, Math.round(p.confidence))),
    }));

  if (!evidence.length) {
    evidence.push({
      label: "AI-hypothese op basis van vacaturetekst",
      weight: Math.round(p.confidence),
    });
  }

  const guess: ClientGuess = {
    name,
    confidence: Math.round(p.confidence),
    evidence,
    alternatives: (p.alternatives || [])
      .filter((a) => a.name && !isAgencyName(a.name) && cleanName(a.name) !== name)
      .slice(0, 3)
      .map((a) => ({ name: cleanName(a.name), confidence: Math.round(a.confidence) })),
  };

  void leadStatusFromGuess(guess);

  return { guess, model: result.model, detail: result.detail };
}
