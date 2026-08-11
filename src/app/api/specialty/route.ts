import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSpecialty } from "@/lib/ingest/linkedin";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ specialty: getSpecialty() });
}
