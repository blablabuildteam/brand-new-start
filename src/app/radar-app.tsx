"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SourceLogo, SourceLogos, sourceChannelsFromRow } from "@/components/source-logo";
import { BlablaLogo } from "@/components/blabla-logo";
import { INGEST_POLICY } from "@/lib/costs";

type Factor = { label: string; points: number; source?: string };
type Signal = {
  id: string;
  source: string;
  title: string;
  summary: string;
  roleLabel: string;
  employmentHint: string | null;
  evidenceUrl: string | null;
  seenAt: string;
  firstSeenAt?: string;
  company: { id: string; name: string };
  channel?: string;
  channelLabel?: string;
  raw?: Record<string, unknown> | null;
};
type RadarRow = {
  id: string;
  roleLabel: string;
  status: string;
  kans: number;
  angle: string | null;
  sources: string[];
  factors: Factor[];
  company: { id: string; name: string; sector: string | null };
  signals: Signal[];
};
type SyncHit = {
  company: string;
  title: string;
  url?: string | null;
  kept: boolean;
  isNew?: boolean;
};
type SyncRun = {
  id: string;
  at: string;
  channel: string;
  label: string;
  mode: string;
  detail?: string;
  fetched: number;
  kept: number;
  searched?: string[];
  hits: SyncHit[];
};
type SyncInfo = {
  last: SyncRun | null;
  recent: SyncRun[];
  huntQueries: string[];
  boardQueries?: string[];
  platformsEnabled: number;
};

type SyncStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

type LiveSync = {
  phase: "running" | "done" | "error";
  action: "all" | "market" | "boards" | "platforms";
  title: string;
  statusLine: string;
  explain: string;
  searched: string[];
  steps: SyncStep[];
  runs: SyncRun[];
  error?: string;
};

const STATUS_NL: Record<string, string> = {
  hot: "Sterke kans",
  warm: "Kans groeit",
  watch: "Volgen",
  cold: "Zwak",
};

const STATUS_HELP: Record<string, string> = {
  hot: "Hoogste prioriteit — genoeg bewijs om nu te benaderen.",
  warm: "Wordt interessanter — nog 1–2 signalen en het is hot.",
  watch:
    "Op de radar houden: nog te weinig bewijs voor actie. Check bij een volgende sync of er een contract/ZZP-label, nieuwe vacature of sterker signaal bij komt.",
  cold: "Zwak signaal — lage prioriteit, alleen meenemen als er niets beters is.",
};

const FILTER_HELP: Record<"all" | "hot" | "contract", string> = {
  all: "Alle bedrijven op de radar",
  hot: "Groen bolletje · score ≥ 75 — hoogste prioriteit",
  contract: "Alleen hits die al interim/ZZP/contract noemen",
};

const SCORE_MAX = 98;

function cleanAngle(angle: string | null | undefined) {
  if (!angle) return null;
  if (/Pulse|employment-type/i.test(angle)) {
    return "Nog geen hard contract-bewijs in de tekst — check de vacature of wacht op een sterker signaal.";
  }
  return angle;
}

function scoreTone(kans: number) {
  if (kans >= 75) return "hot";
  if (kans >= 55) return "warm";
  if (kans >= 35) return "watch";
  return "cold";
}

function SyncStepVisual({ id, label }: { id: string; label: string }) {
  if (id === "boards") {
    return (
      <span className="inline-flex items-center gap-2" title={label}>
        <SourceLogo channel="indeed" size="sm" />
        <SourceLogo channel="freelance-nl" size="sm" />
      </span>
    );
  }
  if (id === "market" || id === "linkedin-jobs") {
    return (
      <span className="inline-flex items-center" title={label}>
        <SourceLogo channel="linkedin-jobs" size="sm" />
      </span>
    );
  }
  if (id === "indeed") {
    return (
      <span title={label}>
        <SourceLogo channel="indeed" size="sm" />
      </span>
    );
  }
  if (id === "freelance-nl") {
    return (
      <span title={label}>
        <SourceLogo channel="freelance-nl" size="sm" />
      </span>
    );
  }
  return <span className="font-medium">{label}</span>;
}

