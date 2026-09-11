"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { AgencyLead, LeadStatus } from "@/lib/opportunity";

type Payload = {
  watchlist: {
    id: string;
    name: string;
    note?: string;
    recruiters: { name: string; title?: string; brand?: string; linkedinUrl?: string }[];
  }[];
  live: AgencyLead[];
  demo: AgencyLead[];
};

const STATUS_NL: Record<LeadStatus, string> = {
  suggest: "Voorstel",
  review: "Review",
  weak: "Te dun",
  confirmed: "Bevestigd",
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

function LeadCard({
  lead,
  busy,
  aiBusy,
  onReview,
  onAiGuess,
}: {
  lead: AgencyLead;
  busy: boolean;
  aiBusy: boolean;
  onReview: (id: string, action: "confirmed" | "rejected") => void;
  onAiGuess: (id: string) => void;
}) {
  const client = lead.confirmedClient || lead.guess?.name;
  const open = lead.status !== "confirmed" && lead.status !== "rejected";
  return (
    <article className="ws-panel px-4 py-3.5 transition hover:border-[var(--accent)]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[0.7rem] font-medium text-[var(--muted)]">{lead.agency.name}</p>
            {lead.demo ? <span className="ws-badge">Voorbeeld</span> : null}
            {lead.aiGuess ? (
              <span className="ws-badge border-transparent bg-[var(--signal)] text-[var(--ink)]">AI</span>
            ) : null}
          </div>
          <h2 className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--ink)]">{lead.title}</h2>
          <p className="mt-0.5 text-[0.78rem] text-[var(--muted)]">
            {lead.roleLabel}
            {lead.recruiter.name ? (
              <>
                {" · "}
                {lead.recruiter.url ? (
                  <a
                    href={lead.recruiter.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--ink)] no-underline hover:underline"
                  >
                    {lead.recruiter.name}
                  </a>
                ) : (
                  lead.recruiter.name
                )}
              </>
            ) : null}
          </p>
          {factsLine(lead) ? <p className="mt-1 text-[0.72rem] text-[var(--muted)]">{factsLine(lead)}</p> : null}
        </div>
        <span
          className={`shrink-0 rounded-[calc(var(--radius)-2px)] border px-2 py-0.5 text-[0.65rem] font-semibold ${statusClass(lead.status)}`}
        >
          {STATUS_NL[lead.status]}
          {lead.guess && lead.status !== "rejected" ? ` · ${lead.guess.confidence}%` : ""}
        </span>
      </div>

      <div className="mt-3 rounded-[var(--radius)] border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2.5">
        <p className="ws-label">Eindklant</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{client || "Nog niet te zeggen"}</p>
        {lead.guess?.evidence.length ? (
          <ul className="mt-2 space-y-1.5">
            {lead.guess.evidence.slice(0, 3).map((e, i) => (
              <li key={i} className="text-[0.75rem] leading-snug text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]/80">{e.label}</span>
                {e.quote ? <span className="block">“{e.quote}”</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">Te vaag voor regels — probeer AI eindklant.</p>
        )}
        {lead.guess?.alternatives.length ? (
          <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
            Ook mogelijk: {lead.guess.alternatives.map((a) => `${a.name} (${a.confidence}%)`).join(", ")}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 max-sm:[&>button]:min-w-[calc(50%-0.25rem)] max-sm:[&>button]:flex-1">
          <button type="button" disabled={busy || aiBusy} onClick={() => onAiGuess(lead.id)} className="btn-signal btn-tool">
            {aiBusy ? "AI bezig…" : lead.aiGuess ? "Opnieuw AI" : "AI eindklant"}
          </button>
          <button
            type="button"
            disabled={busy || aiBusy || !client}
            onClick={() => onReview(lead.id, "confirmed")}
            className="btn-ink btn-tool"
          >
            Bevestig {client || "klant"}
          </button>
          <button
            type="button"
            disabled={busy || aiBusy}
            onClick={() => onReview(lead.id, "rejected")}
            className="btn-ghost btn-tool"
          >
            Niet deze
          </button>
          {lead.evidenceUrl ? (
            <a
              href={lead.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-semibold text-[var(--accent)] no-underline hover:underline max-sm:ml-0 max-sm:w-full max-sm:pt-1"
            >
              Vacature →
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function LeadsDesk() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiId, setAiId] = useState<string | null>(null);
  const [watchOpen, setWatchOpen] = useState(false);

  function upsertLead(next: AgencyLead) {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (list: AgencyLead[]) => list.map((l) => (l.id === next.id ? next : l));
      return { ...prev, live: patch(prev.live), demo: patch(prev.demo) };
    });
  }

  function load() {
    fetch("/api/leads")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login?next=/leads";
          return null;
        }
        if (!res.ok) throw new Error("laden mislukt");
        return (await res.json()) as Payload;
      })
      .then((j) => {
        if (j) setData(j);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"));
  }

  useEffect(() => {
    load();
  }, []);

  async function onReview(id: string, action: "confirmed" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error("opslaan mislukt");
      const j = (await res.json()) as { lead?: AgencyLead };
      if (j.lead) upsertLead(j.lead);
      else load();
    } finally {
      setBusy(false);
    }
  }

  async function onAiGuess(id: string) {
    setAiId(id);
    setError(null);
    try {
      const res = await fetch("/api/leads/ai-guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        lead?: AgencyLead;
        error?: string;
        detail?: string;
      };
      if (res.status === 503) {
        setError("OPENAI_API_KEY ontbreekt in Vercel / .env.local");
        return;
      }
      if (!res.ok) {
        setError(j.error || "AI mislukt");
        return;
      }
      if (j.lead) upsertLead(j.lead);
      if (!j.ok) setError(j.detail || "AI vond geen betrouwbare eindklant");
    } finally {
      setAiId(null);
    }
  }

  return (
    <AppShell current="leads" title="Bureaus" subtitle="Eerst eindklant, dan hiring manager" fill>
      <div className="ws-shell ws-shell--split">
        <section className="ws-intro lg:col-span-2">
          <p className="ws-intro__title">Wat doe je hier?</p>
          <p className="ws-intro__text">
            Bureau-vacature → eindklant raden en bevestigen. Bevestigde kansen landen in Kansen.
          </p>
        </section>
        <aside className={`radar-scroll-pane min-h-0 shrink-0 lg:max-h-none ${watchOpen ? "max-lg:max-h-64" : "max-lg:max-h-none"}`}>
          <button
            type="button"
            className="radar-scroll-pane__head w-full text-left lg:pointer-events-none"
            onClick={() => setWatchOpen((v) => !v)}
            aria-expanded={watchOpen}
          >
            <p className="ws-label">Die je volgt</p>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {data?.watchlist.length ?? 0}
              </span>
              <span className="text-[0.7rem] text-[var(--accent)] lg:hidden" aria-hidden>
                {watchOpen ? "▴" : "▾"}
              </span>
            </span>
          </button>
          <div className={`radar-scroll-pane__body !px-2 ${watchOpen ? "" : "max-lg:hidden"} lg:!block`}>
            {!data ? (
              <p className="px-2 py-2 text-[0.78rem] text-[var(--muted)]">Laden…</p>
            ) : (
              <ul className="space-y-0.5">
                {data.watchlist.map((a) => (
                  <li key={a.id} className="rounded-[var(--radius)] px-2.5 py-2 hover:bg-[var(--surface-2)]">
                    <p className="text-[0.82rem] font-semibold text-[var(--ink)]">{a.name}</p>
                    {a.note ? <p className="mt-0.5 text-[0.68rem] leading-snug text-[var(--muted)]">{a.note}</p> : null}
                    <ul className="mt-1.5 space-y-0.5">
                      {a.recruiters.map((r) => (
                        <li key={r.name} className="text-[0.7rem] leading-snug text-[var(--muted)]">
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
                          {r.brand ? ` · ${r.brand}` : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="ws-main min-h-0 flex-1">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <p className="ws-label">Open leads</p>
            {data ? (
              <p className="text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {data.live.length} live · {data.demo.length} voorbeelden
              </p>
            ) : null}
          </div>

          {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}

          {!data ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Uit je radar</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {data.live.length}
                  </span>
                </div>
                {data.live.length ? (
                  <div className="space-y-2.5">
                    {data.live.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        busy={busy}
                        aiBusy={aiId === l.id}
                        onReview={onReview}
                        onAiGuess={onAiGuess}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="ws-empty">
                    Nog geen bureau-hits in de radar. Test AI op het SAP/Rotterdam-voorbeeld hieronder.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Voorbeelden</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {data.demo.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {data.demo.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      busy={busy}
                      aiBusy={aiId === l.id}
                      onReview={onReview}
                      onAiGuess={onAiGuess}
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
