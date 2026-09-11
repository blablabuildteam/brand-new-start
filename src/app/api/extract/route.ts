import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { aiExtractVacancy, hasOpenAiKey } from "@/lib/ai-extract";
import { leadSourceForAi } from "@/lib/opportunity";
import { listSignals, patchSignalRaw } from "@/lib/store";
import { pushAlert } from "@/lib/desk-meta";

export const maxDuration = 60;

const Body = z.object({
  signalId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasOpenAiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt", detail: "no-anthropic-key" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  let title = "";
  let text = "";
  let companyHint: string | null = null;
  let signalId = parsed.data.signalId || null;

  if (parsed.data.leadId) {
    const src = await leadSourceForAi(parsed.data.leadId);
    if (!src) return NextResponse.json({ error: "lead niet gevonden" }, { status: 404 });
    title = src.title;
    text = src.text;
    companyHint = src.agencyName;
    signalId = src.lead.signalId || signalId;
  } else if (signalId) {
    const sigs = await listSignals(800);
    const s = sigs.find((x) => x.id === signalId);
    if (!s) return NextResponse.json({ error: "signaal niet gevonden" }, { status: 404 });
    const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
    title = s.title;
    text = [s.summary, typeof raw.description === "string" ? raw.description : ""].filter(Boolean).join("\n");
    companyHint = s.company?.name || null;
  } else {
    return NextResponse.json({ error: "signalId of leadId verplicht" }, { status: 400 });
  }

  try {
    const result = await aiExtractVacancy({ title, text, companyHint });
    if (!result.extract) {
      return NextResponse.json({ ok: false, detail: result.detail }, { status: 200 });
    }
    if (signalId) {
      await patchSignalRaw(signalId, { vacancyExtract: result.extract });
    }
    return NextResponse.json({
      ok: true,
      detail: result.detail,
      model: result.model,
      extract: result.extract,
      signalId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "extract-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Batch-extract for newest signals without extract (admin scouting boost). */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });
  if (!hasOpenAiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt" }, { status: 503 });
  }

  const limit = Math.min(8, Number(new URL(req.url).searchParams.get("limit") || 5));
  const sigs = await listSignals(120);
  const todo = sigs.filter((s) => {
    const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
    return !raw.vacancyExtract && s.source !== "hm-post";
  }).slice(0, limit);

  let done = 0;
  for (const s of todo) {
    const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
    const text = [s.summary, typeof raw.description === "string" ? raw.description : ""].filter(Boolean).join("\n");
    const result = await aiExtractVacancy({
      title: s.title,
      text,
      companyHint: s.company?.name,
    });
    if (result.extract) {
      await patchSignalRaw(s.id, { vacancyExtract: result.extract });
      done += 1;
      if ((result.extract.confidence || 0) >= 70 && result.extract.employment !== "unknown") {
        await pushAlert({
          kind: "info",
          title: `Extract: ${s.company?.name || "kans"}`,
          body: result.extract.summary || result.extract.role || s.title,
          href: "/radar",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, scanned: todo.length, extracted: done });
}
