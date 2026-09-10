import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { enabledPlatforms, PLATFORM_TARGETS } from "@/lib/platforms";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    platforms: PLATFORM_TARGETS,
    enabled: enabledPlatforms().length,
    note: "Careers-bronnen voor sync (technisch). Eindklanten komen uit de radar, niet uit een checklist.",
  });
}
