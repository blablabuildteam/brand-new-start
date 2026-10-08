import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { loadDeskMeta, saveDeskMeta } from "@/lib/desk-meta";

const Body = z.object({
  openingIds: z.array(z.string().min(1)).min(1).max(80),
  /** true = terugzetten */
  undo: z.boolean().optional(),
});

/** Wegzetten / herstellen van jobboard-openingen. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const meta = await loadDeskMeta();
  const dismissedOpenings = { ...meta.dismissedOpenings };
  const at = new Date().toISOString();

  if (parsed.data.undo) {
    for (const id of parsed.data.openingIds) delete dismissedOpenings[id];
  } else {
    for (const id of parsed.data.openingIds) {
      dismissedOpenings[id] = { at };
    }
  }

  await saveDeskMeta({}, { ...meta, dismissedOpenings });
  return NextResponse.json({
    ok: true,
    count: parsed.data.openingIds.length,
    undo: Boolean(parsed.data.undo),
  });
}
