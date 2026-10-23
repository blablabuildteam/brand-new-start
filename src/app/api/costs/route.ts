import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildCostsPayload } from "@/lib/costs-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await buildCostsPayload(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
