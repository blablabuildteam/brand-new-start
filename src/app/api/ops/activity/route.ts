import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { listActivity, type ActivityLevel } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const levelRaw = url.searchParams.get("level") || "all";
  const level = (["all", "info", "warn", "error"].includes(levelRaw)
    ? levelRaw
    : "all") as ActivityLevel | "all";
  const actor = url.searchParams.get("actor") || undefined;
  const kind = url.searchParams.get("kind") || undefined;
  const limit = Number(url.searchParams.get("limit")) || 200;

  const events = await listActivity({ limit, level, actor, kind });
  return NextResponse.json({
    ok: true,
    events,
    note: "Alleen voor blablabuild — niet zichtbaar voor recruiters.",
  });
}
