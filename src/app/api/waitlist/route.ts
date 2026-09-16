import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { databaseUrl, getDb } from "@/lib/db/client";
import { waitlistEntries } from "@/lib/db/schema";

export const runtime = "nodejs";

function makeId() {
  return `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureTable() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const sql = neon(url);
  await sql`
    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      company text,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist_entries (email)`;
  await sql`CREATE INDEX IF NOT EXISTS waitlist_created_idx ON waitlist_entries (created_at)`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      company?: string;
      note?: string;
    };

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const company = String(body.company || "").trim() || null;
    const note = String(body.note || "").trim() || null;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Geldig e-mailadres is verplicht" }, { status: 400 });
    }

    await ensureTable();
    const db = getDb();

    const existing = await db.select().from(waitlistEntries).where(eq(waitlistEntries.email, email)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ ok: true, already: true });
    }

    await db.insert(waitlistEntries).values({
      id: makeId(),
      name,
      email,
      company,
      note,
      createdAt: new Date(),
    });

    const { postAlertWebhook } = await import("@/lib/alert-webhook");
    await postAlertWebhook({
      title: "Wachtlijst",
      body: `${name} <${email}>${company ? ` · ${company}` : ""}${note ? `\n${note}` : ""}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("waitlist", err);
    return NextResponse.json({ error: "Kon niet opslaan. Probeer later opnieuw." }, { status: 500 });
  }
}
