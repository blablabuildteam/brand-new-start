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

      <div className="mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 overflow-hidden lg:grid-cols-[14rem_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b border-[var(--line)]/80 lg:border-b-0 lg:border-r">
          {groups.map((g) => {
            const companyActive = opening?.companyId === g.companyId;
            return (
              <div key={g.companyId} className="border-b border-[var(--line)]/60 last:border-b-0">
                <p className="px-4 pb-1 pt-3 text-[0.72rem] font-semibold text-[var(--ink)]">{g.company}</p>
                <ul className="pb-2">
                  {g.openings.map((r) => {
                    const active = opening?.openingId === r.openingId && companyActive;
                    return (
                      <li key={r.openingId}>
                        <button
                          type="button"
                          onClick={() => select(r.companyId, r.openingId)}
                          className={`w-full truncate px-4 py-1 text-left text-[0.78rem] ${
                            active
                              ? "font-semibold text-[var(--ink)]"
                              : "text-[var(--muted)] hover:text-[var(--ink)]"
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
        </aside>

        <main className="min-h-0 overflow-y-auto px-5 py-6 md:px-8">
          {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
          {!proposal || !opening ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <article className="max-w-[38rem]">
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
                {opening.title}
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {opening.company}
                {opening.roleLabel && opening.roleLabel !== opening.title ? ` · ${opening.roleLabel}` : ""}
              </p>

              <section className="mt-7">
                <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Hiring manager</p>
                {proposal.hiring.slice(0, 1).map((t) => (
                  <div key={t.label} className="mt-1.5 flex items-baseline justify-between gap-3">
                    <p className="text-sm">
                      <span className="font-semibold text-[var(--ink)]">{t.label}</span>
                      {t.subtitle ? <span className="text-[var(--muted)]"> · {t.subtitle}</span> : null}
                    </p>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-semibold no-underline hover:underline"
                    >
                      {t.cta === "bericht" ? "Bericht" : "Vind op LinkedIn"}
                    </a>
                  </div>
                ))}
              </section>

              <section className="mt-7">
                <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Voorstel</p>
                <ol className="mt-1.5">
                  {proposal.shortlist.map((s, i) => (
                    <li key={s.person.id} className="border-t border-[var(--line)]/70 py-2 first:border-t-0">
                      <p className="text-sm">
                        <span className="tabular-nums text-[var(--muted)]">{i + 1}. </span>
                        <span className="font-semibold text-[var(--ink)]">{s.person.name}</span>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {s.person.title} · €{s.person.rate}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[0.78rem] text-[var(--muted)]">{s.why[0]}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-7">
                <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">Bericht</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setTab("hm")}
                    className={`text-xs ${tab === "hm" ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}
                  >
                    Manager
                  </button>
                  {proposal.candidateMessages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTab(m.id)}
                      className={`text-xs ${tab === m.id ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}
                    >
                      {m.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className="mt-2 w-full resize-y rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed"
                />
                <div className="mt-2 flex gap-3">
                  <button type="button" onClick={copyDraft} className="text-xs font-semibold text-[var(--ink)]">
                    {copied ? "Gekopieerd" : "Kopieer"}
                  </button>
                  {linkedInUrl ? (
                    <a
                      href={linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold no-underline hover:underline"
                    >
                      Open LinkedIn
                    </a>
                  ) : null}
                </div>
              </section>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
