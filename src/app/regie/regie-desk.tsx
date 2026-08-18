"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceBar } from "@/components/workspace-bar";
import { ScoreChip, SCORE_BAND, scoreTone } from "@/components/score-chip";
import type { PlacementProposal } from "@/lib/placement";
import type { ApproachTarget } from "@/lib/approach";

type DeskItem = {
  companyId: string;
  openingId: string;
  company: string;
  sector: string | null;
  title: string;
  roleLabel: string;
  kans: number;
  hmSearched?: boolean;
  proposal: PlacementProposal;
};

const AVAIL = { nu: "Direct", "2w": "2 weken", "1m": "4 weken" } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function hmKnown(proposal: PlacementProposal | null) {
  const t = proposal?.hiring[0];
  return t?.kind === "person" && t.cta === "bericht";
}

function defaultTab(proposal: PlacementProposal | null): "hm" | string {
  if (hmKnown(proposal)) return "hm";
  return proposal?.shortlist[0]?.person.id || "hm";
}

function groupRail(items: DeskItem[]) {
  const groups: { companyId: string; company: string; openings: DeskItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.companyId === item.companyId) last.openings.push(item);
    else groups.push({ companyId: item.companyId, company: item.company, openings: [item] });
  }
  return groups;
}

function writeUrl(companyId: string, openingId: string) {
  const url = `/regie?id=${encodeURIComponent(companyId)}&opening=${encodeURIComponent(openingId)}`;
  window.history.replaceState(window.history.state, "", url);
}

