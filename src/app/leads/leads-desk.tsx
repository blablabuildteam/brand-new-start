"use client";

import { useEffect, useState } from "react";
import { WorkspaceBar } from "@/components/workspace-bar";
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
    <article className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            {lead.agency.name}
            {lead.demo ? " · voorbeeld" : ""}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--ink)]">{lead.title}</h2>
          <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
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
            ) : (
              " · recruiter onbekend"
            )}
            {lead.recruiter.title ? ` · ${lead.recruiter.title}` : ""}
          </p>
          {factsLine(lead) ? <p className="mt-1 text-[0.75rem] text-[var(--muted)]">{factsLine(lead)}</p> : null}
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[0.68rem] font-semibold ${
            lead.status === "confirmed"
              ? "border-[var(--green)]/40 bg-[var(--green-soft)] text-[var(--green)]"
              : lead.status === "suggest"
                ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]"
                : lead.status === "rejected"
                  ? "border-[var(--line)] text-[var(--muted)]"
                  : "border-[var(--warn)]/35 bg-[var(--warn-soft)] text-[var(--warn)]"
          }`}
        >
          {STATUS_NL[lead.status]}
          {lead.guess && lead.status !== "rejected" ? ` · ${lead.guess.confidence}%` : ""}
        </span>
      </div>

      <div className="mt-3 border-t border-[var(--line)]/70 pt-3">
        <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">Eindklant</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{client || "Nog niet te zeggen"}</p>
        {lead.guess?.evidence.length ? (
          <ul className="mt-2 space-y-1">
            {lead.guess.evidence.map((e, i) => (
              <li key={i} className="text-[0.75rem] text-[var(--muted)]">
                {e.label}
                {e.quote ? <span className="block text-[var(--ink)]/80">“{e.quote}”</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">Geen harde hint in de tekst — handmatig beoordelen.</p>
        )}
        {lead.guess?.alternatives.length ? (
          <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
            Ook mogelijk: {lead.guess.alternatives.map((a) => `${a.name} (${a.confidence}%)`).join(", ")}
          </p>
        ) : null}
      </div>

      {lead.status === "confirmed" || lead.status === "rejected" ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            disabled={busy || !client}
            onClick={() => onReview(lead.id, "confirmed")}
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Bevestig {client || "klant"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview(lead.id, "rejected")}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline disabled:opacity-50"
          >
            Niet deze
          </button>
          {lead.evidenceUrl ? (
            <a
              href={lead.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[var(--accent)] no-underline hover:text-[var(--ink)] hover:underline"
            >
              Vacature
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
    <div className="flex min-h-dvh flex-col">
      <WorkspaceBar current="leads" />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-5 md:px-8">
        <div className="mb-5">
          <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">Contracting</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
            Bureau → eindklant
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Vacatures van je watchlist. De eindklant is een gok met bewijs — onder de drempel blijft het review. Hiring
            manager zoeken we pas ná bevestiging, bij díe organisatie. De kaarten hieronder zijn echte publieke teksten,
            uit verschillende niches — nog geen scrape.
          </p>
        </div>

        {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
        {!data ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside>
              <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">Watchlist</p>
              <ul className="mt-2 space-y-3">
                {data.watchlist.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-semibold text-[var(--ink)]">{a.name}</p>
                    {a.note ? <p className="mt-0.5 text-[0.7rem] leading-snug text-[var(--muted)]">{a.note}</p> : null}
                    <ul className="mt-1.5 space-y-1">
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
                          {r.title ? ` · ${r.title}` : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="space-y-6">
              <section>
                <p className="mb-2 text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                  Uit je radar {data.live.length ? `(${data.live.length})` : ""}
                </p>
                {data.live.length ? (
                  <div className="space-y-3">
                    {data.live.map((l) => (
                      <LeadCard key={l.id} lead={l} busy={busy} onReview={onReview} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                    Nog geen bureau-vacatures in de radar. Sync LinkedIn — of beoordeel eerst de voorbeelden.
                  </p>
                )}
              </section>

              <section>
                <p className="mb-2 text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                  Publieke teksten · alle hoeken
                </p>
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
    </div>
  );
}
