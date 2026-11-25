import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { isDemoUser } from "@/lib/demo-mode";
import { reviewDemoLead } from "@/lib/demo-workspace";
import { deskCacheHeaders, readLeadsPayload } from "@/lib/desk-payloads";
import { loadHuntSettings } from "@/lib/hunt";
import { reopenLead, reviewLead } from "@/lib/opportunity";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = await readLeadsPayload(session);
  return NextResponse.json(payload, { headers: deskCacheHeaders() });
}

const Body = z.object({
  id: z.string().min(1),
  action: z.enum(["confirmed", "rejected", "reopen"]),
  clientName: z.string().min(2).max(80).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  if (isDemoUser(session)) {
    const lead = reviewDemoLead(parsed.data.id, parsed.data.action, parsed.data.clientName, session.demoSlug);
    if (!lead) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    logFromSession(session, {
      level: "info",
      kind: `demo.lead.${parsed.data.action}`,
      summary: `Demo · ${parsed.data.action} · ${(lead.title || "").slice(0, 80)}`,
      path: "/api/leads",
      status: 200,
      detail: { id: lead.id, action: parsed.data.action, demo: true },
    });
    return NextResponse.json({ ok: true, lead, demoMode: true });
  }

  await loadHuntSettings();
  try {
    const lead =
      parsed.data.action === "reopen"
        ? await reopenLead(parsed.data.id)
        : await reviewLead(parsed.data.id, parsed.data.action, parsed.data.clientName);
    if (!lead) {
      logFromSession(session, {
        level: "warn",
        kind: "api.error",
        summary: `Lead niet gevonden · ${parsed.data.action}`,
        path: "/api/leads",
        status: 404,
        detail: { id: parsed.data.id },
      });
      return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    }
    const kind =
      parsed.data.action === "confirmed"
        ? "lead.confirm"
        : parsed.data.action === "rejected"
          ? "lead.reject"
          : "lead.reopen";
    const title = (lead.title || "").slice(0, 80);
    logFromSession(session, {
      level: "info",
      kind,
      summary:
        parsed.data.action === "confirmed"
          ? `Bevestigd · ${parsed.data.clientName || lead.confirmedClient || "?"} · ${title}`
          : parsed.data.action === "rejected"
            ? `Afgewezen · ${title}`
            : `Heropend · ${title}`,
      path: "/api/leads",
      status: 200,
      detail: { id: lead.id, action: parsed.data.action, clientName: parsed.data.clientName },
    });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "opslaan mislukt";
    logFromSession(session, {
      level: "error",
      kind: "api.error",
      summary: `Lead review mislukt · ${msg}`,
      path: "/api/leads",
      status: 400,
      detail: { id: parsed.data.id, action: parsed.data.action, error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
