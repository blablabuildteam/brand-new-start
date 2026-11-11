import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { pingPresence } from "@/lib/usage-presence";

export const dynamic = "force-dynamic";

const Body = z.object({
  path: z.string().max(120).optional(),
});

/** Lichte heartbeat: alleen als de tab zichtbaar is. Telt mee voor sessieduur. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const sessionRow = await pingPresence({
    email: session.email,
    role: session.role,
    path: parsed.data.path || "/",
  });
  return NextResponse.json({ ok: true, sessionId: sessionRow.id, lastAt: sessionRow.lastAt });
}
