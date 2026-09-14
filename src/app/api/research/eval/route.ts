import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasAiKey } from "@/lib/ai-client";
import { EVAL_CASES, runEval } from "@/lib/research/eval";

export const maxDuration = 800;
export const runtime = "nodejs";

const Body = z.object({
  depth: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
  ids: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    cases: EVAL_CASES.map((c) => ({ id: c.id, expected: c.expected, note: c.note })),
  });
}

/** Run the research eval-set so prompt/scoring changes can be measured. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAiKey()) return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  try {
    const out = await runEval(parsed.data);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 240) : "eval-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
