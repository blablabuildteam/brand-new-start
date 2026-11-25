import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { hasAiKey } from "@/lib/ai-client";
import { hasWeb } from "@/lib/research/web";
import { identifyLead } from "@/lib/lead-ai";
import { isDemoUser } from "@/lib/demo-mode";
import { demoAiOutcome, playDemoProgress } from "@/lib/demo-ai";
import {
  demoScopeOf,
  hydrateDemo,
  listDemoLeads,
  persistDemo,
  saveDemoAiGuess,
  saveDemoAiMiss,
} from "@/lib/demo-workspace";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(1),
  depth: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
});

function ndjsonResponse(write: (send: (obj: unknown) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      try {
        await write(send);
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 220) : "AI-fout";
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  // Demo: vast voorbeeldresultaat met echte voortgang — geen API-kosten, wel het echte gevoel.
  if (isDemoUser(session)) {
    const scope = demoScopeOf(session);
    await hydrateDemo(scope);
    const { id } = parsed.data;
    const current = listDemoLeads(scope).find((l) => l.id === id);
    if (!current) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    return ndjsonResponse(async (send) => {
      await playDemoProgress((p) => send({ type: "progress", ...p }));
      const outcome = demoAiOutcome(id);
      // Tijdens het zoeken kan de bezoeker elders iets hebben gewijzigd: eerst verse stand.
      await hydrateDemo(scope);
      logFromSession(session, {
        level: "info",
        kind: "demo.lead.ai",
        summary: `Demo AI · ${outcome.kind === "hit" ? outcome.guess.name : "geen opdracht"} · ${(current.title || id).slice(0, 60)}`,
        path: "/api/leads/ai-guess",
        status: 200,
        detail: { id, demo: true },
      });
      if (outcome.kind === "hit") {
        const lead = saveDemoAiGuess(id, outcome.guess, "demo", scope);
        await persistDemo(scope);
        send({
          type: "done",
          ok: true,
          detail: `Demo · ${outcome.queries.length} zoekopdrachten, ${outcome.sources.length} bronnen`,
          model: "demo",
          report: outcome.guess.report,
          hasWeb: true,
          lead,
        });
        return;
      }
      const lead = saveDemoAiMiss(id, outcome.detail, outcome.notAssignment, scope);
      await persistDemo(scope);
      send({ type: "done", ok: false, detail: outcome.detail, model: "demo", hasWeb: true, lead });
    });
  }

  // Standaard mag gratis/SERP-paden zonder Anthropic. Deep heeft Claude nodig.
  if (!hasAiKey() && parsed.data.depth === "deep") {
    logFromSession(session, {
      level: "error",
      kind: "api.error",
      summary: "AI diep · ANTHROPIC_API_KEY ontbreekt",
      path: "/api/leads/ai-guess",
      status: 503,
      detail: { id: parsed.data.id, detail: "no-anthropic-key" },
    });
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY ontbreekt",
        detail: "no-anthropic-key",
      },
      { status: 503 }
    );
  }

  // Without Firecrawl the agent has no web access and can only reason over the
  // vacancy text plus our own history. That is a different (and weaker) product
  // than "deep research", so say so instead of quietly downgrading.
  if (!hasWeb() && parsed.data.depth === "deep") {
    logFromSession(session, {
      level: "error",
      kind: "api.error",
      summary: "AI diep · geen websearch",
      path: "/api/leads/ai-guess",
      status: 503,
      detail: { id: parsed.data.id, detail: "no-web" },
    });
    return NextResponse.json(
      {
        error:
          "Diep onderzoek vereist websearch — zet FIRECRAWL_API_KEY of kies Standaard.",
        detail: "no-web",
      },
      { status: 503 }
    );
  }

  return ndjsonResponse(async (send) => {
    const r = await identifyLead(parsed.data.id, parsed.data.depth, (p) => send({ type: "progress", ...p }));
    if (r.error) {
      logFromSession(session, {
        level: "error",
        kind: "lead.ai",
        summary: `AI mislukt · ${r.error.slice(0, 120)}`,
        path: "/api/leads/ai-guess",
        status: 500,
        detail: { id: parsed.data.id, depth: parsed.data.depth, error: r.error },
      });
      send({ type: "error", error: r.error });
      return;
    }
    const guessName = r.lead?.guess?.name || r.detail || "";
    logFromSession(session, {
      level: "info",
      kind: "lead.ai",
      summary: `AI ${parsed.data.depth} · ${(guessName || parsed.data.id).toString().slice(0, 80)}`,
      path: "/api/leads/ai-guess",
      status: 200,
      detail: {
        id: parsed.data.id,
        depth: parsed.data.depth,
        model: r.model,
        ok: r.ok,
      },
    });
    send({ type: "done", ok: r.ok, detail: r.detail, model: r.model, report: r.report, hasWeb: hasWeb(), lead: r.lead });
  });
}
