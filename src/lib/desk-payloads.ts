import { getSession, type SessionUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { loadDeskMeta } from "@/lib/desk-meta";
import { loadHuntSettings } from "@/lib/hunt";
import { listAgencyLeads } from "@/lib/opportunity";
import { enabledPlatforms } from "@/lib/platforms";
import { listRadar, listSignals, stats } from "@/lib/store";
import { channelLabel, lastSyncByChannel, lastSyncOverall, listSyncRuns } from "@/lib/sync-log";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function deskCacheHeaders() {
  return NO_STORE;
}

/** Same JSON the browser gets from GET /api/leads. Dates become strings. */
export async function readLeadsPayload() {
  await loadHuntSettings();
  const [data, runs, meta] = await Promise.all([listAgencyLeads(), listSyncRuns(40), loadDeskMeta()]);
  const feed = runs.find((r) => r.channel === "recruiter-feed") || null;
  const last = runs[0] || null;
  const checkedAt =
    Object.values(meta.feedChecks)
      .map((c) => c.at)
      .sort()
      .at(-1) || null;
  return {
    ...data,
    persistence: hasDatabase() ? ("postgres" as const) : ("memory" as const),
    sync: {
      lastFeed: feed
        ? { at: feed.at, kept: feed.kept, fetched: feed.fetched, mode: feed.mode }
        : null,
      last: last ? { at: last.at, channel: last.channel, label: last.label } : null,
      checkedAt,
    },
  };
}

export async function readRadarPayload(session: SessionUser) {
  const hunt = await loadHuntSettings();
  const radarRows = await listRadar();
  function withChannel<T extends { source: string; raw?: unknown }>(s: T) {
    const raw = s.raw && typeof s.raw === "object" ? (s.raw as Record<string, unknown>) : null;
    const channel =
      (raw && typeof raw.channel === "string" && raw.channel) ||
      (s.source === "tender" ? "tenderned" : s.source === "pulse" ? "pulse" : "seed");
    const slim = raw && "description" in raw ? { ...raw, description: undefined } : raw;
    return { ...s, raw: slim, channel, channelLabel: channelLabel(String(channel)) };
  }
  const radar = radarRows.map((r) => ({
    ...r,
    signals: r.signals.map(withChannel),
    openings: (r.openings || []).map((o) => ({
      ...o,
      signals: o.signals.map(withChannel),
    })),
  }));
  const feedRows = await listSignals(24);
  const feed = feedRows.map(withChannel);
  const recent = await listSyncRuns(12);
  const last = recent[0] || (await lastSyncOverall());
  const byChannel = await lastSyncByChannel();
  return {
    user: { email: session.email, role: session.role },
    stats: await stats(radarRows),
    radar,
    feed,
    workspace: hunt,
    sync: {
      last,
      byChannel,
      recent,
      huntQueries: hunt.roles,
      boardQueries: hunt.roles,
      platformsEnabled: enabledPlatforms().length,
    },
  };
}

export async function readSessionRadarPayload() {
  const session = await getSession();
  if (!session) return null;
  return readRadarPayload(session);
}
