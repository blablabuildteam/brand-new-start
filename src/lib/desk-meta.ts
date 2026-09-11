import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";
import type { ClientGuess } from "@/lib/end-client";

const META_ID = "desk-meta";

export type CrmStage = "nieuw" | "bevestigd" | "hm" | "outreach" | "won" | "lost";

export type DeskAlert = {
  id: string;
  at: string;
  kind: "hot" | "confirm" | "hm" | "info";
  title: string;
  body: string;
  href?: string;
  read: boolean;
};

type ReviewRow = {
  status: "confirmed" | "rejected";
  clientName?: string;
  at: string;
};

type AiRow = {
  guess: ClientGuess;
  at: string;
  model?: string;
};

export type DeskMeta = {
  leadReviews: Record<string, ReviewRow>;
  aiGuesses: Record<string, AiRow>;
  crmStages: Record<string, CrmStage>;
  alerts: DeskAlert[];
};

const emptyMeta = (): DeskMeta => ({
  leadReviews: {},
  aiGuesses: {},
  crmStages: {},
  alerts: [],
});

const g = globalThis as unknown as { __bnsDeskMeta?: DeskMeta };

function mem(): DeskMeta {
  if (!g.__bnsDeskMeta) g.__bnsDeskMeta = emptyMeta();
  return g.__bnsDeskMeta;
}

export async function loadDeskMeta(): Promise<DeskMeta> {
  if (!hasDatabase()) return mem();
  try {
    const db = getDb();
    const rows = await db.select().from(workspaceSettings).where(eq(workspaceSettings.id, META_ID)).limit(1);
    const raw = rows[0]?.data as Partial<DeskMeta> | undefined;
    const next: DeskMeta = {
      leadReviews: raw?.leadReviews && typeof raw.leadReviews === "object" ? raw.leadReviews : {},
      aiGuesses: raw?.aiGuesses && typeof raw.aiGuesses === "object" ? raw.aiGuesses : {},
      crmStages: raw?.crmStages && typeof raw.crmStages === "object" ? raw.crmStages : {},
      alerts: Array.isArray(raw?.alerts) ? raw!.alerts.slice(0, 40) : [],
    };
    g.__bnsDeskMeta = next;
    return next;
  } catch {
    return mem();
  }
}

export async function saveDeskMeta(patch: Partial<DeskMeta>): Promise<DeskMeta> {
  const prev = await loadDeskMeta();
  const next: DeskMeta = {
    leadReviews: { ...prev.leadReviews, ...patch.leadReviews },
    aiGuesses: { ...prev.aiGuesses, ...patch.aiGuesses },
    crmStages: { ...prev.crmStages, ...patch.crmStages },
    alerts: patch.alerts ?? prev.alerts,
  };
  g.__bnsDeskMeta = next;
  if (!hasDatabase()) return next;
  const db = getDb();
  await db
    .insert(workspaceSettings)
    .values({
      id: META_ID,
      data: next as unknown as typeof workspaceSettings.$inferInsert.data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: workspaceSettings.id,
      set: { data: next as unknown as typeof workspaceSettings.$inferInsert.data, updatedAt: new Date() },
    });
  return next;
}

export async function pushAlert(
  alert: Omit<DeskAlert, "id" | "at" | "read"> & { id?: string }
): Promise<DeskMeta> {
  const meta = await loadDeskMeta();
  const row: DeskAlert = {
    id: alert.id || `al_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    href: alert.href,
    read: false,
  };
  const alerts = [row, ...meta.alerts].slice(0, 40);
  const saved = await saveDeskMeta({ alerts });

  const hook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (hook) {
    void fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${row.title}*\n${row.body}${row.href ? `\n${row.href}` : ""}` }),
    }).catch(() => null);
  }
  return saved;
}

export async function markAlertsRead(ids?: string[]): Promise<DeskMeta> {
  const meta = await loadDeskMeta();
  const alerts = meta.alerts.map((a) =>
    !ids || ids.includes(a.id) ? { ...a, read: true } : a
  );
  return saveDeskMeta({ alerts });
}

export const CRM_STAGE_NL: Record<CrmStage, string> = {
  nieuw: "Nieuw",
  bevestigd: "Bevestigd",
  hm: "Manager",
  outreach: "Outreach",
  won: "Gewonnen",
  lost: "Afgelegd",
};
