import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { listDemoDashboard } from "@/lib/demo-analytics";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const rows = await listDemoDashboard();
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("admin demos", err);
    return NextResponse.json({ error: "Kon demo-analytics niet laden" }, { status: 500 });
  }
}