function ScoreChip({ kans, large }: { kans: number; large?: boolean }) {
  const tone = scoreTone(kans);
  const cls =
    tone === "hot"
      ? "border-[var(--green)]/40 bg-[var(--green-soft)] text-[var(--green)]"
      : tone === "warm"
        ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]"
        : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-md border ${cls} ${
        large ? "min-w-[3.6rem] px-2.5 py-1.5" : "min-w-[2.8rem] px-2 py-1"
      }`}
      title={`Kans-score ${kans}/${SCORE_MAX} (som van factoren, max ${SCORE_MAX})`}
      style={{ fontFamily: "var(--mono)" }}
    >
      <span className={`font-semibold tabular-nums ${large ? "text-lg" : "text-sm"}`}>{kans}</span>
      <span className="text-[0.58rem] opacity-80">/{SCORE_MAX}</span>
    </span>
  );
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} u geleden`;
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

function rowMeta(r: RadarRow) {
  const sig = r.signals[0];
  const raw = (sig?.raw && typeof sig.raw === "object" ? sig.raw : {}) as Record<string, unknown>;
  const logo = typeof raw.companyLogo === "string" ? raw.companyLogo : null;
  const applicants = typeof raw.applicants === "number" ? raw.applicants : null;
  const postedRaw = typeof raw.postedAt === "string" ? raw.postedAt : null;
  let postedLabel: string | null = null;
  if (postedRaw) {
    const t = Date.parse(postedRaw);
    if (!Number.isNaN(t)) postedLabel = `geplaatst ${timeAgo(new Date(t).toISOString())}`;
    else if (postedRaw.length < 40) postedLabel = postedRaw;
  }
  return { logo, applicants, postedLabel };
}

const EMPLOYMENT_NL: Record<string, string> = {
  contract: "Contract",
  interim: "Interim",
  zzp: "ZZP",
  unknown: "",
};

function rowChannels(r: RadarRow) {
  return sourceChannelsFromRow(r.signals);
}

function rowEmployment(r: RadarRow) {
  const hint = r.signals.find((s) => s.employmentHint && s.employmentHint !== "unknown")?.employmentHint;
  return hint ? EMPLOYMENT_NL[hint] || hint : null;
}

function isFresh(r: RadarRow, sinceIso?: string | null) {
  if (!sinceIso) return false;
  const since = new Date(sinceIso).getTime();
  return r.signals.some((s) => {
    const t = new Date(s.firstSeenAt || s.seenAt).getTime();
    return t >= since - 2000;
  });
}

