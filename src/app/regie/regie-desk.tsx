"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { PlacementProposal } from "@/lib/placement";

type RailItem = {
  id: string;
  company: string;
  title: string;
  kans: number;
  openings: { id: string; title: string; roleLabel: string; kans: number }[];
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

const STEPS = [
  "Vacature gelezen",
  "Bench gefilterd",
  "Gerankt op rol · domein · stack",
  "Twee berichten klaar",
];

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

export default function RegieDesk() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const openingId = params.get("opening");
  const { data, error } = usePlacement(id, openingId);
  const [beat, setBeat] = useState(0);
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
  const runKey = opening ? `${opening.companyId}:${opening.openingId}` : "";

  useEffect(() => {
    if (!runKey) return;
    setBeat(0);
    setTab("hm");
    const timers = [180, 420, 720, 980].map((ms, i) =>
      window.setTimeout(() => setBeat(i + 1), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [runKey]);

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

  const ready = beat >= STEPS.length;
  const hm = proposal?.hiring[0];
  const activeMsg =
    tab === "hm"
      ? { label: "Naar de manager", href: hm?.url }
      : {
          label: "Naar de kandidaat",
          href: proposal?.shortlist.find((s) => s.person.id === tab)?.linkedinUrl,
        };

  return (
    <div className="regie-shell flex min-h-dvh flex-col">
      <header className="shrink-0 border-b border-[var(--line)]/80 bg-[var(--header)] px-5 py-4 text-white md:px-8">
        <div className="mx-auto flex max-w-[1180px] items-end justify-between gap-4">
          <div>
            <p
              className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55"
              style={{ fontFamily: "var(--mono)" }}
            >
              Licentie-klaar · bench inwisselbaar
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl" style={{ fontFamily: "var(--display)" }}>
              Regie
            </h1>
            <p className="mt-1 max-w-md text-sm text-white/70">
              Vacature → hiring manager → drie namen. Daarna verstuur jij.
            </p>
          </div>
          <Link href="/" className="text-sm font-medium text-white/80 no-underline hover:text-white">
            ← Radar
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-[1180px] flex-1 lg:grid-cols-[15.5rem_1fr]">
        <aside className="border-b border-[var(--line)]/80 bg-[var(--surface)]/70 lg:border-b-0 lg:border-r">
          <p
            className="px-4 pb-1 pt-4 text-[0.62rem] uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Openingen
          </p>
          <ul className="max-h-[28vh] overflow-y-auto pb-3 lg:max-h-none">
            {(data?.rail.length ? data.rail : []).map((r) => {
              const first = r.openings[0];
              const active = opening?.companyId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => first && select(r.id, first.id)}
                    className={`w-full px-4 py-2.5 text-left ${
                      active ? "bg-[var(--accent-soft)]/70" : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-[var(--ink)]">{r.company}</span>
                    <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--muted)]">{r.title}</span>
                  </button>
                  {active && r.openings.length > 1
                    ? r.openings.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => select(r.id, o.id)}
                          className={`w-full px-4 py-1.5 pl-6 text-left text-[0.75rem] ${
                            opening?.openingId === o.id
                              ? "font-semibold text-[var(--ink)]"
                              : "text-[var(--muted)] hover:text-[var(--ink)]"
                          }`}
                        >
                          {o.title}
                        </button>
                      ))
                    : null}
                </li>
              );
            })}
          </ul>
          {data?.demo ? (
            <p className="px-4 pb-4 text-[0.7rem] leading-relaxed text-[var(--muted)]">
              Geen live radar — demo op een overheids-BA.
            </p>
          ) : null}
        </aside>

        <main className="px-5 py-6 md:px-8">
          {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
          {!proposal || !opening ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <article>
              <p
                className="text-[0.62rem] uppercase tracking-[0.1em] text-[var(--muted)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                {opening.roleLabel}
                {proposal.domain ? ` · ${proposal.domain}` : ""}
                {proposal.family ? ` · ${proposal.family}` : ""}
              </p>
              <h2
                className="mt-1 text-3xl font-bold tracking-tight text-[var(--ink)] md:text-[2.35rem]"
                style={{ fontFamily: "var(--display)" }}
              >
                {opening.company}
              </h2>
              <p className="mt-1 text-base text-[var(--muted)]">{opening.title}</p>

              <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
                {STEPS.map((s, i) => (
                  <li
                    key={s}
                    className={`text-[0.75rem] ${
                      beat > i ? "text-[var(--ink)]" : "text-[var(--muted)]/50"
                    }`}
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    {String(i + 1).padStart(2, "0")} {s}
                  </li>
                ))}
              </ol>

              {ready ? (
                <div className="animate-fade-in">
                  <p
                    className="mt-8 max-w-xl text-xl font-semibold leading-snug text-[var(--ink)] md:text-2xl"
                    style={{ fontFamily: "var(--display)" }}
                  >
                    {proposal.pitch}
                  </p>

                  <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,16rem)_1fr]">
                    <section>
                      <p
                        className="text-[0.62rem] uppercase tracking-[0.1em] text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        Hiring manager
                      </p>
                      {proposal.hiring.map((t) => (
                        <div key={t.label} className="mt-2">
                          <p className="text-lg font-semibold text-[var(--ink)]">{t.label}</p>
                          {t.subtitle ? (
                            <p className="text-sm text-[var(--muted)]">{t.subtitle}</p>
                          ) : null}
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block rounded-[var(--radius)] bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold no-underline"
                            style={{ color: "#fff" }}
                          >
                            {t.cta === "bericht" ? "Bericht" : "Vind op LinkedIn"}
                          </a>
                        </div>
                      ))}
                    </section>

                    <section>
                      <p
                        className="text-[0.62rem] uppercase tracking-[0.1em] text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        Voorstel · {proposal.scanned} in de bench
                      </p>
                      <ul className="mt-2">
                        {proposal.shortlist.map((s, i) => (
                          <li
                            key={s.person.id}
                            className="regie-person flex items-start justify-between gap-4 border-t border-[var(--line)]/70 py-3 first:border-t-0"
                            style={{ animationDelay: `${i * 90}ms` }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm">
                                <span
                                  className="mr-2 tabular-nums text-[var(--muted)]"
                                  style={{ fontFamily: "var(--mono)" }}
                                >
                                  {i + 1}
                                </span>
                                <span className="font-semibold text-[var(--ink)]">{s.person.name}</span>
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  · {s.person.title} · {s.person.city} · €{s.person.rate}
                                </span>
                              </p>
                              <p className="mt-1 text-[0.8rem] leading-snug text-[var(--muted)]">
                                {s.why.join(" · ")}
                              </p>
                            </div>
                            <span
                              className="shrink-0 tabular-nums text-sm text-[var(--green)]"
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {s.score}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {proposal.runnerUp ? (
                        <p className="mt-2 text-[0.75rem] text-[var(--muted)]">
                          Niet meegenomen: {proposal.runnerUp.person.name} ({proposal.runnerUp.score}) —{" "}
                          {proposal.runnerUp.why[0]}
                        </p>
                      ) : null}
                    </section>
                  </div>

                  <section className="mt-10">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p
                        className="text-[0.62rem] uppercase tracking-[0.1em] text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        Berichten · jij verstuurt
                      </p>
                      <p className="text-[0.7rem] text-[var(--muted)]">{proposal.cost.note}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("hm")}
                        className={`rounded-[var(--radius)] px-2.5 py-1 text-xs font-medium ${
                          tab === "hm"
                            ? "bg-[var(--ink)] text-white"
                            : "bg-[var(--surface-2)] text-[var(--muted)]"
                        }`}
                      >
                        Manager
                      </button>
                      {proposal.candidateMessages.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setTab(m.id)}
                          className={`rounded-[var(--radius)] px-2.5 py-1 text-xs font-medium ${
                            tab === m.id
                              ? "bg-[var(--ink)] text-white"
                              : "bg-[var(--surface-2)] text-[var(--muted)]"
                          }`}
                        >
                          {m.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={10}
                      className="mt-3 w-full resize-y rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={copyDraft}
                        className="rounded-[var(--radius)] bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {copied ? "Gekopieerd" : "Kopieer"}
                      </button>
                      {activeMsg.href ? (
                        <a
                          href={activeMsg.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] no-underline hover:border-[var(--accent)]"
                        >
                          {activeMsg.label} op LinkedIn
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                      Boolean · {proposal.booleanSearch}
                    </p>
                  </section>
                </div>
              ) : (
                <p className="mt-10 text-sm text-[var(--muted)]">Bezig met koppelen…</p>
              )}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
