"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ScoreChip, SCORE_BAND, scoreTone } from "@/components/score-chip";
import type { CrmLane, CrmOpportunity } from "@/lib/crm";

type Filter = "all" | CrmLane;

function formatDay(isoStr: string | null) {
  if (!isoStr) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
    }).format(new Date(isoStr));
  } catch {
    return "—";
  }
}

function freshClass(f: CrmOpportunity["freshness"]) {
  if (f === "vers") return "border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]";
  if (f === "actueel") return "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]";
  return "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]";
}

export default function KansenDesk() {
  const [items, setItems] = useState<CrmOpportunity[]>([]);
  const [counts, setCounts] = useState({ all: 0, bureau: 0, direct: 0, withHm: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  useEffect(() => {
    fetch("/api/crm")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login?next=/kansen";
          return null;
        }
        if (!res.ok) throw new Error("laden mislukt");
        return res.json() as Promise<{
          items: CrmOpportunity[];
          counts: { all: number; bureau: number; direct: number; withHm: number };
        }>;
      })
      .then((j) => {
        if (!j) return;
        setItems(j.items);
        setCounts(j.counts);
        setSel(j.items[0]?.id || null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.lane === filter);
  }, [items, filter]);

  const active = filtered.find((i) => i.id === sel) || filtered[0] || null;

  useEffect(() => {
    if (!filtered.length) {
      setSel(null);
      return;
    }
    if (!filtered.some((i) => i.id === sel)) {
      setSel(filtered[0].id);
    }
  }, [filtered, sel]);

  function pick(id: string) {
    setSel(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePane("detail");
    }
  }

  function setFilterSafe(next: Filter) {
    setFilter(next);
    setMobilePane("list");
  }

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Alles", n: counts.all },
    { id: "bureau", label: "Bevestigd", n: counts.bureau },
    { id: "direct", label: "Direct", n: counts.direct },
  ];

  return (
    <AppShell current="kansen" title="Kansen" subtitle="Pipeline · bevestigd & actueel" fill>
      <div className="ws-shell !gap-3">
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterSafe(f.id)}
              className={`shrink-0 rounded-[var(--radius)] border px-3 py-2.5 text-xs font-semibold touch-manipulation ${
                filter === f.id
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-80" style={{ fontFamily: "var(--mono)" }}>
                {f.n}
              </span>
            </button>
          ))}
          <p
            className="ml-auto hidden shrink-0 self-center text-[0.7rem] text-[var(--muted)] sm:block"
            style={{ fontFamily: "var(--mono)" }}
          >
            {counts.withHm} met manager
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)] lg:gap-4">
          <section
            className={`radar-scroll-pane min-h-0 flex-1 ${
              mobilePane === "detail" ? "max-lg:hidden" : ""
            }`}
          >
            <div className="radar-scroll-pane__head">
              <p className="ws-label">Overzicht</p>
              <p className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {filtered.length}
              </p>
            </div>
            <div className="radar-scroll-pane__body !px-1.5">
              {error ? <p className="px-2 py-2 text-sm text-[var(--warn)]">{error}</p> : null}
              {loading ? <p className="px-2 py-2 text-sm text-[var(--muted)]">Laden…</p> : null}
              {!loading && !filtered.length ? (
                <p className="ws-empty m-2">
                  Nog geen kansen hier. Bevestig een eindklant op Bureaus, of wacht op warme radar-hits.
                </p>
              ) : null}
              <ul className="space-y-1">
                {filtered.map((row) => {
                  const on = active?.id === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => pick(row.id)}
                        aria-current={on ? "true" : undefined}
                        className={`flex w-full min-h-12 items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition touch-manipulation ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 shadow-[inset_3px_0_0_0_var(--accent)]"
                            : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[0.88rem] font-semibold text-[var(--ink)]">
                              {row.endClient}
                            </span>
                            <span className="ws-badge">{row.lane === "bureau" ? "Bureau" : "Direct"}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--muted)]">
                            {row.roleLabel}
                            {row.agencyName ? ` · ${row.agencyName}` : ""}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-2 text-[0.68rem] text-[var(--muted)]">
                            <span>{row.freshnessLabel}</span>
                            <span>·</span>
                            <span>gevonden {formatDay(row.foundAt)}</span>
                          </span>
                        </span>
                        {row.kans != null ? (
                          <span
                            className="shrink-0 tabular-nums text-[0.75rem] font-semibold text-[var(--ink)]"
                            style={{ fontFamily: "var(--mono)" }}
                          >
                            {row.kans}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[0.65rem] text-[var(--muted)]">—</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <aside
            className={`ws-panel min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 ${
              mobilePane === "list" ? "max-lg:hidden" : ""
            }`}
          >
            {active ? (
              <div className="animate-fade-in pb-8 lg:pb-4">
                <button
                  type="button"
                  className="btn-ghost btn-tool mb-3 min-h-11 touch-manipulation lg:hidden"
                  onClick={() => setMobilePane("list")}
                >
                  ← Overzicht
                </button>

                <p className="ws-label">{active.lane === "bureau" ? "Bevestigde kans" : "Directe kans"}</p>
                <h2
                  className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)]"
                  style={{ fontFamily: "var(--display)" }}
                >
                  {active.endClient}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{active.title}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {active.kans != null ? (
                    <>
                      <ScoreChip kans={active.kans} />
                      <span className="text-sm font-semibold text-[var(--ink)]">
                        {SCORE_BAND[scoreTone(active.kans)]}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--muted)]">Nog geen kans-score</span>
                  )}
                  <span
                    className={`rounded-[calc(var(--radius)-2px)] border px-2 py-0.5 text-[0.65rem] font-semibold ${freshClass(active.freshness)}`}
                  >
                    {active.freshnessLabel}
                  </span>
                </div>

                <dl className="mt-5 space-y-3 border-t border-[var(--line)]/80 pt-4 text-sm">
                  <div>
                    <dt className="ws-label">Rol</dt>
                    <dd className="mt-1 font-medium text-[var(--ink)]">{active.roleLabel}</dd>
                  </div>
                  <div>
                    <dt className="ws-label">Bronnen</dt>
                    <dd className="mt-1 text-[var(--muted)]">
                      {active.sources.length ? active.sources.join(" · ") : "—"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="ws-label">Gevonden</dt>
                      <dd className="mt-1 text-[var(--ink)]">{formatDay(active.foundAt)}</dd>
                    </div>
                    <div>
                      <dt className="ws-label">Laatst gezien</dt>
                      <dd className="mt-1 text-[var(--ink)]">{formatDay(active.lastSeenAt)}</dd>
                    </div>
                  </div>
                  {active.confirmedAt ? (
                    <div>
                      <dt className="ws-label">Bevestigd</dt>
                      <dd className="mt-1 text-[var(--ink)]">{formatDay(active.confirmedAt)}</dd>
                    </div>
                  ) : null}
                  {active.agencyName ? (
                    <div>
                      <dt className="ws-label">Bureau</dt>
                      <dd className="mt-1 text-[var(--ink)]">
                        {active.agencyName}
                        {active.recruiterName ? ` · ${active.recruiterName}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="ws-label">Hiring manager</dt>
                    <dd className="mt-1 text-[var(--ink)]">
                      {active.hiringManager ? (
                        <>
                          <span className="font-semibold">{active.hiringManager}</span>
                          {active.hiringManagerTitle ? (
                            <span className="block text-[0.8rem] text-[var(--muted)]">
                              {active.hiringManagerTitle}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[var(--muted)]">Nog niet gevonden</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  {active.href ? (
                    <Link href={active.href} className="btn-ink btn-tool no-underline">
                      Open voorstel
                    </Link>
                  ) : null}
                  {active.evidenceUrl ? (
                    <a
                      href={active.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-tool no-underline"
                    >
                      Vacature
                    </a>
                  ) : null}
                  {active.companyId && !active.hiringManager ? (
                    <Link
                      href={`/radar`}
                      className="btn-ghost btn-tool no-underline"
                    >
                      Zoek manager op Radar
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Selecteer een kans.</p>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
