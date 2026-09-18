import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listAgencyLeads } from "@/lib/opportunity";
import { patchSignalRaw } from "@/lib/store";
import { recordSync } from "@/lib/sync-log";
import { loadDeskMeta, saveDeskMeta, type HmGuessRow, type HmHitStored } from "@/lib/desk-meta";
import { enrichByLinkedin, hasLushaKey, normalizeLinkedinProfile } from "@/lib/lusha";

export const maxDuration = 30;

const Body = z.object({
  crmId: z.string().min(1),
  linkedinUrl: z.string().min(8).optional(),
  /** Set this person as the hiring manager without spending a Lusha credit. */
  pickOnly: z.boolean().optional(),
});

function keyOf(url: string | null | undefined) {
  return normalizeLinkedinProfile(url) || "";
}

function promote(row: HmGuessRow, url: string, patch?: Partial<HmHitStored>): HmGuessRow {
  const key = keyOf(url);
  const hits = row.hits.map((hit) => (keyOf(hit.url) === key ? { ...hit, ...patch } : hit));
  const hit = hits.find((h) => keyOf(h.url) === key);
  if (!hit) return row;
  return {
    ...row,
    hiringManager: hit.name,
    hiringManagerTitle: hit.title,
    hiringManagerUrl: hit.url,
    hiringManagerEmail: hit.email ?? null,
    hiringManagerPhone: hit.phone ?? null,
    lushaAt: hit.lushaAt ?? null,
    lushaStatus: hit.lushaStatus ?? null,
    hits,
    at: new Date().toISOString(),
  };
}

async function persist(crmId: string, row: HmGuessRow) {
  await saveDeskMeta({
    hmGuesses: { [crmId]: row },
    crmStages: { [crmId]: "hm" },
  });
  if (!crmId.startsWith("crm_bureau_")) return;
  const leadId = crmId.replace("crm_bureau_", "");
  const leads = await listAgencyLeads();
  const lead = [...leads.live, ...leads.demo].find((l) => l.id === leadId);
  if (lead?.signalId) {
    await patchSignalRaw(lead.signalId, { bureauHm: row, crmStage: "hm" });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  const { crmId, pickOnly } = parsed.data;
  const meta = await loadDeskMeta();
  const current = meta.hmGuesses[crmId];
  if (!current?.hits?.length) {
    return NextResponse.json({ error: "Eerst een hiring manager zoeken." }, { status: 400 });
  }

  const linkedinUrl = parsed.data.linkedinUrl || current.hiringManagerUrl || "";
  const profile = normalizeLinkedinProfile(linkedinUrl);
  if (!profile || !current.hits.some((h) => keyOf(h.url) === profile)) {
    return NextResponse.json({ error: "Geen LinkedIn-profiel bij deze kans." }, { status: 400 });
  }

  if (pickOnly) {
    const row = promote(current, profile);
    await persist(crmId, row);
    return NextResponse.json({ ok: true, picked: true, ...publicContact(row) });
  }

  const existing = current.hits.find((h) => keyOf(h.url) === profile);
  if (existing?.lushaAt && (existing.email || existing.phone || existing.lushaStatus)) {
    const row = promote(current, profile);
    if (row.hiringManagerUrl !== current.hiringManagerUrl) await persist(crmId, row);
    return NextResponse.json({ ok: true, cached: true, ...publicContact(row) });
  }

  if (!hasLushaKey()) {
    return NextResponse.json(
      { error: "LUSHA_API_KEY ontbreekt — naam en LinkedIn staan er wel.", detail: "no-lusha-key" },
      { status: 503 }
    );
  }

  try {
    const found = await enrichByLinkedin(profile);
    const row = promote(current, profile, {
      email: found.email,
      phone: found.phone,
      lushaAt: new Date().toISOString(),
      lushaStatus: found.status,
    });
    await persist(crmId, row);
    await recordSync({
      channel: "lusha",
      label: "Lusha contact",
      mode: "lusha",
      detail: `${found.detail} · ${found.creditsCharged} cr`,
      fetched: 1,
      kept: found.status === "ok" ? 1 : 0,
      searched: [existing?.name || profile],
      hits: [
        {
          company: crmId,
          title: `${existing?.name || "HM"} · ${found.email || found.phone || found.detail}`,
          url: profile,
          kept: found.status === "ok",
          isNew: true,
        },
      ],
    });
    return NextResponse.json({
      ok: true,
      cached: false,
      creditsCharged: found.creditsCharged,
      detail: found.detail,
      ...publicContact(row),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 220) : "Lusha-fout";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function publicContact(row: HmGuessRow) {
  return {
    hiringManager: row.hiringManager,
    hiringManagerTitle: row.hiringManagerTitle,
    hiringManagerUrl: row.hiringManagerUrl,
    hiringManagerEmail: row.hiringManagerEmail || null,
    hiringManagerPhone: row.hiringManagerPhone || null,
    lushaStatus: row.lushaStatus || null,
    hits: row.hits,
  };
}
