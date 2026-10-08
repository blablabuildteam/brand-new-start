import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";
import type { ClientGuess } from "@/lib/end-client";

const META_ID = "desk-meta";

export type CrmStage = "nieuw" | "bevestigd" | "hm" | "outreach" | "won" | "lost";

export type DeskAlert = {
  id: string;
  at: string;
  kind: "hot" | "confirm" | "hm" | "info" | "sync" | "watchlist";
  title: string;
  body: string;
  href?: string;
  read: boolean;
};

export type HmHitStored = {
  name: string;
  title: string | null;
  url: string | null;
  score?: number;
  /** Summiere redenatie waarom deze kandidaat hoog scoort. */
  why?: string;
  email?: string | null;
  phone?: string | null;
  lushaAt?: string | null;
  lushaStatus?: "ok" | "empty" | "restricted" | null;
};

export type HmGuessRow = {
  hiringManager: string | null;
  hiringManagerTitle: string | null;
  hiringManagerUrl: string | null;
  hiringManagerEmail?: string | null;
  hiringManagerPhone?: string | null;
  lushaAt?: string | null;
  lushaStatus?: "ok" | "empty" | "restricted" | null;
  hits: HmHitStored[];
  planKeywords?: string;
  detail?: string;
  at: string;
};

function profileKey(url: string | null | undefined) {
  if (!url) return "";
  return url.split("?")[0].replace(/\/+$/, "").toLowerCase();
}

/** A fresh LinkedIn search must not wipe mail/tel already paid for. */
export function withPreservedContacts(prev: HmGuessRow | undefined, next: HmGuessRow): HmGuessRow {
  if (!prev) return next;
  const oldByUrl = new Map<string, HmHitStored>();
  for (const hit of prev.hits || []) {
    const key = profileKey(hit.url);
    if (key) oldByUrl.set(key, hit);
  }
  const hits = next.hits.map((hit) => {
    const old = oldByUrl.get(profileKey(hit.url));
    if (!old?.lushaAt && !old?.email && !old?.phone) return hit;
    return {
      ...hit,
      email: old.email ?? null,
      phone: old.phone ?? null,
      lushaAt: old.lushaAt ?? null,
      lushaStatus: old.lushaStatus ?? null,
    };
  });
  const top = hits.find((h) => profileKey(h.url) === profileKey(next.hiringManagerUrl));
  const samePerson = profileKey(prev.hiringManagerUrl) === profileKey(next.hiringManagerUrl);
  return {
    ...next,
    hits,
    hiringManagerEmail: top?.email ?? (samePerson ? prev.hiringManagerEmail ?? null : null),
    hiringManagerPhone: top?.phone ?? (samePerson ? prev.hiringManagerPhone ?? null : null),
    lushaAt: top?.lushaAt ?? (samePerson ? prev.lushaAt ?? null : null),
    lushaStatus: top?.lushaStatus ?? (samePerson ? prev.lushaStatus ?? null : null),
  };
}

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

/** AI heeft gezocht maar geen opdrachtgever gevonden — niet nog eens betalen. */
export type AiMissRow = {
  at: string;
  detail: string;
  notAssignment?: boolean;
};

/** Laatste keer dat we het LinkedIn-profiel van een recruiter echt bij Apify hebben opgehaald. */
export type FeedCheck = {
  at: string;
  newestUrl?: string | null;
  /** Laatst gelezen headline/occupation van de posts-actor. */
  headline?: string | null;
  /** Geparseerde werkgever, als bekend. */
  employer?: string | null;
  /** Wanneer we signaleerden dat dit niet meer bij het watchlist-bureau lijkt. */
  leftAgencyAt?: string | null;
};

/** Bedrijven die geen eindklant bleken (bureau/consultancy) — nooit meer op Jobboards. */
export type RejectedCompany = {
  name: string;
  at: string;
  by?: string;
};

/** Teller AI-research vandaag — voor dagplafond (geschatte €). */
export type AiDaySpend = {
  /** YYYY-MM-DD (UTC) */
  day: string;
  count: number;
};

export type DeskMeta = {
  leadReviews: Record<string, ReviewRow>;
  aiGuesses: Record<string, AiRow>;
  aiMisses: Record<string, AiMissRow>;
  /** keyed by genormaliseerde LinkedIn-URL */
  feedChecks: Record<string, FeedCheck>;
  crmStages: Record<string, CrmStage>;
  /** Hiring-manager results keyed by CRM id (crm_bureau_* / crm_direct_*). */
  hmGuesses: Record<string, HmGuessRow>;
  /** keyed by genormaliseerde bedrijfsnaam */
  rejectedCompanies: Record<string, RejectedCompany>;
  alerts: DeskAlert[];
  aiDaySpend: AiDaySpend | null;
};

const emptyMeta = (): DeskMeta => ({
  leadReviews: {},
  aiGuesses: {},
  aiMisses: {},
  feedChecks: {},
  crmStages: {},
  hmGuesses: {},
  rejectedCompanies: {},
  alerts: [],
  aiDaySpend: null,
});

