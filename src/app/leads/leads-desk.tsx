"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CompanyMark } from "@/components/company-mark";
import { agencyLogoUrls } from "@/lib/company-logo";
import { BtnSpinner } from "@/components/btn-spinner";
import { ScoreChip } from "@/components/score-chip";
import { ResearchMeter } from "@/components/research-meter";
import { kansenHref, regieHref } from "@/lib/desk-links";
import { cachePeek } from "@/lib/client-cache";
import { DESK, hmSearchMessage } from "@/lib/desk-labels";
import { eurApprox, eurRange, SYNC_COST_PER_RUN, syncStillLocked } from "@/lib/costs";
import type { AgencyLead, LeadStatus } from "@/lib/opportunity";
import { huntSignals, type EvidenceOrigin } from "@/lib/end-client";
import { plainLinkedIn } from "@/lib/plain-text";
import { streamResearch } from "@/lib/research/client";
import { skipBatchResearch } from "@/lib/research/first-pass";
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
  persistence?: "postgres" | "memory";
  watchlist: {
    id: string;
    name: string;
    note?: string;
    linkedinSlug?: string;
    recruiters: { name: string; title?: string; brand?: string; linkedinUrl?: string }[];
  }[];
  live: AgencyLead[];
  demo: AgencyLead[];
  sync?: {
    lastFeed: { at: string; kept: number; fetched: number; mode: string } | null;
    last: { at: string; channel: string; label: string } | null;
    checkedAt?: string | null;
    pending?: { name: string; agency: string }[];
    log?: {
      at: string;
      kept: number;
      fetched: number;
      mode: string;
      detail?: string;
      people: { name: string; agency?: string; window?: "week" | "year"; posts?: number }[];
      posts: string[];
    }[];
  };
};

function recruiterKey(agency: string, name: string) {
  return `${agency.trim().toLowerCase()}::${name.trim().toLowerCase()}`;
}

function timeAgoShort(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = ms / 60000;
  if (m < 1) return "zojuist";
  if (m < 60) return `${Math.round(m)}m geleden`;
  const h = m / 60;
  if (h < 48) return `${Math.round(h)}u geleden`;
  return `${Math.round(h / 24)}d geleden`;
}

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
    .filter((p): p is string => Boolean(p))
    .map((p) => plainLinkedIn(p))
    .join(" · ");
}

const ORIGIN_NL: Record<EvidenceOrigin, string> = {
  post: "uit de post",
  web: "online gevonden",
  memory: "eerder bevestigd",
  history: "eerdere opdracht van deze recruiter",
  knowledge: "marktkennis",
};

function whyLine(lead: AgencyLead): string | null {
  const g = lead.guess;
  if (!g) return null;
  if (g.summary) return g.summary;
  if (g.source === "serp") return "De naam kwam terug in zoekresultaten die bij deze opdracht passen.";
  if (g.source === "deep") return g.report?.hypothesis || "Via diep onderzoek.";
  const top = g.evidence?.[0];
  if (top?.label) return top.label;
  if (g.report?.hypothesis) return g.report.hypothesis;
  return null;
}

/** Aanwijzingen = losse stukjes in de post die naar één organisatie kunnen wijzen. */
function cluesInPost(lead: AgencyLead) {
  const text = `${lead.title}\n${lead.summary || ""}`;
  const s = huntSignals({ title: lead.title, text });
  return [...s.project_signals, ...s.hard_signals, s.location.city || "", ...lead.facts.stack.slice(0, 2)]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);
}

function clientExplain(lead: AgencyLead): { kind: "ok" | "thin" | "hunt"; why: string; short: string } {
  if (lead.status === "confirmed") return { kind: "ok", why: "Door jou bevestigd.", short: "" };
  if (lead.status === "rejected") {
    const why = lead.aiMiss?.notAssignment ? `Weggezet door AI — ${lead.aiMiss.detail}` : "Afgewezen.";
    return { kind: "ok", why, short: lead.aiMiss?.notAssignment ? "AI: geen opdracht" : "" };
  }
  const g = lead.guess;
  if (g && g.confidence >= 45) {
    return { kind: "ok", why: `${g.confidence}% · ${whyLine(lead) || "past bij de post"}`, short: "" };
  }
  if (lead.aiMiss) {
    return {
      kind: "thin",
      why: `AI heeft gezocht, geen zekere naam. ${lead.aiMiss.detail}`,
      short: "AI vond geen zekere naam — vul in als je hem kent",
    };
  }
  const clues = cluesInPost(lead);
  return {
    kind: "hunt",
    why: clues.length
      ? `Nog niet uitgezocht. Aanwijzingen in de post: ${clues.join(", ")}. Klik AI om de opdrachtgever te zoeken.`
      : "Nog niet uitgezocht. De post noemt geen naam; AI zoekt de opdracht online terug en kijkt naar eerdere klanten van dit bureau.",
    short: clues.length ? `Nog niet uitgezocht · ${clues.slice(0, 3).join(", ")}` : "Nog niet uitgezocht",
  };
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isLinkedInPost(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.includes("linkedin.com") && !u.pathname.includes("/jobs");
  } catch {
    return false;
  }
}

/** The public vacancy that actually names the client, when the bureau post does not. */
function proofVacancy(lead: AgencyLead) {
  return lead.guess?.evidence.find((e) => e.origin === "web" && e.url && e.weight >= 80) || null;
}

