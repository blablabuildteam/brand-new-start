"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResearchMeter } from "@/components/research-meter";
import { kansenHref, regieHref } from "@/lib/desk-links";
import type { AgencyLead, LeadStatus } from "@/lib/opportunity";
import { streamResearch } from "@/lib/research/client";
import { startingProgress } from "@/lib/research/progress";
import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

const MAX_PARALLEL_RESEARCH = 3;

type AiJob = {
  depth: ResearchDepth;
  progress: ResearchProgress;
  status: "queued" | "running" | "error";
  error?: string;
};

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
  suggest: "Sterk voorstel",
  review: "Review",
  weak: "Te dun",
  confirmed: "Bevestigd",
  rejected: "Afgewezen",
};

const STATUS_HINT: Record<LeadStatus, string> = {
  suggest: "Hoge zekerheid (≥80%) — meestal veilig om te bevestigen",
  review: "Twijfelzone (45–79%) — check bewijs of kies een optie",
  weak: "Weinige signalen (<45%) — zelf invullen of AI opnieuw",
  confirmed: "Door jou bevestigd",
  rejected: "Afgewezen",
};

function factsLine(l: AgencyLead) {
  return [l.facts.location, l.facts.start, l.facts.duration, l.facts.hours, l.facts.stack.slice(0, 4).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

function statusClass(status: LeadStatus) {
  if (status === "confirmed") return "border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]";
  if (status === "suggest") return "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]";
  if (status === "rejected") return "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]";
  return "border-[var(--warn)]/30 bg-[var(--warn-soft)] text-[var(--warn)]";
}

function LeadCard({
  lead,
  busy,
  aiBusy,
  aiDepth,
  aiProgress,
  aiQueued,
  aiError,
  clientDraft,
  onClientDraft,
  onReview,
  onAiGuess,
  onHmSearch,
  hmBusy,
}: {
  lead: AgencyLead;
  busy: boolean;
  aiBusy: boolean;
  aiDepth?: ResearchDepth | null;
  aiProgress?: ResearchProgress | null;
  aiQueued?: boolean;
  aiError?: string | null;
  hmBusy?: boolean;
  clientDraft: string;
  onClientDraft: (v: string) => void;
  onReview: (id: string, action: "confirmed" | "rejected", clientName?: string) => void;
  onAiGuess: (id: string, depth?: ResearchDepth) => void;
  onHmSearch?: (id: string) => void;
}) {
  const [showText, setShowText] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const guessed = lead.confirmedClient || lead.guess?.name || "";
  const client = (clientDraft || guessed).trim();
  const open = lead.status !== "confirmed" && lead.status !== "rejected";
  const multi =
    open && lead.guess && (lead.guess.alternatives.length > 0 || lead.guess.confidence < 80);
  const report = lead.guess?.report;
  const researchLock = busy || aiBusy || Boolean(aiQueued);
  const sourceLabel =
    lead.guess?.source === "deep"
      ? "AI research"
      : lead.guess?.source === "ai"
        ? "AI"
        : lead.guess
          ? "Regels"
          : null;

  return (
    <article className="ws-panel px-4 py-3.5 transition hover:border-[var(--accent)]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[0.7rem] font-medium text-[var(--muted)]">{lead.agency.name}</p>
            {lead.demo ? <span className="ws-badge">Voorbeeld</span> : null}
            {lead.aiGuess ? (
              <span className="ws-badge border-transparent bg-[var(--signal)] text-[var(--ink)]">AI</span>
            ) : null}
          </div>
          <h2 className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--ink)]">{lead.title}</h2>
          <p className="mt-0.5 text-[0.78rem] text-[var(--muted)]">
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
            ) : null}
          </p>
          {factsLine(lead) ? <p className="mt-1 text-[0.72rem] text-[var(--muted)]">{factsLine(lead)}</p> : null}
        </div>
        <span
          className={`ws-status shrink-0 ${statusClass(lead.status)}`}
          title={STATUS_HINT[lead.status]}
        >
          {STATUS_NL[lead.status]}
          {lead.guess && lead.status !== "rejected" ? ` · ${lead.guess.confidence}% zeker` : ""}
        </span>
      </div>

      {lead.guess ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sourceLabel ? (
            <span className="rounded-[calc(var(--radius)-2px)] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--muted)]">
              Bron: {sourceLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowScore((v) => !v)}
            className="text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
          >
            {showScore ? "Scoring verbergen" : "Waarop is deze score gebaseerd?"}
          </button>
        </div>
      ) : null}

      {showScore && lead.guess ? (
        <div className="mt-2 rounded-[var(--radius)] border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2.5 text-[0.75rem] leading-relaxed text-[var(--muted)]">
          {report ? (
            <>
              <p className="font-medium text-[var(--ink)]">{report.hypothesis}</p>
              <p className="mt-1.5">{report.why}</p>
              {report.signalsSummary ? (
                <p className="mt-1.5">
                  <span className="font-medium text-[var(--ink)]/80">Signalen: </span>
                  {report.signalsSummary}
                </p>
              ) : null}

              {report.ranking.length ? (
                <div className="mt-2.5 space-y-2">
                  <p className="font-medium text-[var(--ink)]/80">Kandidaten &amp; scoreopbouw</p>
                  {report.ranking.slice(0, 4).map((r, idx) => (
                    <div
                      key={r.name}
                      className="rounded-[calc(var(--radius)-2px)] border border-[var(--line)]/70 bg-[var(--surface)] px-2.5 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-[var(--ink)]">
                          {idx + 1}. {r.name}
                        </span>
                        <span className="shrink-0 font-semibold text-[var(--ink)]">{r.confidence}%</span>
                      </div>
                      <p className="mt-0.5 text-[0.72rem] leading-snug">{idx === 0 ? r.why : r.whyLower || r.why}</p>
                      {r.score?.lines.length ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {r.score.lines.map((l, i) => (
                            <li key={i} className="flex gap-2 text-[0.7rem] leading-snug">
                              <span
                                className={`w-9 shrink-0 text-right font-semibold ${
                                  l.points >= 0 ? "text-[var(--accent)]" : "text-[#b4462f]"
                                }`}
                              >
                                {l.points >= 0 ? `+${l.points}` : l.points}
                              </span>
                              <span>
                                <span className="text-[var(--ink)]/80">{l.label}</span>
                                {l.note ? <span className="block italic opacity-80">{l.note}</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {r.counterEvidence.length ? (
                        <p className="mt-1.5 text-[0.7rem] leading-snug">
                          <span className="font-medium text-[#b4462f]">Tegen: </span>
                          {r.counterEvidence.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {report.timeline?.length ? (
                <div className="mt-2">
                  <p className="font-medium text-[var(--ink)]/80">Tijdlijn</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {report.timeline.slice(0, 5).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.counterEvidence.length ? (
                <div className="mt-2">
                  <p className="font-medium text-[var(--ink)]/80">Tegenbewijs / onzekerheid</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {report.counterEvidence.slice(0, 4).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.openQuestions?.length ? (
                <div className="mt-2">
                  <p className="font-medium text-[var(--ink)]/80">Nog te checken</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {report.openQuestions.slice(0, 4).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.sources.length ? (
                <div className="mt-2">
                  <p className="font-medium text-[var(--ink)]/80">Bronnen ({report.sources.length})</p>
                  <ul className="mt-1 space-y-0.5">
                    {report.sources.slice(0, 8).map((s, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span
                          className="shrink-0 rounded border border-[var(--line)] px-1 text-[0.62rem] font-semibold text-[var(--muted)]"
                          title={
                            s.internal
                              ? "Eigen desk-data"
                              : `Tier ${s.tier ?? 4} — 1 officieel, 2 platform, 3 aggregator, 4 onbekend${s.scraped ? " · pagina gelezen" : ""}`
                          }
                        >
                          {s.internal ? "eigen" : `T${s.tier ?? 4}`}
                          {s.scraped ? "•" : ""}
                        </span>
                        <span className="truncate">
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent)] no-underline hover:underline"
                            >
                              {s.title || s.url}
                            </a>
                          ) : (
                            s.title
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="mt-2 text-[0.68rem] italic">{report.scoringNotes}</p>
            </>
          ) : (
            <>
              <p>
                <strong className="text-[var(--ink)]">Eerste eindklant</strong> komt uit lokale regels: expliciete
                opdrachtgever-naam in de tekst, of catalogus-tags (stad/sector/stack).
              </p>
              <ul className="mt-2 space-y-1">
                {lead.guess.evidence.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-[var(--ink)]/80">
                      {e.label} (+{e.weight})
                    </span>
                    {e.quote ? <span className="block italic">“{e.quote}”</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.68rem]">
                Status: ≥80% Sterk voorstel · 45–79% Review · &lt;45% Te dun. Voor diepere check: AI research.
              </p>
            </>
          )}
        </div>
      ) : null}

      {lead.summary ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
          >
            {showText ? "Vacaturetekst verbergen" : "Vacaturetekst / AI-basis tonen"}
          </button>
          {showText ? (
            <div className="mt-2 rounded-[var(--radius)] border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2.5">
              <p className="ws-label">Waar de AI op leest</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-[var(--ink)]/85">
                {lead.summary}
                {lead.summary.length >= 1390 ? "…" : ""}
              </p>
              {lead.guess?.evidence.length ? (
                <ul className="mt-2 space-y-1 border-t border-[var(--line)]/70 pt-2">
                  {lead.guess.evidence.slice(0, 4).map((e, i) => (
                    <li key={i} className="text-[0.72rem] leading-snug text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]/80">{e.label}</span>
                      {e.quote ? <span className="mt-0.5 block italic">“{e.quote}”</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {lead.evidenceUrl ? (
                <a
                  href={lead.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[0.72rem] font-semibold text-[var(--accent)] no-underline hover:underline"
                >
                  Volledige vacature →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-[var(--radius)] border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2.5">
        <p className="ws-label">{multi ? "Eindklant · kies of vul in" : "Eindklant"}</p>
        {open ? (
          <input
            type="text"
            value={clientDraft || guessed}
            onChange={(e) => onClientDraft(e.target.value)}
            placeholder="Naam eindklant"
            className="mt-1.5 w-full rounded-[calc(var(--radius)-2px)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            aria-label="Eindklant overrulen"
          />
        ) : (
          <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{client || "Nog niet te zeggen"}</p>
        )}
        {lead.guess?.evidence.length && !showText ? (
          <ul className="mt-2 space-y-1.5">
            {lead.guess.evidence.slice(0, 3).map((e, i) => (
              <li key={i} className="text-[0.75rem] leading-snug text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]/80">{e.label}</span>
                {e.quote ? <span className="block">“{e.quote}”</span> : null}
              </li>
            ))}
          </ul>
        ) : !lead.guess?.evidence.length ? (
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">Te vaag voor regels — probeer AI eindklant.</p>
        ) : null}
        {lead.guess && (lead.guess.name || lead.guess.alternatives.length) ? (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[0.72rem] text-[var(--muted)]">
              {lead.guess.alternatives.length
                ? "Mogelijke eindklanten — tik om te kiezen:"
                : "Voorgestelde eindklant:"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.guess.name ? (
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => onClientDraft(lead.guess!.name)}
                  className={`rounded-[calc(var(--radius)-2px)] border px-2 py-0.5 text-[0.7rem] font-medium disabled:opacity-50 ${
                    client === lead.guess.name
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
                  }`}
                >
                  {lead.guess.name} ({lead.guess.confidence}%)
                </button>
              ) : null}
              {lead.guess.alternatives.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  disabled={!open}
                  onClick={() => onClientDraft(a.name)}
                  className={`rounded-[calc(var(--radius)-2px)] border px-2 py-0.5 text-[0.7rem] font-medium disabled:opacity-50 ${
                    client === a.name
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
                  }`}
                >
                  {a.name} ({a.confidence}%)
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {aiQueued ? (
        <p className="mt-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-[0.78rem] text-[var(--muted)]">
          In de wachtrij — start zodra er een plek vrij is (max {MAX_PARALLEL_RESEARCH} tegelijk).
        </p>
      ) : null}
      {aiBusy && aiProgress && aiDepth ? <ResearchMeter depth={aiDepth} progress={aiProgress} /> : null}
      {aiError ? <p className="mt-2 text-[0.75rem] text-[var(--warn)]">{aiError}</p> : null}

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 max-sm:[&>button]:min-w-[calc(50%-0.25rem)] max-sm:[&>button]:flex-1">
          <button
            type="button"
            disabled={researchLock}
            onClick={() => onAiGuess(lead.id, "standard")}
            className="btn-ink btn-tool"
          >
            {aiBusy ? "Bezig…" : aiQueued ? "Wachtrij…" : lead.aiGuess ? "Opnieuw research" : "AI research"}
          </button>
          <button
            type="button"
            disabled={researchLock}
            onClick={() => onAiGuess(lead.id, "quick")}
            className="btn-ghost btn-tool"
            title="Eén zoekronde — snel en goedkoop, lagere zekerheid"
          >
            Snel
          </button>
          <button
            type="button"
            disabled={researchLock}
            onClick={() => onAiGuess(lead.id, "deep")}
            className="btn-ghost btn-tool"
            title="Drie rondes: shortlist, verificatie per kandidaat en actieve falsificatie (langzaam)"
          >
            Deep
          </button>
          <button
            type="button"
            disabled={busy || aiBusy || client.length < 2}
            onClick={() => onReview(lead.id, "confirmed", client)}
            className="btn-ink btn-tool"
          >
            Bevestig {client || "klant"}
          </button>
          <button
            type="button"
            disabled={busy || aiBusy}
            onClick={() => onReview(lead.id, "rejected")}
            className="btn-ghost btn-tool"
          >
            Niet deze
          </button>
          {lead.evidenceUrl ? (
            <a
              href={lead.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-semibold text-[var(--accent)] no-underline hover:underline max-sm:ml-0 max-sm:w-full max-sm:pt-1"
            >
              Vacature →
            </a>
          ) : null}
        </div>
      ) : lead.status === "confirmed" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="w-full text-[0.75rem] text-[var(--muted)]">
            Bevestigd als <strong className="text-[var(--ink)]">{client}</strong>
            {lead.hiringManager ? (
              <>
                {" · "}
                HM:{" "}
                {lead.hiringManagerUrl ? (
                  <a
                    href={lead.hiringManagerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--accent)] no-underline hover:underline"
                  >
                    {lead.hiringManager}
                  </a>
                ) : (
                  <strong className="text-[var(--ink)]">{lead.hiringManager}</strong>
                )}
                {lead.hiringManagerTitle ? ` · ${lead.hiringManagerTitle}` : ""}
              </>
            ) : (
              ". Volgende stap: hiring manager."
            )}
          </p>
          <Link href={kansenHref(`crm_bureau_${lead.id}`)} className="btn-ink btn-tool no-underline">
            Open in Kansen
          </Link>
          <button
            type="button"
            disabled={hmBusy}
            onClick={() => onHmSearch?.(lead.id)}
            className="btn-ink btn-tool"
          >
            {hmBusy ? "HM zoeken…" : "Zoek hiring manager"}
          </button>
          <Link href={regieHref({})} className="btn-ghost btn-tool no-underline">
            Naar Voorstel
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export default function LeadsDesk() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiJobs, setAiJobs] = useState<Record<string, AiJob>>({});
  const aiJobsRef = useRef<Record<string, AiJob>>({});
  const runningRef = useRef(new Set<string>());
  const pumpRef = useRef<() => void>(() => undefined);
  const [hmId, setHmId] = useState<string | null>(null);
  const [hmNote, setHmNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<"all" | "open" | "confirmed">("all");
  const [watchAgency, setWatchAgency] = useState<string | null>(null);
  const [clientDrafts, setClientDrafts] = useState<Record<string, string>>({});

  function upsertLead(next: AgencyLead) {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (list: AgencyLead[]) => list.map((l) => (l.id === next.id ? next : l));
      return { ...prev, live: patch(prev.live), demo: patch(prev.demo) };
    });
    if (next.guess?.name) {
      setClientDrafts((d) => ({ ...d, [next.id]: d[next.id] ?? next.guess!.name }));
    }
  }

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
        if (j) {
          setData(j);
          const drafts: Record<string, string> = {};
          for (const l of [...j.live, ...j.demo]) {
            const name = l.confirmedClient || l.guess?.name;
            if (name) drafts[l.id] = name;
          }
          setClientDrafts((prev) => ({ ...drafts, ...prev }));
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fout"));
  }

  useEffect(() => {
    load();
  }, []);

  const filteredLive = useMemo(() => {
    if (!data) return [];
    const n = q.trim().toLowerCase();
    return data.live.filter((l) => {
      if (bucket === "open" && (l.status === "confirmed" || l.status === "rejected")) return false;
      if (bucket === "confirmed" && l.status !== "confirmed") return false;
      if (watchAgency && l.agency.name.toLowerCase() !== watchAgency.toLowerCase()) return false;
      if (!n) return true;
      const blob = `${l.title} ${l.agency.name} ${l.confirmedClient || ""} ${l.guess?.name || ""} ${l.roleLabel}`.toLowerCase();
      return blob.includes(n);
    });
  }, [data, q, bucket, watchAgency]);

  const filteredDemo = useMemo(() => {
    if (!data) return [];
    const n = q.trim().toLowerCase();
    return data.demo.filter((l) => {
      if (bucket === "open" && (l.status === "confirmed" || l.status === "rejected")) return false;
      if (bucket === "confirmed" && l.status !== "confirmed") return false;
      if (watchAgency && l.agency.name.toLowerCase() !== watchAgency.toLowerCase()) return false;
      if (!n) return true;
      const blob = `${l.title} ${l.agency.name} ${l.confirmedClient || ""} ${l.guess?.name || ""}`.toLowerCase();
      return blob.includes(n);
    });
  }, [data, q, bucket, watchAgency]);

  const watchPeople = useMemo(() => {
    if (!data?.watchlist.length) return [];
    return data.watchlist.flatMap((a) =>
      a.recruiters.map((r) => ({
        key: `${a.id}:${r.name}`,
        agencyName: a.name,
        name: r.name,
        url: r.linkedinUrl,
        brand: r.brand,
      })),
    );
  }, [data]);

  const deepOpenCount = data?.live.filter(
    (l) => l.status !== "confirmed" && l.status !== "rejected" && !l.aiGuess && !aiJobs[l.id]
  ).length ?? 0;

  const researchStrip = useMemo(() => {
    const jobs = Object.values(aiJobs);
    const running = jobs.filter((j) => j.status === "running").length;
    const queued = jobs.filter((j) => j.status === "queued").length;
    if (!running && !queued) return null;
    return { running, queued };
  }, [aiJobs]);

  async function onReview(id: string, action: "confirmed" | "rejected", clientName?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(action === "confirmed" && clientName ? { clientName } : {}),
        }),
      });
      if (!res.ok) throw new Error("opslaan mislukt");
      const j = (await res.json()) as { lead?: AgencyLead };
      if (j.lead) upsertLead(j.lead);
      else load();
    } finally {
      setBusy(false);
    }
  }

  function patchJob(id: string, patch: Partial<AiJob> | null) {
    setAiJobs((prev) => {
      const next = { ...prev };
      if (!patch) delete next[id];
      else next[id] = { ...next[id], ...patch } as AiJob;
      aiJobsRef.current = next;
      return next;
    });
  }

  async function runResearchJob(id: string, depth: ResearchDepth) {
    patchJob(id, { status: "running", depth, progress: startingProgress(depth) });
    try {
      const result = await streamResearch<AgencyLead>(id, depth, (p) => {
        patchJob(id, { progress: p, status: "running" });
      });
      if (result.lead) upsertLead(result.lead);
      if (!result.ok) {
        patchJob(id, { status: "error", error: result.error || result.detail || "AI mislukt" });
        return;
      }
      patchJob(id, null);
    } catch (e) {
      patchJob(id, {
        status: "error",
        error: e instanceof Error ? e.message : "AI mislukt",
      });
    } finally {
      runningRef.current.delete(id);
      pumpRef.current();
    }
  }

  function pumpQueue() {
    const queued = Object.entries(aiJobsRef.current).filter(([, j]) => j.status === "queued");
    for (const [id, job] of queued) {
      if (runningRef.current.size >= MAX_PARALLEL_RESEARCH) break;
      runningRef.current.add(id);
      void runResearchJob(id, job.depth);
    }
  }
  pumpRef.current = pumpQueue;

  function onAiGuess(id: string, depth: ResearchDepth = "standard") {
    const current = aiJobsRef.current[id];
    if (current && (current.status === "running" || current.status === "queued")) return;
    if (runningRef.current.size >= MAX_PARALLEL_RESEARCH) {
      patchJob(id, { depth, progress: startingProgress(depth), status: "queued" });
      return;
    }
    runningRef.current.add(id);
    patchJob(id, { depth, progress: startingProgress(depth), status: "running" });
    void runResearchJob(id, depth);
  }

  function deepAllOpen() {
    if (!data) return;
    const targets = data.live.filter((l) => {
      if (l.status === "confirmed" || l.status === "rejected") return false;
      if (!l.aiGuess) return true;
      return false;
    });
    for (const l of targets) onAiGuess(l.id, "deep");
  }

  async function onHmSearch(id: string) {
    setHmId(id);
    setError(null);
    setHmNote(null);
    try {
      const res = await fetch("/api/leads/hm-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        empty?: boolean;
        hiringManager?: string | null;
        hiringManagerTitle?: string | null;
        hits?: { name: string; title: string | null }[];
        error?: string;
        detail?: string;
        crmId?: string;
      };
      if (res.status === 503) {
        setError(j.error || "APIFY_TOKEN ontbreekt");
        return;
      }
      if (!res.ok) {
        setError(j.error || "HM-zoeken mislukt");
        return;
      }
      if (j.hiringManager) {
        setHmNote(
          `${j.hiringManager}${j.hiringManagerTitle ? ` · ${j.hiringManagerTitle}` : ""}${
            j.hits && j.hits.length > 1 ? ` (+${j.hits.length - 1} alternatieven)` : ""
          }`
        );
        setData((prev) => {
          if (!prev) return prev;
          const patch = (list: AgencyLead[]) =>
            list.map((l) =>
              l.id === id
                ? { ...l, hiringManager: j.hiringManager, hiringManagerTitle: j.hiringManagerTitle || null }
                : l
            );
          return { ...prev, live: patch(prev.live), demo: patch(prev.demo) };
        });
        router.push(kansenHref(j.crmId || `crm_bureau_${id}`));
      } else {
        setHmNote(j.detail || "Geen hiring manager gevonden — check LinkedIn company-slug of probeer opnieuw.");
      }
    } finally {
      setHmId(null);
    }
  }

  return (
    <AppShell current="leads" title="Bureaus" subtitle="Eerst eindklant, dan hiring manager" fill>
      <div className="ws-shell flex min-h-0 flex-1 flex-col gap-3">
        <details className="ws-fold shrink-0">
          <summary>
            <span>Wat doe je hier?</span>
            <span className="ws-fold__meta">Eindklant → hiring manager</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Feeds van de recruiters die je volgt. Bevestig de eindklant (regels of AI research),
              daarna <strong className="font-semibold text-[var(--ink)]">Zoek hiring manager</strong> —
              LinkedIn people-search op de eindklant, zonder Radar-opening nodig. Resultaat landt in
              Kansen + Voorstel.
            </p>
          </div>
        </details>

        <section className="ws-panel shrink-0 px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <p className="ws-label">Die je volgt</p>
            <Link
              href="/instellingen#volgen"
              className="text-[0.72rem] font-semibold text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline"
            >
              Bewerken
            </Link>
          </div>
          {!data ? (
            <p className="mt-2 text-[0.78rem] text-[var(--muted)]">Laden…</p>
          ) : watchPeople.length === 0 ? (
            <p className="mt-2 text-[0.78rem] text-[var(--muted)]">
              Nog niemand.{" "}
              <Link href="/instellingen#volgen" className="font-semibold text-[var(--ink)] no-underline hover:underline">
                Stel in →
              </Link>
            </p>
          ) : (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setWatchAgency(null)}
                className={`ws-chip shrink-0 ${!watchAgency ? "ws-chip--on" : ""}`}
              >
                Alles
              </button>
              {watchPeople.map((p) => {
                const on = watchAgency?.toLowerCase() === p.agencyName.toLowerCase();
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setWatchAgency(on ? null : p.agencyName)}
                    className={`ws-chip shrink-0 max-w-[14rem] ${on ? "ws-chip--on" : ""}`}
                    title={p.url ? `${p.name} · open LinkedIn` : p.name}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="truncate opacity-70">{p.brand || p.agencyName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <main className="ws-main min-h-0 flex-1">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <p className="ws-label">Open leads</p>
            {data ? (
              <p className="text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {filteredLive.length}/{data.live.length} live
                {watchAgency ? ` · ${watchAgency}` : ""}
              </p>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek bureau, rol of eindklant…"
              className="min-w-[12rem] flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              aria-label="Filter leads"
            />
            {(["all", "open", "confirmed"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucket(b)}
                className={`ws-chip ${bucket === b ? "ws-chip--on" : ""}`}
              >
                {b === "all" ? "Alles" : b === "open" ? "Te reviewen" : "Bevestigd"}
              </button>
            ))}
            <button
              type="button"
              disabled={!deepOpenCount}
              onClick={deepAllOpen}
              className="btn-ghost btn-tool"
              title="Start Deep research op alle open live leads zonder AI-gok. Max 3 tegelijk, de rest wacht."
            >
              Deep alle open{deepOpenCount ? ` · ${deepOpenCount}` : ""}
            </button>
          </div>

          {researchStrip ? (
            <p className="mb-3 text-[0.78rem] text-[var(--ink)]">
              <span className="font-semibold">{researchStrip.running} deep/AI bezig</span>
              {researchStrip.queued ? ` · ${researchStrip.queued} in wachtrij` : ""}
              <span className="text-[var(--muted)]"> — meters per kaart</span>
            </p>
          ) : null}

          {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}
          {hmNote ? <p className="mb-3 text-sm text-[var(--accent)]">{hmNote}</p> : null}

          {!data ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Uit je radar</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {filteredLive.length}
                  </span>
                </div>
                {filteredLive.length ? (
                  <div className="space-y-2.5">
                    {filteredLive.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        busy={busy}
                        aiBusy={aiJobs[l.id]?.status === "running"}
                        aiQueued={aiJobs[l.id]?.status === "queued"}
                        aiDepth={aiJobs[l.id]?.depth ?? null}
                        aiProgress={aiJobs[l.id]?.progress ?? null}
                        aiError={aiJobs[l.id]?.error ?? null}
                        hmBusy={hmId === l.id}
                        clientDraft={clientDrafts[l.id] || ""}
                        onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [l.id]: v }))}
                        onReview={onReview}
                        onAiGuess={onAiGuess}
                        onHmSearch={onHmSearch}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="ws-empty">
                    Nog geen live bureau-hits. Zorg dat recruiters een LinkedIn-URL hebben, daarna
                    admin: Sync → Recruiter-feeds. Of test AI op een voorbeeld hieronder.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ws-label">Voorbeelden</p>
                  <span className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                    {filteredDemo.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {filteredDemo.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      busy={busy}
                      aiBusy={aiJobs[l.id]?.status === "running"}
                      aiQueued={aiJobs[l.id]?.status === "queued"}
                      aiDepth={aiJobs[l.id]?.depth ?? null}
                      aiProgress={aiJobs[l.id]?.progress ?? null}
                      aiError={aiJobs[l.id]?.error ?? null}
                      hmBusy={hmId === l.id}
                      clientDraft={clientDrafts[l.id] || ""}
                      onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [l.id]: v }))}
                      onReview={onReview}
                      onAiGuess={onAiGuess}
                      onHmSearch={onHmSearch}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
