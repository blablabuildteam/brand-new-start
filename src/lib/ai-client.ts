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

/**
 * Repair JSON that was cut off mid-stream (hit max_tokens).
 * Drops the incomplete tail, then closes the open brackets so the
 * complete part of a long research report is still usable.
 */
function repairTruncatedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const s = text.slice(start);

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  /** Last index that ended a complete value inside the innermost container. */
  let safe = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      safe = i;
    } else if (ch === ",") safe = i - 1;
  }

  if (!stack.length) return s;
  if (safe < 0) return null;

  let out = s.slice(0, safe + 1).replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through to repair
      }
    }
    const repaired = repairTruncatedJson(trimmed);
    if (repaired) return JSON.parse(repaired);
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
    stop_reason?: string;
  };
  const raw = data.content?.find((c) => c.type === "text")?.text;
  if (!raw) return { json: null, model, detail: "lege AI-respons" };

  const truncated = data.stop_reason === "max_tokens";
  try {
    return {
      json: extractJsonObject(raw),
      model,
      detail: truncated ? `AI · ${model} (antwoord afgekapt, deels hersteld)` : `AI · ${model}`,
    };
  } catch {
    return {
      json: null,
      model,
      detail: truncated
        ? `AI-antwoord afgekapt op max_tokens (${raw.length} tekens) en niet te herstellen`
        : "ongeldige JSON van AI",
    };
  }
}
