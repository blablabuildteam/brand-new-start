"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ScoreChip } from "@/components/score-chip";
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
  demoOpening?: boolean;
  sampleBench?: boolean;
  /** Bureau-confirmed client without a Radar row — uses the bureau HM endpoint. */
  bureauLane?: boolean;
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

function defaultTab(): "hm" {
  return "hm";
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
  const [lushaBusy, setLushaBusy] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [q, setQ] = useState("");

  useEffect(() => {
    import("@/lib/client-cache").then(({ cachedJson }) =>
      cachedJson<{ items: DeskItem[] }>("placement", "/api/placement", {
        ttlMs: 45_000,
        staleMs: 5 * 60_000,
        onUpdate: (j) => setItems(j.items),
      })
        .then((j) => {
          setItems(j.items);
          setError(null);
        })
        .catch((e: unknown) => {
          const status = (e as { status?: number }).status;
          if (status === 401) window.location.href = "/login?next=/regie";
          else setError(e instanceof Error ? e.message : "fout");
        })
        .finally(() => setLoading(false))
    );
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
  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items;
    return items.filter((i) =>
      `${i.company} ${i.title} ${i.roleLabel}`.toLowerCase().includes(n)
    );
  }, [items, q]);
  const groups = useMemo(() => groupRail(visible), [visible]);

  useEffect(() => {
    setTab(defaultTab());
    setHuntErr("");
  }, [item?.openingId]);

  useEffect(() => {
    if (!initialId) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePane("detail");
    }
  }, [initialId]);

  useEffect(() => {
    if (!proposal) return;
    setDraft(tab === "hm" ? proposal.hmMessage : proposal.candidateMessages.find((m) => m.id === tab)?.body || "");
  }, [proposal, tab]);

  function select(companyId: string, oid: string) {
    setSel({ companyId, openingId: oid });
    writeUrl(companyId, oid);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePane("detail");
    }
  }

  async function huntHm(force = false) {
    if (!item) return;
    setHuntBusy(true);
    setHuntErr("");
    try {
      // Bureau-lane items have no Radar opening — /api/hm-search would 404 on
      // their crm_bureau_* id, so they go through the CRM-aware endpoint.
      const res = item.bureauLane
        ? await fetch("/api/leads/hm-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crmId: item.companyId, force }),
          })
        : await fetch("/api/hm-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: item.companyId, openingId: item.openingId, force }),
          });
      const data = (await res.json()) as {
        error?: string;
        empty?: boolean;
        detail?: string;
        targets?: ApproachTarget[];
        hiringManager?: string | null;
        hiringManagerTitle?: string | null;
        hiringManagerUrl?: string | null;
        hits?: { name: string; title: string | null; url: string | null }[];
      };
      if (item.bureauLane && res.ok && !data.targets && data.hiringManager) {
        data.targets = [
          {
            kind: "person",
            cta: "bericht",
            label: data.hiringManager,
            subtitle: data.hiringManagerTitle || null,
            url: data.hiringManagerUrl || "",
          } as ApproachTarget,
          ...(data.hits || []).slice(1).map(
            (h) =>
              ({
                kind: "person",
                cta: "bericht",
                label: h.name,
                subtitle: h.title,
                url: h.url || "",
              }) as ApproachTarget
          ),
        ];
      }
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

  async function enrich(linkedinUrl: string) {
    if (!item || item.companyId === "demo") return;
    setLushaBusy(linkedinUrl);
    setHuntErr("");
    try {
      const res = await fetch("/api/lusha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: item.companyId,
          openingId: item.openingId,
          linkedinUrl,
        }),
      });
      const data = (await res.json()) as { error?: string; detail?: string; targets?: ApproachTarget[] };
      if (!res.ok) {
        throw new Error(
          data.detail === "no-lusha-key" || data.error?.includes("LUSHA_API_KEY")
            ? "Geen Lusha-key — zet LUSHA_API_KEY in Vercel."
            : data.error || "Lusha mislukt"
        );
      }
      if (data.targets?.length) {
        const openingId = item.openingId;
        const companyId = item.companyId;
        setItems((rows) =>
          rows.map((r) =>
            r.openingId === openingId && r.companyId === companyId
              ? { ...r, proposal: { ...r.proposal, hiring: data.targets! } }
              : r
          )
        );
      }
    } catch (e) {
      setHuntErr(e instanceof Error ? e.message : "Lusha mislukt");
    } finally {
      setLushaBusy("");
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
    <AppShell current="voorstel" title="Bericht" subtitle="Alleen naar de hiring manager. Jij verstuurt." fill>
      <div className="ws-shell ws-shell--split ws-shell--split-wide">
        <details className={`ws-fold lg:col-span-2 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}>
          <summary>
            <span>Wat is dit?</span>
            <span className="ws-fold__meta">Bericht naar de hiring manager</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Hier staat het <strong className="font-semibold text-[var(--ink)]">bericht aan de hiring manager</strong>.
              Niets gaat automatisch — jij kopieert en stuurt via LinkedIn of mail. Berichten naar kandidaten komen
              later, niet in dit scherm.
            </p>
            <ol className="ws-fold__steps">
              <li>
                <span className="ws-fold__n">1</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Kies opening</strong> — uit Jobboards of een
                  bevestigde kans op{" "}
                  <Link href="/kansen" className="font-semibold text-[var(--ink)] underline underline-offset-2">
                    Kansen
                  </Link>
                  .
                </span>
              </li>
              <li>
                <span className="ws-fold__n">2</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Kies de manager</strong> — naam, mail en
                  LinkedIn staan hier. Zoek ze als ze er nog niet zijn.
                </span>
              </li>
              <li>
                <span className="ws-fold__n">3</span>
                <span>
                  <strong className="font-semibold text-[var(--ink)]">Kopieer & stuur</strong> — tekst klaarzetten,
                  jij plakt het in LinkedIn of mail.
                </span>
              </li>
            </ol>
          </div>
        </details>
        <aside
          className={`radar-scroll-pane min-h-0 max-lg:flex-1 ${mobilePane === "detail" ? "max-lg:hidden" : ""}`}
        >
          <div className="radar-scroll-pane__head">
            <p className="ws-label">Openingen</p>
            <p className="tabular-nums text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
              {visible.length || 0}
            </p>
          </div>
          <div className="px-2 pb-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter bedrijf of rol…"
              className="w-full rounded-[calc(var(--radius)-2px)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem] outline-none focus:border-[var(--accent)]"
              aria-label="Filter openingen"
            />
          </div>
          <div className="radar-scroll-pane__body !px-1.5">
            {groups.map((g) => {
              const companyActive = item?.companyId === g.companyId;
              return (
                <div key={g.companyId} className="mb-3 last:mb-0">
                  <p className="px-2 pb-1 pt-1 text-[0.7rem] font-semibold text-[var(--ink)]">
                    {g.company}
                    {g.openings.some((o) => o.bureauLane) ? (
                      <span className="ml-1.5 font-medium text-[var(--muted)]">· bureau</span>
                    ) : null}
                  </p>
                  <ul className="space-y-0.5">
                    {g.openings.map((r) => {
                      const active = item?.openingId === r.openingId && companyActive;
                      return (
                        <li key={r.openingId}>
                          <button
                            type="button"
                            onClick={() => select(r.companyId, r.openingId)}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-full min-h-10 items-center gap-2 rounded-[var(--radius)] border px-2.5 py-2 text-left transition lg:min-h-0 lg:py-1.5 ${
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

        <main className={`ws-main ${mobilePane === "list" ? "max-lg:hidden" : ""}`}>
          {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
          {loading || !item || !proposal ? (
            <p className="text-sm text-[var(--muted)]">Laden…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                className="btn-ghost btn-tool self-start lg:hidden"
                onClick={() => setMobilePane("list")}
              >
                ← Openingen
              </button>
              <section className="ws-panel px-4 py-4">
                <p className="ws-label">{item.company}</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ fontFamily: "var(--display)" }}>
                      {item.title}
                    </h1>
                    {item.roleLabel && item.roleLabel !== item.title ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.roleLabel}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ScoreChip kans={item.kans} large />
                  </div>
                </div>
              </section>

              <section className="ws-panel">
                <div className="border-b border-[var(--line)]/80 px-4 py-2.5">
                  <p className="ws-label">Hiring manager</p>
                </div>
                {proposal.hiring.slice(0, 3).map((t) => {
                  const named = t.kind === "person" && t.cta === "bericht";
                  const recruiter = /recruiter/i.test(t.subtitle || "");
                  return (
                    <div
                      key={`${t.kind}-${t.label}`}
                      className="flex flex-col gap-3 border-t border-[var(--line)]/70 px-4 py-4 first:border-t-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius)] bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                          {named ? initials(t.label) : "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--ink)]">{t.label}</span>
                          {t.subtitle ? (
                            <span className="block text-[0.78rem] text-[var(--muted)]">{t.subtitle}</span>
                          ) : null}
                          {t.email ? (
                            <span className="block break-all text-[0.72rem] text-[var(--muted)]">{t.email}</span>
                          ) : null}
                          {t.phone ? (
                            <span className="block text-[0.72rem] text-[var(--muted)]">{t.phone}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {named && !recruiter && t.email ? (
                          <a
                            href={`mailto:${t.email}`}
                            className="btn-ghost btn-tool no-underline"
                          >
                            Mail
                          </a>
                        ) : null}
                        {named && !recruiter && t.phone ? (
                          <a
                            href={`tel:${t.phone}`}
                            className="btn-ghost btn-tool no-underline"
                          >
                            Bel
                          </a>
                        ) : null}
                        {named &&
                        !recruiter &&
                        !t.email &&
                        !t.phone &&
                        /linkedin\.com\/in\//i.test(t.url) &&
                        t.lushaStatus !== "empty" &&
                        t.lushaStatus !== "restricted" ? (
                          <button
                            type="button"
                            disabled={Boolean(lushaBusy)}
                            onClick={() => void enrich(t.url)}
                            className="btn-ghost btn-tool disabled:opacity-50"
                          >
                            {lushaBusy === t.url ? "Lusha…" : "Mail/tel"}
                          </button>
                        ) : null}
                        {named && !recruiter ? (
                          <button
                            type="button"
                            onClick={() => setTab("hm")}
                            className={tab === "hm" ? "btn-ink btn-tool" : "btn-ghost btn-tool"}
                          >
                            Bericht
                          </button>
                        ) : null}
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost btn-tool no-underline"
                        >
                          {named ? (recruiter ? "Vraag op LinkedIn" : "LinkedIn") : "Vind op LinkedIn"}
                        </a>
                      </div>
                    </div>
                  );
                })}
                {!known && item.companyId !== "demo" ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)]/70 px-4 py-3">
                    <button
                      type="button"
                      disabled={huntBusy}
                      onClick={() => void huntHm(false)}
                      className="btn-ghost btn-tool disabled:opacity-50"
                    >
                      {huntBusy ? "Zoeken…" : "Zoek 3 namen"}
                    </button>
                    <p className="text-[0.72rem] text-[var(--muted)]">
                      {huntErr || "Alleen mensen die nu bij dit bedrijf werken · ≈ €0,10"}
                    </p>
                  </div>
                ) : known && item.hmSearched && item.companyId !== "demo" ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)]/70 px-4 py-3">
                    <button
                      type="button"
                      disabled={huntBusy}
                      onClick={() => void huntHm(true)}
                      className="btn-ghost btn-tool disabled:opacity-50"
                    >
                      {huntBusy ? "Zoeken…" : "Opnieuw zoeken"}
                    </button>
                    <p className="text-[0.72rem] text-[var(--muted)]">{huntErr || "≈ €0,10"}</p>
                  </div>
                ) : null}
              </section>

              <section className="ws-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/80 px-4 py-2.5">
                  <p className="ws-label">Bericht aan de hiring manager</p>
                </div>
                <div className="px-4 py-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={8}
                    className="ws-textarea bg-[var(--surface-2)]"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyDraft}
                      className="btn-ink btn-tool"
                    >
                      {copied ? "Gekopieerd" : "Kopieer"}
                    </button>
                    {linkedInUrl ? (
                      <a
                        href={linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost btn-tool no-underline"
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
    </AppShell>
  );
}
