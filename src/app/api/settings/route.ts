import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadHuntSettings, saveHuntSettings } from "@/lib/hunt";
import { z } from "zod";

const Patch = z.object({
  name: z.string().min(1).max(40).optional(),
  market: z.string().min(1).max(40).optional(),
  roles: z.array(z.string()).max(24).optional(),
  requireContract: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hunt = await loadHuntSettings();
  return NextResponse.json(hunt);
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  }
  const hunt = await saveHuntSettings(parsed.data);
  return NextResponse.json(hunt);
}
