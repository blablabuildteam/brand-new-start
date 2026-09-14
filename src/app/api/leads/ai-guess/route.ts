import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasAiKey } from "@/lib/ai-client";
import { researchEndClient } from "@/lib/end-client-research";
import { leadSourceForAi, saveAiGuess } from "@/lib/opportunity";

export const maxDuration = 120;
export const runtime = "nodejs";

const Body = z.object({
  id: z.string().min(1),
  depth: z.enum(["standard", "deep"]).optional().default("standard"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasAiKey()) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY ontbreekt",
        detail: "no-anthropic-key",
      },
      { status: 503 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const src = await leadSourceForAi(parsed.data.id);
  if (!src) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });

  if (src.lead.status === "confirmed" || src.lead.status === "rejected") {
    return NextResponse.json({ error: "al beoordeeld" }, { status: 400 });
  }

  try {
    const result = await researchEndClient({
      title: src.title,
      text: src.text,
      agencyName: src.agencyName,
      recruiterName: src.lead.recruiter.name || undefined,
      depth: parsed.data.depth,
    });

    if (!result.guess) {
      return NextResponse.json(
        {
          ok: false,
          detail: result.detail,
          lead: src.lead,
        },
        { status: 200 }
      );
    }

    const lead = await saveAiGuess(parsed.data.id, result.guess, { model: result.model });
    return NextResponse.json({
      ok: true,
      detail: result.detail,
      model: result.model,
      report: result.report,
      lead,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "AI-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
