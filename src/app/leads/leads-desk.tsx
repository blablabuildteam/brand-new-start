"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResearchMeter } from "@/components/research-meter";
import { kansenHref, regieHref } from "@/lib/desk-links";
import { DESK } from "@/lib/desk-labels";
import type { AgencyLead, LeadStatus } from "@/lib/opportunity";
import { isHuntWorthy, huntSignals } from "@/lib/end-client";
import { streamResearch } from "@/lib/research/client";
import { skipBatchResearch } from "@/lib/research/first-pass";
import { startingProgress } from "@/lib/research/progress";
import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

const MAX_PARALLEL_RESEARCH = 3;

type AiJob = {
  depth: ResearchDepth;
  progress: ResearchProgress;
  status: "queued" | "running" | "error";
  error?: string;
};

type Payload = {
  watchlist: {
    id: string;
    name: string;
    note?: string;
    recruiters: { name: string; title?: string; brand?: string; linkedinUrl?: string }[];
  }[];
  live: AgencyLead[];
  demo: AgencyLead[];
  sync?: {
    lastFeed: { at: string; kept: number; fetched: number; mode: string } | null;
    last: { at: string; channel: string; label: string } | null;
  };
};

function timeAgoShort(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = ms / 60000;
  if (m < 1) return "zojuist";
  if (m < 60) return `${Math.round(m)}m geleden`;
  const h = m / 60;
  if (h < 48) return `${Math.round(h)}u geleden`;
  return `${Math.round(h / 24)}d geleden`;
}

const STATUS_NL: Record<LeadStatus, string> = {
  suggest: "Sterk voorstel",
  review: "Review",
  weak: "Te dun",
  confirmed: "Bevestigd",
  rejected: "Afgewezen",
};

const STATUS_HINT: Record<LeadStatus, string> = {
  suggest: "Hoge zekerheid (≥80%) — meestal veilig om te bevestigen",
  review: "Twijfelzone (45–79%) — check bewijs of kies een optie",
  weak: "Weinige signalen (<45%) — zelf invullen of AI opnieuw",
  confirmed: "Door jou bevestigd",
  rejected: "Afgewezen",
};