function WhyBlock({ lead }: { lead: AgencyLead }) {
  const g = lead.guess;
  if (!g?.evidence?.length) {
    return <p className="text-[0.78rem] leading-relaxed text-[var(--muted)]">{clientExplain(lead).why}</p>;
  }
  return (
    <div className="lead-why">
      <p className="lead-why__label">Waarom {g.name || "deze opdrachtgever"}?</p>
      {g.summary ? <p className="lead-why__summary">{g.summary}</p> : null}
      <ul className="lead-why__list">
        {g.evidence.slice(0, 4).map((e, i) => (
          <li key={i}>
            {e.origin ? (
              <span className={`lead-why__origin lead-why__origin--${e.origin}`}>{ORIGIN_NL[e.origin]}</span>
            ) : null}
            <span className="text-[var(--ink)]">{e.label}</span>
            {e.quote ? (
              <span className="lead-why__quote">
                “{e.quote.replace(/\s+/g, " ").normalize("NFKC").trim()}”
                {e.url ? (
                  <>
                    {" "}
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      bron
                    </a>
                  </>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {g.check ? <p className="lead-why__check">Check: {g.check}</p> : null}
      {g.alternatives.length ? (
        <p className="lead-why__alts">
          Ook mogelijk:{" "}
          {g.alternatives
            .slice(0, 3)
            .map((a) => `${a.name} (${a.confidence}%)`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

type Bucket = "ready" | "open" | "confirmed" | "rejected" | "all";

const BUCKET_NL: Record<Bucket, string> = {
  ready: "Klaar om te bevestigen",
  open: "Te reviewen",
  confirmed: "Bevestigd",
  rejected: "Weg",
  all: "Alles",
};

const BUCKET_CHIP: Record<Bucket, string> = {
  ready: "Klaar",
  open: "Te reviewen",
  confirmed: "Bevestigd",
  rejected: "Weg",
  all: "Alles",
};

function bucketOf(l: AgencyLead): Exclude<Bucket, "all"> {
  if (l.status === "suggest") return "ready";
  if (l.status === "confirmed") return "confirmed";
  if (l.status === "rejected") return "rejected";
  return "open";
}

function statusShort(status: LeadStatus) {
  if (status === "suggest") return "Sterk";
  if (status === "review") return "Review";
  if (status === "weak") return "Te dun";
  if (status === "confirmed") return "Bevestigd";
  return "Weg";
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
  confirming,
  active,
  onOpen,
}: {
  lead: AgencyLead;
  busy: boolean;
  aiBusy: boolean;
  aiDepth?: ResearchDepth | null;
  aiProgress?: ResearchProgress | null;
  aiQueued?: boolean;
  aiError?: string | null;
  hmBusy?: boolean;
  confirming?: boolean;
  clientDraft: string;
  onClientDraft: (v: string) => void;
  onReview: (id: string, action: "confirmed" | "rejected" | "reopen", clientName?: string) => void;
  onAiGuess: (id: string, depth?: ResearchDepth) => void;
  onHmSearch?: (id: string) => void;
  active?: boolean;
  onOpen?: () => void;
}) {
  const guessed = lead.confirmedClient || lead.guess?.name || "";
  const client = (clientDraft || guessed).trim();
  const actionable = lead.status !== "confirmed" && lead.status !== "rejected";
  const conf = lead.guess?.confidence ?? null;

  const quickConfirm = actionable && Boolean(lead.guess?.name) && (lead.guess?.confidence ?? 0) >= 45;
  const quickAi = actionable && !lead.guess && !lead.aiMiss;

  const rowBusy = Boolean(confirming || hmBusy);
  return (
    <article className={`lead-row ${active ? "lead-row--on" : ""} ${rowBusy ? "lead-row--busy" : ""}`}>
      <div className="lead-row__head">
        <button type="button" className="lead-row__hit" onClick={onOpen} aria-current={active ? "true" : undefined}>
          <span className="lead-row__title truncate">{lead.title}</span>
          <span className="lead-row__meta truncate">
            {lead.agency.name}
            {lead.recruiter.name ? ` · ${lead.recruiter.name}` : ""}
            {factsLine(lead) ? ` · ${factsLine(lead)}` : ""}
          </span>
        </button>
        <div className="lead-row__side">
          {conf != null ? (
            <ScoreChip
              kans={conf}
              percent
              label={lead.status === "confirmed" ? "Bevestigd" : lead.status === "rejected" ? "Weg" : undefined}
              parts={(lead.guess?.evidence || []).slice(0, 6).map((e) => ({
                label: e.origin ? `${e.label} · ${ORIGIN_NL[e.origin] || e.origin}` : e.label,
              }))}
            />
          ) : (
            <span
              className={`ws-score shrink-0 ${lead.status === "confirmed" ? "ws-score--hot" : lead.status === "rejected" ? "ws-score--cold" : "ws-score--watch"}`}
              title={STATUS_HINT[lead.status]}
            >
              <span className="ws-score__band">{statusShort(lead.status)}</span>
            </span>
          )}
          {quickConfirm ? (
            <button
              type="button"
              disabled={busy || aiBusy || client.length < 2}
              onClick={() => onReview(lead.id, "confirmed", client)}
              className={`btn-ink btn-row ${confirming ? "is-busy" : ""}`}
              aria-busy={confirming || undefined}
              title={`Bevestig ${client} als opdrachtgever — daarna staat de kans op Kansen`}
            >
              {confirming ? <BtnSpinner /> : null}
              {confirming ? "Bevestigen" : "Bevestig"}
            </button>
          ) : quickAi ? (
            <button
              type="button"
              disabled={busy || aiBusy || Boolean(aiQueued)}
              onClick={() => onAiGuess(lead.id, "standard")}
              className="btn-ghost btn-row"
              title="AI leest de post en zoekt de opdracht online terug (~2 cent)"
            >
              {aiBusy ? "Zoekt…" : aiQueued ? "Wacht…" : `AI · ${eurApprox(SYNC_COST_PER_RUN.actions["ai-research"].eur)}`}
            </button>
          ) : null}
        </div>
      </div>
      <div className="lead-row__clientline" onClick={onOpen}>
        <span className="lead-row__arrow" aria-hidden>
          →
        </span>
        <span className={`min-w-0 truncate ${client ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
          {client || "Opdrachtgever onbekend"}
        </span>
      </div>
    </article>
  );
}

function VacancyLinks({ lead }: { lead: AgencyLead }) {
  const proof = proofVacancy(lead)?.url || null;
  const post = lead.evidenceUrl;
  const links: { href: string; label: string }[] = [];
  if (proof) links.push({ href: proof, label: "Open de vacature" });
  if (post && post !== proof) {
    links.push({ href: post, label: isLinkedInPost(post) ? "Open de post" : "Post van het bureau" });
  }
  if (!links.length && post) links.push({ href: post, label: "Open de vacature" });
  if (!links.length) return null;
  return (
    <div className="lead-detail__links">
      {links.map((link) => (
        <a key={link.href + link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="lead-detail__link">
          <span>{link.label}</span>
          <span className="lead-detail__link-host">{linkHost(link.href)}</span>
        </a>
      ))}
    </div>
  );
}

function LeadDetail({
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
  confirming,
  onBack,
}: {
  lead: AgencyLead;
  busy: boolean;
  aiBusy: boolean;
  aiDepth?: ResearchDepth | null;
  aiProgress?: ResearchProgress | null;
  aiQueued?: boolean;
  aiError?: string | null;
  hmBusy?: boolean;
  confirming?: boolean;
  clientDraft: string;
  onClientDraft: (v: string) => void;
  onReview: (id: string, action: "confirmed" | "rejected" | "reopen", clientName?: string) => void;
  onAiGuess: (id: string, depth?: ResearchDepth) => void;
  onHmSearch?: (id: string) => void;
  onBack?: () => void;
}) {
  const guessed = lead.confirmedClient || lead.guess?.name || "";
  const client = (clientDraft || guessed).trim();
  const actionable = lead.status !== "confirmed" && lead.status !== "rejected";
  const researchLock = busy || aiBusy || Boolean(aiQueued);
  const conf = lead.guess?.confidence ?? null;

  return (
    <div className="lead-detail">
      {onBack ? (
        <button type="button" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--muted)] hover:text-[var(--ink)] lg:hidden" onClick={onBack}>
          <span aria-hidden>←</span> Terug naar lijst
        </button>
      ) : null}
      <p className="lead-detail__meta">
        {lead.agency.name}
        {lead.recruiter.name ? ` · ${lead.recruiter.name}` : ""}
        {factsLine(lead) ? ` · ${factsLine(lead)}` : ""}
      </p>
      <h2 className="lead-detail__title">{lead.title}</h2>
      <VacancyLinks lead={lead} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`text-sm font-semibold ${client ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
          {client || "Opdrachtgever onbekend"}
        </span>
        {conf != null ? (
          <ScoreChip
            kans={conf}
            percent
            label={lead.status === "confirmed" ? "Bevestigd" : lead.status === "rejected" ? "Weg" : undefined}
            parts={(lead.guess?.evidence || []).slice(0, 6).map((e) => ({
              label: e.origin ? `${e.label} · ${ORIGIN_NL[e.origin] || e.origin}` : e.label,
            }))}
          />
        ) : null}
      </div>
      <div className="mt-4">
        <WhyBlock lead={lead} />
      </div>
      {actionable ? (
        <div className="lead-row__actions">
          <input
            type="text"
            value={clientDraft || guessed}
            onChange={(e) => onClientDraft(e.target.value)}
            placeholder="Eindklant"
            className="lead-row__input"
            aria-label="Eindklant"
          />
          <button
            type="button"
            disabled={busy || aiBusy || client.length < 2}
            onClick={() => onReview(lead.id, "confirmed", client)}
            className={`btn-ink btn-tool ${confirming ? "is-busy" : ""}`}
            aria-busy={confirming || undefined}
          >
            {confirming ? <BtnSpinner /> : null}
            {confirming ? "Bevestigen" : "Bevestig"}
          </button>
          <button type="button" disabled={researchLock} onClick={() => onAiGuess(lead.id, "standard")} className="btn-ghost btn-tool">
            {aiBusy ? "…" : `AI · ${eurRange(SYNC_COST_PER_RUN.actions["ai-research"].eur)}`}
          </button>
          <button type="button" disabled={busy || aiBusy} onClick={() => onReview(lead.id, "rejected")} className="btn-ghost btn-tool">
            Weg
          </button>
        </div>
      ) : lead.status === "confirmed" ? (
        <div className="lead-row__actions">
          <p className="mr-auto text-[0.78rem] text-[var(--muted)]">
            <strong className="text-[var(--ink)]">{client}</strong>
            {lead.hiringManager ? ` · HM ${lead.hiringManager}` : " · nog geen HM"}
          </p>
          <Link href={kansenHref(`crm_bureau_${lead.id}`)} className="btn-ink btn-tool no-underline">
            Open op Kansen
          </Link>
          <button
            type="button"
            disabled={hmBusy}
            onClick={() => onHmSearch?.(lead.id)}
            className={`btn-ghost btn-tool ${hmBusy ? "is-busy" : ""}`}
            aria-busy={hmBusy || undefined}
          >
            {hmBusy ? <BtnSpinner /> : null}
            {hmBusy ? "Zoeken" : "Zoek manager"}
          </button>
        </div>
      ) : (
        <div className="lead-row__actions">
          <button type="button" disabled={busy} onClick={() => onReview(lead.id, "reopen")} className="btn-ghost btn-tool">
            Terugzetten
          </button>
        </div>
      )}
      {aiQueued ? <p className="mt-2 text-[0.72rem] text-[var(--muted)]">In wachtrij…</p> : null}
      {aiBusy && aiProgress && aiDepth ? <ResearchMeter depth={aiDepth} progress={aiProgress} /> : null}
      {aiError ? <p className="mt-1.5 text-[0.72rem] text-[var(--warn)]">{aiError}</p> : null}
    </div>
  );
}

/** One post at a time: read why, then Bevestig / Weg / Volgende. Keys: B or Enter, W, → or spatie, ←, Esc. */
function QuickReview({
  ids,
  leads,
  busy,
  drafts,
  onDraft,
  onReview,
  onClose,
}: {
  ids: string[];
  leads: Map<string, AgencyLead>;
  busy: boolean;
  drafts: Record<string, string>;
  onDraft: (id: string, v: string) => void;
  onReview: (id: string, action: "confirmed" | "rejected", clientName?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const [done, setDone] = useState({ confirmed: 0, rejected: 0 });
  const lead = ids[at] ? leads.get(ids[at]) : undefined;
  const client = lead ? (drafts[lead.id] || lead.confirmedClient || lead.guess?.name || "").trim() : "";
  const decided = lead ? lead.status === "confirmed" || lead.status === "rejected" : false;
  const finished = at >= ids.length;

  const act = useRef<(k: "confirm" | "reject" | "next" | "prev" | "close") => void>(() => undefined);
  useEffect(() => {
    act.current = (k) => {
      if (k === "close") return onClose();
      if (k === "prev") return setAt((i) => Math.max(0, i - 1));
      if (k === "next") return setAt((i) => Math.min(ids.length, i + 1));
      if (!lead || busy || decided) return;
      if (k === "confirm" && client.length < 2) return;
      const action = k === "confirm" ? "confirmed" : "rejected";
      void onReview(lead.id, action, action === "confirmed" ? client : undefined).then(() => {
        setDone((d) => ({ ...d, [action]: d[action] + 1 }));
        setAt((i) => i + 1);
      });
    };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === "Escape") return act.current("close");
      if (typing) {
        if (e.key === "Enter") act.current("confirm");
        return;
      }
      const map: Record<string, "confirm" | "reject" | "next" | "prev"> = {
        b: "confirm",
        Enter: "confirm",
        w: "reject",
        ArrowRight: "next",
        " ": "next",
        ArrowLeft: "prev",
      };
      const k = map[e.key];
      if (k) {
        e.preventDefault();
        act.current(k);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="quick-review" role="dialog" aria-modal="true" aria-label="Snel beoordelen">
      <div className="quick-review__card">
        <div className="quick-review__bar">
          <span className="ws-label">
            Snel beoordelen · {Math.min(at + 1, ids.length)}/{ids.length}
          </span>
          <button type="button" className="btn-ghost btn-tool" onClick={onClose}>
            Sluiten
          </button>
        </div>
        <div className="quick-review__progress" aria-hidden>
          <span style={{ width: `${(Math.min(at, ids.length) / Math.max(ids.length, 1)) * 100}%` }} />
        </div>

        {finished || !lead ? (
          <div className="quick-review__body">
            <p className="text-base font-semibold text-[var(--ink)]">Klaar.</p>
            <p className="text-sm text-[var(--muted)]">
              {done.confirmed} bevestigd · {done.rejected} weggezet. Bevestigde kansen staan nu op{" "}
              <Link href="/kansen" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                Kansen
              </Link>
              , klaar voor stap 2: manager zoeken.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/kansen" className="btn-ink btn-tool no-underline">
                Naar Kansen
              </Link>
              <button type="button" className="btn-ghost btn-tool" onClick={onClose}>
                Terug naar de lijst
              </button>
            </div>
          </div>
        ) : (
          <div className="quick-review__body">
            <p className="lead-row__title">{lead.title}</p>
            <p className="lead-row__meta">
              {lead.agency.name}
              {lead.recruiter.name ? ` · ${lead.recruiter.name}` : ""}
              {factsLine(lead) ? ` · ${factsLine(lead)}` : ""}
            </p>
            <div className="quick-review__client">
              <input
                type="text"
                value={drafts[lead.id] ?? lead.guess?.name ?? ""}
                onChange={(e) => onDraft(lead.id, e.target.value)}
                placeholder="Eindklant"
                className="lead-row__input"
                aria-label="Eindklant"
              />
              {lead.guess ? <span className="quick-review__conf">{lead.guess.confidence}%</span> : null}
            </div>
            <WhyBlock lead={lead} />
            {lead.evidenceUrl ? (
              <a href={lead.evidenceUrl} target="_blank" rel="noopener noreferrer" className="lead-row__vac">
                Open de post
              </a>
            ) : null}
            {decided ? (
              <p className="mt-2 text-[0.78rem] text-[var(--muted)]">
                Al {lead.status === "confirmed" ? "bevestigd" : "weggezet"}.
              </p>
            ) : null}
          </div>
        )}

        {!finished && lead ? (
          <div className="quick-review__actions">
            <button type="button" className="btn-ghost btn-tool" onClick={() => act.current("prev")} disabled={at === 0}>
              ←
            </button>
            <button
              type="button"
              className="btn-ghost btn-tool"
              disabled={busy || decided}
              onClick={() => act.current("reject")}
              title="Geen opdracht of niet voor ons (W)"
            >
              Weg
            </button>
            <button type="button" className="btn-ghost btn-tool" onClick={() => act.current("next")} title="Later (→)">
              Volgende
            </button>
            <button
              type="button"
              className={`btn-ink btn-tool quick-review__confirm ${busy ? "is-busy" : ""}`}
              disabled={busy || decided || client.length < 2}
              aria-busy={busy || undefined}
              onClick={() => act.current("confirm")}
              title="Bevestig opdrachtgever (B of Enter)"
            >
              {busy ? <BtnSpinner /> : null}
              {busy ? "Bevestigen" : `Bevestig ${client || ""}`.trim()}
            </button>
          </div>
        ) : null}
        <p className="quick-review__keys">B/Enter bevestig · W weg · → volgende · ← terug · Esc sluit</p>
      </div>
    </div>
  );
}

export default function LeadsDesk({ initial }: { initial?: Payload }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(initial || null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [aiJobs, setAiJobs] = useState<Record<string, AiJob>>({});
  const aiJobsRef = useRef<Record<string, AiJob>>({});
  const runningRef = useRef(new Set<string>());
  const pumpRef = useRef<() => void>(() => undefined);
  const [hmId, setHmId] = useState<string | null>(null);
  const [hmNote, setHmNote] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [bucketPick, setBucketPick] = useState<Bucket | null>(null);
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [watchAgency, setWatchAgency] = useState<string | null>(null);
  const [openRecruiter, setOpenRecruiter] = useState<string | null>(null);
  /** Kantoren in de sync-lijst: standaard dicht, anders vreet Vibe de hele pagina. */
  const [openAgency, setOpenAgency] = useState<string | null>(null);
  const [clientDrafts, setClientDrafts] = useState<Record<string, string>>(() => {
    const drafts: Record<string, string> = {};
    if (initial) {
      for (const l of [...initial.live, ...initial.demo]) {
        const name = l.confirmedClient || l.guess?.name;
        if (name) drafts[l.id] = name;
      }
    }
    return drafts;
  });

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

  const dataRef = useRef<Payload | null>(initial || null);

  function applyPayload(j: Payload) {
    const live = Array.isArray(j?.live) ? j.live : [];
    const prev = dataRef.current;
    if (prev && prev.live.length > 0 && live.length === 0) {
      setError("Vernieuwen lukte niet. De posts die er stonden, staan er nog.");
      return;
    }
    const next = { ...j, live };
    dataRef.current = next;
    setData(next);
    if (live.length === 0) {
      setError(
        j.persistence === "memory"
          ? "De database was even niet bereikbaar. Er is niets gewist."
          : "De posts zijn niet geladen. Er is niets gewist."
      );
    } else {
      setError(null);
    }
    const drafts: Record<string, string> = {};
    for (const l of [...live, ...(j.demo || [])]) {
      const name = l.confirmedClient || l.guess?.name;
      if (name) drafts[l.id] = name;
    }
    setClientDrafts((prevDrafts) => ({ ...drafts, ...prevDrafts }));
  }

  function load(attempt = 0): Promise<void> {
    return import("@/lib/client-cache").then(({ cachedJson, cacheClear, cachePeek, cacheSet, isBlankDesk }) => {
      if (initial && initial.live.length > 0 && !cachePeek("leads")) cacheSet("leads", initial);
      return cachedJson<Payload>("leads", "/api/leads", {
        ttlMs: 45_000,
        staleMs: 5 * 60_000,
        onUpdate: (j) => {
          if (!isBlankDesk("leads", j)) applyPayload(j);
        },
      })
        .then((j) => {
          if (isBlankDesk("leads", j) && attempt < 1) {
            cacheClear("leads");
            return load(attempt + 1);
          }
          applyPayload(j);
        })
        .catch((e: unknown) => {
          const status = (e as { status?: number }).status;
          if (status === 401) window.location.href = "/login?next=/leads";
          else if (!dataRef.current?.live.length) {
            setError("De posts zijn niet geladen. Er is niets gewist.");
          }
        });
    });
  }

  useLayoutEffect(() => {
    const cached = cachePeek<Payload>("leads");
    if (cached?.live?.length) applyPayload(cached);
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { ready: 0, open: 0, confirmed: 0, rejected: 0, all: 0 };
    for (const l of data?.live || []) {
      c.all += 1;
      c[bucketOf(l)] += 1;
    }
    return c;
  }, [data]);
  const bucket: Bucket = bucketPick ?? (counts.ready ? "ready" : "open");

  const matches = useMemo(() => {
    return (l: AgencyLead) => {
      if (bucket !== "all" && bucketOf(l) !== bucket) return false;
      if (watchAgency && l.agency.name.toLowerCase() !== watchAgency.toLowerCase()) return false;
      return true;
    };
  }, [bucket, watchAgency]);

  const filteredLive = useMemo(() => (data ? data.live.filter(matches) : []), [data, matches]);
  const selected =
    [...(data?.live || [])].find((l) => l.id === pickedId) || filteredLive[0] || null;

  function openLead(id: string) {
    setPickedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePane("detail");
    }
  }
  const leadMap = useMemo(() => new Map([...(data?.live || []), ...(data?.demo || [])].map((l) => [l.id, l])), [data]);

  const feedAt = data?.sync?.lastFeed?.at || data?.sync?.checkedAt || null;
  const feedPending = data?.sync?.pending?.length ?? 0;
  const feedLocked = feedPending === 0 && syncStillLocked(data?.sync?.checkedAt || data?.sync?.lastFeed?.at);
  const feedCost = eurRange(SYNC_COST_PER_RUN.actions["recruiter-feeds"].eur);

  const feedRoster = useMemo(() => {
    const pending = new Set((data?.sync?.pending || []).map((p) => recruiterKey(p.agency, p.name)));
    const posts = new Map<string, { id: string; title: string }[]>();
    for (const lead of data?.live || []) {
      const name = lead.recruiter.name?.trim();
      if (!name) continue;
      const key = recruiterKey(lead.agency.name, name);
      const list = posts.get(key) || [];
      list.push({ id: lead.id, title: lead.title });
      posts.set(key, list);
    }
    return (data?.watchlist || []).map((agency) => ({
      id: agency.id,
      name: agency.name,
      linkedinSlug: agency.linkedinSlug,
      recruiters: agency.recruiters.map((r) => {
        const key = recruiterKey(agency.name, r.name);
        const found = posts.get(key) || [];
        return {
          key,
          name: r.name,
          checked: found.length > 0 || !pending.has(key),
          posts: found,
        };
      }),
    }));
  }, [data]);

  function startReview() {
    const pool = (data?.live || []).filter((l) => bucketOf(l) === "ready" || bucketOf(l) === "open");
    const ids = (bucket === "ready" || bucket === "open" ? pool.filter((l) => bucketOf(l) === bucket) : pool)
      .filter((l) => l.guess?.name)
      .map((l) => l.id);
    if (ids.length) setReviewIds(ids);
  }

  const batchable = (l: AgencyLead) => !skipBatchResearch(l) && !l.aiMiss && !l.aiGuess;
  const deepOpenCount = data?.live.filter(batchable).length ?? 0;
  const reviewable = (data?.live || []).filter(
    (l) => (bucket === "all" || bucket === bucketOf(l)) && (bucketOf(l) === "ready" || bucketOf(l) === "open") && l.guess?.name
  ).length;

  const researchStrip = useMemo(() => {
    const jobs = Object.values(aiJobs);
    const running = jobs.filter((j) => j.status === "running").length;
    const queued = jobs.filter((j) => j.status === "queued").length;
    if (!running && !queued) return null;
    return { running, queued };
  }, [aiJobs]);

  async function postReview(id: string, action: "confirmed" | "rejected" | "reopen", clientName?: string) {
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
    else void load();
    const { cacheClear, prefetchJson } = await import("@/lib/client-cache");
    cacheClear("leads");
    cacheClear("crm");
    if (action === "confirmed") prefetchJson("crm", "/api/crm", 90_000);
  }

  async function onReview(id: string, action: "confirmed" | "rejected" | "reopen", clientName?: string): Promise<void> {
    setConfirmId(id);
    setBusy(true);
    setError(null);
    try {
      await postReview(id, action, clientName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "opslaan mislukt");
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  function readyRows() {
    return (data?.live || []).filter((l) => {
      if (bucketOf(l) !== "ready") return false;
      const name = (clientDrafts[l.id] || l.confirmedClient || l.guess?.name || "").trim();
      return name.length >= 2;
    });
  }

  async function confirmReady() {
    const rows = readyRows();
    if (!rows.length || busy) return;
    setBulk({ done: 0, total: rows.length });
    setBusy(true);
    setError(null);
    let failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const l = rows[i]!;
      const name = (clientDrafts[l.id] || l.confirmedClient || l.guess?.name || "").trim();
      setConfirmId(l.id);
      setBulk({ done: i, total: rows.length });
      try {
        await postReview(l.id, "confirmed", name);
      } catch {
        failed += 1;
      }
    }
    setConfirmId(null);
    setBusy(false);
    setBulk(null);
    if (failed) setError(`${failed} van ${rows.length} posts niet bevestigd. De rest staat op Kansen.`);
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
  useEffect(() => {
    pumpRef.current = pumpQueue;
  });

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
    // Alles wat nog niet door AI is gelezen; missers en al-sterke leads kosten niets extra.
    for (const l of data.live.filter(batchable)) onAiGuess(l.id, "standard");
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
        setHmNote(hmSearchMessage(j.detail));
      }
    } finally {
      setHmId(null);
    }
  }

  return (
    <AppShell current="leads" title={DESK.bureau.title} subtitle={DESK.bureau.subtitle} fill>
      <div className="ws-shell flex min-h-0 flex-1 flex-col gap-3">
        <main className="flex min-h-0 flex-1 flex-col gap-3">
          <details className={`ws-fold shrink-0 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
            <summary>
              <span>{DESK.bureau.foldTitle}</span>
              <span className="ws-fold__meta">{DESK.bureau.foldMeta}</span>
            </summary>
            <div className="ws-fold__body">
              <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
                Vacatures uit LinkedIn-feeds van kantoren die je volgt. Jij bevestigt de eindklant — daarna zoek je de
                hiring manager. De andere bron is{" "}
                <a href={DESK.direct.href} className="underline underline-offset-2 text-[var(--ink)]">
                  {DESK.direct.nav}
                </a>
                .
              </p>
              <ol className="ws-fold__steps">
                <li>
                  <span className="ws-fold__n">1</span>
                  <span>
                    Review — AI leest de post en zoekt dezelfde opdracht online terug. Jij bevestigt of wijst af.
                  </span>
                </li>
                <li>
                  <span className="ws-fold__n">2</span>
                  <span>
                    Bevestigd — de kans staat meteen op{" "}
                    <a href="/kansen" className="underline underline-offset-2 text-[var(--ink)]">
                      Kansen
                    </a>
                    , bij stap 2: manager zoeken.
                  </span>
                </li>
                <li>
                  <span className="ws-fold__n">3</span>
                  <span>Manager, contact en bericht doe je op Kansen. Hier alleen: wie is de opdrachtgever?</span>
                </li>
              </ol>
            </div>
          </details>

          <details className={`ws-fold shrink-0 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
            <summary>
              <span>
                {data ? `${counts.all} posts` : "Sync"}
                {data ? ` · ${counts.ready} klaar` : ""}
              </span>
              <span className="ws-fold__meta">
                {feedLocked
                  ? `vandaag al · ${feedAt ? timeAgoShort(feedAt) : "opgehaald"}`
                  : feedAt
                    ? `Feeds ${timeAgoShort(feedAt)}`
                    : "Nog geen sync"}
              </span>
            </summary>
            <div className="ws-fold__body !p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2">
                <p className="text-[0.72rem] text-[var(--muted)]">
                  {feedLocked
                    ? "Al opgehaald vandaag. Opnieuw ophalen kan via Sync."
                    : feedPending > 0
                      ? `${feedPending} nieuwe recruiters nog niet opgehaald · ≈ ${feedCost} per run.`
                      : `Ophalen en kosten staan op Sync · ≈ ${feedCost}.`}
                </p>
                <a
                  href="/sync"
                  className="text-[0.72rem] font-semibold text-[var(--ink)] underline decoration-[var(--signal)] underline-offset-2"
                >
                  Naar Sync →
                </a>
              </div>
              {feedRoster.length ? (
                <div className="feed-sync">
                  {feedRoster.map((agency) => {
                    const agencyOpen = openAgency === agency.id;
                    const postsTotal = agency.recruiters.reduce((n, r) => n + r.posts.length, 0);
                    const checkedN = agency.recruiters.filter((r) => r.checked).length;
                    return (
                      <section key={agency.id}>
                        <button
                          type="button"
                          className="feed-sync__co"
                          aria-expanded={agencyOpen}
                          onClick={() => {
                            setOpenAgency(agencyOpen ? null : agency.id);
                            if (agencyOpen) setOpenRecruiter(null);
                          }}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <CompanyMark
                              name={agency.name}
                              logoUrls={agencyLogoUrls({
                                name: agency.name,
                                id: agency.id,
                                linkedinSlug: agency.linkedinSlug,
                              })}
                              size="sm"
                            />
                            <span className="truncate">{agency.name}</span>
                          </span>
                          <span className="feed-sync__co-meta">
                            {agency.recruiters.length} recruiters
                            {postsTotal ? ` · ${postsTotal} posts` : ""}
                            {checkedN < agency.recruiters.length
                              ? ` · ${agency.recruiters.length - checkedN} nieuw`
                              : ""}
                          </span>
                          <span className="feed-sync__chev" aria-hidden>
                            {agencyOpen ? "▴" : "▾"}
                          </span>
                        </button>
                        {agencyOpen ? (
                          <ul>
                            {agency.recruiters.map((person) => {
                              const open = openRecruiter === person.key;
                              return (
                                <li key={person.key}>
                                  <button
                                    type="button"
                                    className="feed-sync__row"
                                    aria-expanded={open}
                                    onClick={() => setOpenRecruiter(open ? null : person.key)}
                                  >
                                    <span
                                      className={`feed-sync__tick${person.checked ? " feed-sync__tick--on" : ""}`}
                                      aria-hidden
                                    >
                                      {person.checked ? (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                          <path
                                            d="M2 5.2 4 7.2 8 2.8"
                                            stroke="currentColor"
                                            strokeWidth="1.4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      ) : null}
                                    </span>
                                    <span className="truncate">{person.name}</span>
                                    {person.posts.length ? (
                                      <span className="feed-sync__n">{person.posts.length}</span>
                                    ) : null}
                                  </button>
                                  {open ? (
                                    person.posts.length ? (
                                      <ul className="feed-sync__posts">
                                        {person.posts.map((post) => (
                                          <li key={post.id}>
                                            <button
                                              type="button"
                                              className="feed-sync__post"
                                              onClick={() => openLead(post.id)}
                                            >
                                              {post.title}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="feed-sync__empty">
                                        {person.checked
                                          ? "Opgehaald, geen vacature-posts."
                                          : "Nog niet opgehaald."}
                                      </p>
                                    )
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="px-3.5 py-3 text-[0.78rem] text-[var(--muted)]">Nog geen recruiters op de lijst.</p>
              )}
            </div>
          </details>

          <div className={`flex flex-wrap items-center gap-1.5 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
            {(["ready", "open", "confirmed", "rejected", "all"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucketPick(b)}
                className={`ws-chip ${bucket === b ? "ws-chip--on" : ""}`}
                title={BUCKET_NL[b]}
              >
                {BUCKET_CHIP[b]}
                <span className="ws-chip__n">{data ? counts[b] : "…"}</span>
              </button>
            ))}
          </div>
          <div className={`flex flex-wrap items-center gap-2 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
            {bucket === "ready" && readyRows().length ? (
              <button
                type="button"
                onClick={() => void confirmReady()}
                disabled={busy}
                className={`btn-ink btn-tool ${bulk ? "is-busy" : ""}`}
                aria-busy={Boolean(bulk) || undefined}
                title="Zet alle sterke AI-voorstellen (80%+) in één keer op Kansen."
              >
                {bulk ? <BtnSpinner /> : null}
                {bulk ? `Bevestigen ${bulk.done} van ${bulk.total}` : `Bevestig alle ${readyRows().length}`}
              </button>
            ) : null}
            {(bucket === "ready" || bucket === "open") && reviewable ? (
              <button
                type="button"
                onClick={startReview}
                className="btn-ghost btn-tool"
                title="Open één post tegelijk: Bevestig, Weg, of Volgende. Handig om de klaar-stapel snel door te lopen."
              >
                Eén voor één · {reviewable}
              </button>
            ) : null}
            {(bucket === "open" || bucket === "all") && deepOpenCount ? (
              <button
                type="button"
                onClick={deepAllOpen}
                className="btn-ghost btn-tool"
                title={`Laat AI voor ${deepOpenCount} posts de opdrachtgever zoeken. Schatting ${eurApprox(SYNC_COST_PER_RUN.actions["ai-research"].eur)} per post.`}
              >
                Zoek opdrachtgevers · {deepOpenCount} · {eurApprox(SYNC_COST_PER_RUN.actions["ai-research"].eur)}/st
              </button>
            ) : null}
          </div>
          {watchAgency ? (
            <p className="mb-3 text-[0.78rem] text-[var(--muted)]">
              Alleen <strong className="text-[var(--ink)]">{watchAgency}</strong> ·{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => setWatchAgency(null)}>
                filter weg
              </button>
            </p>
          ) : null}

          {researchStrip ? (
            <p className="mb-3 text-[0.78rem] text-[var(--ink)]">
              <span className="font-semibold">{researchStrip.running} research bezig</span>
              {researchStrip.queued ? ` · ${researchStrip.queued} in wachtrij` : ""}
              <span className="text-[var(--muted)]"> — meters per kaart</span>
            </p>
          ) : null}

          {bulk ? (
            <div className="lead-bulk" role="status" aria-live="polite">
              <BtnSpinner />
              <span>
                Bevestigen {Math.min(bulk.done + 1, bulk.total)} van {bulk.total}
              </span>
              <span className="lead-bulk__bar" aria-hidden>
                <span style={{ width: `${Math.round((bulk.done / bulk.total) * 100)}%` }} />
              </span>
            </div>
          ) : null}
          {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}
          {hmNote ? <p className="mb-3 text-sm text-[var(--accent)]">{hmNote}</p> : null}

          {!data ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-6">
              <section className={`radar-scroll-pane min-h-0 flex-1 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`} aria-label="Posts">
                <div className="radar-scroll-pane__head">
                  <div className="min-w-0">
                    <p className="ws-label">{BUCKET_NL[bucket]}</p>
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {filteredLive.length}
                      <span className="font-normal text-[var(--muted)]"> posts</span>
                    </p>
                  </div>
                </div>
                <div className="radar-scroll-pane__body">
                {filteredLive.length ? (
                  <div>
                    {filteredLive.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        active={selected?.id === l.id}
                        onOpen={() => openLead(l.id)}
                        busy={busy}
                        aiBusy={aiJobs[l.id]?.status === "running"}
                        aiQueued={aiJobs[l.id]?.status === "queued"}
                        aiDepth={aiJobs[l.id]?.depth ?? null}
                        aiProgress={aiJobs[l.id]?.progress ?? null}
                        aiError={aiJobs[l.id]?.error ?? null}
                        hmBusy={hmId === l.id}
                        confirming={confirmId === l.id}
                        clientDraft={clientDrafts[l.id] || ""}
                        onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [l.id]: v }))}
                        onReview={onReview}
                        onAiGuess={onAiGuess}
                        onHmSearch={onHmSearch}
                      />
                    ))}
                  </div>
                ) : data.live.length ? (
                  <p className="ws-empty">
                    Niets in {BUCKET_NL[bucket].toLowerCase()}
                    {watchAgency ? " met dit filter" : ""}.
                  </p>
                ) : error ? (
                  <div className="ws-empty">
                    <p className="m-0">{error}</p>
                    <button
                      type="button"
                      className="btn-ink btn-tool mt-3"
                      onClick={() => {
                        setError(null);
                        void import("@/lib/client-cache").then(({ cacheClear }) => {
                          cacheClear("leads");
                          void load();
                        });
                      }}
                    >
                      Opnieuw laden
                    </button>
                  </div>
                ) : (
                  <p className="ws-empty">
                    Nog geen live hits. Zet in Instellingen een LinkedIn-URL bij de recruiter en sync de feeds (max 1× per dag).
                  </p>
                )}
                </div>
              </section>
              <aside className={`ws-panel ws-panel--soft ws-panel--scroll min-h-0 flex-1 px-4 py-4 lg:px-5 ${mobilePane === "list" ? "max-lg:hidden" : ""}`}>
                {selected ? (
                  <LeadDetail
                    lead={selected}
                    busy={busy}
                    aiBusy={aiJobs[selected.id]?.status === "running"}
                    aiQueued={aiJobs[selected.id]?.status === "queued"}
                    aiDepth={aiJobs[selected.id]?.depth ?? null}
                    aiProgress={aiJobs[selected.id]?.progress ?? null}
                    aiError={aiJobs[selected.id]?.error ?? null}
                    hmBusy={hmId === selected.id}
                    confirming={confirmId === selected.id}
                    clientDraft={clientDrafts[selected.id] || ""}
                    onClientDraft={(v) => setClientDrafts((d) => ({ ...d, [selected.id]: v }))}
                    onReview={onReview}
                    onAiGuess={onAiGuess}
                    onHmSearch={onHmSearch}
                    onBack={() => setMobilePane("list")}
                  />
                ) : (
                  <p className="text-sm text-[var(--muted)]">Kies een post in de lijst.</p>
                )}
              </aside>
            </div>
          )}

          <div className={`shrink-0 space-y-2 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
          <details className="ws-fold">
            <summary>
              <span>Kantoren die je volgt</span>
              <span className="ws-fold__meta">
                {data
                  ? `${data.watchlist.length} kantoren · ${data.watchlist.reduce((n, a) => n + a.recruiters.length, 0)} recruiters`
                  : "Laden…"}
                {watchAgency ? ` · filter ${watchAgency}` : ""}
              </span>
            </summary>
            <div className="ws-fold__body !p-0">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2">
                <p className="text-[0.72rem] text-[var(--muted)]">Filter op kantoor · klik naam om te filteren</p>
                <Link
                  href="/instellingen#volgen"
                  className="text-[0.72rem] font-semibold text-[var(--ink)] underline decoration-[var(--signal)] underline-offset-2"
                >
                  Bewerken
                </Link>
              </div>
              {!data ? (
                <p className="px-3.5 py-3 text-[0.78rem] text-[var(--muted)] sm:px-4">Laden…</p>
              ) : data.watchlist.length === 0 ? (
                <p className="px-3.5 py-3 text-[0.78rem] text-[var(--muted)] sm:px-4">
                  Nog geen kantoren.{" "}
                  <Link href="/instellingen#volgen" className="font-semibold text-[var(--ink)] no-underline hover:underline">
                    Stel in →
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  <li>
                    <button
                      type="button"
                      onClick={() => setWatchAgency(null)}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-[var(--surface-2)] sm:px-4 ${
                        !watchAgency ? "bg-[var(--accent-soft)] font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
                      }`}
                    >
                      <span>Alle kantoren</span>
                      <span className="tabular-nums text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                        {data.live.length} hits
                      </span>
                    </button>
                  </li>
                  {data.watchlist.map((a) => {
                    const on = watchAgency?.toLowerCase() === a.name.toLowerCase();
                    const leadCount = data.live.filter((l) => l.agency.name.toLowerCase() === a.name.toLowerCase()).length;
                    return (
                      <li key={a.id} className={on ? "bg-[var(--accent-soft)]/40" : ""}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 hover:bg-[var(--surface-2)] sm:px-4 [&::-webkit-details-marker]:hidden">
                            <CompanyMark
                              name={a.name}
                              logoUrls={agencyLogoUrls({
                                name: a.name,
                                id: a.id,
                                linkedinSlug: a.linkedinSlug,
                              })}
                              size="sm"
                            />
                            <span
                              role="button"
                              tabIndex={0}
                              className={`min-w-0 flex-1 truncate text-left text-sm ${
                                on ? "font-semibold text-[var(--ink)]" : "font-medium text-[var(--ink)]"
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setWatchAgency(on ? null : a.name);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setWatchAgency(on ? null : a.name);
                                }
                              }}
                            >
                              {a.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                              {leadCount} hits · {a.recruiters.length}
                            </span>
                            <span className="shrink-0 text-[0.65rem] text-[var(--muted)] transition group-open:rotate-180" aria-hidden>
                              ▾
                            </span>
                          </summary>
                          <div className="border-t border-[var(--line)]/70 bg-[var(--surface-2)]/50 px-3.5 py-2.5 sm:px-4">
                            {a.note ? <p className="mb-2 text-[0.72rem] text-[var(--muted)]">{a.note}</p> : null}
                            <ul className="space-y-1.5">
                              {a.recruiters.map((r) => (
                                <li key={r.name} className="flex items-center justify-between gap-3 text-[0.78rem]">
                                  {r.linkedinUrl ? (
                                    <a
                                      href={r.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-[var(--ink)] no-underline hover:underline"
                                    >
                                      {r.name}
                                    </a>
                                  ) : (
                                    <span className="font-medium text-[var(--ink)]">{r.name}</span>
                                  )}
                                  {r.brand ? <span className="truncate text-[var(--muted)]">{r.brand}</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </details>
          </div>
        </main>
      </div>
      {reviewIds ? (
        <QuickReview
          ids={reviewIds}
          leads={leadMap}
          busy={busy}
          drafts={clientDrafts}
          onDraft={(id, v) => setClientDrafts((d) => ({ ...d, [id]: v }))}
          onReview={(id, action, name) => onReview(id, action, name)}
          onClose={() => setReviewIds(null)}
        />
      ) : null}
    </AppShell>
  );
}
