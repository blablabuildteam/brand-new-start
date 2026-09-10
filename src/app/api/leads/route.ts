import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listAgencyLeads, reviewLead } from "@/lib/opportunity";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await listAgencyLeads();
  return NextResponse.json(data);
}

const Body = z.object({
  id: z.string().min(1),
  action: z.enum(["confirmed", "rejected"]),
  clientName: z.string().min(2).max(80).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  const lead = await reviewLead(parsed.data.id, parsed.data.action, parsed.data.clientName);
  if (!lead) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}
