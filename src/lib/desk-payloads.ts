import { getSession, type SessionUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { loadDeskMeta } from "@/lib/desk-meta";
import { loadHuntSettings } from "@/lib/hunt";
import { listAgencyLeads } from "@/lib/opportunity";
import { enabledPlatforms } from "@/lib/platforms";
import {
  countPermanentJobs,
  listAgencySuggestions,
  listRadar,
  listSignals,
  stats,
} from "@/lib/store";
import { pendingFeedRecruiters } from "@/lib/ingest/recruiter-feeds";
import { channelLabel, lastSyncByChannel, lastSyncOverall, listSyncRuns } from "@/lib/sync-log";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function parseFeedPerson(line: string): {
  name: string;
  agency?: string;
  window?: "week" | "year";
  posts?: number;
} {
  const parts = line.split(" · ").map((s) => s.trim()).filter(Boolean);
  let posts: number | undefined;
  let window: "week" | "year" | undefined;
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1] || "")) {
    const mark = parts[parts.length - 2];
    if (mark === "week" || mark === "year") {
      posts = Number(parts.pop());
      window = parts.pop() as "week" | "year";
    }
  }
  return {
    name: parts[0] || line,
    agency: parts.slice(1).join(" · ") || undefined,
    window,
    posts,
  };
}

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
    // Bureau-vacatures van jobboards horen op Jobboards, niet tussen de posts.
    live: data.live.filter((l) => l.source !== "jobboard"),
    persistence: hasDatabase() ? ("postgres" as const) : ("memory" as const),
    sync: {
      lastFeed: feed
        ? { at: feed.at, kept: feed.kept, fetched: feed.fetched, mode: feed.mode }
        : null,
      last: last ? { at: last.at, channel: last.channel, label: last.label } : null,
      checkedAt,
      pending: pendingFeedRecruiters(meta.feedChecks),
      log: runs
        .filter((r) => r.channel === "recruiter-feed")
        .slice(0, 8)
        .map((r) => ({
          at: r.at,
          kept: r.kept,
          fetched: r.fetched,
          mode: r.mode,
          detail: r.detail,
          people: r.mode === "fresh" ? [] : (r.searched || []).map(parseFeedPerson),
          posts: (r.hits || [])
            .filter((h) => h.kept && h.title)
            .slice(0, 4)
            .map((h) => h.title),
        })),
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
  const [permanentFiltered, agencySuggestions, leadData] = await Promise.all([
    countPermanentJobs(),
    listAgencySuggestions().then((s) => s.length),
    listAgencyLeads(),
  ]);
  /**
   * Contract-vacatures van bureaus: geen eindklant in de tekst, maar wel het
   * bewijs dat er ergens budget is. Hier kun je de eindklant laten uitzoeken.
   */
  const agencyOpenings = leadData.live
    .filter((l) => l.source === "jobboard" && l.status !== "rejected")
    .map((l) => ({
      id: l.id,
      title: l.title,
      roleLabel: l.roleLabel,
      agency: l.agency.name,
      evidenceUrl: l.evidenceUrl,
      guess: l.guess,
      aiGuess: l.aiGuess,
      status: l.status,
      confirmedClient: l.confirmedClient,
      aiMiss: l.aiMiss || null,
      facts: l.facts,
    }));
  return {
    user: { email: session.email, role: session.role },
    stats: await stats(radarRows),
    radar,
    agencyOpenings,
    feed,
    workspace: hunt,
    sync: {
      last,
      byChannel,
      recent,
      permanentFiltered,
      agencySuggestions,
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