export default function RadarApp() {
  const router = useRouter();
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [stats, setStats] = useState<{
    hot: number;
    warm: number;
    companies: number;
    signals: number;
  } | null>(null);
  const [sync, setSync] = useState<SyncInfo | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "contract">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [live, setLive] = useState<LiveSync | null>(null);
  const [freshSince, setFreshSince] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  async function load(opts?: { keepActive?: boolean }) {
    setLoading(true);
    const res = await fetch("/api/radar");
    if (res.status === 401) {
      router.replace("/login");
      return null;
    }
    const data = await res.json();
    setRadar(data.radar);
    setStats(data.stats);
    setSync(data.sync);
    setActiveId((prev) => {
      if (opts?.keepActive && prev && data.radar.some((r: RadarRow) => r.id === prev)) return prev;
      const still = data.radar.some((r: RadarRow) => r.id === prev);
      return still ? prev : data.radar[0]?.id || null;
    });
    setLoading(false);
    return data as { sync: SyncInfo; radar: RadarRow[] };
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return radar.filter((r) => {
      if (filter === "hot") return r.status === "hot";
      if (filter === "contract") {
        return (
          r.sources.includes("job-type") ||
          r.factors.some((f) => /contract|interim|zzp/i.test(f.label))
        );
      }
      return true;
    });
  }, [radar, filter]);

  const active = filtered.find((r) => r.id === activeId) || filtered[0] || null;

  async function postIngest(body: Record<string, unknown>) {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Sync mislukt");
    return data as { run?: SyncRun; mode?: string; queries?: unknown };
  }

  function mergeSearched(prev: string[], next: string[]) {
    return [...new Set([...prev, ...next])];
  }

  async function runOne(
    action: "market" | "boards" | "platforms",
    opts?: { nested?: boolean }
  ) {
    const previewSearched =
      action === "market"
        ? (sync?.huntQueries || []).slice(0, 8).map((q) => `LinkedIn · ${q}`)
        : action === "boards"
          ? ["Indeed NL", ...(sync?.boardQueries || []).slice(0, 4).map((q) => `Freelancer.nl · ${q}`)]
          : [`Careers · ${sync?.platformsEnabled ?? 0} platforms`];

    const title =
      action === "market"
        ? "LinkedIn Jobs"
        : action === "boards"
          ? "Indeed + Freelancer.nl"
          : "Careers / platforms";

    const explain =
      action === "market"
        ? "We zoeken op LinkedIn Jobs naar BNS-rollen (SM, Agile, BA, …) met contract/ZZP-filters, houden alleen niche-hits, en zetten die op de radar."
        : action === "boards"
          ? "We zoeken op Indeed (live) en Freelancer.nl (zodra Firecrawl-key er is) naar dezelfde rollen, filteren op niche, en voegen nieuwe hits toe."
          : "We scrapen careers-pagina’s van de watchlist-bedrijven (Firecrawl) op openstaande BNS-rollen.";

    if (!opts?.nested) {
      setBusy(true);
      setMenuOpen(false);
      setLive({
        phase: "running",
        action,
        title,
        statusLine: `${title} doorzoeken…`,
        explain,
        searched: previewSearched,
        steps: [{ id: action, label: title, status: "running" }],
        runs: [],
      });
    }

    const body =
      action === "market"
        ? {
            action: "market",
            maxUrls: INGEST_POLICY.syncMarketUrls,
            maxJobs: INGEST_POLICY.syncMarketJobs,
          }
        : action === "boards"
          ? {
              action: "boards",
              maxIndeed: INGEST_POLICY.syncIndeedMax,
              maxFreelanceQueries: INGEST_POLICY.syncFreelanceQueries,
            }
          : { action: "platforms" };

    const data = await postIngest(body);
    const runInfo = data.run || null;
    const searched = runInfo?.searched?.length
      ? runInfo.searched
      : previewSearched;

    return { title, explain, runInfo, searched };
  }

  async function run(action: "all" | "market" | "boards" | "platforms") {
    setBusy(true);
    setMenuOpen(false);
    const startedAt = new Date().toISOString();

    if (action === "all") {
      setLive({
        phase: "running",
        action: "all",
        title: "Alle bronnen",
        statusLine: "Stap 1/2 · LinkedIn Jobs…",
        explain:
          "Eén sync haalt alle actieve bronnen op: eerst LinkedIn Jobs, daarna Indeed (+ Freelancer.nl). Hits worden gefilterd op BNS-rollen en als nieuw of refresh op de radar gezet.",
        searched: [
          ...(sync?.huntQueries || []).slice(0, 6).map((q) => `LinkedIn · ${q}`),
          "Indeed NL",
          "Freelancer.nl",
        ],
        steps: [
          { id: "market", label: "LinkedIn Jobs", status: "running" },
          { id: "boards", label: "Indeed + Freelancer.nl", status: "pending" },
        ],
        runs: [],
      });

      try {
        const market = await runOne("market", { nested: true });
        setLive((prev) =>
          prev
            ? {
                ...prev,
                statusLine: "Stap 2/2 · Indeed + Freelancer.nl…",
                searched: mergeSearched(prev.searched, market.searched),
                steps: prev.steps.map((s) =>
                  s.id === "market"
                    ? {
                        id: s.id,
                        label: s.label,
                        status: "done",
                        detail: market.runInfo
                          ? `${market.runInfo.kept} gehouden · ${market.runInfo.fetched} opgehaald`
                          : "klaar",
                      }
                    : s.id === "boards"
                      ? { ...s, status: "running" }
                      : s
                ),
                runs: market.runInfo ? [market.runInfo] : [],
              }
            : prev
        );

        const boards = await runOne("boards", { nested: true });
        const runs = [...(market.runInfo ? [market.runInfo] : []), ...(boards.runInfo ? [boards.runInfo] : [])];
        const kept = runs.reduce((a, r) => a + r.kept, 0);
        const fetched = runs.reduce((a, r) => a + r.fetched, 0);
        const neu = runs.flatMap((r) => r.hits).filter((h) => h.kept && h.isNew).length;

        setLive((prev) =>
          prev
            ? {
                ...prev,
                phase: "done",
                statusLine: `Klaar · ${kept} gehouden · ${fetched} opgehaald · ${neu} nieuw`,
                searched: mergeSearched(prev.searched, boards.searched),
                steps: prev.steps.map((s) =>
                  s.id === "boards"
                    ? {
                        id: s.id,
                        label: s.label,
                        status: "done",
                        detail: boards.runInfo
                          ? `${boards.runInfo.kept} gehouden · ${boards.runInfo.fetched} opgehaald`
                          : "klaar",
                      }
                    : s
                ),
                runs,
              }
            : prev
        );
        setFreshSince(startedAt);
        await load({ keepActive: true });
      } catch (e) {
        setLive((prev) =>
          prev
            ? {
                ...prev,
                phase: "error",
                statusLine: "Sync mislukt",
                error: e instanceof Error ? e.message : "Mislukt",
                steps: prev.steps.map((s) =>
                  s.status === "running" ? { ...s, status: "error" } : s
                ),
              }
            : prev
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const one = await runOne(action);
      setLive({
        phase: "done",
        action,
        title: one.runInfo?.label || one.title,
        statusLine: one.runInfo
          ? `${one.runInfo.kept} gehouden · ${one.runInfo.fetched} opgehaald (${one.runInfo.mode})`
          : `Klaar`,
        explain: one.explain,
        searched: one.searched,
        steps: [
          {
            id: action,
            label: one.title,
            status: "done",
            detail: one.runInfo
              ? `${one.runInfo.kept}/${one.runInfo.fetched}`
              : undefined,
          },
        ],
        runs: one.runInfo ? [one.runInfo] : [],
      });
      setFreshSince(startedAt);
      await load({ keepActive: true });
    } catch (e) {
      setLive((prev) => ({
        phase: "error",
        action,
        title: action,
        statusLine: "Sync mislukt",
        explain: prev?.explain || "",
        searched: prev?.searched || [],
        steps: (prev?.steps || []).map((s) =>
          s.status === "running" ? { ...s, status: "error" } : s
        ),
        runs: prev?.runs || [],
        error: e instanceof Error ? e.message : "Mislukt",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
  }

  function selectRow(id: string) {
    setActiveId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  const allHits = (live?.runs || []).flatMap((r) =>
    r.hits.map((h) => ({ ...h, channel: r.channel }))
  );
  const newHits = allHits.filter((h) => h.kept && h.isNew);
  const keptHits = allHits.filter((h) => h.kept);
  const refreshHits = keptHits.filter((h) => !h.isNew);
  const totalFetched = (live?.runs || []).reduce((a, r) => a + r.fetched, 0);
  const totalKept = (live?.runs || []).reduce((a, r) => a + r.kept, 0);
  const showPanel = Boolean(live);

  return (
    <div className="radar-shell flex h-dvh flex-col overflow-hidden">
      <header className="z-40 shrink-0 border-b border-[var(--line)]/80 bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3.5 md:px-8">
          <div className="flex items-center gap-3.5">
            <Image
              src="/assets/bns-logo.png"
              alt="Brand New Start"
              width={52}
              height={52}
              className="h-12 w-auto md:h-14"
              priority
            />
            <div>
              <p className="text-base font-semibold tracking-tight text-[var(--ink)] md:text-lg" style={{ fontFamily: "var(--display)" }}>
                Brand New Start
              </p>
              <p className="text-[0.72rem] text-[var(--muted)]">Radar · contracting-kansen</p>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run("all")}
              className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-bright)] disabled:opacity-50"
            >
              {busy ? "Syncen…" : "Sync alles"}
            </button>
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Meer
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[13rem] rounded-md border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow)]">
                <button
                  type="button"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
                  onClick={() => run("market")}
                >
                  Alleen LinkedIn
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
                  onClick={() => run("boards")}
                >
                  Alleen Indeed / Freelancer.nl
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
                  onClick={() => run("platforms")}
                >
                  Alleen careers-platforms
                </button>
                <div className="my-1 h-px bg-[var(--line)]" />
                <a
                  href="/costs"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
                >
                  Kosten / ROI
                </a>
                <a
                  href="/methode"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
                >
                  Methode & queries
                </a>
                <a
                  href="/samenwerking"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
                >
                  Samenwerkingsvoorstel
                </a>
                <div className="my-1 h-px bg-[var(--line)]" />
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
                  onClick={logout}
                >
                  Uitloggen
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-5 pt-5 md:px-8">
        <div className="mb-3 shrink-0 space-y-3 border-b border-[var(--line)]/70 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className="text-sm text-[var(--muted)]"
                title="Bedrijven op de radar · hoeveel daarvan score ≥75 (sterke kans) · totaal aantal vacature/signalen"
              >
                {stats ? (
                  <>
                    <span title="Unieke bedrijven met minstens één relevant signaal">{stats.companies} bedrijven</span>
                    {" · "}
                    <span title="Score ≥ 75 — hoogste prioriteit om nu te benaderen">{stats.hot} sterke kans</span>
                    {" · "}
                    <span title="Losse vacatures/hits die we hebben binnengehaald">{stats.signals} signalen</span>
                  </>
                ) : (
                  "Laden…"
                )}
              </p>
              <p className="mt-1 max-w-xl text-[0.7rem] leading-relaxed text-[var(--muted)]">
                Sync haalt vacatures op bij LinkedIn, Indeed en Freelancer.nl, filtert op BNS-rollen, en scoort ze
                (max {SCORE_MAX}).
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[0.65rem] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5" title={STATUS_HELP.hot}>
                  <span className="h-2 w-2 rounded-full bg-[var(--green)]" /> Sterke kans (≥75)
                </span>
                <span className="inline-flex items-center gap-1.5" title={STATUS_HELP.warm}>
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Kans groeit (≥55)
                </span>
                <span className="inline-flex items-center gap-1.5" title={STATUS_HELP.watch}>
                  <span className="h-2 w-2 rounded-full bg-[var(--line)]" /> Volgen — later opnieuw checken
                </span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                {(
                  [
                    ["all", "Alles"],
                    ["hot", "Sterke kans"],
                    ["contract", "Interim/ZZP"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    title={FILTER_HELP[id]}
                    onClick={() => setFilter(id)}
                    className={`px-2.5 py-1 text-xs transition ${
                      filter === id
                        ? "border-b-2 border-[var(--accent)] font-semibold text-[var(--ink)]"
                        : "border-b-2 border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="max-w-[16rem] text-right text-[0.65rem] leading-snug text-[var(--muted)]">
                {FILTER_HELP[filter]}
              </p>
            </div>
          </div>

          {!live && sync?.last ? (
            <button
              type="button"
              onClick={() =>
                setLive({
                  phase: "done",
                  action: "all",
                  title: sync.last!.label,
                  statusLine: `${sync.last!.kept} gehouden · ${sync.last!.fetched} opgehaald`,
                  explain: "Laatste sync-run opnieuw bekijken.",
                  searched: sync.last!.searched || [],
                  steps: [
                    {
                      id: sync.last!.channel,
                      label: sync.last!.label,
                      status: "done",
                      detail: `${sync.last!.kept}/${sync.last!.fetched}`,
                    },
                  ],
                  runs: [sync.last!],
                })
              }
              className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--accent)]/25 bg-[var(--accent-soft)]/40 px-3 py-2.5 text-left transition hover:bg-[var(--accent-soft)]/70"
            >
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-[var(--accent)]" style={{ fontFamily: "var(--mono)" }}>
                  Laatste sync
                </p>
                <p className="text-sm font-medium text-[var(--ink)]">
                  {sync.last.label} · {timeAgo(sync.last.at)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {sync.last.kept}/{sync.last.fetched} gehouden
                  {sync.last.searched?.length ? ` · ${sync.last.searched.length} zoekopdrachten` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">Details →</span>
            </button>
          ) : null}
        </div>

        {showPanel && live ? (
          <section className="mb-4 shrink-0 animate-fade-in overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)]/80 px-4 py-3">
              <div className="min-w-0">
                <p
                  className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  Sync
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                  {live.phase === "running" ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                      {live.statusLine}
                    </span>
                  ) : live.phase === "error" ? (
                    <span className="text-[var(--warn)]">{live.error || live.statusLine}</span>
                  ) : (
                    live.statusLine
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{live.title}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                onClick={() => setLive(null)}
              >
                Sluiten
              </button>
            </div>

            {live.phase === "done" || live.phase === "running" ? (
              <div className="grid grid-cols-3 divide-x divide-[var(--line)]/80 border-b border-[var(--line)]/80 bg-[var(--surface-2)]/40">
                <div className="px-4 py-2.5">
                  <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">Opgehaald</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                    {totalFetched || "—"}
                  </p>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">Gehouden</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                    {totalKept || "—"}
                  </p>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">Nieuw</p>
                  <p
                    className={`mt-0.5 text-lg font-semibold tabular-nums ${newHits.length ? "text-[var(--green)]" : "text-[var(--ink)]"}`}
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    {live.phase === "done" ? newHits.length : "…"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 px-4 py-3">
              {live.steps.length ? (
                <ol className="flex flex-wrap gap-2">
                  {live.steps.map((s) => (
                    <li
                      key={s.id}
                      className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs ${
                        s.status === "running"
                          ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/50 text-[var(--ink)]"
                          : s.status === "done"
                            ? "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                            : s.status === "error"
                              ? "border-[var(--warn)]/40 bg-[var(--warn)]/5 text-[var(--warn)]"
                              : "border-[var(--line)]/70 text-[var(--muted)]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          s.status === "running"
                            ? "animate-pulse bg-[var(--accent)]"
                            : s.status === "done"
                              ? "bg-[var(--green)]"
                              : s.status === "error"
                                ? "bg-[var(--warn)]"
                                : "bg-[var(--line)]"
                        }`}
                      />
                      <SyncStepVisual id={s.id} label={s.label} />
                      {s.detail ? <span className="tabular-nums text-[var(--muted)]">{s.detail}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : null}

              {live.searched.length ? (
                <div>
                  <p className="mb-1.5 text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">
                    Zoekopdrachten · {live.searched.length}
                  </p>
                  <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                    {live.searched.map((q) => (
                      <span
                        key={q}
                        className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.68rem] text-[var(--ink)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {live.phase === "done" ? (
                <div>
                  <p className="mb-1.5 text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">
                    Resultaten
                    {keptHits.length ? ` · ${keptHits.length}` : ""}
                    {newHits.length ? ` · ${newHits.length} nieuw` : ""}
                    {refreshHits.length && !newHits.length ? " · alleen refreshes" : ""}
                  </p>
                  {keptHits.length ? (
                    <ul className="max-h-36 divide-y divide-[var(--line)]/70 overflow-y-auto rounded border border-[var(--line)]/80">
                      {[...newHits, ...refreshHits].slice(0, 14).map((h, i) => (
                        <li key={`${h.company}-${h.title}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                          <SourceLogo channel={h.channel} size="sm" />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-[var(--ink)]">{h.company}</span>
                            <span className="text-[var(--muted)]"> — {h.title}</span>
                          </span>
                          {h.isNew ? (
                            <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--green)]">
                              nieuw
                            </span>
                          ) : (
                            <span className="shrink-0 text-[0.62rem] text-[var(--muted)]">refresh</span>
                          )}
                          {h.url ? (
                            <a
                              href={h.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs text-[var(--accent)] no-underline hover:underline"
                            >
                              bron
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">Geen niche-hits in deze run.</p>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-8 pb-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <section className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            <h2 className="sr-only">Contracting-ruimte</h2>
            {loading && !radar.length ? (
              <p className="text-sm text-[var(--muted)]">Radar laden…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Geen resultaten in dit filter.</p>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((r, idx) => {
                  const on = active?.id === r.id;
                  const channels = rowChannels(r);
                  const employment = rowEmployment(r);
                  const fresh = isFresh(r, freshSince);
                  const meta = rowMeta(r);
                  const angle = cleanAngle(r.angle);
                  return (
                    <li key={r.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}>
                      <button
                        type="button"
                        onClick={() => selectRow(r.id)}
                        aria-current={on ? "true" : undefined}
                        className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 shadow-[inset_3px_0_0_0_var(--accent)]"
                            : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]/70"
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            r.status === "hot"
                              ? "bg-[var(--green)]"
                              : r.status === "warm"
                                ? "bg-[var(--accent)]"
                                : "bg-[var(--line)]"
                          }`}
                          title={STATUS_HELP[r.status] || STATUS_NL[r.status]}
                        />
                        {meta.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={meta.logo}
                            alt=""
                            className="mt-0.5 h-7 w-7 shrink-0 rounded object-contain bg-white"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[var(--ink)]">{r.company.name}</span>
                            <SourceLogos channels={channels} />
                            {fresh ? (
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--green)]">
                                nieuw
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-sm text-[var(--muted)]">
                            {r.roleLabel}
                            {r.company.sector ? ` · ${r.company.sector}` : ""}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-[var(--muted)]">
                            <span>{STATUS_NL[r.status] || r.status}</span>
                            {employment ? <span>· {employment}</span> : null}
                            {meta.postedLabel ? <span>· {meta.postedLabel}</span> : null}
                            {meta.applicants != null ? <span>· {meta.applicants} aanmeldingen</span> : null}
                          </span>
                          {angle ? (
                            <span className="mt-1.5 block text-[0.75rem] leading-snug text-[var(--ink)]/75 line-clamp-2">
                              {angle}
                            </span>
                          ) : null}
                        </span>
                        <ScoreChip kans={r.kans} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside
            ref={detailRef}
            className="min-h-0 overflow-y-auto overscroll-contain border-t border-[var(--line)]/70 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
          >
            {active ? (
              <div key={active.id} className="animate-fade-in pb-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.68rem] uppercase tracking-[0.06em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                        {STATUS_NL[active.status] || active.status}
                      </p>
                      <SourceLogos channels={rowChannels(active)} size="md" />
                    </div>
                    <p className="mt-1 max-w-sm text-[0.7rem] leading-snug text-[var(--muted)]">
                      {STATUS_HELP[active.status]}
                    </p>
                    <div className="mt-1 flex items-center gap-2.5">
                      {rowMeta(active).logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rowMeta(active).logo!}
                          alt=""
                          className="h-9 w-9 rounded object-contain bg-white"
                        />
                      ) : null}
                      <h3 className="text-2xl font-bold tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                        {active.company.name}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {active.roleLabel}
                      {active.company.sector ? ` · ${active.company.sector}` : ""}
                    </p>
                    {(rowMeta(active).postedLabel || rowMeta(active).applicants != null) && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {rowMeta(active).postedLabel}
                        {rowMeta(active).postedLabel && rowMeta(active).applicants != null ? " · " : ""}
                        {rowMeta(active).applicants != null ? `${rowMeta(active).applicants} aanmeldingen` : ""}
                      </p>
                    )}
                  </div>
                  <ScoreChip kans={active.kans} large />
                </div>

                {cleanAngle(active.angle) ? (
                  <p className="mt-5 border-l-2 border-[var(--accent)] pl-3 text-sm leading-relaxed text-[var(--ink)]">
                    {cleanAngle(active.angle)}
                  </p>
                ) : null}

                <div className="mt-8">
                  <h4 className="mb-1 text-[0.7rem] uppercase tracking-[0.06em] text-[var(--muted)]">
                    Waarom deze score (max {SCORE_MAX})
                  </h4>
                  <p className="mb-3 text-[0.7rem] leading-relaxed text-[var(--muted)]">
                    Score = som van factoren hieronder. ≥75 sterke kans (groen) · ≥55 kans groeit (blauw) · lager =
                    volgen (grijs).
                  </p>
                  <ul className="space-y-2">
                    {active.factors.map((f, i) => (
                      <li key={i} className="flex justify-between gap-4 text-sm">
                        <span className="text-[var(--ink)]/90">{f.label}</span>
                        <span className="shrink-0 tabular-nums text-[var(--green)]" style={{ fontFamily: "var(--mono)" }}>
                          +{f.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  <h4 className="mb-3 text-[0.7rem] uppercase tracking-[0.06em] text-[var(--muted)]">Bronnen</h4>
                  <ul className="space-y-4">
                    {active.signals.map((s) => {
                      const ch = s.channel || "";
                      const chLabel = s.channelLabel || ch || s.source;
                      return (
                        <li key={s.id}>
                          <div className="flex items-center gap-2">
                            <SourceLogos channels={ch ? [ch] : []} />
                            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--accent)]" style={{ fontFamily: "var(--mono)" }}>
                              {chLabel}
                            </p>
                          </div>
                          <p className="mt-0.5 text-sm font-medium">{s.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)] line-clamp-3">{s.summary}</p>
                          {s.evidenceUrl ? (
                            <a
                              href={s.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1.5 inline-block text-xs font-medium"
                            >
                              Openen →
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Selecteer een bedrijf.</p>
            )}
          </aside>
        </div>
      </main>

      <footer className="shrink-0 border-t border-[var(--line)]/70 bg-[var(--surface)]/80">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-2.5 md:px-8">
          <p className="text-[0.7rem] text-[var(--muted)]">Brand New Start · Radar</p>
          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.7rem] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
          >
            <span>Tool gebouwd door</span>
            <BlablaLogo className="h-4 w-4" />
            <span className="font-semibold tracking-tight text-[var(--ink)]">blablabuild</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
