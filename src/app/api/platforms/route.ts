import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadHuntSettings } from "@/lib/hunt";
import { enabledPlatforms, PLATFORM_TARGETS } from "@/lib/platforms";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await loadHuntSettings();
  const enabled = enabledPlatforms();
  return NextResponse.json({
    platforms: PLATFORM_TARGETS.map((p) => ({
      ...p,
      following: enabled.some((e) => e.id === p.id),
    })),
    enabled: enabled.length,
    note: "Welke eindklanten je volgt, regel je in Instellingen.",
  });
}
