import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listActionQueue, listCrmOpportunities, setCrmStage } from "@/lib/crm";
import { loadHuntSettings } from "@/lib/hunt";
import type { CrmStage } from "@/lib/desk-meta";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const items = await listCrmOpportunities();
  const actionQueue = listActionQueue(items);
  return NextResponse.json({
    items,
    actionQueue,
    counts: {
      all: items.length,
      bureau: items.filter((i) => i.lane === "bureau").length,
      direct: items.filter((i) => i.lane === "direct").length,
      withHm: items.filter((i) => i.hiringManager).length,
      byStage: {
        nieuw: items.filter((i) => i.stage === "nieuw").length,
        bevestigd: items.filter((i) => i.stage === "bevestigd").length,
        hm: items.filter((i) => i.stage === "hm").length,
        outreach: items.filter((i) => i.stage === "outreach").length,
        won: items.filter((i) => i.stage === "won").length,
        lost: items.filter((i) => i.stage === "lost").length,
      },
    },
  });
}

const Body = z.object({
  id: z.string().min(1),
  stage: z.enum(["nieuw", "bevestigd", "hm", "outreach", "won", "lost"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  const item = await setCrmStage(parsed.data.id, parsed.data.stage as CrmStage);
  if (!item) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}
