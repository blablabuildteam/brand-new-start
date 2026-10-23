"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RememberedFold } from "@/components/remembered-fold";
import { BtnSpinner } from "@/components/btn-spinner";
import { ScoreChip } from "@/components/score-chip";
import { DismissButton } from "@/components/dismiss-button";
import { CompanyMark } from "@/components/company-mark";
import type { CrmLane, CrmOpportunity, CrmResults, CrmStage, DealInput } from "@/lib/crm";
import { needsContact } from "@/lib/crm";
import { radarHref } from "@/lib/desk-links";
import { cachePeek } from "@/lib/client-cache";
import { DESK, hmSearchMessage } from "@/lib/desk-labels";
import { eurRange, SYNC_COST_PER_RUN } from "@/lib/costs";
import { guessCompanyLogo } from "@/lib/company-logo";

/** Werkbakken: open stappen, dan uitkomst. Bron is een losse keuze ernaast. */
type Bucket = "step2" | "step3" | "step4" | "contacted" | "won" | "lost";
type Filter = "open" | Bucket;

function bucketOf(row: CrmOpportunity): Bucket {
  if (row.stage === "won") return "won";
  if (row.stage === "lost") return "lost";
  if (row.stage === "outreach") return "contacted";
  const n = stepOf(row).n;
  return n === 2 ? "step2" : n === 3 ? "step3" : "step4";
}

const FILTER_HINT: Record<Filter, string> = {
  open: "Alles wat nog loopt — de knop rechts is steeds de volgende stap.",
  step2: "Opdrachtgever bekend, nog geen hiring manager.",
  step3: "Manager bekend, mail of telefoon ontbreekt nog.",
  step4: "Klaar om te benaderen — stuur het bericht en zet daarna op Gecontacteerd.",
  contacted: "Bericht verstuurd of gebeld. Wordt het wat? Zet op Gewonnen met de dealwaarde.",
  won: "Gesloten deals — wie, wanneer en voor hoeveel.",
  lost: "Afgelegd. Terugzetten kan in de detail.",
};

function eur(n: number) {
  return `€${Math.round(n).toLocaleString("nl-NL")}`;
}

function firstName(email: string | null | undefined) {
  if (!email) return null;
  const local = email.split("@")[0] || "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : null;
}

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

/** Summiere hover-uitleg: waarom deze HM (of kandidaat) gekozen/hoog scoort. */
function hmWhyTip(
  row: CrmOpportunity,
  hit?: { name: string; title?: string | null; score?: number; why?: string } | null
): string | undefined {
  const name = hit?.name || row.hiringManager;
  const stored = (name && row.hmHits.find((h) => h.name === name)) || hit || null;
  if (stored?.why) return stored.why;
  const bits: string[] = [];
  if (stored?.title) bits.push(stored.title);
  else if (!hit && row.hiringManagerTitle) bits.push(row.hiringManagerTitle);
  if (typeof stored?.score === "number") bits.push(`score ${stored.score}`);
  if (row.endClient) bits.push(`bij ${row.endClient}`);
  return bits.length ? bits.join(" · ") : undefined;
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

/** Vaste route: opdrachtgever → manager → mail/tel → bericht.
 * "Mail/tel" (niet "Contact") omdat "Contact" eerder botste met de nav-tab Bericht. */
const STEPS = ["Opdrachtgever", "Manager", "Mail/tel", "Bericht"] as const;

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
  if (needsContact(row)) return { n: 3, action: "contact", label: "Haal mail/tel" };
  if (row.stage === "outreach") return { n: 4, action: "bericht", label: "Follow-up" };
  return { n: 4, action: "bericht", label: "Bericht" };
}

const HM_COST = eurRange(SYNC_COST_PER_RUN.actions["hm-search"].eur);
const LUSHA_COST = eurRange(SYNC_COST_PER_RUN.actions.lusha.eur);

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
  backlog?: { feedPending: number; feedReady?: number; boardBelow: number; boardThreshold: number };
  results?: CrmResults;
  lusha?: boolean;
};

