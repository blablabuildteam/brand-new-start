import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDemoUser } from "@/lib/demo-mode";
import { addDemoSeconds, demoAnalyticsEnabled, trackDemoClick } from "@/lib/demo-analytics";

export const runtime = "nodejs";

/** Heartbeat + klik-tracking voor gepersonaliseerde demo's. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !isDemoUser(session) || !session.demoSlug) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.demoPreview || !demoAnalyticsEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = (await req.json().catch(() => ({}))) as {
    seconds?: number;
    kansId?: string;
  };

  try {
    if (typeof body.seconds === "number" && body.seconds > 0) {
      await addDemoSeconds(session.demoSlug, Math.min(120, Math.round(body.seconds)));
    }
    if (typeof body.kansId === "string" && body.kansId.trim()) {
      await trackDemoClick(session.demoSlug, body.kansId.trim());
    }
  } catch (err) {
    console.error("demo track", err);
    return NextResponse.json({ error: "track failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
