"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScoreChip } from "@/components/score-chip";
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

function sourceLine(row: CrmOpportunity) {
  return row.bronLabel || (row.lane === "bureau" ? "Bureau" : "Direct");
}

function nextActionOf(row: CrmOpportunity) {
  if (row.stage === "won" || row.stage === "lost") return CRM_STAGE_NL[row.stage];
  if (!row.hiringManager) return "Zoek hiring manager";
  if (row.stage === "outreach") return "Follow-up";
  return "Open voorstel";
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
  const [counts, setCounts] = useState(
    initial?.counts || { all: 0, bureau: 0, direct: 0, withHm: 0 }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(params.get("id"));
  const [stageBusy, setStageBusy] = useState(false);
  const [hmBusy, setHmBusy] = useState(false);
  const [hmError, setHmError] = useState<string | null>(null);
  const [hmAutoRan, setHmAutoRan] = useState(false);
  const [q, setQ] = useState("");

  function refresh() {
    return import("@/lib/client-cache").then(({ cachedJson, cacheClear }) => {
      cacheClear("crm");
      return cachedJson<InitialCrm>("crm", "/api/crm", { ttlMs: 5_000 }).then((j: InitialCrm) => {
        setItems(j.items);
        setCounts(j.counts);
      });
    });
  }

  async function searchHm(crmId: string, force = false) {
    setHmBusy(true);
    setHmError(null);
    try {
      const res = await fetch("/api/leads/hm-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmId, force }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        empty?: boolean;
        hiringManager?: string | null;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setHmError(j.error || "HM-zoeken mislukt");
        return;
      }
      if (j.empty || !j.hiringManager) {
        setHmError(j.detail || "Geen hiring manager gevonden bij dit bedrijf op LinkedIn.");
      }
      await refresh().catch(() => null);
    } finally {
      setHmBusy(false);
    }
  }

  useEffect(() => {
    if (initial) setLoading(false);
    import("@/lib/client-cache").then(({ cachedJson }) =>
      cachedJson<InitialCrm>("crm", "/api/crm", { ttlMs: initial ? 20_000 : 60_000 })
        .then((j: InitialCrm) => {
          setItems(j.items);
          setCounts(j.counts);
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
    if (id) setSel(id);
  }, [params]);

  useEffect(() => {
    const id = params.get("id");
    const wantHm = params.get("hm") === "1";
    if (!wantHm || !id || hmAutoRan || loading) return;
    const row = items.find((i) => i.id === id);
    if (!row) return;
    setHmAutoRan(true);
    if (!row.hiringManager) void searchHm(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from deep link
  }, [params, items, loading, hmAutoRan]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const rows = items.filter((i) => {
      if (filter === "bureau" || filter === "direct") {
        if (i.lane !== filter) return false;
      } else if (filter !== "all" && i.stage !== filter) {
        return false;
      }
      if (!n) return true;
      const blob = `${i.endClient} ${i.roleLabel} ${i.title} ${i.hiringManager || ""} ${i.bronLabel} ${i.bronDetail || ""} ${i.agencyName || ""}`.toLowerCase();
      return blob.includes(n);
    });
    return rows.slice().sort((a, b) => {
      const ah = a.hiringManager ? 1 : 0;
      const bh = b.hiringManager ? 1 : 0;
      if (ah !== bh) return ah - bh;
      const ak = a.kans ?? -1;
      const bk = b.kans ?? -1;
      if (bk !== ak) return bk - ak;
      return (b.foundAt || "").localeCompare(a.foundAt || "");
    });
  }, [items, filter, q]);

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

  const active = sel ? items.find((i) => i.id === sel) || null : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key !== "j" && e.key !== "k") return;
      if (!filtered.length) return;
      const idx = sel ? filtered.findIndex((i) => i.id === sel) : -1;
      const next =
        e.key === "j"
          ? filtered[Math.min(filtered.length - 1, Math.max(0, idx) + 1)]
          : filtered[Math.max(0, (idx < 0 ? 1 : idx) - 1)];
      if (next) setSel(next.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, sel]);

  function pick(id: string) {
    setSel((cur) => (cur === id ? null : id));
  }

  function setFilterSafe(next: Filter) {
    setFilter(next);
    setSel(null);
  }

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Alles", n: counts.all },
    { id: "nieuw", label: "Nieuw", n: counts.byStage?.nieuw ?? 0 },
    { id: "bevestigd", label: "Bevestigd", n: counts.byStage?.bevestigd ?? counts.bureau },
    { id: "hm", label: "Manager", n: counts.byStage?.hm ?? 0 },
    { id: "outreach", label: "Outreach", n: counts.byStage?.outreach ?? 0 },
    { id: "direct", label: "Direct", n: counts.direct },
  ];

  const needsHm = filtered.filter((r) => !r.hiringManager && r.stage !== "won" && r.stage !== "lost").length;

  return (
    <AppShell current="kansen" title="Kansen" subtitle="Eén lijst · volgende actie in de rij" fill>
      <div className="ws-shell">
        <details className="ws-fold shrink-0">
          <summary>
            <span>Wat is Kansen?</span>
            <span className="ws-fold__meta">Actielijst · HM · voorstel</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Hier staan <strong className="font-semibold text-[var(--ink)]">bevestigde bureau-kansen</strong> en{" "}
              <strong className="font-semibold text-[var(--ink)]">warme directe hits</strong> uit Radar. Per rij
              zie je de volgende stap — meestal: hiring manager zoeken of voorstel openen.
            </p>
            <ol className="ws-fold__steps">
              <li>
                <span className="ws-fold__n">1</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Filter</strong> — nieuw, bevestigd, of zonder
                  manager.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">2</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Actie</strong> — klik een rij voor detail, stage
                  en HM-zoek.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">3</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Door</strong> — met manager klaar voor{" "}
                  <a href="/regie" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                    Voorstel
                  </a>
                  .
                </span>
              </li>
            </ol>
          </div>
        </details>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter op eindklant, rol of HM…"
            className="min-w-[12rem] flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            aria-label="Filter kansen"
          />
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
        </div>

        <section className="radar-scroll-pane min-h-0 flex-1">
          <div className="radar-scroll-pane__head">
            <p className="ws-label">Lijst</p>
            <p className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
              {filtered.length}
              {needsHm ? ` · ${needsHm} zonder HM` : ""}
            </p>
          </div>
          <div className="radar-scroll-pane__body !p-0">
            {error ? <p className="px-5 py-3 text-sm text-[var(--warn)]">{error}</p> : null}
            {loading ? <p className="px-5 py-3 text-sm text-[var(--muted)]">Laden…</p> : null}
            {!loading && !filtered.length ? (
              <p className="ws-empty m-4">
                Nog geen kansen hier. Bevestig een eindklant op Bureaus, of wacht op warme radar-hits.
              </p>
            ) : null}

            {!loading && filtered.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map((row) => {
                  const on = active?.id === row.id;
                  const next = nextActionOf(row);
                  return (
                    <li key={row.id} className={on ? "bg-[var(--surface-2)]" : ""}>
                      <button
                        type="button"
                        onClick={() => pick(row.id)}
                        aria-expanded={on}
                        aria-current={on ? "true" : undefined}
                        className={`kans-row ${on ? "kans-row--on" : ""}`}
                      >
                        <span className="kans-row__main">
                          <span className="kans-row__title">
                            <span className="truncate text-[0.95rem] font-semibold text-[var(--ink)]">
                              {row.endClient}
                            </span>
                            <span className="truncate text-[0.8rem] text-[var(--muted)]">
                              {row.roleLabel}
                              <span className="opacity-80">
                                {" · "}
                                {row.lane === "bureau" ? "Bureau" : "Direct"}
                                {row.freshnessLabel ? ` · ${row.freshnessLabel}` : ""}
                              </span>
                            </span>
                          </span>
                          <span className="kans-row__hm">
                            {row.hiringManager ? (
                              <span className="font-medium text-[var(--ink)]">{row.hiringManager}</span>
                            ) : (
                              <span className="text-[var(--muted)]">Geen hiring manager</span>
                            )}
                          </span>
                        </span>
                        <span className="kans-row__side">
                          <span className="kans-row__next">{next}</span>
                          {row.kans != null ? (
                            <ScoreChip kans={row.kans} />
                          ) : (
                            <span className="text-[0.7rem] text-[var(--muted)]">—</span>
                          )}
                        </span>
                      </button>

                      {on ? (
                        <div className="kans-row__detail">
                          <p className="text-sm text-[var(--muted)]">{row.title}</p>
                          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <dt className="ws-label">Bron</dt>
                              <dd className="mt-1 font-medium text-[var(--ink)]">{sourceLine(row)}</dd>
                              {row.bronDetail ? (
                                <dd className="mt-0.5 text-[0.78rem] text-[var(--muted)]">{row.bronDetail}</dd>
                              ) : null}
                              {row.agencyName ? (
                                <dd className="mt-0.5 text-[0.78rem] text-[var(--muted)]">{row.agencyName}</dd>
                              ) : null}
                            </div>
                            <div>
                              <dt className="ws-label">Hiring manager</dt>
                              <dd className="mt-1 text-[var(--ink)]">
                                {row.hiringManager ? (
                                  <>
                                    {row.hiringManagerUrl ? (
                                      <a
                                        href={row.hiringManagerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-[var(--ink)] no-underline hover:underline"
                                      >
                                        {row.hiringManager}
                                      </a>
                                    ) : (
                                      <span className="font-semibold">{row.hiringManager}</span>
                                    )}
                                    {row.hiringManagerTitle ? (
                                      <span className="block text-[0.8rem] text-[var(--muted)]">
                                        {row.hiringManagerTitle}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-[var(--muted)]">Nog niet gevonden</span>
                                )}
                              </dd>
                              {row.hmHits?.length > 1 ? (
                                <ul className="mt-1.5 space-y-0.5">
                                  {row.hmHits.slice(0, 4).map((h) => (
                                    <li key={h.name} className="text-[0.75rem] text-[var(--muted)]">
                                      {h.url ? (
                                        <a
                                          href={h.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium text-[var(--ink)] no-underline hover:underline"
                                        >
                                          {h.name}
                                        </a>
                                      ) : (
                                        <span className="font-medium text-[var(--ink)]">{h.name}</span>
                                      )}
                                      {h.title ? ` · ${h.title}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                            <div>
                              <dt className="ws-label">Tijdlijn</dt>
                              <dd className="mt-1 text-[var(--ink)]">
                                Gevonden {formatDay(row.foundAt)}
                                {row.lastSeenAt ? ` · gezien ${formatDay(row.lastSeenAt)}` : ""}
                                {row.confirmedAt ? ` · bevestigd ${formatDay(row.confirmedAt)}` : ""}
                              </dd>
                              {row.sources.length > 1 ? (
                                <dd className="mt-1 text-[0.75rem] text-[var(--muted)]">
                                  {row.sources.join(" · ")}
                                </dd>
                              ) : null}
                            </div>
                          </dl>

                          {hmError && active?.id === row.id ? (
                            <p className="mt-3 text-[0.75rem] text-[var(--warn)]">{hmError}</p>
                          ) : null}

                          <div className="mt-5 border-t border-[var(--line)] pt-4">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <label className="block min-w-[10rem] flex-1">
                                <span className="ws-label">Stage</span>
                                <select
                                  className="ws-input mt-1.5 w-full max-w-xs"
                                  disabled={stageBusy}
                                  value={row.stage}
                                  onChange={(e) => void setStage(row.id, e.target.value as CrmStage)}
                                >
                                  {(["bevestigd", "hm", "outreach", "won", "lost"] as CrmStage[]).map((st) => (
                                    <option key={st} value={st}>
                                      {CRM_STAGE_NL[st]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {row.kans != null ? <ScoreChip kans={row.kans} large /> : null}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <button
                                type="button"
                                disabled={hmBusy}
                                onClick={() => void searchHm(row.id, Boolean(row.hiringManager))}
                                className="btn-ink btn-tool"
                              >
                                {hmBusy
                                  ? "LinkedIn zoeken…"
                                  : row.hiringManager
                                    ? "Opnieuw HM zoeken"
                                    : "Zoek hiring manager"}
                              </button>
                              {row.href ? (
                                <Link
                                  href={row.href}
                                  className="text-[0.8rem] font-semibold text-[var(--ink)] no-underline hover:underline"
                                >
                                  Open voorstel
                                </Link>
                              ) : null}
                              {row.evidenceUrl ? (
                                <a
                                  href={row.evidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[0.8rem] font-medium text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline"
                                >
                                  Vacature
                                </a>
                              ) : null}
                              {row.companyId ? (
                                <Link
                                  href={radarHref({
                                    companyId: row.companyId,
                                    openingId: row.openingId,
                                  })}
                                  className="text-[0.8rem] font-medium text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline"
                                >
                                  Op Radar
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
