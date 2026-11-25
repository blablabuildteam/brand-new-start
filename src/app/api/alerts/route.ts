import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { loadDeskMeta, markAlertsRead } from "@/lib/desk-meta";
import { isDemoUser } from "@/lib/demo-mode";
import { demoScopeOf, getDemoAlerts, hydrateDemo, markDemoAlertsRead, persistDemo } from "@/lib/demo-workspace";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(session)) {
    const scope = demoScopeOf(session);
    await hydrateDemo(scope);
    return NextResponse.json({ ...getDemoAlerts(scope), demoMode: true });
  }
  const meta = await loadDeskMeta();
  const unread = meta.alerts.filter((a) => !a.read).length;
  return NextResponse.json({ alerts: meta.alerts, unread });
}

const Body = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  if (isDemoUser(session)) {
    const ids = parsed.data.all ? undefined : parsed.data.ids;
    const scope = demoScopeOf(session);
    await hydrateDemo(scope);
    const out = markDemoAlertsRead(scope, ids);
    await persistDemo(scope);
    return NextResponse.json({ ...out, demoMode: true });
  }
  const meta = parsed.data.all
    ? await markAlertsRead()
    : await markAlertsRead(parsed.data.ids);
  return NextResponse.json({
    alerts: meta.alerts,
    unread: meta.alerts.filter((a) => !a.read).length,
  });
}
