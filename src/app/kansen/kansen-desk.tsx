"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScoreChip, SCORE_BAND, scoreTone } from "@/components/score-chip";
import type { CrmLane, CrmOpportunity, CrmStage } from "@/lib/crm";
import { CRM_STAGE_NL } from "@/lib/crm";
import { radarHref } from "@/lib/desk-links";

type Filter = "all" | CrmLane | CrmStage;

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
  return row.bronLabel || (row.lane === "bureau" ? "Bureau" : "Direct");
}

type ActionItem = CrmOpportunity & { nextAction: string; nextHref: string };

type InitialCrm = {
  items: CrmOpportunity[];
  actionQueue?: ActionItem[];
  counts: {
    all: number;
    bureau: number;
    direct: number;
    withHm: number;
    byStage?: Record<string, number>;
  };
};

export default function KansenDesk({ initial }: { initial?: InitialCrm }) {
  const params = useSearchParams();
  const [items, setItems] = useState<CrmOpportunity[]>(initial?.items || []);
  const [actionQueue, setActionQueue] = useState<ActionItem[]>(initial?.actionQueue || []);
  const [counts, setCounts] = useState(
    initial?.counts || { all: 0, bureau: 0, direct: 0, withHm: 0 }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(params.get("id"));
  const [mobilePane, setMobilePane] = useState<"list" | "detail">(params.get("id") ? "detail" : "list");
  const [stageBusy, setStageBusy] = useState(false);

  useEffect(() => {
    // Always refresh in the background; show SSR data immediately when present.
    if (initial) setLoading(false);
    import("@/lib/client-cache").then(({ cachedJson }) =>
      cachedJson<InitialCrm>("crm", "/api/crm", { ttlMs: initial ? 20_000 : 60_000 })
        .then((j: InitialCrm & { actionQueue?: ActionItem[] }) => {
          setItems(j.items);
          setCounts(j.counts);
          if (j.actionQueue) setActionQueue(j.actionQueue);
        })
        .catch((e: unknown) => {
          const status = (e as { status?: number }).status;
          if (status === 401) window.location.href = "/login?next=/kansen";
          else if (!initial) setError(e instanceof Error ? e.message : "fout");
        })
        .finally(() => setLoading(false))
    );
  }, [initial]);

  useEffect(() => {
    const id = params.get("id");
    if (id) {
      setSel(id);
      setMobilePane("detail");
    }
  }, [params]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "bureau" || filter === "direct") return items.filter((i) => i.lane === filter);
    return items.filter((i) => i.stage === filter);
  }, [items, filter]);

  async function setStage(id: string, stage: CrmStage) {
    setStageBusy(true);
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage }),
      });
      if (!res.ok) throw new Error("stage mislukt");
      const j = (await res.json()) as { item?: CrmOpportunity };
      if (j.item) {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, stage: j.item!.stage } : x)));
      }
      const { cacheClear } = await import("@/lib/client-cache");
      cacheClear("crm");
    } finally {
      setStageBusy(false);
    }
  }

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
    { id: "nieuw", label: "Nieuw", n: counts.byStage?.nieuw ?? 0 },
    { id: "bevestigd", label: "Bevestigd", n: counts.byStage?.bevestigd ?? counts.bureau },
    { id: "hm", label: "Manager", n: counts.byStage?.hm ?? 0 },
    { id: "outreach", label: "Outreach", n: counts.byStage?.outreach ?? 0 },
    { id: "direct", label: "Direct", n: counts.direct },
  ];

  return (
    <AppShell current="kansen" title="Kansen" subtitle="CRM-pipeline · bevestigd & actueel" fill>
      <div className="ws-shell">
        <section className="ws-intro">
          <p className="ws-intro__title">Pipeline</p>
          <p className="ws-intro__text">
            Alle serieuze kansen op één rij. <strong>Bron</strong> = waar de kans vandaan komt:{" "}
            <em>Bureau · …</em> (via detacheerder, bevestigd) of een jobboard zoals LinkedIn/Indeed
            (direct bij de eindklant). Klik een regel voor detail, hiring manager en voorstel.
          </p>
        </section>

        {actionQueue.length ? (
          <section className="ws-panel shrink-0 px-3.5 py-3">
            <p className="ws-label">Actie vandaag</p>
            <ul className="mt-2 divide-y divide-[var(--line)]/70">
              {actionQueue.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a.id)}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--ink)]">{a.endClient}</span>
                      <span className="block truncate text-[0.72rem] text-[var(--muted)]">
                        {a.roleLabel} · {a.nextAction}
                      </span>
                    </span>
                    {a.kans != null ? <ScoreChip kans={a.kans} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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
                                {row.bronDetail ? ` · ${row.bronDetail}` : ""}
                              </span>
                              <span className="mt-0.5 block truncate text-[0.68rem] text-[var(--muted)]">
                                HM: {row.hiringManager || "nog niet gevonden"}
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
                          <th className="px-3 py-2.5 font-semibold">Stage</th>
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
                              <td className="px-3 py-3 align-top">
                                <span className="ws-badge">{CRM_STAGE_NL[row.stage] || row.stage}</span>
                              </td>
                              <td className="max-w-[12rem] px-3 py-3 align-top text-[var(--muted)]">
                                <span className="line-clamp-2">{row.roleLabel}</span>
                              </td>
                              <td className="max-w-[14rem] px-3 py-3 align-top">
                                <span className="block font-medium text-[var(--ink)]">{sourceLine(row)}</span>
                                {row.bronDetail ? (
                                  <span className="mt-0.5 block line-clamp-2 text-[0.72rem] text-[var(--muted)]">
                                    {row.bronDetail}
                                  </span>
                                ) : null}
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
                    <dd className="mt-1 font-medium text-[var(--ink)]">{sourceLine(active)}</dd>
                    {active.bronDetail ? (
                      <dd className="mt-0.5 text-sm text-[var(--muted)]">{active.bronDetail}</dd>
                    ) : null}
                  </div>
                  {active.sources.length > 1 ? (
                    <div>
                      <dt className="ws-label">Alle signalen</dt>
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

                <div className="mt-4">
                  <p className="ws-label">Stage</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(["bevestigd", "hm", "outreach", "won", "lost"] as CrmStage[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={stageBusy}
                        onClick={() => void setStage(active.id, st)}
                        className={`ws-chip !py-1.5 ${active.stage === st ? "ws-chip--on" : ""}`}
                      >
                        {CRM_STAGE_NL[st]}
                      </button>
                    ))}
                  </div>
                </div>

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
                  {active.companyId || active.endClient ? (
                    <Link
                      href={radarHref({
                        companyId: active.companyId,
                        openingId: active.openingId,
                        q: active.companyId ? null : active.endClient,
                      })}
                      className="btn-ghost btn-tool no-underline"
                    >
                      {active.hiringManager ? "Open op Radar" : "Zoek manager op Radar"}
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
