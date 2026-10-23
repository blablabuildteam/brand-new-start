import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadHuntSettings } from "@/lib/hunt";
import { LUCKY_SHOT, listLuckyShots } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await loadHuntSettings();
  const data = await listLuckyShots();
  const firstAt = data.trackingSince
    ? new Date(data.trackingSince).getTime() + LUCKY_SHOT.luckyDays * 86_400_000
    : null;
  return NextResponse.json(
    {
      ...data,
      rules: LUCKY_SHOT,
      firstLuckyAt: firstAt && firstAt > Date.now() ? new Date(firstAt).toISOString() : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
