import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { deskCacheHeaders, readLeadsPayload } from "@/lib/desk-payloads";
import { loadHuntSettings } from "@/lib/hunt";
import { reopenLead, reviewLead } from "@/lib/opportunity";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = await readLeadsPayload();
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
  await loadHuntSettings();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  try {
    const lead =
      parsed.data.action === "reopen"
        ? await reopenLead(parsed.data.id)
        : await reviewLead(parsed.data.id, parsed.data.action, parsed.data.clientName);
    if (!lead) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 200) : "opslaan mislukt" },
      { status: 400 }
    );
  }
}
