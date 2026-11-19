import { raiseSystemAlert } from "@/lib/system-alerts";

/**
 * Gratis check of de koppelingen werken (alleen account-endpoints, geen scrape/AI-run).
 * Draait dagelijks via cron en bij het openen van de Sync-pagina (gecachet).
 */

export type IntegrationStatus = {
  id: "apify" | "ai" | "firecrawl";
  label: string;
  ok: boolean | null;
  detail: string;
};

const g = globalThis as unknown as { __bnsHealth?: { at: number; list: IntegrationStatus[] } };
const CACHE_MS = 10 * 60_000;

async function probe(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(6000) });
    return { status: res.status, text: res.ok ? "" : await res.text().catch(() => "") };
  } catch {
    return { status: 0, text: "niet bereikbaar" };
  }
}

function verdict(status: number, text: string, fix: string): { ok: boolean | null; detail: string } {
  if (status >= 200 && status < 300) return { ok: true, detail: "werkt" };
  if (status === 401 || status === 403) return { ok: false, detail: `key ongeldig of verlopen — ${fix}` };
  if (status === 402 || /credit|billing|balance/i.test(text)) return { ok: false, detail: "tegoed op" };
  if (status === 0) return { ok: null, detail: "niet bereikbaar (tijdelijk?)" };
  return { ok: null, detail: `onverwacht antwoord (${status})` };
}

export async function checkIntegrations(opts?: { fresh?: boolean; alert?: boolean }) {
  if (!opts?.fresh && g.__bnsHealth && Date.now() - g.__bnsHealth.at < CACHE_MS) return g.__bnsHealth.list;

  const apifyKey = process.env.APIFY_TOKEN?.trim();
  const aiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const fcKey = process.env.FIRECRAWL_API_KEY?.trim();

  const [apify, ai, fc] = await Promise.all([
    apifyKey ? probe(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(apifyKey)}`) : null,
    aiKey
      ? probe("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": aiKey, "anthropic-version": "2026-10-21" },
        })
      : null,
    fcKey
      ? probe("https://api.firecrawl.dev/v1/team/credit-usage", { headers: { Authorization: `Bearer ${fcKey}` } })
      : null,
  ]);

  const list: IntegrationStatus[] = [
    {
      id: "apify",
      label: "Apify (LinkedIn, feeds, managers)",
      ...(apify ? verdict(apify.status, apify.text, "nieuwe APIFY_TOKEN in Vercel") : { ok: false, detail: "geen APIFY_TOKEN" }),
    },
    {
      id: "ai",
      label: "AI (Claude)",
      ...(ai ? verdict(ai.status, ai.text, "nieuwe ANTHROPIC_API_KEY in Vercel") : { ok: false, detail: "geen ANTHROPIC_API_KEY" }),
    },
    {
      id: "firecrawl",
      label: "Online zoeken (Firecrawl)",
      ...(fc ? verdict(fc.status, fc.text, "nieuwe FIRECRAWL_API_KEY in Vercel") : { ok: false, detail: "geen FIRECRAWL_API_KEY" }),
    },
  ];
  g.__bnsHealth = { at: Date.now(), list };

  if (opts?.alert !== false) {
    for (const s of list.filter((x) => x.ok === false)) {
      await raiseSystemAlert({
        key: `health-${s.id}`,
        title: `${s.label.split(" (")[0]} werkt niet`,
        body: `${s.label}: ${s.detail}.`,
      });
    }
  }
  return list;
}
