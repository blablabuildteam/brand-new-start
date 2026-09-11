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

function sourceLine(row: CrmOpportunity) {
  if (row.lane === "bureau") {
    const bits = [row.agencyName, row.recruiterName].filter(Boolean);
    return bits.length ? bits.join(" · ") : "Bureau";
  }
  return row.sources.length ? row.sources.join(" · ") : "Direct";
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
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.lane === filter);
  }, [items, filter]);

  const active = sel ? filtered.find((i) => i.id === sel) || null : null;

  useEffect(() => {
    if (sel && !filtered.some((i) => i.id === sel)) {
      setSel(null);
      setMobilePane("list");
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
    setSel(null);
    setMobilePane("list");
  }

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Alles", n: counts.all },
    { id: "bureau", label: "Bevestigd", n: counts.bureau },
    { id: "direct", label: "Direct", n: counts.direct },
  ];

  return (
    <AppShell current="kansen" title="Kansen" subtitle="CRM-pipeline · bevestigd & actueel" fill>
      <div className="ws-shell">
        <section className="ws-intro">
          <p className="ws-intro__title">Pipeline</p>
          <p className="ws-intro__text">
            Alle serieuze kansen op één rij: bevestigde bureau-leads en warme/sterke radar-hits. Klik een
            regel voor detail, hiring manager en voorstel.
          </p>
        </section>

        <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterSafe(f.id)}
              className={`ws-chip shrink-0 ${filter === f.id ? "ws-chip--on" : ""}`}
            >
              {f.label}
              <span className="tabular-nums opacity-80" style={{ fontFamily: "var(--mono)" }}>
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

        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 ${
            active ? "lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] lg:gap-4" : ""
          }`}
        >
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
            <div className="radar-scroll-pane__body !p-0">
              {error ? <p className="px-3 py-3 text-sm text-[var(--warn)]">{error}</p> : null}
              {loading ? <p className="px-3 py-3 text-sm text-[var(--muted)]">Laden…</p> : null}
              {!loading && !filtered.length ? (
                <p className="ws-empty m-3">
                  Nog geen kansen hier. Bevestig een eindklant op Bureaus, of wacht op warme radar-hits.
                </p>
              ) : null}

              {!loading && filtered.length ? (
                <>
                  {/* Mobile list cards */}
                  <ul className="divide-y divide-[var(--line)]/80 lg:hidden">
                    {filtered.map((row) => {
                      const on = active?.id === row.id;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => pick(row.id)}
                            aria-current={on ? "true" : undefined}
                            className={`flex w-full min-h-12 items-start gap-3 px-3 py-3 text-left touch-manipulation ${
                              on ? "bg-[var(--accent-soft)]/60" : "hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-[0.9rem] font-semibold text-[var(--ink)]">
                                  {row.endClient}
                                </span>
                                <span className="ws-badge">
                                  {row.lane === "bureau" ? "Bureau" : "Direct"}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--muted)]">
                                {row.roleLabel}
                              </span>
                              <span className="mt-1 block truncate text-[0.7rem] text-[var(--muted)]">
                                {sourceLine(row)}
                                {" · "}
                                {row.hiringManager || "geen manager"}
                              </span>
                            </span>
                            {row.kans != null ? <ScoreChip kans={row.kans} /> : (
                              <span className="shrink-0 text-[0.65rem] text-[var(--muted)]">—</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop CRM table */}
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-[1] bg-[var(--surface)]">
                        <tr className="border-b border-[var(--line)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--muted)]">
                          <th className="px-3 py-2.5 font-semibold">Eindklant</th>
                          <th className="px-3 py-2.5 font-semibold">Rol</th>
                          <th className="px-3 py-2.5 font-semibold">Bron</th>
                          <th className="px-3 py-2.5 font-semibold">Hiring manager</th>
                          <th className="px-3 py-2.5 font-semibold">Versheid</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Kans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row) => {
                          const on = active?.id === row.id;
                          return (
                            <tr
                              key={row.id}
                              tabIndex={0}
                              role="button"
                              aria-current={on ? "true" : undefined}
                              onClick={() => pick(row.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  pick(row.id);
                                }
                              }}
                              className={`cursor-pointer border-b border-[var(--line)]/70 transition ${
                                on
                                  ? "bg-[var(--accent-soft)]/55 shadow-[inset_3px_0_0_0_var(--accent)]"
                                  : "hover:bg-[var(--surface-2)]"
                              }`}
                            >
                              <td className="px-3 py-3 align-top">
                                <span className="block font-semibold text-[var(--ink)]">{row.endClient}</span>
                                <span className="mt-1 inline-flex">
                                  <span className="ws-badge">
                                    {row.lane === "bureau" ? "Bureau" : "Direct"}
                                  </span>
                                </span>
                              </td>
                              <td className="max-w-[12rem] px-3 py-3 align-top text-[var(--muted)]">
                                <span className="line-clamp-2">{row.roleLabel}</span>
                              </td>
                              <td className="max-w-[14rem] px-3 py-3 align-top text-[var(--muted)]">
                                <span className="line-clamp-2">{sourceLine(row)}</span>
                              </td>
                              <td className="max-w-[12rem] px-3 py-3 align-top">
                                {row.hiringManager ? (
                                  <>
                                    <span className="block font-medium text-[var(--ink)]">
                                      {row.hiringManager}
                                    </span>
                                    {row.hiringManagerTitle ? (
                                      <span className="mt-0.5 block truncate text-[0.72rem] text-[var(--muted)]">
                                        {row.hiringManagerTitle}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-[var(--muted)]">Nog niet gevonden</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span
                                  className={`inline-flex rounded-[calc(var(--radius)-2px)] border px-2 py-0.5 text-[0.65rem] font-semibold ${freshClass(row.freshness)}`}
                                >
                                  {row.freshnessLabel}
                                </span>
                                <span className="mt-1 block text-[0.68rem] text-[var(--muted)]">
                                  {formatDay(row.foundAt)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right align-top">
                                {row.kans != null ? (
                                  <span className="inline-flex flex-col items-end gap-0.5">
                                    <ScoreChip kans={row.kans} />
                                    <span className="text-[0.65rem] text-[var(--muted)]">
                                      {SCORE_BAND[scoreTone(row.kans)]}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[var(--muted)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          {active ? (
            <aside
              className={`ws-panel min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 ${
                mobilePane === "list" ? "max-lg:hidden" : ""
              }`}
            >
              <div className="animate-fade-in pb-8 lg:pb-4">
                <button
                  type="button"
                  className="btn-ghost btn-tool mb-3 min-h-11 touch-manipulation lg:hidden"
                  onClick={() => {
                    setMobilePane("list");
                    setSel(null);
                  }}
                >
                  ← Overzicht
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-tool mb-3 hidden lg:inline-flex"
                  onClick={() => setSel(null)}
                >
                  Sluiten
                </button>

                <p className="ws-label">{active.lane === "bureau" ? "Bevestigde kans" : "Directe kans"}</p>
                <h2 className="ws-title mt-1">{active.endClient}</h2>
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
                    <dt className="ws-label">Bron</dt>
                    <dd className="mt-1 text-[var(--muted)]">{sourceLine(active)}</dd>
                  </div>
                  {active.sources.length ? (
                    <div>
                      <dt className="ws-label">Signalen</dt>
                      <dd className="mt-1 text-[var(--muted)]">{active.sources.join(" · ")}</dd>
                    </div>
                  ) : null}
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
                    <Link href="/radar" className="btn-ghost btn-tool no-underline">
                      Zoek manager op Radar
                    </Link>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
