/**
 * Anthropic Claude client for desk AI (eindklant + extract).
 * Quality-first: Claude Sonnet by default.
 */

export function hasAiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** @deprecated use hasAiKey — kept for older import sites */
export function hasOpenAiKey() {
  return hasAiKey();
}

export function aiModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("geen JSON-object");
  }
}

/**
 * Messages API call that returns parsed JSON from the model text.
 */
export async function aiJsonCompletion(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ json: unknown; model: string; detail: string } | { json: null; model: string; detail: string }> {
  const key = anthropicKey();
  const model = aiModel();
  if (!key) {
    return { json: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.2,
      system: `${opts.system}\n\nAntwoord UITSLUITEND met één geldig JSON-object. Geen markdown, geen uitleg buiten JSON.`,
      messages: [{ role: "user", content: opts.user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return {
      json: null,
      model,
      detail: `Anthropic ${res.status}: ${err.slice(0, 180)}`,
    };
  }

  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const raw = data.content?.find((c) => c.type === "text")?.text;
  if (!raw) return { json: null, model, detail: "lege AI-respons" };

  try {
    return { json: extractJsonObject(raw), model, detail: `AI · ${model}` };
  } catch {
    return { json: null, model, detail: "ongeldige JSON van AI" };
  }
}