const g = globalThis as unknown as { __bnsDeskMeta?: DeskMeta; __bnsDeskMetaStale?: boolean };

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
      aiMisses: raw?.aiMisses && typeof raw.aiMisses === "object" ? raw.aiMisses : {},
      feedChecks: raw?.feedChecks && typeof raw.feedChecks === "object" ? raw.feedChecks : {},
      crmStages: raw?.crmStages && typeof raw.crmStages === "object" ? raw.crmStages : {},
      hmGuesses: raw?.hmGuesses && typeof raw.hmGuesses === "object" ? raw.hmGuesses : {},
      rejectedCompanies:
        raw?.rejectedCompanies && typeof raw.rejectedCompanies === "object" ? raw.rejectedCompanies : {},
      alerts: Array.isArray(raw?.alerts) ? raw!.alerts.slice(0, 80) : [],
      aiDaySpend:
        raw?.aiDaySpend &&
        typeof raw.aiDaySpend === "object" &&
        typeof raw.aiDaySpend.day === "string" &&
        typeof raw.aiDaySpend.count === "number"
          ? { day: raw.aiDaySpend.day, count: raw.aiDaySpend.count }
          : null,
    };
    g.__bnsDeskMeta = next;
    g.__bnsDeskMetaStale = false;
    return next;
  } catch {
    // Fall back to whatever we have, but remember that it may be incomplete so
    // a following save cannot overwrite the row with an empty blob.
    g.__bnsDeskMetaStale = true;
    return mem();
  }
}

/** Drop a lead's review + AI miss, so it is open again. */
export async function forgetLeadVerdict(id: string): Promise<DeskMeta> {
  const prev = await loadDeskMeta();
  const leadReviews = { ...prev.leadReviews };
  const aiMisses = { ...prev.aiMisses };
  delete leadReviews[id];
  delete aiMisses[id];
  return saveDeskMeta({}, { ...prev, leadReviews, aiMisses });
}

export async function saveDeskMeta(patch: Partial<DeskMeta>, base?: DeskMeta): Promise<DeskMeta> {
  const prev = base ?? (await loadDeskMeta());
  if (hasDatabase() && g.__bnsDeskMetaStale) {
    throw new Error("Desk-data kon niet gelezen worden — niet opgeslagen om verlies te voorkomen.");
  }
  const next: DeskMeta = {
    leadReviews: { ...prev.leadReviews, ...patch.leadReviews },
    aiGuesses: { ...prev.aiGuesses, ...patch.aiGuesses },
    aiMisses: { ...prev.aiMisses, ...patch.aiMisses },
    feedChecks: { ...prev.feedChecks, ...patch.feedChecks },
    crmStages: { ...prev.crmStages, ...patch.crmStages },
    hmGuesses: { ...prev.hmGuesses, ...patch.hmGuesses },
    rejectedCompanies: { ...prev.rejectedCompanies, ...patch.rejectedCompanies },
    alerts: patch.alerts ?? prev.alerts,
    aiDaySpend: patch.aiDaySpend !== undefined ? patch.aiDaySpend : prev.aiDaySpend,
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
    id:
      alert.id ||
      `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    href: alert.href,
    read: false,
  };
  // A caller-supplied id means "this event, once" — re-running an HM search or
  // re-confirming a lead should refresh the alert, not stack duplicates.
  const alerts = [row, ...meta.alerts.filter((a) => a.id !== row.id)].slice(0, 80);
  const saved = await saveDeskMeta({ alerts });

  const { postAlertWebhook } = await import("@/lib/alert-webhook");
  await postAlertWebhook({ title: row.title, body: row.body, href: row.href });
  return saved;
}

export async function markAlertsRead(ids?: string[]): Promise<DeskMeta> {
  const meta = await loadDeskMeta();
  const alerts = meta.alerts.map((a) =>
    !ids || ids.includes(a.id) ? { ...a, read: true } : a
  );
  return saveDeskMeta({ alerts });
}

function aiDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Hoeveel AI-research-runs nog mogen vandaag (conservatief × high €/st). */
export async function aiDaySlotsLeft(opts: { maxEur: number; eurPerRunHigh: number }) {
  const meta = await loadDeskMeta();
  const day = aiDayKey();
  const used = meta.aiDaySpend?.day === day ? meta.aiDaySpend.count : 0;
  const unit = Math.max(opts.eurPerRunHigh, 0.01);
  const cap = Math.floor(opts.maxEur / unit);
  return { day, used, left: Math.max(0, cap - used), cap };
}

export async function bumpAiDaySpend(n = 1) {
  const meta = await loadDeskMeta();
  const day = aiDayKey();
  const prev = meta.aiDaySpend?.day === day ? meta.aiDaySpend.count : 0;
  return saveDeskMeta({ aiDaySpend: { day, count: prev + n } }, meta);
}

export const CRM_STAGE_NL: Record<CrmStage, string> = {
  nieuw: "Nieuw",
  bevestigd: "Bevestigd",
  hm: "Manager",
  outreach: "Outreach",
  won: "Gewonnen",
  lost: "Afgelegd",
};
