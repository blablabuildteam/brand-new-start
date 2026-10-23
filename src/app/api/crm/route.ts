import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { listActionQueue, listCrmDesk, setCrmStage } from "@/lib/crm";
import { loadHuntSettings } from "@/lib/hunt";
import { hasLushaKey } from "@/lib/lusha";
import type { CrmStage } from "@/lib/desk-meta";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const { items, backlog, results } = await listCrmDesk();
  const actionQueue = listActionQueue(items);
  return NextResponse.json({
    items,
    actionQueue,
    backlog,
    results,
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
    lusha: hasLushaKey(),
  });
}

const num = z.number().finite().min(0).max(10_000_000).nullable().optional();

const Body = z.object({
  id: z.string().min(1),
  stage: z.enum(["nieuw", "bevestigd", "hm", "outreach", "won", "lost"]),
  deal: z
    .object({
      marginPerHour: num,
      hoursPerWeek: num,
      weeks: num,
      dealEur: num,
      note: z.string().max(300).nullable().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  const item = await setCrmStage(parsed.data.id, parsed.data.stage as CrmStage, {
    by: session.email,
    deal: parsed.data.deal,
  });
  if (!item) {
    logFromSession(session, {
      level: "warn",
      kind: "api.error",
      summary: `CRM stage · niet gevonden`,
      path: "/api/crm",
      status: 404,
      detail: { id: parsed.data.id, stage: parsed.data.stage },
    });
    return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  }
  const dealEur = item.deal?.dealEur;
  logFromSession(session, {
    level: "info",
    kind: "crm.stage",
    summary: `Stage → ${parsed.data.stage} · ${(item.endClient || item.title || "").slice(0, 80)}${
      parsed.data.stage === "won" && dealEur ? ` · €${dealEur.toLocaleString("nl-NL")}` : ""
    }`,
    path: "/api/crm",
    status: 200,
    detail: { id: item.id, stage: parsed.data.stage, lane: item.lane, dealEur: dealEur ?? null },
  });
  return NextResponse.json({ ok: true, item });
}
