"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceBar } from "@/components/workspace-bar";
import type { PlacementProposal } from "@/lib/placement";

type RailItem = {
  companyId: string;
  openingId: string;
  company: string;
  title: string;
  kans: number;
};

type OpeningMeta = {
  companyId: string;
  openingId: string;
  company: string;
  sector: string | null;
  title: string;
  roleLabel: string;
  kans: number;
};

type Payload = {
  rail: RailItem[];
  demo?: boolean;
  opening: OpeningMeta | null;
  proposal: PlacementProposal | null;
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

function usePlacement(id: string | null, opening: string | null) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams();
    if (id) q.set("id", id);
    if (opening) q.set("opening", opening);
    fetch(`/api/placement?${q}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login?next=/regie";
          return null;
        }
        if (!res.ok) throw new Error("niet gevonden");
        return res.json() as Promise<Payload>;
      })
      .then((j) => {
        if (j) {
          setData(j);
          setError(null);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"));
  }, [id, opening]);
  return { data, error };
}

function groupRail(items: RailItem[]) {
  const groups: { companyId: string; company: string; openings: RailItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.companyId === item.companyId) last.openings.push(item);
    else groups.push({ companyId: item.companyId, company: item.company, openings: [item] });
  }
  return groups;
}

export default function RegieDesk() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const openingId = params.get("opening");
  const { data, error } = usePlacement(id, openingId);
  const [tab, setTab] = useState<"hm" | string>("hm");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id || !data?.opening || data.opening.companyId === "demo") return;
    router.replace(
      `/regie?id=${encodeURIComponent(data.opening.companyId)}&opening=${encodeURIComponent(data.opening.openingId)}`
    );
  }, [id, data, router]);

  const proposal = data?.proposal ?? null;
  const opening = data?.opening ?? null;
  const groups = useMemo(() => groupRail(data?.rail || []), [data?.rail]);

  useEffect(() => {
    setTab("hm");
  }, [opening?.openingId]);

  useEffect(() => {
    if (!proposal) return;
    setDraft(tab === "hm" ? proposal.hmMessage : proposal.candidateMessages.find((m) => m.id === tab)?.body || "");
  }, [proposal, tab]);

  function select(companyId: string, oid: string) {
    router.replace(`/regie?id=${encodeURIComponent(companyId)}&opening=${encodeURIComponent(oid)}`);
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
  const linkedInUrl =
    tab === "hm" ? hm?.url : proposal?.shortlist.find((s) => s.person.id === tab)?.linkedinUrl;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <WorkspaceBar current="voorstel" />

      <div className="mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 gap-4 overflow-hidden px-5 py-4 md:px-8 lg:grid-cols-[16.5rem_1fr]">
        <aside className="radar-scroll-pane min-h-0">
          <div className="radar-scroll-pane__head">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Openingen</p>
            <p className="tabular-nums text-[0.68rem] text-[var(--muted)]">{data?.rail.length || 0}</p>
          </div>
          <div className="radar-scroll-pane__body !px-1.5">
            {groups.map((g) => {
              const companyActive = opening?.companyId === g.companyId;
              return (
                <div key={g.companyId} className="mb-3 last:mb-0">
                  <p className="px-2 pb-1 pt-1 text-[0.7rem] font-semibold text-[var(--ink)]">{g.company}</p>
                  <ul className="space-y-0.5">
                    {g.openings.map((r) => {
                      const active = opening?.openingId === r.openingId && companyActive;
                      return (
                        <li key={r.openingId}>
                          <button
                            type="button"
                            onClick={() => select(r.companyId, r.openingId)}
                            aria-current={active ? "true" : undefined}
                            className={`w-full truncate rounded-md border px-2.5 py-1.5 text-left text-[0.78rem] transition ${
                              active
                                ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 font-semibold text-[var(--ink)] shadow-[inset_3px_0_0_0_var(--accent)]"
                                : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                            }`}
                          >
                            {r.title}
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
          {!proposal || !opening ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="animate-fade-in overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow)]">
                <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">{opening.company}</p>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
                    {opening.title}
                  </h1>
                  <p className="tabular-nums text-sm text-[var(--muted)]">Kans {opening.kans}</p>
                </div>
                {opening.roleLabel && opening.roleLabel !== opening.title ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{opening.roleLabel}</p>
                ) : null}
              </section>

              <section className="animate-fade-in overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]" style={{ animationDelay: "40ms" }}>
                <div className="border-b border-[var(--line)]/80 px-5 py-2.5">
                  <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Hiring manager</p>
                </div>
                {proposal.hiring.slice(0, 1).map((t) => {
                  const on = tab === "hm";
                  return (
                    <div key={t.label} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <button type="button" onClick={() => setTab("hm")} className="flex min-w-0 items-center gap-3 text-left">
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                            on ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent)]"
                          }`}
                        >
                          {initials(t.label) || "HM"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--ink)]">{t.label}</span>
                          {t.subtitle ? <span className="block text-[0.78rem] text-[var(--muted)]">{t.subtitle}</span> : null}
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTab("hm")}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                            on
                              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]/40"
                          }`}
                        >
                          Bericht
                        </button>
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] no-underline hover:border-[var(--accent)]/40"
                        >
                          {t.cta === "bericht" ? "LinkedIn" : "Vind op LinkedIn"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="animate-fade-in" style={{ animationDelay: "80ms" }}>
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

              <section
                className="animate-fade-in overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]"
                style={{ animationDelay: "120ms" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/80 px-5 py-2.5">
                  <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Bericht</p>
                  <div className="flex flex-wrap gap-1">
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
