import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

export type ResearchStreamResult<TLead> = {
  ok: boolean;
  lead?: TLead;
  error?: string;
  detail?: string;
};

/** POST /api/leads/ai-guess and follow the NDJSON progress stream. */
export async function streamResearch<TLead>(
  id: string,
  depth: ResearchDepth,
  onProgress: (p: ResearchProgress) => void
): Promise<ResearchStreamResult<TLead>> {
  const res = await fetch("/api/leads/ai-guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, depth }),
  });
  const ct = res.headers.get("content-type") || "";

  if (!ct.includes("ndjson")) {
    const j = (await res.json().catch(() => ({}))) as ResearchStreamResult<TLead>;
    if (res.status === 503) {
      return { ok: false, error: j.error || "ANTHROPIC_API_KEY ontbreekt in Vercel / .env.local" };
    }
    if (!res.ok) return { ok: false, error: j.error || "AI mislukt" };
    return j;
  }

  if (!res.body) return { ok: false, error: "geen stream" };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let doneEvent: ResearchStreamResult<TLead> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev: ResearchStreamResult<TLead> & ResearchProgress & { type?: string };
      try {
        ev = JSON.parse(line) as typeof ev;
      } catch {
        continue;
      }
      if (ev.type === "progress" && ev.label && ev.pct != null && ev.etaSec != null) {
        onProgress({
          step: ev.step || "run",
          label: ev.label,
          detail: ev.detail,
          pct: ev.pct,
          etaSec: ev.etaSec,
        });
      } else if (ev.type === "done" || ev.type === "error") {
        doneEvent = ev;
      }
    }
  }

  if (!doneEvent) return { ok: false, error: "Geen resultaat van research" };
  if (doneEvent.error) return { ok: false, error: doneEvent.error, lead: doneEvent.lead };
  if (!doneEvent.ok) {
    return {
      ok: false,
      lead: doneEvent.lead,
      detail: doneEvent.detail || "AI vond geen betrouwbare eindklant",
    };
  }
  return doneEvent;
}
