import { aiJsonCompletion, hasAiKey } from "@/lib/ai-client";
import { isAgencyName, looksLikeIntermediary } from "@/lib/agency";

/**
 * Eén korte lezing van de vacaturetekst. Geen recruiter, geen bureau, geen
 * websearch. Alleen een naam als het model zeker is én een citaat uit de tekst
 * geeft. Dat is hoe een chat het ook doet, zonder de research-ronde.
 */
const MIN_CONFIDENCE = 85;

export type ClientRead = {
  name: string;
  confidence: number;
  because: string;
  quote: string;
  model: string;
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function acceptClientRead(opts: {
  sure: boolean;
  name: string | null | undefined;
  confidence: number;
  quote: string | null | undefined;
  text: string;
}): string | null {
  if (!opts.sure) return null;
  if (!Number.isFinite(opts.confidence) || opts.confidence < MIN_CONFIDENCE) return null;
  const name = (opts.name || "").trim().replace(/\s+/g, " ");
  const quote = (opts.quote || "").trim();
  if (name.length < 2 || name.length > 60 || quote.length < 8) return null;
  if (/^(onbekend|opdrachtgever|klant|eindklant|organisatie)$/i.test(name)) return null;
  if (isAgencyName(name) || looksLikeIntermediary(name)) return null;
  if (!norm(opts.text).includes(norm(quote))) return null;
  return name;
}

export async function readClientFromVacancy(opts: {
  title: string;
  text: string;
}): Promise<ClientRead | null> {
  if (!hasAiKey()) return null;
  const blob = `${opts.title}\n\n${opts.text}`.replace(/\s+/g, " ").trim().slice(0, 1800);
  if (blob.length < 40) return null;

  const result = await aiJsonCompletion({
    temperature: 0,
    maxTokens: 220,
    system: `Je herkent de eindklant alleen uit de vacaturetekst.
Geen bureau, geen recruiter, geen gok.
sure=true alleen als een programmanaam, systeem of combinatie in de tekst maar bij één echte organisatie hoort, of de naam er letterlijk staat.
Een algemene template ("Word Scrum Master", "voor een klant", "bij onze opdrachtgever") is sure=false.
quote is een kort stuk dat letterlijk in de tekst staat.
JSON: {"sure":boolean,"name":string|null,"confidence":number,"because":string,"quote":string}`,
    user: blob,
  });

  const raw = result.json as {
    sure?: boolean;
    name?: string | null;
    confidence?: number;
    because?: string;
    quote?: string;
  } | null;
  if (!raw) return null;
  const name = acceptClientRead({
    sure: raw.sure === true,
    name: raw.name,
    confidence: Number(raw.confidence),
    quote: raw.quote,
    text: blob,
  });
  if (!name) return null;
  return {
    name,
    confidence: Math.round(Number(raw.confidence)),
    because: (raw.because || "Herkend uit de vacaturetekst").slice(0, 180),
    quote: (raw.quote || "").slice(0, 180),
    model: result.model,
  };
}