export default function RegieDesk({
  initialId,
  initialOpening,
}: {
  initialId: string | null;
  initialOpening: string | null;
}) {
  const [items, setItems] = useState<DeskItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState({ companyId: initialId, openingId: initialOpening });
  const [tab, setTab] = useState<"hm" | string>("hm");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [huntBusy, setHuntBusy] = useState(false);
  const [huntErr, setHuntErr] = useState("");

  useEffect(() => {
    fetch("/api/placement")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login?next=/regie";
          return null;
        }
        if (!res.ok) throw new Error("niet gevonden");
        return res.json() as Promise<{ items: DeskItem[] }>;
      })
      .then((j) => {
        if (!j) return;
        setItems(j.items);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"))
      .finally(() => setLoading(false));
  }, []);

  const item =
    items.find((i) => i.companyId === sel.companyId && i.openingId === sel.openingId) ||
    items.find((i) => i.companyId === sel.companyId) ||
    items[0] ||
    null;

  useEffect(() => {
    if (!item) return;
    if (sel.companyId === item.companyId && sel.openingId === item.openingId) return;
    setSel({ companyId: item.companyId, openingId: item.openingId });
    if (item.companyId !== "demo") writeUrl(item.companyId, item.openingId);
  }, [item, sel.companyId, sel.openingId]);

  const proposal = item?.proposal ?? null;
  const groups = useMemo(() => groupRail(items), [items]);

  useEffect(() => {
    setTab(defaultTab(proposal));
    setHuntErr("");
  }, [item?.openingId]);

  useEffect(() => {
    if (!proposal) return;
    setDraft(tab === "hm" ? proposal.hmMessage : proposal.candidateMessages.find((m) => m.id === tab)?.body || "");
  }, [proposal, tab]);

  function select(companyId: string, oid: string) {
    setSel({ companyId, openingId: oid });
    writeUrl(companyId, oid);
  }

  async function huntHm(force = false) {
    if (!item) return;
    setHuntBusy(true);
    setHuntErr("");
    try {
      const res = await fetch("/api/hm-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: item.companyId, openingId: item.openingId, force }),
      });
      const data = (await res.json()) as {
        error?: string;
        empty?: boolean;
        detail?: string;
        targets?: ApproachTarget[];
      };
      if (!res.ok) throw new Error(data.error || "zoeken mislukt");
      if (data.empty || !data.targets?.length) {
        setHuntErr(
          data.detail === "no-apify-token"
            ? "Geen Apify-token — gebruik Vind op LinkedIn."
            : data.detail === "demo"
              ? "Demo-opening — sync eerst echte kansen."
              : data.detail === "no-company-linkedin"
                ? "Geen LinkedIn-bedrijfspagina — gebruik Vind op LinkedIn."
                : "Geen mensen gevonden die nu bij dit bedrijf werken."
        );
        return;
      }
      const openingId = item.openingId;
      const companyId = item.companyId;
      const named = data.targets.find((t) => t.kind === "person" && t.cta === "bericht");
      const first = named?.label.split(/\s+/)[0];
        setItems((rows) =>
          rows.map((r) =>
            r.openingId === openingId && r.companyId === companyId
              ? {
                  ...r,
                  hmSearched: true,
                  proposal: {
                  ...r.proposal,
                  hiring: data.targets!,
                  hmMessage: first
                    ? r.proposal.hmMessage.replace(/^Hoi\b[^,]*,/, `Hoi ${first},`)
                    : r.proposal.hmMessage,
                },
              }
            : r
        )
      );
      setTab("hm");
    } catch (e) {
      setHuntErr(e instanceof Error ? e.message : "zoeken mislukt");
    } finally {
      setHuntBusy(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  const hm = proposal?.hiring[0];
  const known = hmKnown(proposal);
  const linkedInUrl =
    tab === "hm" ? hm?.url : proposal?.shortlist.find((s) => s.person.id === tab)?.linkedinUrl;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <WorkspaceBar current="voorstel" />

      <div className="mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 gap-4 overflow-hidden px-5 py-4 md:px-8 lg:grid-cols-[16.5rem_1fr]">
        <aside className="radar-scroll-pane min-h-0">
          <div className="radar-scroll-pane__head">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Openingen</p>
            <p className="tabular-nums text-[0.68rem] text-[var(--muted)]">{items.length || 0}</p>
          </div>
          <div className="radar-scroll-pane__body !px-1.5">
            {groups.map((g) => {
              const companyActive = item?.companyId === g.companyId;
              return (
                <div key={g.companyId} className="mb-3 last:mb-0">
                  <p className="px-2 pb-1 pt-1 text-[0.7rem] font-semibold text-[var(--ink)]">{g.company}</p>
                  <ul className="space-y-0.5">
                    {g.openings.map((r) => {
                      const active = item?.openingId === r.openingId && companyActive;
                      return (
                        <li key={r.openingId}>
                          <button
                            type="button"
                            onClick={() => select(r.companyId, r.openingId)}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                              active
                                ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 shadow-[inset_3px_0_0_0_var(--accent)]"
                                : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            <span
                              className={`min-w-0 flex-1 truncate text-[0.78rem] ${
                                active ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"
                              }`}
                            >
                              {r.title}
                            </span>
                            <span
                              className="shrink-0 tabular-nums text-[0.65rem] text-[var(--muted)]"
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {r.kans}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto pb-6">
          {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
          {loading || !item || !proposal ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow)]">
                <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">{item.company}</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
                      {item.title}
                    </h1>
                    {item.roleLabel && item.roleLabel !== item.title ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.roleLabel}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ScoreChip kans={item.kans} large />
                    <p className="text-sm font-semibold text-[var(--ink)]">{SCORE_BAND[scoreTone(item.kans)]}</p>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="border-b border-[var(--line)]/80 px-5 py-2.5">
                  <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Hiring manager</p>
                </div>
                {proposal.hiring.slice(0, 3).map((t) => {
                  const named = t.kind === "person" && t.cta === "bericht";
                  const recruiter = /recruiter/i.test(t.subtitle || "");
                  return (
                    <div
                      key={`${t.kind}-${t.label}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)]/70 px-5 py-4 first:border-t-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                          {named ? initials(t.label) : "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--ink)]">{t.label}</span>
                          {t.subtitle ? (
                            <span className="block text-[0.78rem] text-[var(--muted)]">{t.subtitle}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {named && !recruiter ? (
                          <button
                            type="button"
                            onClick={() => setTab("hm")}
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                              tab === "hm"
                                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                                : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]/40"
                            }`}
                          >
                            Bericht
                          </button>
                        ) : null}
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] no-underline hover:border-[var(--accent)]/40"
                        >
                          {named ? (recruiter ? "Vraag op LinkedIn" : "LinkedIn") : "Vind op LinkedIn"}
                        </a>
                      </div>
                    </div>
                  );
                })}
                {!known && item.companyId !== "demo" ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)]/70 px-5 py-3">
                    <button
                      type="button"
                      disabled={huntBusy}
                      onClick={() => void huntHm(false)}
                      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)] disabled:opacity-50"
                    >
                      {huntBusy ? "Zoeken…" : "Zoek 3 namen"}
                    </button>
                    <p className="text-[0.72rem] text-[var(--muted)]">
                      {huntErr || "Alleen mensen die nu bij dit bedrijf werken · ≈ €0,10"}
                    </p>
                  </div>
                ) : known && item.hmSearched && item.companyId !== "demo" ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)]/70 px-5 py-3">
                    <button
                      type="button"
                      disabled={huntBusy}
                      onClick={() => void huntHm(true)}
                      className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                    >
                      {huntBusy ? "Zoeken…" : "Opnieuw zoeken"}
                    </button>
                    <p className="text-[0.72rem] text-[var(--muted)]">{huntErr || "≈ €0,10"}</p>
                  </div>
                ) : null}
              </section>

              <section>
                <p className="mb-2 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Voorstel</p>
                <ol className="grid gap-3 md:grid-cols-3">
                  {proposal.shortlist.map((s, i) => {
                    const on = tab === s.person.id;
                    return (
                      <li key={s.person.id}>
                        <button
                          type="button"
                          onClick={() => setTab(s.person.id)}
                          className={`flex h-full w-full flex-col rounded-md border bg-[var(--surface)] p-4 text-left shadow-[var(--shadow)] transition ${
                            on
                              ? "border-[var(--accent)] shadow-[inset_3px_0_0_0_var(--accent)]"
                              : "border-[var(--line)] hover:border-[var(--accent)]/40"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={`grid h-9 w-9 place-items-center rounded-md text-[0.7rem] font-semibold ${
                                on ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--ink)]"
                              }`}
                            >
                              {initials(s.person.name)}
                            </span>
                            <span className="tabular-nums text-[0.68rem] text-[var(--muted)]">{i + 1}</span>
                          </span>
                          <span className="mt-3 block text-sm font-semibold text-[var(--ink)]">{s.person.name}</span>
                          <span className="mt-0.5 block text-[0.78rem] text-[var(--muted)]">{s.person.title}</span>
                          <span className="mt-2 flex flex-wrap gap-x-2 text-[0.72rem] text-[var(--muted)]">
                            <span>€{s.person.rate}</span>
                            <span>·</span>
                            <span>{s.person.city}</span>
                            <span>·</span>
                            <span className={s.person.available === "nu" ? "text-[var(--green)]" : ""}>
                              {AVAIL[s.person.available]}
                            </span>
                          </span>
                          <span className="mt-3 block text-[0.78rem] leading-snug text-[var(--muted)]">{s.why[0]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/80 px-5 py-2.5">
                  <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Bericht</p>
                  <div className="flex flex-wrap gap-1">
                    {known ? (
                      <button
                        type="button"
                        onClick={() => setTab("hm")}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                          tab === "hm"
                            ? "bg-[var(--ink)] text-white"
                            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                        }`}
                      >
                        Manager
                      </button>
                    ) : null}
                    {proposal.candidateMessages.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTab(m.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                          tab === m.id
                            ? "bg-[var(--ink)] text-white"
                            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                        }`}
                      >
                        {m.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={8}
                    className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyDraft}
                      className="rounded-md bg-[var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {copied ? "Gekopieerd" : "Kopieer"}
                    </button>
                    {linkedInUrl ? (
                      <a
                        href={linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] no-underline hover:border-[var(--accent)]/40"
                      >
                        Open LinkedIn
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
