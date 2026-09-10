import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCrmOpportunities } from "@/lib/crm";
import { loadHuntSettings } from "@/lib/hunt";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const items = await listCrmOpportunities();
  return NextResponse.json({
    items,
    counts: {
      all: items.length,
      bureau: items.filter((i) => i.lane === "bureau").length,
      direct: items.filter((i) => i.lane === "direct").length,
      withHm: items.filter((i) => i.hiringManager).length,
    },
  });
}