export default function KansenDesk({ initial }: { initial?: InitialCrm }) {
  const router = useRouter();
  const [params, setParams] = useState(() => new URLSearchParams());
  const [items, setItems] = useState<CrmOpportunity[]>(initial?.items || []);
  const [counts, setCounts] = useState(
    initial?.counts || { all: 0, bureau: 0, direct: 0, withHm: 0 }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [filter, setFilter] = useState<Filter>("open");
  const [lane, setLane] = useState<"all" | CrmLane>("all");
  const [results, setResults] = useState<CrmResults | null>(initial?.results || null);
  const [sel, setSel] = useState<string | null>(params.get("id"));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stageBusy, setStageBusy] = useState(false);
  const [hmBusy, setHmBusy] = useState(false);
  const [hmBusyId, setHmBusyId] = useState<string | null>(null);
  const [hmError, setHmError] = useState<string | null>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [lushaReady, setLushaReady] = useState(Boolean(initial?.lusha));
  const [backlog, setBacklog] = useState(initial?.backlog || null);
  const [hmAutoRan, setHmAutoRan] = useState(false);
  const [q, setQ] = useState("");
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  /** Zwak (kans-score < 55) staat standaard uit: anders staan DUO 51 of Booking 16/98 bovenaan Zoek manager. */
  const [showWeak, setShowWeak] = useState(false);
  /** pipeline = volgende stap eerst · fresh = nieuwste eerst. */
  const [sortBy, setSortBy] = useState<"pipeline" | "fresh">("pipeline");

  function refresh() {
    return import("@/lib/client-cache").then(({ cachedJson, cacheClear }) => {
      cacheClear("crm");
      return cachedJson<InitialCrm>("crm", "/api/crm", { ttlMs: 5_000 }).then((j: InitialCrm) => {
        setItems(j.items);
        setCounts(j.counts);
        if (j.backlog) setBacklog(j.backlog);
        if (j.results) setResults(j.results);
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
            : j.error || "Mail/tel ophalen mislukt"
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
    setHmBusyId(crmId);
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
        needsPick?: boolean;
        hiringManager?: string | null;
        hits?: { name: string }[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setHmError(j.error || "HM-zoeken mislukt");
        return;
      }
      if (j.needsPick || ((j.hits?.length || 0) > 0 && !j.hiringManager)) {
        setHmError("Kies hieronder wie de hiring manager is.");
      } else if (j.empty || !j.hiringManager) {
        setHmError(hmSearchMessage(j.detail));
      }
      await refresh().catch(() => null);
    } finally {
      setHmBusy(false);
      setHmBusyId(null);
    }
  }

  useLayoutEffect(() => {
    const next = new URLSearchParams(window.location.search);
    setParams(next);
    const id = next.get("id");
    if (id) setSel(id);
    const cached = cachePeek<InitialCrm>("crm");
    if (!cached?.items?.length) return;
    setItems(cached.items);
    setCounts(cached.counts);
    if (cached.backlog) setBacklog(cached.backlog);
        if (cached.results) setResults(cached.results);
    if (typeof cached.lusha === "boolean") setLushaReady(cached.lusha);
    setLoading(false);
  }, []);

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
        if (j.results) setResults(j.results);
          if (typeof j.lusha === "boolean") setLushaReady(j.lusha);
        },
      })
        .then((j: InitialCrm) => {
          setItems(j.items);
          setCounts(j.counts);
          if (j.backlog) setBacklog(j.backlog);
        if (j.results) setResults(j.results);
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

  /** Alleen jobboards: feed-bevestigingen horen altijd in de lijst (drempel 55 geldt niet). */
  const isWeak = (r: CrmOpportunity) =>
    r.lane === "direct" &&
    r.stage !== "won" &&
    r.stage !== "lost" &&
    r.stage !== "outreach" &&
    r.kans != null &&
    r.kans < 55;

  const inFilter = (r: CrmOpportunity, f: Filter) => {
    if (lane !== "all" && r.lane !== lane) return false;
    const b = bucketOf(r);
    return f === "open" ? b !== "won" && b !== "lost" : b === f;
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((r) => {
      if (!inFilter(r, filter)) return false;
      if (!showWeak && isWeak(r)) return false;
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
    if (filter === "won") {
      return rows.slice().sort((a, b) => (b.deal?.wonAt || "").localeCompare(a.deal?.wonAt || ""));
    }
    if (filter === "contacted") {
      return rows
        .slice()
        .sort((a, b) => (b.deal?.contactedAt || "").localeCompare(a.deal?.contactedAt || ""));
    }
    return rows.slice().sort((a, b) => {
      const aw = isWeak(a) ? 1 : 0;
      const bw = isWeak(b) ? 1 : 0;
      if (aw !== bw) return aw - bw;
      // Actualiteit = eerst gezien (foundAt), niet lastSeen — anders springt oud weer omhoog na sync.
      const fresh = (r: CrmOpportunity) => r.foundAt || r.lastSeenAt || "";
      if (sortBy === "fresh") {
        const fc = fresh(b).localeCompare(fresh(a));
        if (fc !== 0) return fc;
        return stepOf(a).n - stepOf(b).n;
      }
      const as = stepOf(a).n;
      const bs = stepOf(b).n;
      if (as !== bs) return as - bs;
      return fresh(b).localeCompare(fresh(a));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inFilter/isWeak lezen alleen lane
  }, [items, filter, lane, q, showWeak, sortBy]);

  const weakHidden = useMemo(() => {
    if (showWeak) return 0;
    return items.filter((r) => inFilter(r, filter) && isWeak(r)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inFilter/isWeak lezen alleen lane
  }, [items, filter, lane, showWeak]);

  async function setStage(id: string, stage: CrmStage, deal?: DealInput) {
    setStageBusy(true);
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage, deal }),
      });
      if (!res.ok) throw new Error("stage mislukt");
      const j = (await res.json()) as { item?: CrmOpportunity };
      if (j.item) {
        setItems((prev) =>
          prev.map((x) => (x.id === id ? { ...x, stage: j.item!.stage, deal: j.item!.deal } : x))
        );
      }
      // Resultaat-tellers komen van de server; stil verversen.
      void refresh().catch(() => null);
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
    if (step.action === "bericht" && row.href) router.push(row.href);
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

  const nIn = (f: Filter) => items.filter((r) => inFilter(r, f)).length;
  const workFilters: { id: Filter; label: string }[] = [
    { id: "open", label: "Alles open" },
    { id: "step2", label: "Zoek manager" },
    { id: "step3", label: "Mail/tel" },
    { id: "step4", label: "Bericht" },
  ];
  const outcomeFilters: { id: Filter; label: string }[] = [
    { id: "contacted", label: "Gecontacteerd" },
    { id: "won", label: "Gewonnen" },
  ];
  const lostN = nIn("lost");

  const needsHm = filtered.filter((r) => !r.hiringManager && r.stage !== "won" && r.stage !== "lost").length;
  const allFilteredPicked = filtered.length > 0 && filtered.every((r) => picked.has(r.id));

  return (
    <AppShell current="kansen" title={DESK.kansen.title} subtitle={DESK.kansen.subtitle} fill>
      <div className="ws-shell">
        <RememberedFold
          storageKey="kansen-what"
          className="ws-fold shrink-0"
          summary={
            <summary>
              <span>Wat is Kansen?</span>
              <span className="ws-fold__meta">Vier stappen per kans</span>
            </summary>
          }
        >
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
                  LinkedIn.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">3</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Mail/tel</strong> — Haal mail/tel zet mail en
                  telefoon op de kans.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">4</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Bericht</strong> — tekst aan die manager. Jij
                  verstuurt, en zet daarna de uitkomst in de rij.
                </span>
              </li>
            </ol>
            <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              <strong className="font-semibold text-[var(--ink)]">Kans-score</strong> is de som van het bewijs dat
              hier nú een contracting-opdracht ligt: een vacature die contract of ZZP noemt, meerdere bronnen, verse
              posts, meer open rollen bij dezelfde klant. Max 98, vanaf 55 noemen we het warm. Open een rij en je
              ziet precies welke punten er in zitten.
            </p>
          </div>
        </RememberedFold>

        <div className="kans-toolbar shrink-0">
          <div className="kans-toolbar__row">
            <div className="lead-seg" role="tablist" aria-label="Werkbak">
              {workFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilterSafe(f.id)}
                  className={`lead-seg__btn ${filter === f.id ? "lead-seg__btn--on" : ""}`}
                >
                  {f.label}
                  <span className="lead-seg__n">{loading ? "…" : nIn(f.id)}</span>
                </button>
              ))}
            </div>
            <div className="lead-seg kans-toolbar__outcome" role="tablist" aria-label="Uitkomst">
              {outcomeFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilterSafe(f.id)}
                  className={`lead-seg__btn ${filter === f.id ? "lead-seg__btn--on" : ""} ${
                    f.id === "won" ? "kans-toolbar__won" : ""
                  }`}
                >
                  {f.label}
                  <span className="lead-seg__n">{loading ? "…" : nIn(f.id)}</span>
                </button>
              ))}
            </div>
            <div className="kans-toolbar__right">
              <label className="lead-period">
                <span className="lead-period__label">Bron</span>
                <select
                  value={lane}
                  onChange={(e) => {
                    setLane(e.target.value as "all" | CrmLane);
                    setSel(null);
                    setPicked(new Set());
                  }}
                  aria-label="Filter op bron"
                >
                  <option value="all">Alle bronnen</option>
                  <option value="direct">Jobboards</option>
                  <option value="bureau">Recruiter feed</option>
                </select>
              </label>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek klant, rol of manager…"
                className="kans-toolbar__search"
                aria-label="Filter kansen"
              />
            </div>
          </div>
          <div className="lead-toolbar__hint">
            <p className="lead-buckets__hint">{FILTER_HINT[filter]}</p>
            {weakHidden > 0 || showWeak ? (
              <button
                type="button"
                className="lead-toolbar__more"
                onClick={() => setShowWeak((v) => !v)}
                title="Jobboard-kansen met score onder 55. Recruiter-feed bevestigingen blijven altijd zichtbaar."
              >
                {showWeak ? "Verberg zwakke (<55)" : `+${weakHidden} zwak (<55)`}
              </button>
            ) : null}
            {lostN && filter !== "lost" ? (
              <button type="button" className="lead-toolbar__more" onClick={() => setFilterSafe("lost")}>
                {lostN} afgelegd
              </button>
            ) : null}
          </div>
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
                className={`btn-ink btn-tool ${hmBusy ? "is-busy" : ""}`}
                aria-busy={hmBusy || undefined}
              >
                {hmBusy ? <BtnSpinner /> : null}
                {hmBusy ? "Zoeken" : "Zoek HM"}
              </button>
              <DismissButton
                disabled={stageBusy}
                title={`Verwijder ${picked.size} kansen`}
                onClick={() => {
                  void (async () => {
                    const ids = [...picked];
                    for (const id of ids) {
                      await setStage(id, "lost");
                    }
                    setPicked(new Set());
                    setBulkNote(`${ids.length} weggezet`);
                  })();
                }}
              >
                {picked.size}
              </DismissButton>
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
            <p className="kans-costnote tabular-nums" style={{ fontFamily: "var(--mono)" }}>
              {filtered.length} {filtered.length === 1 ? "kans" : "kansen"}
              {needsHm ? ` · ${needsHm} zonder manager` : ""}
              {` · manager ≈ ${HM_COST} · mail/tel ≈ ${LUSHA_COST}`}
            </p>
          </div>
          <div className="kans-results">
            <span className="kans-results__label">Resultaat</span>
            <button
              type="button"
              className={`kans-results__stat ${filter === "contacted" ? "is-on" : ""}`}
              onClick={() => setFilterSafe("contacted")}
            >
              <strong>{results?.contacted ?? 0}</strong> gecontacteerd
            </button>
            <button
              type="button"
              className={`kans-results__stat kans-results__stat--won ${filter === "won" ? "is-on" : ""}`}
              onClick={() => setFilterSafe("won")}
            >
              <strong>{results?.won ?? 0}</strong> gewonnen
              {results?.wonEur ? <span className="kans-results__eur">{eur(results.wonEur)}</span> : null}
            </button>
            {results?.conversion != null ? (
              <span className="kans-results__conv" title="Gewonnen ÷ gecontacteerd">
                {results.conversion}% conversie
              </span>
            ) : null}
            {backlog?.feedReady ? (
              <Link
                href="/leads"
                className="kans-results__inflow"
                title="Deze posts komen pas op Kansen als je de opdrachtgever bevestigt."
              >
                Instroom: {backlog.feedReady} posts wachten op bevestiging in Recruiter feed →
              </Link>
            ) : null}
          </div>
          <div className="radar-scroll-pane__body !p-0">
            {error ? <p className="px-5 py-3 text-sm text-[var(--warn)]">{error}</p> : null}
            {loading ? <p className="px-5 py-3 text-sm text-[var(--muted)]">Laden…</p> : null}
            {!loading && !filtered.length ? (
              <p className="ws-empty m-4">
                {filter === "won"
                  ? "Nog geen gewonnen deals. Open een gecontacteerde kans en zet hem op Gewonnen met de dealwaarde."
                  : filter === "contacted"
                    ? "Nog niemand gecontacteerd. Na je bericht of belletje: open de kans en klik Gecontacteerd."
                    : filter === "lost"
                      ? "Niets afgelegd."
                      : "Nog geen kansen hier. Bevestig een opdrachtgever op Recruiter feed, of wacht op een warme jobboard-hit."}
              </p>
            ) : null}

            {!loading && filtered.length ? (
              <div className="kans-head">
                <span />
                <span>Opdrachtgever</span>
                <span>Bron</span>
                <button
                  type="button"
                  className={`kans-head__sort ${sortBy === "fresh" ? "kans-head__sort--on" : ""}`}
                  onClick={() => setSortBy("fresh")}
                  title="Sorteer op actualiteit (nieuwste eerst)"
                >
                  Actualiteit
                </button>
                <span>Hiring manager</span>
                <button
                  type="button"
                  className={`kans-head__sort kans-head__sort--end ${sortBy === "pipeline" ? "kans-head__sort--on" : ""}`}
                  onClick={() => setSortBy("pipeline")}
                  title="Sorteer op volgende stap"
                >
                  Volgende stap
                </button>
              </div>
            ) : null}

            {!loading && filtered.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map((row) => {
                  const on = active?.id === row.id;
                  const step = stepOf(row);
                  const checked = picked.has(row.id);
                  const stepBusy =
                    (hmBusyId === row.id && step.action === "hm") ||
                    (contactBusy && step.action === "contact" && on);
                  const rowWeak = isWeak(row);
                  return (
                    <li key={row.id} className={on ? "bg-[var(--surface-2)]" : ""}>
                      <div
                        className={`kans-row ${on ? "kans-row--on" : ""} ${rowWeak ? "kans-row--weak" : ""}`}
                        title={rowWeak ? "Zwak signaal (score < 55) — lagere prioriteit." : undefined}
                      >
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
                              {row.openingCount && row.openingCount > 1
                                ? ` · ${row.openingCount} vacatures`
                                : ""}
                            </span>
                          </span>
                        </button>

                        <span className="kans-row__src">
                          <span className={`kans-origin ${row.lane === "bureau" ? "kans-origin--feed" : "kans-origin--board"}`}>
                            {originOf(row).label}
                          </span>
                        </span>

                        <button
                          type="button"
                          className="kans-row__when"
                          title={
                            row.foundAt
                              ? `Gevonden ${formatDay(row.foundAt)}${row.lastSeenAt && row.lastSeenAt !== row.foundAt ? ` · laatst gezien ${formatDay(row.lastSeenAt)}` : ""}`
                              : "Sorteer op actualiteit"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setSortBy("fresh");
                          }}
                        >
                          <span className="kans-row__when-main">{row.freshnessLabel || "—"}</span>
                          {row.foundAt ? (
                            <span className="kans-row__when-sub">{formatDay(row.foundAt)}</span>
                          ) : null}
                        </button>

                        <span className="kans-row__hm">
                          <span
                            className={`block truncate ${row.hiringManager ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"}`}
                            title={row.hiringManager ? hmWhyTip(row) : undefined}
                          >
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

                        <span className="kans-row__side">
                          <span className="kans-row__side-actions">
                            {row.stage === "won" ? (
                              <span className="kans-row__deal">
                                {row.deal?.dealEur ? eur(row.deal.dealEur) : "Gewonnen"}
                              </span>
                            ) : step.action ? (
                              <button
                                type="button"
                                disabled={stepBusy}
                                className={`btn-ink btn-row kans-row__cta ${stepBusy ? "is-busy" : ""}`}
                                aria-busy={stepBusy || undefined}
                                title={
                                  step.action === "hm"
                                    ? `Manager zoeken · ≈ ${HM_COST}`
                                    : step.action === "contact"
                                      ? `Mail/tel ophalen · ≈ ${LUSHA_COST}`
                                      : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void runPrimary(row);
                                }}
                              >
                                {stepBusy ? <BtnSpinner /> : null}
                                {stepBusy ? (step.action === "hm" ? "Zoeken" : "Bezig") : step.label}
                              </button>
                            ) : (
                              <span className="kans-row__next">{step.label}</span>
                            )}
                            {row.stage !== "won" && row.stage !== "lost" ? (
                              <DismissButton
                                disabled={stageBusy}
                                title="Verwijderen — afleggen"
                                onClick={() => void setStage(row.id, "lost")}
                              />
                            ) : null}
                          </span>
                          <span className="kans-row__step">
                            {row.stage === "won"
                              ? `Gewonnen ${formatDay(row.deal?.wonAt || null)}${
                                  firstName(row.deal?.closedBy) ? ` · ${firstName(row.deal?.closedBy)}` : ""
                                }`
                              : row.stage === "outreach"
                                ? `Gecontacteerd ${formatDay(row.deal?.contactedAt || null)}`
                                : row.stage === "lost"
                                  ? "Afgelegd"
                                  : `Stap ${step.n} · ${STEPS[step.n - 1]}`}
                          </span>
                        </span>
                      </div>

                      {on ? (
                        <div className="kans-row__detail">
                          <div className="kans-detail__top">
                            <div className="min-w-0">
                              <p className="kans-detail__title">{row.title}</p>
                              <p className="kans-detail__meta">
                                <span className={`kans-origin ${row.lane === "bureau" ? "kans-origin--feed" : "kans-origin--board"}`}>
                                  {originOf(row).label}
                                </span>
                                {row.lane === "bureau"
                                  ? [row.agencyName, row.recruiterName].filter(Boolean).map((t) => (
                                      <span key={t}>{t}</span>
                                    ))
                                  : originOf(row).detail
                                    ? <span>{originOf(row).detail}</span>
                                    : null}
                                {row.foundAt ? <span>gevonden {formatDay(row.foundAt)}</span> : null}
                                {row.lastSeenAt && row.lastSeenAt !== row.foundAt ? (
                                  <span>gezien {formatDay(row.lastSeenAt)}</span>
                                ) : null}
                                {row.confirmedAt ? <span>bevestigd {formatDay(row.confirmedAt)}</span> : null}
                              </p>
                            </div>
                            <ol className="kans-track" aria-label="Pipeline">
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
                          </div>

                          {row.hmHits.length && !row.hiringManager ? (
                            <div className="kans-pick">
                              <div className="kans-pick__head">
                                <p className="ws-label">Kies hiring manager</p>
                                <p className="kans-pick__hint">
                                  LinkedIn bij {row.endClient} — #1 is geen automatische keuze.
                                </p>
                              </div>
                              <ul>
                                {row.hmHits.slice(0, 5).map((h) => (
                                  <li key={`${h.name}-${h.url || ""}`} className="kans-pick__row">
                                    <span className="min-w-0 truncate">
                                      <span className="font-medium text-[var(--ink)]" title={hmWhyTip(row, h)}>
                                        {h.name}
                                      </span>
                                      {h.title ? (
                                        <span className="text-[var(--muted)]"> · {h.title}</span>
                                      ) : null}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={contactBusy}
                                      onClick={() => void fetchContact(row.id, h.url, true)}
                                      className="kans-pick__use"
                                    >
                                      Gebruik
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {row.hiringManager ? (
                            <div className="kans-contact">
                              <div className="kans-contact__main">
                                <div className="min-w-0">
                                  <p className="ws-label">Hiring manager</p>
                                  <p className="kans-contact__name" title={hmWhyTip(row)}>
                                    {row.hiringManager}
                                    {row.hiringManagerTitle ? (
                                      <span className="kans-contact__title"> · {row.hiringManagerTitle}</span>
                                    ) : null}
                                  </p>
                                  <p className="kans-contact__coords">
                                    {row.hiringManagerEmail || (row.lushaStatus ? "geen mail" : "mail nog ophalen")}
                                    {" · "}
                                    {row.hiringManagerPhone || (row.lushaStatus ? "geen tel" : "tel nog ophalen")}
                                  </p>
                                  {!lushaReady && needsContact(row) ? (
                                    <p className="kans-contact__note">
                                      Lusha-key ontbreekt — naam/LinkedIn kun je al gebruiken.
                                    </p>
                                  ) : null}
                                </div>
                                <div className="kans-contact__btns">
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
                                      {contactBusy ? "Mail/tel…" : "Haal mail/tel"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {row.hmHits.filter((h) => h.name !== row.hiringManager).length ? (
                                <ul className="kans-contact__alts">
                                  {row.hmHits
                                    .filter((h) => h.name !== row.hiringManager)
                                    .slice(0, 3)
                                    .map((h) => (
                                      <li key={`${h.name}-${h.url || ""}`} className="kans-pick__row">
                                        <span className="min-w-0 truncate">
                                          <span className="font-medium text-[var(--ink)]" title={hmWhyTip(row, h)}>
                                            {h.name}
                                          </span>
                                          {h.title ? <span className="text-[var(--muted)]"> · {h.title}</span> : null}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={contactBusy}
                                          onClick={() => void fetchContact(row.id, h.url, true)}
                                          className="kans-pick__use"
                                        >
                                          Gebruik
                                        </button>
                                      </li>
                                    ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

                          {hmError && active?.id === row.id ? (
                            <p className="mt-2 text-[0.75rem] text-[var(--warn)]">{hmError}</p>
                          ) : null}

                          <div className="kans-detail__foot">
                            <div className="kans-detail__foot-main">
                              {row.lane === "direct" && row.kans != null ? (
                                <div className="kans-detail__score">
                                  <p className="ws-label">Jobboard-score</p>
                                  <div className="kans-detail__score-row">
                                    <ScoreChip
                                      kans={row.kans}
                                      parts={(row.kansFactors || []).map((f) => ({
                                        label: f.label,
                                        points: f.points,
                                      }))}
                                    />
                                    <span className="kans-detail__score-hint">
                                      Contracting-bewijs · drempel 55
                                    </span>
                                  </div>
                                </div>
                              ) : null}

                              <OutcomePanel
                                key={row.id}
                                row={row}
                                busy={stageBusy}
                                onStage={(st, deal) => setStage(row.id, st, deal)}
                              />
                            </div>

                            <div className="kans-detail__actions">
                              <button
                                type="button"
                                disabled={hmBusy && hmBusyId === row.id}
                                onClick={() => void searchHm(row.id, Boolean(row.hiringManager))}
                                className={`btn-ink btn-row ${hmBusyId === row.id ? "is-busy" : ""}`}
                                aria-busy={hmBusyId === row.id || undefined}
                              >
                                {hmBusyId === row.id ? <BtnSpinner /> : null}
                                {hmBusyId === row.id
                                  ? "Zoeken"
                                  : row.hiringManager
                                    ? "Opnieuw manager"
                                    : "Zoek manager"}
                              </button>
                              {row.href ? (
                                <Link href={row.href} className="kans-detail__link">
                                  Bericht
                                </Link>
                              ) : null}
                              {row.evidenceUrl ? (
                                <a
                                  href={row.evidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="kans-detail__link"
                                >
                                  Bron
                                </a>
                              ) : null}
                              {row.companyId ? (
                                <Link
                                  href={radarHref({
                                    companyId: row.companyId,
                                    openingId: row.openingId,
                                  })}
                                  className="kans-detail__link"
                                >
                                  Jobboards
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

const DEAL_DEFAULTS = { marginPerHour: 20, hoursPerWeek: 36, weeks: 20 };

/**
 * Uitkomst van één kans: gecontacteerd → gewonnen (met dealwaarde) of afgelegd.
 * Dealwaarde = marge/uur × uren/week × weken; zo is elke deal vergelijkbaar.
 */
function OutcomePanel({
  row,
  busy,
  onStage,
}: {
  row: CrmOpportunity;
  busy: boolean;
  onStage: (stage: CrmStage, deal?: DealInput) => Promise<void>;
}) {
  const d = row.deal;
  const [editing, setEditing] = useState(false);
  const [margin, setMargin] = useState(String(d?.marginPerHour ?? DEAL_DEFAULTS.marginPerHour));
  const [hours, setHours] = useState(String(d?.hoursPerWeek ?? DEAL_DEFAULTS.hoursPerWeek));
  const [weeks, setWeeks] = useState(String(d?.weeks ?? DEAL_DEFAULTS.weeks));
  const [note, setNote] = useState(d?.note ?? "");

  const m = Number(margin) || 0;
  const h = Number(hours) || 0;
  const w = Number(weeks) || 0;
  const total = Math.round(m * h * w);
  const backStage: CrmStage = row.hiringManager ? "hm" : "bevestigd";
  const who = (email?: string | null) => (firstName(email) ? ` · ${firstName(email)}` : "");

  const state =
    row.stage === "won"
      ? `Gewonnen ${formatDay(d?.wonAt || null)}${who(d?.closedBy)}`
      : row.stage === "outreach"
        ? `Gecontacteerd ${formatDay(d?.contactedAt || null)}${who(d?.contactedBy)}`
        : row.stage === "lost"
          ? "Afgelegd"
          : "Nog niet gecontacteerd";

  async function saveWon() {
    await onStage("won", {
      marginPerHour: m || null,
      hoursPerWeek: h || null,
      weeks: w || null,
      dealEur: total || null,
      note: note.trim() || null,
    });
    setEditing(false);
  }

  return (
    <div className="kans-outcome">
      <p className="ws-label">
        Uitkomst
        <span className={`kans-outcome__state kans-outcome__state--${row.stage}`}>{state}</span>
      </p>

      {row.stage === "won" && d?.dealEur && !editing ? (
        <p className="kans-outcome__deal">
          <strong>{eur(d.dealEur)}</strong>
          {d.marginPerHour && d.hoursPerWeek && d.weeks ? (
            <span>
              {" "}
              · €{d.marginPerHour}/u × {d.hoursPerWeek}u × {d.weeks} wk
            </span>
          ) : null}
          {d.note ? <span> · {d.note}</span> : null}
        </p>
      ) : null}

      {editing ? (
        <div className="kans-deal">
          <div className="kans-deal__grid">
            <label>
              <span>Marge €/uur</span>
              <input type="number" min={0} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
            </label>
            <label>
              <span>Uren/week</span>
              <input type="number" min={0} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
            <label>
              <span>Looptijd (weken)</span>
              <input type="number" min={0} inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            </label>
            <div className="kans-deal__total">
              <span>Dealwaarde</span>
              <strong>{total ? eur(total) : "—"}</strong>
            </div>
          </div>
          <label className="kans-deal__note">
            <span>Kandidaat / notitie</span>
            <input
              type="text"
              maxLength={300}
              value={note}
              placeholder="Bijv. Jan de Vries · start 1 dec"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="kans-detail__chips">
            <button type="button" disabled={busy} className="btn-ink btn-tool" onClick={() => void saveWon()}>
              {busy ? "Opslaan…" : row.stage === "won" ? "Deal bijwerken" : "Opslaan als gewonnen"}
            </button>
            <button type="button" className="btn-ghost btn-tool" onClick={() => setEditing(false)}>
              Annuleer
            </button>
          </div>
        </div>
      ) : (
        <div className="kans-detail__chips">
          {row.stage !== "outreach" && row.stage !== "won" && row.stage !== "lost" ? (
            <button
              type="button"
              disabled={busy}
              className="ws-chip"
              title="Bericht verstuurd of gebeld — telt mee in je conversie."
              onClick={() => void onStage("outreach")}
            >
              ✓ Gecontacteerd
            </button>
          ) : null}
          {row.stage !== "won" && row.stage !== "lost" ? (
            <button
              type="button"
              disabled={busy}
              className="ws-chip kans-outcome__win"
              onClick={() => setEditing(true)}
            >
              Gewonnen…
            </button>
          ) : null}
          {row.stage === "won" ? (
            <button type="button" disabled={busy} className="ws-chip" onClick={() => setEditing(true)}>
              Wijzig deal
            </button>
          ) : null}
          {row.stage !== "lost" && row.stage !== "won" ? (
            <button type="button" disabled={busy} className="ws-chip" onClick={() => void onStage("lost")}>
              Afgelegd
            </button>
          ) : null}
          {row.stage === "won" || row.stage === "lost" ? (
            <button
              type="button"
              disabled={busy}
              className="ws-chip"
              onClick={() => void onStage(d?.contactedAt ? "outreach" : backStage)}
            >
              {d?.contactedAt ? "Terug naar gecontacteerd" : "Terug naar werkbak"}
            </button>
          ) : row.stage === "outreach" ? (
            <button type="button" disabled={busy} className="ws-chip" onClick={() => void onStage(backStage)}>
              Toch niet gecontacteerd
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
