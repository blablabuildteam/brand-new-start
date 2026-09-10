import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { aiGuessEndClient, hasOpenAiKey } from "@/lib/ai-end-client";
import { leadSourceForAi, saveAiGuess } from "@/lib/opportunity";

export const maxDuration = 60;

const Body = z.object({
  id: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasOpenAiKey()) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY ontbreekt",
        detail: "no-openai-key",
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
    const result = await aiGuessEndClient({
      title: src.title,
      text: src.text,
      agencyName: src.agencyName,
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
      lead,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "AI-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
