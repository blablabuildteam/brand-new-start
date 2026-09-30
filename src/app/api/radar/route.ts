import { NextResponse } from "next/server";
import { getRadarDetail } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { deskCacheHeaders, readRadarPayload } from "@/lib/desk-payloads";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const detail = await getRadarDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ detail }, { headers: deskCacheHeaders() });
  }

  const payload = await readRadarPayload(session);
  return NextResponse.json(payload, { headers: deskCacheHeaders() });
}
