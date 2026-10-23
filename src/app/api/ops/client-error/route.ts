import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().min(1).max(400),
  path: z.string().max(200).optional(),
  stack: z.string().max(1200).optional(),
  source: z.string().max(80).optional(),
});

/** Ongevangen UI-fouten van ingelogde users → activity_events. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  logFromSession(session, {
    level: "error",
    kind: "client.error",
    summary: parsed.data.message.slice(0, 200),
    path: parsed.data.path || null,
    status: null,
    detail: {
      stack: parsed.data.stack?.split("\n").slice(0, 8).join("\n"),
      source: parsed.data.source || "window",
    },
  });

  return NextResponse.json({ ok: true });
}
