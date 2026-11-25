/**
 * Anthropic Claude client for desk AI (eindklant + extract).
 * Quality-first: Claude Sonnet 5.5 by default (override with ANTHROPIC_MODEL, e.g. claude-opus-5-5).
 */

import { recordSpend } from "@/lib/spend-ledger";
import { flagSystemProblem } from "@/lib/system-alerts";

export function hasAiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** @deprecated use hasAiKey — kept for older import sites */
export function hasOpenAiKey() {
  return hasAiKey();
}

const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Vangnet als het gekozen model faalt (400/404). Sonnet 4.5 gaat 30 nov 2026 uit de lucht. */
const LEGACY_MODEL = "claude-sonnet-5";

export function aiModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/** Claude 3 / 4.0–4.6 accept `temperature` on 2023-06-01; newer models reject it. */
function isLegacyModel(model: string) {
  return /^claude-(3|[a-z]+-4(-[0-6])?(-\d{8})?$)/.test(model);
}

/** USD per million tokens (input, output). */
function priceFor(model: string): [number, number] {
  if (/haiku-5/.test(model)) return [0.1, 0.5];
  if (/haiku/.test(model)) return [1, 5];
  if (/fable/.test(model)) return [8, 40];
  if (/opus-5/.test(model)) return [4, 20];
  if (/opus/.test(model)) return [5, 25];
  if (/sonnet-5/.test(model)) return [2, 10];
  return [3, 15];
}

const WEB_SEARCH_USD = 0.01;

function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

export type Effort = "low" | "medium" | "high";

type ContentBlock = {
  type?: string;
  text?: string;
  content?: unknown;
  [k: string]: unknown;
};

type MessagesResponse = {
  content?: ContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
};

function trackUsage(model: string, usage: MessagesResponse["usage"]) {
  if (!usage) return;
  const [pin, pout] = priceFor(model);
  const inTok =
    (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  recordSpend({
    aiCalls: 1,
    inTok,
    outTok,
    webSearches: searches,
    aiUsd: (inTok * pin + outTok * pout) / 1_000_000 + searches * WEB_SEARCH_USD,
  });
}

/**
 * One Messages request. Modern models: API 2026-10-21, effort instead of temperature,
 * thinking tokens share `max_tokens` so we add headroom. Legacy models keep the old shape.
 */
async function callMessages(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: unknown }[];
  maxTokens: number;
  effort: Effort;
  temperature?: number;
  tools?: unknown[];
}): Promise<{ ok: true; data: MessagesResponse } | { ok: false; status: number; error: string }> {
  const legacy = isLegacyModel(opts.model);
  const headroom = opts.effort === "low" ? 3000 : opts.effort === "medium" ? 8000 : 16000;
  const body: Record<string, unknown> = {
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
    max_tokens: legacy ? opts.maxTokens : opts.maxTokens + headroom,
  };
  if (legacy) body.temperature = opts.temperature ?? 0.2;
  else {
    body.output_config = { effort: opts.effort };
    // Bij een veiligheidsweigering draait de API dezelfde vraag zelf op een fallback-model.
    body.fallbacks = "default";
  }
  if (opts.tools?.length) body.tools = opts.tools;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey(),
        "anthropic-version": legacy ? "2023-06-01" : "2026-10-21",
        ...(legacy ? {} : { "anthropic-beta": "server-side-fallback-2026-07-01" }),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const problem =
        res.status === 401 || res.status === 403
          ? "Anthropic API-key ongeldig of ingetrokken. Zet een nieuwe ANTHROPIC_API_KEY in Vercel."
          : /credit|billing|balance/i.test(err)
            ? "Anthropic-tegoed is op. Waardeer op in de Anthropic console."
            : res.status === 404
              ? `AI-model ${opts.model} bestaat niet (meer).`
              : res.status === 429
                ? "AI rate limit geraakt — te veel posts tegelijk. Probeer het over een paar minuten opnieuw."
                : null;
      if (problem) {
        flagSystemProblem({ key: `ai-${res.status}`, title: "AI werkt niet", body: problem, href: "/leads" });
      }
      return { ok: false, status: res.status, error: err.slice(0, 220) };
    }
    const data = (await res.json()) as MessagesResponse;
    trackUsage(opts.model, data.usage);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "netwerkfout" };
  }
}

