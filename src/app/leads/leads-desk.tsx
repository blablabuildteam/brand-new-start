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
  onReview,
}: {
  lead: AgencyLead;
  busy: boolean;
  onReview: (id: string, action: "confirmed" | "rejected") => void;
}) {
  const client = lead.confirmedClient || lead.guess?.name;
  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition hover:border-[var(--accent)]/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.7rem] font-semibold text-[var(--muted)]">{lead.agency.name}</p>
            {lead.demo ? (
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Voorbeeld
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--ink)]">{lead.title}</h2>
          <p className="mt-1 text-[0.8rem] text-[var(--muted)]">
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
          {factsLine(lead) ? <p className="mt-1.5 text-[0.75rem] text-[var(--muted)]">{factsLine(lead)}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${statusClass(lead.status)}`}>
          {STATUS_NL[lead.status]}
          {lead.guess && lead.status !== "rejected" ? ` · ${lead.guess.confidence}%` : ""}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-3.5 py-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Eindklant</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{client || "Nog niet te zeggen"}</p>
        {lead.guess?.evidence.length ? (
          <ul className="mt-2 space-y-1.5">
            {lead.guess.evidence.slice(0, 2).map((e, i) => (
              <li key={i} className="text-[0.75rem] leading-snug text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]/80">{e.label}</span>
                {e.quote ? <span className="block">“{e.quote}”</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">Geen harde hint — handmatig beoordelen.</p>
        )}
      </div>

      {lead.status === "confirmed" || lead.status === "rejected" ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !client}
            onClick={() => onReview(lead.id, "confirmed")}
            className="btn-ink rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Bevestig {client || "klant"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview(lead.id, "rejected")}
            className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Niet deze
          </button>
          {lead.evidenceUrl ? (
            <a
              href={lead.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-semibold text-[var(--accent)] no-underline hover:underline"
            >
              Vacature →
            </a>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function LeadsDesk() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error("opslaan mislukt");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell current="leads" title="Bureaus" subtitle="Eerst eindklant, dan pas manager">
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-5 md:px-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Bureau-vacatures → geraden eindklant met bewijs. Bevestig voordat je een manager zoekt.
          </p>
          {data ? (
            <p className="text-[0.75rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
              {data.live.length} live · {data.demo.length} voorbeelden
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
        {!data ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
            <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Watchlist</p>
              <ul className="mt-3 space-y-4">
                {data.watchlist.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-semibold text-[var(--ink)]">{a.name}</p>
                    {a.note ? <p className="mt-0.5 text-[0.7rem] leading-snug text-[var(--muted)]">{a.note}</p> : null}
                    <ul className="mt-2 space-y-1">
                      {a.recruiters.map((r) => (
                        <li key={r.name} className="text-[0.72rem] leading-snug text-[var(--muted)]">
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
            </aside>

            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Uit je radar
                  </p>
                  <span className="text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {data.live.length}
                  </span>
                </div>
                {data.live.length ? (
                  <div className="space-y-3">
                    {data.live.map((l) => (
                      <LeadCard key={l.id} lead={l} busy={busy} onReview={onReview} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
                    Nog geen bureau-hits in de radar. Beoordeel eerst de voorbeelden hieronder.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Voorbeelden
                  </p>
                  <span className="text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {data.demo.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {data.demo.map((l) => (
                    <LeadCard key={l.id} lead={l} busy={busy} onReview={onReview} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
