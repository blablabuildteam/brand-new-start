import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { loadHuntSettings } from "@/lib/hunt";
import { listAgencyLeads, reopenLead, reviewLead } from "@/lib/opportunity";
import { listSyncRuns } from "@/lib/sync-log";
import { loadDeskMeta } from "@/lib/desk-meta";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const [data, runs, meta] = await Promise.all([listAgencyLeads(), listSyncRuns(40), loadDeskMeta()]);
  const feed = runs.find((r) => r.channel === "recruiter-feed") || null;
  const last = runs[0] || null;
  const checkedAt = Object.values(meta.feedChecks)
    .map((c) => c.at)
    .sort()
    .at(-1) || null;
  return NextResponse.json({
    ...data,
    sync: {
      lastFeed: feed
        ? { at: feed.at, kept: feed.kept, fetched: feed.fetched, mode: feed.mode }
        : null,
      last: last ? { at: last.at, channel: last.channel, label: last.label } : null,
      checkedAt,
    },
  });
}

const Body = z.object({
  id: z.string().min(1),
  action: z.enum(["confirmed", "rejected", "reopen"]),
  clientName: z.string().min(2).max(80).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  try {
    const lead =
      parsed.data.action === "reopen"
        ? await reopenLead(parsed.data.id)
        : await reviewLead(parsed.data.id, parsed.data.action, parsed.data.clientName);
    if (!lead) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 200) : "opslaan mislukt" },
      { status: 400 }
    );
  }
}
