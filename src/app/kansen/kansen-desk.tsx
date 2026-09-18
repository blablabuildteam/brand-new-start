"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScoreChip } from "@/components/score-chip";
import { CompanyMark } from "@/components/company-mark";
import type { CrmLane, CrmOpportunity, CrmStage } from "@/lib/crm";
import { CRM_STAGE_NL } from "@/lib/crm";
import { radarHref } from "@/lib/desk-links";
import { guessCompanyLogo } from "@/lib/company-logo";

/** Filters volgen de vier stappen plus de twee bronnen — niet de losse stages. */
type Filter = "all" | "step2" | "step3" | "step4" | CrmLane;

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

function needsContact(row: CrmOpportunity) {
  if (!row.hiringManager || !row.hiringManagerUrl) return false;
  if (row.hiringManagerEmail || row.hiringManagerPhone) return false;
  if (row.lushaStatus === "empty" || row.lushaStatus === "restricted") return false;
  return true;
}

function contactLine(row: CrmOpportunity) {
  if (!row.hiringManager) return "Geen hiring manager";
  if (row.hiringManagerEmail && row.hiringManagerPhone) {
    return `${row.hiringManager} · ${row.hiringManagerEmail} · ${row.hiringManagerPhone}`;
  }
  if (row.hiringManagerEmail) return `${row.hiringManager} · ${row.hiringManagerEmail}`;
  if (row.hiringManagerPhone) return `${row.hiringManager} · ${row.hiringManagerPhone}`;
  if (row.lushaStatus === "empty" || row.lushaStatus === "restricted") {
    return `${row.hiringManager} · geen mail/tel`;
  }
  return `${row.hiringManager} · mail/tel nog ophalen`;
}

function originOf(row: CrmOpportunity) {
  if (row.lane === "bureau") {
    return {
      label: "Recruiter feed",
      detail: [row.agencyName, row.recruiterName].filter(Boolean).join(" · ") || null,
    };
  }
  const detail = row.bronDetail && !/job-type|direct bij eindklant/i.test(row.bronDetail) ? row.bronDetail : null;
  return { label: "Jobboards", detail };
}

/** Vaste route: opdrachtgever → manager → contact → bericht. */
const STEPS = ["Opdrachtgever", "Manager", "Contact", "Bericht"] as const;

type Step = {
  /** 1-based positie in STEPS: de stap die nu open staat. */
  n: number;
  action: "hm" | "contact" | "bericht" | null;
  label: string;
};

