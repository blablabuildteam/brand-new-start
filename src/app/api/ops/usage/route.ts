import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { buildUsageOverview } from "@/lib/usage-overview";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const days = Number(new URL(req.url).searchParams.get("days")) || 60;
  const overview = await buildUsageOverview(Math.min(Math.max(days, 7), 180));
  return NextResponse.json(overview, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