function factsLine(l: AgencyLead) {
  return [l.facts.location, l.facts.start, l.facts.duration, l.facts.hours, l.facts.stack.slice(0, 4).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

function statusClass(status: LeadStatus) {
  if (status === "confirmed") return "border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]";
  if (status === "suggest") return "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]";
  if (status === "rejected") return "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]";
  return "border-[var(--warn)]/30 bg-[var(--warn-soft)] text-[var(--warn)]";
}

function whyLine(lead: AgencyLead): string | null {
  const g = lead.guess;
  if (!g) return null;
  if (g.source === "serp") return "Bevestigd in zoekresultaten, zonder Claude.";
  if (g.source === "deep") return "Via deep research.";
  if (g.source === "ai") return "Via AI-analyse van de post.";
  if (g.source === "rules") return "Naam of signaal staat in de post zelf.";
  const top = g.evidence?.[0];
  if (top?.label && top?.quote) {
    const q = top.quote.replace(/\s+/g, " ").trim();
    const short = q.length > 110 ? `${q.slice(0, 108)}…` : q;
    return `${top.label}: “${short}”`;
  }
  if (top?.label) return top.label;
  if (g.report?.hypothesis) return g.report.hypothesis;
  return "Lokale regels.";
}

function clientExplain(lead: AgencyLead): { kind: "ok" | "thin" | "hunt"; why: string } {
  if (lead.status === "confirmed") return { kind: "ok", why: "Door jou bevestigd." };
  if (lead.status === "rejected") return { kind: "ok", why: "Afgewezen." };
  const text = `${lead.title}\n${lead.summary || ""}`;
  const signals = huntSignals({ title: lead.title, text });
  const sporen = [...signals.project_signals, ...signals.hard_signals, signals.location.city || ""]
    .filter(Boolean)
    .slice(0, 3);
  const g = lead.guess;
  if (g && g.confidence >= 45) {
    const why = whyLine(lead);
    return { kind: "ok", why: `${g.confidence}% · ${why || "match op de post"}` };
  }
  if (!isHuntWorthy({ title: lead.title, text, prior: g })) {
    return {
      kind: "thin",
      why: sporen.length
        ? `Niet te vinden: de post noemt geen opdrachtgever. Alleen ${sporen.join(", ")} — te algemeen om te zoeken.`
        : "Niet te vinden: de post noemt geen opdrachtgever en geen uniek project, techniek of stad.",
    };
  }
  return {
    kind: "hunt",
    why: `Nog niet gezocht. Wel een spoor${sporen.length ? `: ${sporen.join(", ")}` : ""}. Start AI om de opdrachtgever te jagen.`,
  };
}

function statusShort(status: LeadStatus) {
  if (status === "suggest") return "Sterk";
  if (status === "review") return "Review";
  if (status === "weak") return "Te dun";
  if (status === "confirmed") return "Bevestigd";
  return "Weg";
}

function LeadCard({
  lead,
  busy,
  aiBusy,
  aiDepth,
  aiProgress,
  aiQueued,
  aiError,
  clientDraft,
  onClientDraft,
  onReview,
  onAiGuess,
  onHmSearch,
  hmBusy,
}: {
  lead: AgencyLead;
  busy: boolean;
  aiBusy: boolean;
  aiDepth?: ResearchDepth | null;
  aiProgress?: ResearchProgress | null;
  aiQueued?: boolean;
  aiError?: string | null;
  hmBusy?: boolean;
  clientDraft: string;
  onClientDraft: (v: string) => void;
  onReview: (id: string, action: "confirmed" | "rejected", clientName?: string) => void;
  onAiGuess: (id: string, depth?: ResearchDepth) => void;
  onHmSearch?: (id: string) => void;
}) {
  const [openRow, setOpenRow] = useState(false);
  const guessed = lead.confirmedClient || lead.guess?.name || "";
  const client = (clientDraft || guessed).trim();
  const actionable = lead.status !== "confirmed" && lead.status !== "rejected";
  const researchLock = busy || aiBusy || Boolean(aiQueued);
  const why = clientExplain(lead);
  const conf = lead.guess && actionable ? lead.guess.confidence : null;

  return (
    <article className={`lead-row ${openRow ? "lead-row--open" : ""}`}>
      <button type="button" className="lead-row__hit" onClick={() => setOpenRow((v) => !v)} aria-expanded={openRow}>
        <span className="lead-row__main">
          <span className="lead-row__top">
            <span className="lead-row__title truncate">{lead.title}</span>
            <span className={`ws-status shrink-0 ${statusClass(lead.status)}`} title={STATUS_HINT[lead.status]}>
              {statusShort(lead.status)}
              {conf != null ? ` · ${conf}%` : ""}
            </span>
          </span>
          <span className="lead-row__meta truncate">
            {lead.agency.name}
            {lead.recruiter.name ? ` · ${lead.recruiter.name}` : ""}
            {factsLine(lead) ? ` · ${factsLine(lead)}` : ""}
          </span>
          <span className="lead-row__clientline">
            <span className="lead-row__arrow" aria-hidden>
              →
            </span>
            <span className={`truncate ${client ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}>
              {client || "Opdrachtgever onbekend"}
            </span>
          </span>
          <span className={`lead-row__why ${why.kind === "thin" ? "lead-row__why--thin" : ""}`}>{why.why}</span>
        </span>
      </button>

      {openRow ? (
        <div className="lead-row__detail" onClick={(e) => e.stopPropagation()}>
          {lead.guess?.evidence?.length ? (
            <div className="lead-why">
              <p className="lead-why__label">Waarom {lead.guess.name || "deze opdrachtgever"}?</p>
              <ul className="lead-why__list">
                {lead.guess.evidence.slice(0, 3).map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-[var(--ink)]">{e.label}</span>
                    {e.quote ? <span className="lead-why__quote">“{e.quote.replace(/\s+/g, " ").trim()}”</span> : null}
                  </li>
                ))}
              </ul>
              {lead.guess.alternatives.length ? (
                <p className="lead-why__alts">
                  Ook mogelijk:{" "}
                  {lead.guess.alternatives
                    .slice(0, 3)
                    .map((a) => `${a.name} (${a.confidence}%)`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[0.78rem] leading-relaxed text-[var(--muted)]">{why.why}</p>
          )}

          {actionable ? (
            <div className="lead-row__actions">
              <input
                type="text"
                value={clientDraft || guessed}
                onChange={(e) => onClientDraft(e.target.value)}
                placeholder="Eindklant"
                className="lead-row__input"
                aria-label="Eindklant"
              />
              <button
                type="button"
                disabled={busy || aiBusy || client.length < 2}
                onClick={() => onReview(lead.id, "confirmed", client)}
                className="btn-ink btn-tool"
              >
                Bevestig
              </button>
              <button
                type="button"
                disabled={researchLock}
                onClick={() => onAiGuess(lead.id, "standard")}
                className="btn-ghost btn-tool"
              >
                {aiBusy ? "…" : "AI"}
              </button>
              <button
                type="button"
                disabled={busy || aiBusy}
                onClick={() => onReview(lead.id, "rejected")}
                className="btn-ghost btn-tool"
              >
                Weg
              </button>
              {lead.evidenceUrl ? (
                <a
                  href={lead.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lead-row__vac"
                >
                  Vacature
                </a>
              ) : null}
            </div>
          ) : lead.status === "confirmed" ? (
            <div className="lead-row__actions">
              <p className="mr-auto text-[0.78rem] text-[var(--muted)]">
                <strong className="text-[var(--ink)]">{client}</strong>
                {lead.hiringManager ? ` · HM ${lead.hiringManager}` : " · nog geen HM"}
              </p>
              <Link href={kansenHref(`crm_bureau_${lead.id}`)} className="btn-ink btn-tool no-underline">
                Open op Kansen
              </Link>
              <button type="button" disabled={hmBusy} onClick={() => onHmSearch?.(lead.id)} className="btn-ghost btn-tool">
                {hmBusy ? "Zoeken…" : "Zoek manager"}
              </button>
            </div>
          ) : null}

          {aiQueued ? <p className="mt-2 text-[0.72rem] text-[var(--muted)]">In wachtrij…</p> : null}
          {aiBusy && aiProgress && aiDepth ? <ResearchMeter depth={aiDepth} progress={aiProgress} /> : null}
          {aiError ? <p className="mt-1.5 text-[0.72rem] text-[var(--warn)]">{aiError}</p> : null}
        </div>
      ) : null}
    </article>
  );
}


export default function LeadsDesk({ initial }: { initial?: Payload }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(initial || null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiJobs, setAiJobs] = useState<Record<string, AiJob>>({});
  const aiJobsRef = useRef<Record<string, AiJob>>({});
  const runningRef = useRef(new Set<string>());
  const pumpRef = useRef<() => void>(() => undefined);
  const [hmId, setHmId] = useState<string | null>(null);
  const [hmNote, setHmNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<"all" | "open" | "confirmed">("all");
  const [watchAgency, setWatchAgency] = useState<string | null>(null);
  const [clientDrafts, setClientDrafts] = useState<Record<string, string>>(() => {
    const drafts: Record<string, string> = {};
    if (initial) {
      for (const l of [...initial.live, ...initial.demo]) {
        const name = l.confirmedClient || l.guess?.name;
        if (name) drafts[l.id] = name;
      }
    }
    return drafts;
  });

  function upsertLead(next: AgencyLead) {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (list: AgencyLead[]) => list.map((l) => (l.id === next.id ? next : l));
      return { ...prev, live: patch(prev.live), demo: patch(prev.demo) };
    });
    if (next.guess?.name) {
      setClientDrafts((d) => ({ ...d, [next.id]: d[next.id] ?? next.guess!.name }));
    }
  }

  function applyPayload(j: Payload) {
    setData(j);
    const drafts: Record<string, string> = {};
    for (const l of [...j.live, ...j.demo]) {
      const name = l.confirmedClient || l.guess?.name;
      if (name) drafts[l.id] = name;
    }
    setClientDrafts((prev) => ({ ...drafts, ...prev }));
  }

  function load() {
    return import("@/lib/client-cache").then(({ cachedJson, cacheSet }) =>
      cachedJson<Payload>("leads", "/api/leads", {
        ttlMs: 45_000,
        staleMs: 5 * 60_000,
        onUpdate: (j) => {
          applyPayload(j);
          cacheSet("leads", j);
        },
      })
        .then((j) => applyPayload(j))
        .catch((e: unknown) => {
          const status = (e as { status?: number }).status;
          if (status === 401) window.location.href = "/login?next=/leads";
          else if (!initial) setError(e instanceof Error ? e.message : "fout");
        })
    );
  }

  useEffect(() => {
    if (initial) {
      import("@/lib/client-cache").then(({ cacheSet }) => cacheSet("leads", initial));
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLive = useMemo(() => {
    if (!data) return [];
    const n = q.trim().toLowerCase();
    return data.live.filter((l) => {
      if (bucket === "open" && (l.status === "confirmed" || l.status === "rejected")) return false;
      if (bucket === "confirmed" && l.status !== "confirmed") return false;
      if (watchAgency && l.agency.name.toLowerCase() !== watchAgency.toLowerCase()) return false;
      if (!n) return true;
      const blob = `${l.title} ${l.agency.name} ${l.confirmedClient || ""} ${l.guess?.name || ""} ${l.roleLabel}`.toLowerCase();
      return blob.includes(n);
    });
  }, [data, q, bucket, watchAgency]);

  const filteredDemo = useMemo(() => {
    if (!data) return [];
    const n = q.trim().toLowerCase();
    return data.demo.filter((l) => {
      if (bucket === "open" && (l.status === "confirmed" || l.status === "rejected")) return false;
      if (bucket === "confirmed" && l.status !== "confirmed") return false;
      if (watchAgency && l.agency.name.toLowerCase() !== watchAgency.toLowerCase()) return false;
      if (!n) return true;
      const blob = `${l.title} ${l.agency.name} ${l.confirmedClient || ""} ${l.guess?.name || ""}`.toLowerCase();
      return blob.includes(n);
    });
  }, [data, q, bucket, watchAgency]);

  const deepOpenCount =
    data?.live.filter((l) => {
      if (l.status === "confirmed" || l.status === "rejected") return false;
      if (skipBatchResearch(l)) return false;
      return isHuntWorthy({ title: l.title, text: l.summary || "", prior: l.guess });
    }).length ?? 0;

  const researchStrip = useMemo(() => {
    const jobs = Object.values(aiJobs);
    const running = jobs.filter((j) => j.status === "running").length;
    const queued = jobs.filter((j) => j.status === "queued").length;
    if (!running && !queued) return null;
    return { running, queued };
  }, [aiJobs]);

  async function onReview(id: string, action: "confirmed" | "rejected", clientName?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(action === "confirmed" && clientName ? { clientName } : {}),
        }),
      });
      if (!res.ok) throw new Error("opslaan mislukt");
      const j = (await res.json()) as { lead?: AgencyLead };
      if (j.lead) upsertLead(j.lead);
      else void load();
      const { cacheClear } = await import("@/lib/client-cache");
      cacheClear("leads");
      cacheClear("crm");
    } finally {
      setBusy(false);
    }
  }

  function patchJob(id: string, patch: Partial<AiJob> | null) {
    setAiJobs((prev) => {
      const next = { ...prev };
      if (!patch) delete next[id];
      else next[id] = { ...next[id], ...patch } as AiJob;
      aiJobsRef.current = next;
      return next;
    });
  }

  async function runResearchJob(id: string, depth: ResearchDepth) {
    patchJob(id, { status: "running", depth, progress: startingProgress(depth) });
    try {
      const result = await streamResearch<AgencyLead>(id, depth, (p) => {
        patchJob(id, { progress: p, status: "running" });
      });
      if (result.lead) upsertLead(result.lead);
      if (!result.ok) {
        patchJob(id, { status: "error", error: result.error || result.detail || "AI mislukt" });
        return;
      }
      patchJob(id, null);
    } catch (e) {
      patchJob(id, {
        status: "error",
        error: e instanceof Error ? e.message : "AI mislukt",
      });
    } finally {
      runningRef.current.delete(id);
      pumpRef.current();
    }
  }

  function pumpQueue() {
    const queued = Object.entries(aiJobsRef.current).filter(([, j]) => j.status === "queued");
    for (const [id, job] of queued) {
      if (runningRef.current.size >= MAX_PARALLEL_RESEARCH) break;
      runningRef.current.add(id);
      void runResearchJob(id, job.depth);
    }
  }
  pumpRef.current = pumpQueue;

  function onAiGuess(id: string, depth: ResearchDepth = "standard") {
    const current = aiJobsRef.current[id];
    if (current && (current.status === "running" || current.status === "queued")) return;
    if (runningRef.current.size >= MAX_PARALLEL_RESEARCH) {
      patchJob(id, { depth, progress: startingProgress(depth), status: "queued" });
      return;
    }
    runningRef.current.add(id);
    patchJob(id, { depth, progress: startingProgress(depth), status: "running" });
    void runResearchJob(id, depth);
  }

  function deepAllOpen() {
    if (!data) return;
    // Eerste hit: alleen jachtwaardige leads — skip naamlek/al-sterk (gratis op desk).
    const targets = data.live.filter((l) => {
      if (l.status === "confirmed" || l.status === "rejected") return false;
      if (skipBatchResearch(l)) return false;
      return isHuntWorthy({
        title: l.title,
        text: l.summary || "",
        prior: l.guess,
      });
    });
    for (const l of targets) onAiGuess(l.id, "standard");
  }

  async function onHmSearch(id: string) {
    setHmId(id);
    setError(null);
    setHmNote(null);
    try {
      const res = await fetch("/api/leads/hm-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        empty?: boolean;
        hiringManager?: string | null;
        hiringManagerTitle?: string | null;
        hits?: { name: string; title: string | null }[];
        error?: string;
        detail?: string;
        crmId?: string;
      };
      if (res.status === 503) {
        setError(j.error || "APIFY_TOKEN ontbreekt");
        return;
      }
      if (!res.ok) {
        setError(j.error || "HM-zoeken mislukt");
        return;
      }
      if (j.hiringManager) {
        setHmNote(
          `${j.hiringManager}${j.hiringManagerTitle ? ` · ${j.hiringManagerTitle}` : ""}${
            j.hits && j.hits.length > 1 ? ` (+${j.hits.length - 1} alternatieven)` : ""
          }`
        );
        setData((prev) => {
          if (!prev) return prev;
          const patch = (list: AgencyLead[]) =>
            list.map((l) =>
              l.id === id
                ? { ...l, hiringManager: j.hiringManager, hiringManagerTitle: j.hiringManagerTitle || null }
                : l
            );
          return { ...prev, live: patch(prev.live), demo: patch(prev.demo) };
        });
        router.push(kansenHref(j.crmId || `crm_bureau_${id}`));
      } else {
        setHmNote(j.detail || "Geen hiring manager gevonden — check LinkedIn company-slug of probeer opnieuw.");
      }
    } finally {
      setHmId(null);
    }
  }

  return (
    <AppShell current="leads" title={DESK.bureau.title} subtitle={DESK.bureau.subtitle} fill>
      <div className="ws-shell flex min-h-0 flex-1 flex-col gap-3">
        <details className="ws-fold shrink-0">
          <summary>
            <span>{DESK.bureau.foldTitle}</span>
            <span className="ws-fold__meta">{DESK.bureau.foldMeta}</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Dit is de <strong className="font-semibold text-[var(--ink)]">recruiter-feed</strong>: vacatures uit
              LinkedIn-feeds van kantoren die je volgt. Jij bevestigt de eindklant — daarna zoek je de hiring
              manager. De andere radar is{" "}
              <a href={DESK.direct.href} className="font-semibold text-[var(--ink)] underline underline-offset-2">
                {DESK.direct.nav}
              </a>{" "}
              (jobboards).
            </p>
            <ol className="ws-fold__steps">
              <li>
                <span className="ws-fold__n">1</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Review</strong> — de tekst wordt gelezen
                  (geen websearch). Alleen een zekere opdrachtgever komt erop; jij bevestigt of wijst af.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">2</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Bevestigd</strong> — de kans verschijnt
                  meteen op{" "}
                  <a href="/kansen" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                    Kansen
                  </a>
                  , bij stap 2: manager zoeken.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">3</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Daar verder</strong> — manager, contact en
                  bericht doe je op Kansen. Hier gaat het alleen om de vraag: wie is de opdrachtgever?
                </span>
              </li>
            </ol>
          </div>
        </details>

        <details className="ws-fold shrink-0">
          <summary>
            <span>Laatste scrape</span>
            <span className="ws-fold__meta">
              {data?.sync?.lastFeed
                ? `Feeds ${timeAgoShort(data.sync.lastFeed.at)}`
                : data?.sync?.last
                  ? `${data.sync.last.label} ${timeAgoShort(data.sync.last.at)}`
                  : "Nog geen sync"}
            </span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Recruiter-feeds (LinkedIn-posts van kantoren die je volgt) landen hier. Jobboards sync je via{" "}
              <a href={DESK.direct.href} className="font-semibold text-[var(--ink)] underline underline-offset-2">
                {DESK.direct.nav}
              </a>
              .
            </p>
            <ul className="mt-2 space-y-1 text-[0.78rem] text-[var(--ink)]">
              <li>
                <span className="text-[var(--muted)]">Recruiter-feeds: </span>
                {data?.sync?.lastFeed ? (
                  <>
                    {timeAgoShort(data.sync.lastFeed.at)} · {data.sync.lastFeed.kept}/
                    {data.sync.lastFeed.fetched} gehouden
                    {data.sync.lastFeed.mode === "error"
                      ? " · mislukt — sync opnieuw via Jobboards"
                      : ""}
                  </>
                ) : (
                  <span className="text-[var(--muted)]">nog niet gedraaid</span>
                )}
              </li>
              {data?.sync?.last ? (
                <li>
                  <span className="text-[var(--muted)]">Laatste desk-sync: </span>
                  {data.sync.last.label} · {timeAgoShort(data.sync.last.at)}
                </li>
              ) : null}
            </ul>
            <p className="mt-2 mb-0 text-[0.72rem] text-[var(--muted)]">
              Nieuwe hits zie je ook in de bel rechtsboven. Mail (Resend) staat nog niet aan — wel
              in-app + optioneel Slack/Discord via{" "}
              <code className="text-[0.68rem]">ALERT_WEBHOOK_URL</code>.
            </p>
          </div>
        </details>

        <details className="ws-fold shrink-0">
          <summary>
            <span>Kantoren die je volgt</span>
            <span className="ws-fold__meta">
              {data
                ? `${data.watchlist.length} kantoren · ${data.watchlist.reduce((n, a) => n + a.recruiters.length, 0)} recruiters`
                : "Laden…"}
              {watchAgency ? ` · filter ${watchAgency}` : ""}
            </span>
          </summary>
          <div className="ws-fold__body !p-0">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2">
              <p className="text-[0.72rem] text-[var(--muted)]">Filter op kantoor · klik naam om te filteren</p>
              <Link
                href="/instellingen#volgen"
                className="text-[0.72rem] font-semibold text-[var(--ink)] underline decoration-[var(--signal)] underline-offset-2"
              >
                Bewerken
              </Link>
            </div>
            {!data ? (
              <p className="px-3.5 py-3 text-[0.78rem] text-[var(--muted)] sm:px-4">Laden…</p>
            ) : data.watchlist.length === 0 ? (
              <p className="px-3.5 py-3 text-[0.78rem] text-[var(--muted)] sm:px-4">
                Nog geen kantoren.{" "}
                <Link href="/instellingen#volgen" className="font-semibold text-[var(--ink)] no-underline hover:underline">
                  Stel in →
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                <li>
                  <button
                    type="button"
                    onClick={() => setWatchAgency(null)}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-[var(--surface-2)] sm:px-4 ${
                      !watchAgency ? "bg-[var(--accent-soft)] font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
                    }`}
                  >
                    <span>Alle kantoren</span>
                    <span className="tabular-nums text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                      {data.live.length} hits
                    </span>
                  </button>
                </li>
                {data.watchlist.map((a) => {
                  const on = watchAgency?.toLowerCase() === a.name.toLowerCase();
                  const leadCount = data.live.filter((l) => l.agency.name.toLowerCase() === a.name.toLowerCase()).length;
                  return (
                    <li key={a.id} className={on ? "bg-[var(--accent-soft)]/40" : ""}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 hover:bg-[var(--surface-2)] sm:px-4 [&::-webkit-details-marker]:hidden">
                          <span
                            role="button"
                            tabIndex={0}
                            className={`min-w-0 flex-1 truncate text-left text-sm ${
                              on ? "font-semibold text-[var(--ink)]" : "font-medium text-[var(--ink)]"
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setWatchAgency(on ? null : a.name);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setWatchAgency(on ? null : a.name);
                              }
                            }}
                          >
                            {a.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                            {leadCount} hits · {a.recruiters.length}
                          </span>
                          <span className="shrink-0 text-[0.65rem] text-[var(--muted)] transition group-open:rotate-180" aria-hidden>
                            ▾
                          </span>
                        </summary>
                        <div className="border-t border-[var(--line)]/70 bg-[var(--surface-2)]/50 px-3.5 py-2.5 sm:px-4">
                          {a.note ? <p className="mb-2 text-[0.72rem] text-[var(--muted)]">{a.note}</p> : null}
                          <ul className="space-y-1.5">
                            {a.recruiters.map((r) => (
                              <li key={r.name} className="flex items-center justify-between gap-3 text-[0.78rem]">
                                {r.linkedinUrl ? (
                                  <a
                                    href={r.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-[var(--ink)] no-underline hover:underline"
                                  >
                                    {r.name}
                                  </a>
                                ) : (
                                  <span className="font-medium text-[var(--ink)]">{r.name}</span>
                                )}
                                {r.brand ? <span className="truncate text-[var(--muted)]">{r.brand}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>

        <main className="ws-main min-h-0 flex-1">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <p className="ws-label">Openingen</p>
            {data ? (
              <p className="text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {filteredLive.length}/{data.live.length} live
                {watchAgency ? ` · ${watchAgency}` : ""}
              </p>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek bureau, rol of eindklant…"
              className="min-w-[12rem] flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              aria-label="Filter openingen"
            />
            {(["all", "open", "confirmed"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucket(b)}
                className={`ws-chip ${bucket === b ? "ws-chip--on" : ""}`}
              >
                {b === "all" ? "Alles" : b === "open" ? "Te reviewen" : "Bevestigd"}
              </button>
            ))}
            <button
              type="button"
              disabled={!deepOpenCount}
              onClick={deepAllOpen}
              className="btn-ghost btn-tool"
              title="Leest de vacaturetekst. Alleen een naam als die zeker is, geen websearch."
            >
              AI alle open{deepOpenCount ? ` · ${deepOpenCount}` : ""}
            </button>
          </div>

          {researchStrip ? (
            <p className="mb-3 text-[0.78rem] text-[var(--ink)]">
              <span className="font-semibold">{researchStrip.running} research bezig</span>
              {researchStrip.queued ? ` · ${researchStrip.queued} in wachtrij` : ""}
              <span className="text-[var(--muted)]"> — meters per kaart</span>
            </p>
          ) : null}

          {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}
          {hmNote ? <p className="mb-3 text-sm text-[var(--accent)]">{hmNote}</p> : null}

          {!data ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const openLeads = data.live.filter(
                  (l) => l.status !== "confirmed" && l.status !== "rejected"
                );
                if (!openLeads.length) return null;
                const kinds = openLeads.map((l) => clientExplain(l).kind);
                const ready = kinds.filter((k) => k === "ok").length;
                const hunt = kinds.filter((k) => k === "hunt").length;
                const thin = kinds.filter((k) => k === "thin").length;
                return (
                  <p className="text-[0.8rem] leading-relaxed text-[var(--muted)]">
                    <strong className="font-semibold text-[var(--ink)]">{openLeads.length} posts</strong> wachten op
                    een opdrachtgever.{" "}
                    {ready ? <>Bij {ready} heeft de AI al een naam voorgesteld: nakijken en bevestigen. </> : null}
                    {hunt ? <>Bij {hunt} staat een spoor in de tekst: laat die lezen, alleen een zekere naam komt erop. </> : null}
                    {thin ? (
                      <>
                        De overige {thin} noemen geen opdrachtgever én geen spoor — daar zou zoeken gokken zijn, dus
                        vul de naam zelf in als je hem kent.
                      </>
                    ) : null}
                  </p>
                );
              })()}
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Te reviewen</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {filteredLive.length}
                  </span>
                </div>
                {filteredLive.length ? (
                  <div className="ws-panel overflow-hidden !p-0">
                    {filteredLive.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        busy={busy}
                        aiBusy={aiJobs[l.id]?.status === "running"}
                        aiQueued={aiJobs[l.id]?.status === "queued"}
                        aiDepth={aiJobs[l.id]?.depth ?? null}
                        aiProgress={aiJobs[l.id]?.progress ?? null}
                        aiError={aiJobs[l.id]?.error ?? null}
                        hmBusy={hmId === l.id}
                        clientDraft={clientDrafts[l.id] || ""}
                        onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [l.id]: v }))}
                        onReview={onReview}
                        onAiGuess={onAiGuess}
                        onHmSearch={onHmSearch}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="ws-empty">
                    Nog geen live hits. Zorg dat recruiters een LinkedIn-URL hebben, daarna
                    admin: Sync → Recruiter-feeds. Of test AI op een voorbeeld hieronder.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Voorbeelden</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {filteredDemo.length}
                  </span>
                </div>
                <div className="ws-panel overflow-hidden !p-0">
                  {filteredDemo.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      busy={busy}
                      aiBusy={aiJobs[l.id]?.status === "running"}
                      aiQueued={aiJobs[l.id]?.status === "queued"}
                      aiDepth={aiJobs[l.id]?.depth ?? null}
                      aiProgress={aiJobs[l.id]?.progress ?? null}
                      aiError={aiJobs[l.id]?.error ?? null}
                      hmBusy={hmId === l.id}
                      clientDraft={clientDrafts[l.id] || ""}
                      onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [l.id]: v }))}
                      onReview={onReview}
                      onAiGuess={onAiGuess}
                      onHmSearch={onHmSearch}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