function stepOf(row: CrmOpportunity): Step {
  if (row.stage === "won") return { n: 4, action: null, label: "Gewonnen" };
  if (row.stage === "lost") return { n: 4, action: null, label: "Afgelegd" };
  if (!row.hiringManager) return { n: 2, action: "hm", label: "Zoek manager" };
  if (needsContact(row)) return { n: 3, action: "contact", label: "Haal contact" };
  if (row.stage === "outreach") return { n: 4, action: "bericht", label: "Follow-up" };
  return { n: 4, action: "bericht", label: "Bericht" };
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
  backlog?: { feedPending: number; boardBelow: number; boardThreshold: number };
  lusha?: boolean;
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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stageBusy, setStageBusy] = useState(false);
  const [hmBusy, setHmBusy] = useState(false);
  const [hmError, setHmError] = useState<string | null>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [lushaReady, setLushaReady] = useState(Boolean(initial?.lusha));
  const [backlog, setBacklog] = useState(initial?.backlog || null);
  const [hmAutoRan, setHmAutoRan] = useState(false);
  const [q, setQ] = useState("");
  const [bulkNote, setBulkNote] = useState<string | null>(null);

  function refresh() {
    return import("@/lib/client-cache").then(({ cachedJson, cacheClear }) => {
      cacheClear("crm");
      return cachedJson<InitialCrm>("crm", "/api/crm", { ttlMs: 5_000 }).then((j: InitialCrm) => {
        setItems(j.items);
        setCounts(j.counts);
        if (j.backlog) setBacklog(j.backlog);
        if (typeof j.lusha === "boolean") setLushaReady(j.lusha);
      });
    });
  }

  async function fetchContact(crmId: string, linkedinUrl?: string | null, pickOnly = false) {
    setContactBusy(true);
    setHmError(null);
    setSel(crmId);
    try {
      const res = await fetch("/api/leads/hm-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmId, linkedinUrl: linkedinUrl || undefined, pickOnly }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (!res.ok) {
        setHmError(
          j.detail === "no-lusha-key"
            ? "Lusha-key ontbreekt nog. Naam en LinkedIn staan er wel — mail en tel komen zodra de key op Vercel staat."
            : j.error || "Contact ophalen mislukt"
        );
        return;
      }
      await refresh().catch(() => null);
    } finally {
      setContactBusy(false);
    }
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
    import("@/lib/client-cache").then(({ cachedJson, cacheSet }) => {
      if (initial) cacheSet("crm", initial);
      return cachedJson<InitialCrm>("crm", "/api/crm", {
        ttlMs: initial ? 45_000 : 60_000,
        staleMs: 5 * 60_000,
        onUpdate: (j) => {
          setItems(j.items);
          setCounts(j.counts);
          if (j.backlog) setBacklog(j.backlog);
          if (typeof j.lusha === "boolean") setLushaReady(j.lusha);
        },
      })
        .then((j: InitialCrm) => {
          setItems(j.items);
          setCounts(j.counts);
          if (j.backlog) setBacklog(j.backlog);
          if (typeof j.lusha === "boolean") setLushaReady(j.lusha);
        })
        .catch((e: unknown) => {
          const status = (e as { status?: number }).status;
          if (status === 401) window.location.href = "/login?next=/kansen";
          else if (!initial) setError(e instanceof Error ? e.message : "fout");
        })
        .finally(() => setLoading(false));
    });
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
    const needle = q.trim().toLowerCase();
    const rows = items.filter((r) => {
      if (filter === "bureau" || filter === "direct") {
        if (r.lane !== filter) return false;
      } else if (filter !== "all") {
        if (stepOf(r).n !== Number(filter.slice(4))) return false;
      }
      if (!needle) return true;
      const hay = [
        r.endClient,
        r.roleLabel,
        r.title,
        r.hiringManager,
        r.agencyName,
        r.bronLabel,
        r.bronDetail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
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

  const selectedRows = useMemo(
    () => filtered.filter((r) => picked.has(r.id)),
    [filtered, picked]
  );

  function pick(id: string) {
    setSel((cur) => (cur === id ? null : id));
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePickAll() {
    if (picked.size && filtered.every((r) => picked.has(r.id))) {
      setPicked(new Set());
      return;
    }
    setPicked(new Set(filtered.map((r) => r.id)));
  }

  function setFilterSafe(next: Filter) {
    setFilter(next);
    setSel(null);
    setPicked(new Set());
  }

  async function runPrimary(row: CrmOpportunity) {
    const step = stepOf(row);
    if (step.action === "hm") {
      setSel(row.id);
      await searchHm(row.id, Boolean(row.hiringManager));
      return;
    }
    if (step.action === "contact") {
      await fetchContact(row.id, row.hiringManagerUrl);
      return;
    }
    if (step.action === "bericht" && row.href) window.location.href = row.href;
  }

  async function bulkSearchHm() {
    const targets = selectedRows.filter(
      (r) => !r.hiringManager && r.stage !== "won" && r.stage !== "lost" && !r.demo
    );
    if (!targets.length) {
      setBulkNote("Geen geselecteerde rijen zonder hiring manager.");
      return;
    }
    setBulkNote(`HM zoeken voor ${targets.length}…`);
    for (const row of targets) {
      await searchHm(row.id);
    }
    setBulkNote(`${targets.length} afgerond`);
    window.setTimeout(() => setBulkNote(null), 2000);
  }

  const perStep = (n: number) => items.filter((r) => stepOf(r).n === n).length;
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Alles", n: counts.all },
    { id: "step2", label: "Zoek manager", n: perStep(2) },
    { id: "step3", label: "Haal contact", n: perStep(3) },
    { id: "step4", label: "Bericht", n: perStep(4) },
    { id: "direct", label: "Jobboards", n: counts.direct },
    { id: "bureau", label: "Recruiter feed", n: counts.bureau },
  ];

  const needsHm = filtered.filter((r) => !r.hiringManager && r.stage !== "won" && r.stage !== "lost").length;
  const allFilteredPicked = filtered.length > 0 && filtered.every((r) => picked.has(r.id));

  return (
    <AppShell
      current="kansen"
      title="Kansen"
      subtitle="Opdrachtgever → manager → contact → bericht"
      fill
    >
      <div className="ws-shell">
        <details className="ws-fold shrink-0">
          <summary>
            <span>Wat is Kansen?</span>
            <span className="ws-fold__meta">Vier stappen per kans</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Een kans komt hier binnen op twee manieren: je bevestigt de opdrachtgever van een post op{" "}
              <a href="/leads" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                Recruiter feed
              </a>
              , of een vacature op{" "}
              <a href="/radar" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                Jobboards
              </a>{" "}
              haalt kans-score 55. Daarna loopt elke kans dezelfde vier stappen, en de knop rechts is altijd de
              eerstvolgende stap.
            </p>
            <ol className="ws-fold__steps">
              <li>
                <span className="ws-fold__n">1</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Opdrachtgever</strong> — bekend, anders staat
                  de kans hier nog niet.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">2</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Manager</strong> — Zoek manager haalt namen van
                  LinkedIn (≈ €0,10).
                </span>
              </li>
              <li>
                <span className="ws-fold__n">3</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Contact</strong> — Haal contact zet mail en
                  telefoon op de kans.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">4</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Bericht</strong> — tekst aan die manager. Jij
                  verstuurt.
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

        {picked.size > 0 ? (
          <div className="kans-bulk shrink-0">
            <label className="flex items-center gap-2 text-[0.8rem] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={allFilteredPicked}
                onChange={togglePickAll}
                className="kans-check"
              />
              <span className="font-semibold tabular-nums">{picked.size} geselecteerd</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={hmBusy}
                onClick={() => void bulkSearchHm()}
                className="btn-ink btn-tool"
              >
                {hmBusy ? "Zoeken…" : "Zoek HM"}
              </button>
              <button type="button" className="btn-ghost btn-tool" onClick={() => setPicked(new Set())}>
                Wissen
              </button>
              {bulkNote ? <span className="text-[0.72rem] text-[var(--muted)]">{bulkNote}</span> : null}
            </div>
          </div>
        ) : null}

        <section className="radar-scroll-pane min-h-0 flex-1">
          <div className="radar-scroll-pane__head">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allFilteredPicked}
                disabled={!filtered.length}
                onChange={togglePickAll}
                className="kans-check"
                aria-label="Selecteer alle zichtbare kansen"
              />
              <p className="ws-label">Lijst</p>
            </div>
            <p className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
              {filtered.length} {filtered.length === 1 ? "kans" : "kansen"}
              {needsHm ? ` · ${needsHm} zonder manager` : ""}
            </p>
          </div>
          {backlog && (backlog.feedPending || backlog.boardBelow) ? (
            <p className="kans-backlog">
              Niet meer kansen dan dit, omdat stap 1 elders nog open staat:{" "}
              {backlog.feedPending ? (
                <>
                  <a href="/leads" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                    {backlog.feedPending} feed-posts
                  </a>{" "}
                  zonder bevestigde opdrachtgever
                </>
              ) : null}
              {backlog.feedPending && backlog.boardBelow ? " · " : ""}
              {backlog.boardBelow ? (
                <>
                  <a href="/radar" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                    {backlog.boardBelow} jobboard-vacatures
                  </a>{" "}
                  onder kans-score {backlog.boardThreshold}
                </>
              ) : null}
              .
            </p>
          ) : null}
          <div className="radar-scroll-pane__body !p-0">
            {error ? <p className="px-5 py-3 text-sm text-[var(--warn)]">{error}</p> : null}
            {loading ? <p className="px-5 py-3 text-sm text-[var(--muted)]">Laden…</p> : null}
            {!loading && !filtered.length ? (
              <p className="ws-empty m-4">
                Nog geen kansen hier. Bevestig een opdrachtgever op Recruiter feed, of wacht op een warme
                jobboard-hit.
              </p>
            ) : null}

            {!loading && filtered.length ? (
              <div className="kans-head" aria-hidden>
                <span />
                <span>Opdrachtgever</span>
                <span>Bron</span>
                <span>Hiring manager</span>
                <span className="text-right">Kans</span>
                <span className="text-right">Volgende stap</span>
              </div>
            ) : null}

            {!loading && filtered.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map((row) => {
                  const on = active?.id === row.id;
                  const step = stepOf(row);
                  const checked = picked.has(row.id);
                  const stepBusy =
                    (hmBusy && step.action === "hm") || (contactBusy && step.action === "contact");
                  return (
                    <li key={row.id} className={on ? "bg-[var(--surface-2)]" : ""}>
                      <div className={`kans-row ${on ? "kans-row--on" : ""}`}>
                        <label
                          className="kans-row__check"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePick(row.id)}
                            className="kans-check"
                            aria-label={`Selecteer ${row.endClient}`}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => pick(row.id)}
                          aria-expanded={on}
                          aria-current={on ? "true" : undefined}
                          className="kans-row__who"
                        >
                          <CompanyMark
                            name={row.endClient}
                            logoUrl={row.logoUrl || guessCompanyLogo(row.endClient)}
                            size="md"
                          />
                          <span className="kans-row__title">
                            <span className="truncate text-[0.95rem] font-semibold text-[var(--ink)]">
                              {row.endClient}
                            </span>
                            <span className="truncate text-[0.78rem] text-[var(--muted)]">
                              {row.roleLabel}
                              {row.freshnessLabel ? ` · ${row.freshnessLabel}` : ""}
                            </span>
                          </span>
                        </button>

                        <span className="kans-row__src">
                          <span className={`kans-origin ${row.lane === "bureau" ? "kans-origin--feed" : "kans-origin--board"}`}>
                            {originOf(row).label}
                          </span>
                          {originOf(row).detail ? (
                            <span className="kans-row__src-detail">{originOf(row).detail}</span>
                          ) : (
                            <span className="kans-row__src-detail">&nbsp;</span>
                          )}
                        </span>

                        <span className="kans-row__hm">
                          <span className={`block truncate ${row.hiringManager ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                            {row.hiringManager || "Geen hiring manager"}
                          </span>
                          {row.hiringManager ? (
                            <span className="block truncate text-[0.72rem] text-[var(--muted)]">
                              {row.hiringManagerEmail ||
                                row.hiringManagerPhone ||
                                (row.lushaStatus ? "Geen mail/tel" : "Mail/tel nog ophalen")}
                            </span>
                          ) : (
                            <span className="block text-[0.72rem]">&nbsp;</span>
                          )}
                        </span>

                        <span className="kans-row__score">
                          {row.kans != null ? (
                            <ScoreChip kans={row.kans} />
                          ) : (
                            <span className="text-[0.7rem] text-[var(--muted)]">—</span>
                          )}
                        </span>

                        <span className="kans-row__side">
                          {step.action ? (
                            <button
                              type="button"
                              disabled={stepBusy}
                              className="btn-ink btn-tool w-full justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                void runPrimary(row);
                              }}
                            >
                              {stepBusy && on ? "Bezig…" : step.label}
                            </button>
                          ) : (
                            <span className="kans-row__next">{step.label}</span>
                          )}
                          <span className="kans-row__step">
                            Stap {step.n} van 4 · {STEPS[step.n - 1]}
                          </span>
                        </span>
                      </div>

                      {on ? (
                        <div className="kans-row__detail">
                          <p className="text-sm text-[var(--muted)]">{row.title}</p>
                          <ol className="kans-track">
                            {STEPS.map((name, i) => (
                              <li
                                key={name}
                                className={`kans-track__item ${
                                  i + 1 < step.n
                                    ? "kans-track__item--done"
                                    : i + 1 === step.n
                                      ? "kans-track__item--now"
                                      : ""
                                }`}
                              >
                                <span className="kans-track__n">{i + 1}</span>
                                {name}
                              </li>
                            ))}
                          </ol>
                          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <dt className="ws-label">Hoe binnengekomen</dt>
                              <dd className="mt-1 font-medium text-[var(--ink)]">{originOf(row).label}</dd>
                              {originOf(row).detail ? (
                                <dd className="mt-0.5 text-[0.78rem] text-[var(--muted)]">{originOf(row).detail}</dd>
                              ) : null}
                              {row.agencyName ? (
                                <dd className="mt-0.5 text-[0.78rem] text-[var(--muted)]">
                                  Bureau · {row.agencyName}
                                  {row.recruiterName ? ` · ${row.recruiterName}` : ""}
                                </dd>
                              ) : null}
                              {row.lane === "direct" ? (
                                <dd className="mt-0.5 text-[0.78rem] text-[var(--muted)]">Directe vacature via Jobboards</dd>
                              ) : null}
                            </div>
                            <div>
                              <dt className="ws-label">Hiring manager</dt>
                              <dd className="mt-1 text-[var(--ink)]">
                                {row.hiringManager ? (
                                  <span className="font-semibold">{contactLine(row)}</span>
                                ) : (
                                  <span className="text-[var(--muted)]">Nog niet gevonden</span>
                                )}
                              </dd>
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

                          {row.hiringManager ? (
                            <div className="kans-contact">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="ws-label">Benaderen</p>
                                  <p className="mt-1 text-[0.95rem] font-semibold text-[var(--ink)]">
                                    {row.hiringManager}
                                  </p>
                                  {row.hiringManagerTitle ? (
                                    <p className="text-[0.8rem] text-[var(--muted)]">{row.hiringManagerTitle}</p>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {row.hiringManagerEmail ? (
                                    <a href={`mailto:${row.hiringManagerEmail}`} className="btn-ink btn-tool no-underline">
                                      Mail
                                    </a>
                                  ) : null}
                                  {row.hiringManagerPhone ? (
                                    <a href={`tel:${row.hiringManagerPhone}`} className="btn-ink btn-tool no-underline">
                                      Bel
                                    </a>
                                  ) : null}
                                  {row.hiringManagerUrl ? (
                                    <a
                                      href={row.hiringManagerUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-ghost btn-tool no-underline"
                                    >
                                      LinkedIn
                                    </a>
                                  ) : null}
                                  {needsContact(row) ? (
                                    <button
                                      type="button"
                                      disabled={contactBusy}
                                      onClick={() => void fetchContact(row.id, row.hiringManagerUrl)}
                                      className="btn-ink btn-tool disabled:opacity-50"
                                    >
                                      {contactBusy ? "Contact…" : "Haal mail en tel"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <dl className="mt-3 grid gap-2 text-[0.8rem] sm:grid-cols-2">
                                <div>
                                  <dt className="ws-label">Mail</dt>
                                  <dd className="mt-0.5 break-all text-[var(--ink)]">
                                    {row.hiringManagerEmail || (row.lushaStatus ? "Niet gevonden" : "Nog niet opgehaald")}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="ws-label">Telefoon</dt>
                                  <dd className="mt-0.5 text-[var(--ink)]">
                                    {row.hiringManagerPhone || (row.lushaStatus ? "Niet gevonden" : "Nog niet opgehaald")}
                                  </dd>
                                </div>
                              </dl>
                              {!lushaReady && needsContact(row) ? (
                                <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
                                  Lusha-key ontbreekt nog. Naam en LinkedIn kun je al gebruiken.
                                </p>
                              ) : null}
                              {row.hmHits.filter((h) => h.name !== row.hiringManager).length ? (
                                <ul className="mt-3 space-y-1 border-t border-[var(--line)] pt-2">
                                  {row.hmHits
                                    .filter((h) => h.name !== row.hiringManager)
                                    .slice(0, 4)
                                    .map((h) => (
                                      <li key={`${h.name}-${h.url || ""}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]">
                                        <span className="font-medium text-[var(--ink)]">{h.name}</span>
                                        {h.title ? <span className="text-[var(--muted)]">{h.title}</span> : null}
                                        {h.email ? <span className="text-[var(--muted)]">{h.email}</span> : null}
                                        <button
                                          type="button"
                                          disabled={contactBusy}
                                          onClick={() => void fetchContact(row.id, h.url, true)}
                                          className="font-semibold text-[var(--ink)] underline underline-offset-2 disabled:opacity-50"
                                        >
                                          Gebruik deze
                                        </button>
                                      </li>
                                    ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

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
                                Open bericht
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
                                  Op Jobboards
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
