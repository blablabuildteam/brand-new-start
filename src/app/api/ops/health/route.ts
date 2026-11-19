import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkIntegrations } from "@/lib/integration-health";

export const dynamic = "force-dynamic";

/** Dagelijkse cron (gratis: alleen account-checks) + handmatig voor ingelogde gebruikers. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isCron = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!isCron && !(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const list = await checkIntegrations({ fresh: true });
  return NextResponse.json({ ok: list.every((s) => s.ok !== false), integrations: list });
}
