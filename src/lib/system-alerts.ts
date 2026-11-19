/**
 * Meldingen als een koppeling (Apify, AI, Firecrawl) of sync misgaat.
 * Eén melding per probleem per dag; een batch van 100 mislukte AI-calls
 * geeft dus niet 100 meldingen.
 */

const g = globalThis as unknown as { __bnsSysAlerts?: Set<string> };

export function systemAlertId(key: string) {
  return `sys-${key}-${new Date().toISOString().slice(0, 10)}`;
}

export async function raiseSystemAlert(opts: { key: string; title: string; body: string; href?: string }) {
  const id = systemAlertId(opts.key);
  const seen = (g.__bnsSysAlerts ||= new Set());
  if (seen.has(id)) return;
  seen.add(id);
  try {
    const { loadDeskMeta, pushAlert } = await import("@/lib/desk-meta");
    const meta = await loadDeskMeta();
    if (meta.alerts.some((a) => a.id === id)) return;
    await pushAlert({ id, kind: "error", title: opts.title, body: opts.body, href: opts.href ?? "/sync" });
  } catch {
    seen.delete(id);
  }
}

/** Fire-and-forget variant for hot paths. */
export function flagSystemProblem(opts: { key: string; title: string; body: string; href?: string }) {
  void raiseSystemAlert(opts);
}
