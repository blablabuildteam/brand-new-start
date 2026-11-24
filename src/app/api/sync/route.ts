import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDemoUser } from "@/lib/demo-mode";
import { getDemoSyncPayload } from "@/lib/demo-workspace";
import { buildSyncDeskPayload } from "@/lib/sync-desk";

/** Sync-desk: per bron status, lock, kosten + recente runs. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isDemoUser(session)) {
    return NextResponse.json(getDemoSyncPayload());
  }

  const payload = await buildSyncDeskPayload();
  return NextResponse.json(payload);
}
