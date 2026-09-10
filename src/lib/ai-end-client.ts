import { z } from "zod";
import { isAgencyName } from "@/lib/agency";
import type { ClientGuess, Evidence } from "@/lib/end-client";
import { leadStatusFromGuess } from "@/lib/end-client";

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

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * On-demand eindklant-hypothese via OpenAI.
 * Geen hiring managers, geen telefoons — alleen organisatie + bewijs.
 */
export async function aiGuessEndClient(opts: {
  title: string;
  text: string;
  agencyName: string;
}): Promise<{ guess: ClientGuess | null; model: string; detail: string }> {
  const key = openaiKey();
  if (!key) {
    return { guess: null, model: "", detail: "OPENAI_API_KEY ontbreekt" };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
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
Antwoord ALLEEN als JSON object met keys: name, confidence, evidence, alternatives, unknown.`;

  const user = `Bureau/poster: ${opts.agencyName}

Vacature:
"""
${blob}
"""`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return {
      guess: null,
      model,
      detail: `OpenAI ${res.status}: ${err.slice(0, 160)}`,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return { guess: null, model, detail: "lege AI-respons" };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { guess: null, model, detail: "ongeldige JSON van AI" };
  }

  const parsed = AiPayload.safeParse(parsedJson);
  if (!parsed.success) {
    return { guess: null, model, detail: "AI-schema klopt niet" };
  }

  const p = parsed.data;
  if (p.unknown || !p.name || p.confidence < 20) {
    return { guess: null, model, detail: "AI: te weinig zekerheid" };
  }

  const name = cleanName(p.name);
  if (name.length < 2 || isAgencyName(name)) {
    return { guess: null, model, detail: "AI gaf agency of lege naam" };
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

  // Status-band consistent houden met rule engine
  void leadStatusFromGuess(guess);

  return { guess, model, detail: `AI · ${model}` };
}
