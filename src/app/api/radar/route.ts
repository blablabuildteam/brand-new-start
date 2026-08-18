import { NextResponse } from "next/server";
import { getRadarDetail, listRadar, listSignals, stats } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { channelLabel, lastSyncByChannel, lastSyncOverall, listSyncRuns } from "@/lib/sync-log";
import { enabledPlatforms } from "@/lib/platforms";
import { loadHuntSettings } from "@/lib/hunt";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const hunt = await loadHuntSettings();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const detail = await getRadarDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ detail });
  }

  const radarRows = await listRadar();
  function withChannel<T extends { source: string; raw?: unknown }>(s: T) {
    const channel =
      (s.raw && typeof s.raw === "object" && (s.raw as { channel?: string }).channel) ||
      (s.source === "tender" ? "tenderned" : s.source === "pulse" ? "pulse" : "seed");
    return { ...s, channel, channelLabel: channelLabel(String(channel)) };
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

  return NextResponse.json({
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
  });
}