/** Final answer text: every text block after the last tool result (citations split text into blocks). */
function finalText(content: ContentBlock[] = []) {
  let lastTool = -1;
  content.forEach((b, i) => {
    if (b.type && /tool_result$/.test(b.type)) lastTool = i;
  });
  return content
    .slice(lastTool + 1)
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
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

const JSON_ONLY = "Antwoord UITSLUITEND met één geldig JSON-object. Geen markdown, geen uitleg buiten JSON.";

/** Try the configured model; on a request-level failure fall back to the legacy model once. */
async function callWithFallback(
  opts: Omit<Parameters<typeof callMessages>[0], "model">
): Promise<{ model: string; res: Awaited<ReturnType<typeof callMessages>> }> {
  const model = aiModel();
  const res = await callMessages({ ...opts, model });
  if (res.ok || model === LEGACY_MODEL || ![400, 404].includes(res.status)) return { model, res };
  const legacy = await callMessages({ ...opts, model: LEGACY_MODEL, tools: undefined });
  return legacy.ok ? { model: LEGACY_MODEL, res: legacy } : { model, res };
}

/**
 * Messages API call that returns parsed JSON from the model text.
 */
export async function aiJsonCompletion(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  effort?: Effort;
}): Promise<{ json: unknown; model: string; detail: string } | { json: null; model: string; detail: string }> {
  if (!anthropicKey()) {
    return { json: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt" };
  }

  const { model, res } = await callWithFallback({
    system: `${opts.system}\n\n${JSON_ONLY}`,
    messages: [{ role: "user", content: opts.user }],
    maxTokens: opts.maxTokens ?? 1200,
    effort: opts.effort ?? "low",
    temperature: opts.temperature,
  });

  if (!res.ok) {
    return { json: null, model, detail: `Anthropic ${res.status}: ${res.error.slice(0, 180)}` };
  }

  if (res.data.stop_reason === "refusal") return { json: null, model, detail: "AI weigerde deze vraag" };
  const raw = finalText(res.data.content);
  if (!raw) return { json: null, model, detail: "lege AI-respons" };

  const truncated = res.data.stop_reason === "max_tokens";
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

export type WebSource = { title: string; url: string };

/**
 * Claude zoekt zelf op het web (server-side web_search), net als ChatGPT:
 * meerdere rondes, eigen vervolgvragen, en leest de pagina's die het vindt.
 * Geeft de gebruikte bronnen terug zodat wij bewijs kunnen wegen.
 */
export async function aiWebResearch(opts: {
  system: string;
  user: string;
  maxSearches?: number;
  maxTokens?: number;
  effort?: Effort;
}): Promise<
  | { json: unknown; model: string; detail: string; sources: WebSource[]; searches: string[] }
  | { json: null; model: string; detail: string; sources: WebSource[]; searches: string[] }
> {
  const model = aiModel();
  if (!anthropicKey()) {
    return { json: null, model: "", detail: "ANTHROPIC_API_KEY ontbreekt", sources: [], searches: [] };
  }
  const tools = [
    {
      // Nieuwe variant (dynamische filtering) op Sonnet/Opus 4.6+; oudere modellen houden de basisversie.
      type: isLegacyModel(model) ? "web_search_20250305" : "web_search_20260209",
      name: "web_search",
      max_uses: opts.maxSearches ?? 5,
      user_location: { type: "approximate", country: "NL", timezone: "Europe/Amsterdam" },
    },
  ];
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: opts.user },
  ];
  const all: ContentBlock[] = [];
  let data: MessagesResponse | null = null;

  for (let turn = 0; turn < 3; turn++) {
    const res = await callMessages({
      model,
      system: `${opts.system}\n\nGebruik eerst de web_search-tool (minstens 2 zoekopdrachten). Pas als je klaar bent met zoeken: ${JSON_ONLY}`,
      messages,
      maxTokens: opts.maxTokens ?? 1200,
      effort: opts.effort ?? "medium",
      tools,
    });
    if (!res.ok) {
      return {
        json: null,
        model,
        detail: `Anthropic ${res.status}: ${res.error.slice(0, 180)}`,
        sources: [],
        searches: [],
      };
    }
    data = res.data;
    all.push(...(data.content || []));
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }

  const sources: WebSource[] = [];
  const searches: string[] = [];
  const errors: string[] = [];
  for (const b of all) {
    if (b.type === "web_search_tool_result" && b.content && !Array.isArray(b.content)) {
      const code = (b.content as { error_code?: string }).error_code;
      if (code) errors.push(code);
    }
    if (b.type === "server_tool_use" && b.name === "web_search") {
      const q = (b.input as { query?: string } | undefined)?.query;
      if (q) searches.push(q);
    }
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as { type?: string; url?: string; title?: string }[]) {
        if (r.type === "web_search_result" && r.url && !sources.some((s) => s.url === r.url)) {
          sources.push({ url: r.url, title: (r.title || r.url).slice(0, 180) });
        }
      }
    }
  }

  const tag = `${model} · ${searches.length} webzoeken${errors.length ? ` · fout ${[...new Set(errors)].join(",")}` : ""}`;
  const raw = finalText(data?.content);
  if (!raw) return { json: null, model, detail: `lege AI-respons (${tag})`, sources, searches };
  try {
    return { json: extractJsonObject(raw), model, detail: `AI + web · ${tag}`, sources, searches };
  } catch {
    return { json: null, model, detail: `ongeldige JSON van AI (${tag})`, sources, searches };
  }
}
