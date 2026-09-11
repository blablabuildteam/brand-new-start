import { z } from "zod";
import { hasOpenAiKey } from "@/lib/ai-end-client";

export type VacancyExtract = {
  endClientHint: string | null;
  role: string | null;
  stack: string[];
  mustHaves: string[];
  location: string | null;
  start: string | null;
  duration: string | null;
  hours: string | null;
  rateHint: string | null;
  employment: "contract" | "interim" | "zzp" | "unknown";
  summary: string | null;
  confidence: number;
  at: string;
  model: string;
};

const ExtractPayload = z.object({
  endClientHint: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  stack: z.array(z.string()).max(12).optional(),
  mustHaves: z.array(z.string()).max(10).optional(),
  location: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
  rateHint: z.string().nullable().optional(),
  employment: z.enum(["contract", "interim", "zzp", "unknown"]).optional(),
  summary: z.string().nullable().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export { hasOpenAiKey };

/**
 * Structured vacancy parse for scouting / scoring.
 * Cheap model; no PII hunting — only role facts from the posting text.
 */
export async function aiExtractVacancy(opts: {
  title: string;
  text: string;
  companyHint?: string | null;
}): Promise<{ extract: VacancyExtract | null; model: string; detail: string }> {
  const key = openaiKey();
  if (!key) return { extract: null, model: "", detail: "OPENAI_API_KEY ontbreekt" };

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const blob = `${opts.title}\n\n${opts.text}`.slice(0, 7000);

  const system = `Je structureert NL IT-contracting vacatures voor recruiters.
Geef ALLEEN JSON met keys: endClientHint, role, stack, mustHaves, location, start, duration, hours, rateHint, employment, summary, confidence.
Regels:
- endClientHint = organisatie waar de professional werkt (niet het bureau), of null.
- employment: contract|interim|zzp|unknown.
- stack/mustHaves: korte NL/EN tech/skills, max 8.
- summary: 1 zin NL.
- Verzin geen personen of contactgegevens.
- confidence 0–100.`;

  const user = `Bedrijf/poster hint: ${opts.companyHint || "onbekend"}

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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { extract: null, model, detail: `OpenAI ${res.status}: ${err.slice(0, 160)}` };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return { extract: null, model, detail: "lege AI-respons" };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { extract: null, model, detail: "ongeldige JSON" };
  }

  const parsed = ExtractPayload.safeParse(parsedJson);
  if (!parsed.success) return { extract: null, model, detail: "AI-schema klopt niet" };

  const p = parsed.data;
  const extract: VacancyExtract = {
    endClientHint: p.endClientHint?.trim().slice(0, 80) || null,
    role: p.role?.trim().slice(0, 80) || null,
    stack: (p.stack || []).map((s) => s.trim()).filter(Boolean).slice(0, 8),
    mustHaves: (p.mustHaves || []).map((s) => s.trim()).filter(Boolean).slice(0, 8),
    location: p.location?.trim().slice(0, 80) || null,
    start: p.start?.trim().slice(0, 60) || null,
    duration: p.duration?.trim().slice(0, 60) || null,
    hours: p.hours?.trim().slice(0, 40) || null,
    rateHint: p.rateHint?.trim().slice(0, 60) || null,
    employment: p.employment || "unknown",
    summary: p.summary?.trim().slice(0, 220) || null,
    confidence: Math.round(p.confidence ?? 50),
    at: new Date().toISOString(),
    model,
  };

  return { extract, model, detail: `extract · ${model}` };
}
