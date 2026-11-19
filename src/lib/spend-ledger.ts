import { eq, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";

/**
 * Gemeten verbruik per dag (Europe/Amsterdam): AI-tokens + zoekopdrachten.
 * Apify meten we niet hier — dat komt direct uit de Apify-API (echte run-kosten).
 */

const LEDGER_ID = "spend-ledger";

export type SpendDay = {
  aiCalls?: number;
  aiUsd?: number;
  inTok?: number;
  outTok?: number;
  /** Claude server-side web_search */
  webSearches?: number;
  /** Firecrawl */
  fcSearches?: number;
  fcScrapes?: number;
};

export type SpendLedger = { days: Record<string, SpendDay> };

const g = globalThis as unknown as { __bnsSpend?: SpendLedger };

export function amsterdamDay(at: Date | string | number = Date.now()) {
  return new Date(at).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

/** Atomisch optellen — meerdere AI-calls lopen parallel. Fire-and-forget. */
export function recordSpend(delta: SpendDay) {
  const clean = Object.fromEntries(
    Object.entries(delta).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v !== 0)
  );
  if (!Object.keys(clean).length) return;
  const day = amsterdamDay();

  if (!hasDatabase()) {
    const store = (g.__bnsSpend ||= { days: {} });
    const cur = (store.days[day] ||= {}) as Record<string, number>;
    for (const [k, v] of Object.entries(clean)) cur[k] = (cur[k] || 0) + (v as number);
    return;
  }

  const json = JSON.stringify(clean);
  void getDb()
    .execute(sql`
      INSERT INTO workspace_settings (id, data, updated_at)
      VALUES (${LEDGER_ID}, jsonb_build_object('days', jsonb_build_object(${day}::text, ${json}::jsonb)), now())
      ON CONFLICT (id) DO UPDATE SET
        data = jsonb_set(
          CASE WHEN workspace_settings.data ? 'days' THEN workspace_settings.data
               ELSE workspace_settings.data || '{"days":{}}'::jsonb END,
          ARRAY['days', ${day}::text],
          coalesce(workspace_settings.data->'days'->${day}::text, '{}'::jsonb) || (
            SELECT jsonb_object_agg(
              d.key,
              coalesce((workspace_settings.data->'days'->${day}::text->>d.key)::numeric, 0)
                + (d.value #>> '{}')::numeric
            )
            FROM jsonb_each(${json}::jsonb) AS d
          ),
          true
        ),
        updated_at = now()
    `)
    .catch(() => undefined);
}

export async function loadSpendLedger(): Promise<SpendLedger> {
  if (!hasDatabase()) return g.__bnsSpend || { days: {} };
  try {
    const rows = await getDb()
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.id, LEDGER_ID))
      .limit(1);
    const data = rows[0]?.data as unknown as SpendLedger | undefined;
    return { days: data?.days && typeof data.days === "object" ? data.days : {} };
  } catch {
    return { days: {} };
  }
}
