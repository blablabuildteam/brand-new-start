"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DEFAULT_ROLES,
  slugAgencyId,
  type EmploymentKind,
  type ManagedAgency,
  type ManagedRecruiter,
} from "@/lib/hunt";
import type { BenchPerson, Domain } from "@/lib/bench";
import { ROLE_FAMILIES, type RoleFamily } from "@/lib/niche";

type SettingsPayload = {
  name: string;
  market: string;
  roles: string[];
  requireContract: boolean;
  employmentKinds: EmploymentKind[];
  agencies: ManagedAgency[];
  bench?: BenchPerson[];
  catalog: {
    employmentKinds: { id: EmploymentKind; label: string; hint: string }[];
  };
  integrations?: {
    database: boolean;
    anthropic: boolean;
    apify: boolean;
    lusha: boolean;
    firecrawl: boolean;
  };
};

type FoundPerson = { name: string; title: string | null; url: string | null };

function Section({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`ws-panel h-full px-4 py-4 ${id ? "scroll-mt-24" : ""}`}>
      <p className="ws-label">{title}</p>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--muted)]">{hint}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function toggleKind(list: EmploymentKind[], id: EmploymentKind): EmploymentKind[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function matchesQuery(q: string, ...parts: (string | undefined | null)[]) {
  if (!q) return true;
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

export default function SettingsForm() {
  const [hunt, setHunt] = useState<SettingsPayload | null>(null);
  const [rolesText, setRolesText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newBureau, setNewBureau] = useState("");
  const [newRecruiter, setNewRecruiter] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [findBusy, setFindBusy] = useState<string | null>(null);
  const [found, setFound] = useState<Record<string, FoundPerson[]>>({});
  const [findMsg, setFindMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login?next=/instellingen";
          return null;
        }
        return r.json();
      })
      .then((j: SettingsPayload | null) => {
        if (!j?.agencies || !j.catalog) return;
        setHunt(j);
        setRolesText(j.roles.join("\n"));
      });
  }, []);

  useEffect(() => {
    if (!hunt) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#volgen") return;
    const el = document.getElementById("volgen");
    if (!el) return;
    // Only once — not on every checkbox/setHunt (that caused scroll jumps).
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hunt ? "ready" : ""]);

  const q = query.trim().toLowerCase();

  const flatRecruiters = useMemo(() => {
    if (!hunt) return [];
    return hunt.agencies.flatMap((a) =>
      a.recruiters.map((r) => ({
        agencyId: a.id,
        agencyName: a.name,
        agencyEnabled: a.enabled,
        recruiter: r,
      }))
    );
  }, [hunt]);

  const filteredFlat = useMemo(() => {
    if (!q) return [];
    return flatRecruiters.filter((row) =>
      matchesQuery(q, row.recruiter.name, row.recruiter.title, row.recruiter.brand, row.agencyName)
    );
  }, [flatRecruiters, q]);

  const visibleAgencies = useMemo(() => {
    if (!hunt) return [];
    if (!q) return hunt.agencies;
    return hunt.agencies.filter((a) => {
      if (matchesQuery(q, a.name, a.note)) return true;
      return a.recruiters.some((r) => matchesQuery(q, r.name, r.title, r.brand));
    });
  }, [hunt, q]);

  function updateAgencies(next: ManagedAgency[]) {
    if (!hunt) return;
    setHunt({ ...hunt, agencies: next });
  }

  function setAgencyEnabled(id: string, enabled: boolean) {
    if (!hunt) return;
    updateAgencies(hunt.agencies.map((a) => (a.id === id ? { ...a, enabled } : a)));
  }

  function setRecruiterEnabled(agencyId: string, name: string, enabled: boolean) {
    if (!hunt) return;
    updateAgencies(
      hunt.agencies.map((a) =>
        a.id !== agencyId
          ? a
          : {
              ...a,
              enabled: enabled ? true : a.enabled,
              recruiters: a.recruiters.map((r) => (r.name === name ? { ...r, enabled } : r)),
            }
      )
    );
  }

  function removeAgency(id: string) {
    if (!hunt) return;
    updateAgencies(hunt.agencies.filter((a) => a.id !== id));
  }

  function removeRecruiter(agencyId: string, name: string) {
    if (!hunt) return;
    updateAgencies(
      hunt.agencies.map((a) =>
        a.id !== agencyId ? a : { ...a, recruiters: a.recruiters.filter((r) => r.name !== name) }
      )
    );
  }

  function addBureau() {
    if (!hunt) return;
    const name = newBureau.trim();
    if (name.length < 2) return;
    if (hunt.agencies.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      setError("Dit bureau staat er al in");
      return;
    }
    const agency: ManagedAgency = {
      id: slugAgencyId(name),
      name,
      aliases: [name.toLowerCase()],
      enabled: true,
      custom: true,
      recruiters: [],
    };
    updateAgencies([agency, ...hunt.agencies]);
    setNewBureau("");
    setError("");
  }

  function addRecruiter(agencyId: string) {
    if (!hunt) return;
    const raw = (newRecruiter[agencyId] || "").trim();
    if (raw.length < 2) return;
    const linkedinMatch = raw.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
    const linkedinUrl = linkedinMatch
      ? `https://www.linkedin.com/in/${decodeURIComponent(linkedinMatch[1]).replace(/\/+$/, "")}`
      : undefined;
    const name = linkedinUrl
      ? decodeURIComponent(linkedinMatch![1]).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : raw;
    if (name.length < 2) return;
    updateAgencies(
      hunt.agencies.map((a) => {
        if (a.id !== agencyId) return a;
        if (a.recruiters.some((r) => r.name.toLowerCase() === name.toLowerCase())) return a;
        const rec: ManagedRecruiter = {
          name,
          enabled: true,
          ...(linkedinUrl ? { linkedinUrl } : {}),
        };
        return { ...a, recruiters: [...a.recruiters, rec], enabled: true };
      })
    );
    setNewRecruiter((prev) => ({ ...prev, [agencyId]: "" }));
  }

  function mergeFound(agencyId: string, people: FoundPerson[]) {
    if (!hunt) return;
    updateAgencies(
      hunt.agencies.map((a) => {
        if (a.id !== agencyId) return a;
        const existing = new Set(a.recruiters.map((r) => r.name.toLowerCase()));
        const extra: ManagedRecruiter[] = people
          .filter((p) => p.name && !existing.has(p.name.toLowerCase()))
          .map((p) => ({
            name: p.name,
            title: p.title || undefined,
            linkedinUrl: p.url || undefined,
            enabled: true,
          }));
        return {
          ...a,
          enabled: true,
          recruiters: [...a.recruiters, ...extra],
        };
      })
    );
    setFound((prev) => ({ ...prev, [agencyId]: [] }));
  }

  async function findRecruiters(agencyId: string) {
    setFindBusy(agencyId);
    setFindMsg((prev) => ({ ...prev, [agencyId]: "" }));
    setError("");
    try {
      const res = await fetch("/api/settings/recruiters-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        people?: FoundPerson[];
      };
      if (!res.ok || j.error) {
        setFindMsg((prev) => ({ ...prev, [agencyId]: j.error || "Zoeken mislukt" }));
        setFound((prev) => ({ ...prev, [agencyId]: j.people || [] }));
        return;
      }
      const people = j.people || [];
      setFound((prev) => ({ ...prev, [agencyId]: people }));
      setFindMsg((prev) => ({
        ...prev,
        [agencyId]: people.length
          ? `${people.length} gevonden — voeg toe wie je wilt.`
          : "Geen recruiters gevonden bij dit bureau.",
      }));
    } finally {
      setFindBusy(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hunt) return;
    setError("");
    setSaved(false);
    setBusy(true);
    const roles = rolesText
      .split(/\n|,/)
      .map((r) => r.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: hunt.name,
          market: hunt.market,
          roles,
          requireContract: hunt.requireContract,
          employmentKinds: hunt.employmentKinds,
          agencies: hunt.agencies,
          bench: hunt.bench || [],
        }),
      });
      if (!res.ok) {
        setError("Opslaan mislukt");
        return;
      }
      const next = (await res.json()) as SettingsPayload;
      setHunt((prev) =>
        prev
          ? {
              ...prev,
              ...next,
              agencies: next.agencies || prev.agencies,
              bench: next.bench || prev.bench || [],
              catalog: prev.catalog,
              integrations: prev.integrations,
            }
          : prev
      );
      setRolesText(next.roles.join("\n"));
      setSaved(true);
      const { cacheClear, cacheSet } = await import("@/lib/client-cache");
      cacheClear("settings");
      cacheSet("settings", next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell current="instellingen" title="Instellingen" subtitle="Wat je zoekt en wie je volgt">
      <main className="ws-shell ws-shell--page">
        <details className="ws-fold">
          <summary>
            <span>Wat stel je hier in?</span>
            <span className="ws-fold__meta">Rollen · bureaus · bench</span>
          </summary>
          <div className="ws-fold__body">
            <p className="m-0 text-[0.8rem] leading-relaxed text-[var(--muted)]">
              Toolnaam, functies, soort opdracht, de bureaus/recruiters die je volgt, en jullie
              ZZP-bench voor Voorstel. Recruiter LinkedIn-feeds voeden Via bureau; eindklanten bevestig
              je daarna zelf.
            </p>
          </div>
        </details>

        {hunt?.integrations ? (
          <section className="ws-panel mb-3 px-4 py-3">
            <p className="ws-label">Pilot-klaarheid</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["database", "Database", hunt.integrations.database],
                  ["anthropic", "AI (Claude)", hunt.integrations.anthropic],
                  ["apify", "Apify sync/HM", hunt.integrations.apify],
                  ["lusha", "Lusha mail/tel", hunt.integrations.lusha],
                  ["firecrawl", "Firecrawl", hunt.integrations.firecrawl],
                ] as const
              ).map(([key, label, ok]) => (
                <li
                  key={key}
                  className={`rounded-[calc(var(--radius)-2px)] border px-2.5 py-1 text-[0.72rem] font-medium ${
                    ok
                      ? "border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]"
                      : "border-[var(--warn)]/30 bg-[var(--warn-soft)] text-[var(--warn)]"
                  }`}
                >
                  {ok ? "✓" : "○"} {label}
                </li>
              ))}
            </ul>
            {!hunt.integrations.lusha ? (
              <p className="mt-2 text-[0.75rem] text-[var(--muted)]">
                Zonder Lusha kun je wel LinkedIn openen; mail/tel-enrichment blijft uit tot{" "}
                <code className="text-[0.7rem]">LUSHA_API_KEY</code> op Vercel staat.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="ws-panel mb-3 px-4 py-3">
          <p className="ws-label">Meldingen</p>
          <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[var(--muted)]">
            Nieuwe hits, bevestigde kansen en gevonden hiring managers landen in de{" "}
            <strong className="font-semibold text-[var(--ink)]">bel rechtsboven</strong> (in-app).
            Optioneel ook naar Slack/Discord via <code className="text-[0.7rem]">ALERT_WEBHOOK_URL</code>.
            Mail-alerts (Brevo e.d.) staan nog niet aan — zeg het als je dat wilt.
          </p>
        </section>

        {!hunt ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 pb-2">
            <section className="ws-panel flex flex-wrap items-end gap-3 px-4 py-3">
              <label className="min-w-[12rem] flex-1 text-sm font-medium">
                Toolnaam
                <span className="mt-0.5 block text-[0.72rem] font-normal text-[var(--muted)]">
                  Verschijnt in het menu (nu: {hunt.name || "Recruitment Scout"}).
                </span>
                <input
                  className="ws-input mt-1 max-w-md"
                  value={hunt.name}
                  onChange={(e) => setHunt({ ...hunt, name: e.target.value })}
                />
              </label>
            </section>

            <Section title="Wat je zoekt" hint="Functies en soort opdracht. Sync en radar filteren hierop.">
              <label className="block text-sm font-medium">
                Functies
                <span className="mt-0.5 block text-[0.75rem] font-normal text-[var(--muted)]">
                  Eén functie per regel. Scroll in het vak of sleep de rechteronderhoek groter.
                </span>
                <textarea
                  rows={12}
                  className="ws-textarea ws-textarea--mono ws-textarea--roles mt-1"
                  value={rolesText}
                  onChange={(e) => setRolesText(e.target.value)}
                />
                <span className="mt-1 block text-[0.7rem] text-[var(--muted)]">
                  {rolesText.split("\n").filter((l) => l.trim()).length} zoekopdrachten
                </span>
              </label>
              <div>
                <p className="text-sm font-medium">Soort opdracht</p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                  Wat mag in Sync/Direct? Zet uit wat je niet wilt zien.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {hunt.catalog.employmentKinds.map((k) => (
                    <label
                      key={k.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border px-3 py-2.5 transition ${
                        hunt.employmentKinds.includes(k.id)
                          ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]/35"
                          : "border-[var(--line)] hover:border-[var(--accent)]/25"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                        checked={hunt.employmentKinds.includes(k.id)}
                        onChange={() =>
                          setHunt({
                            ...hunt,
                            employmentKinds: toggleKind(hunt.employmentKinds, k.id),
                          })
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">{k.label}</span>
                        <span className="block text-[0.72rem] text-[var(--muted)]">{k.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <label
                className={`flex items-start gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-sm ${
                  hunt.requireContract
                    ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]/35"
                    : "border-[var(--line)]"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={hunt.requireContract}
                  onChange={(e) => setHunt({ ...hunt, requireContract: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-[var(--ink)]">Alleen contracting</span>
                  <span className="mt-0.5 block text-[0.75rem] text-[var(--muted)]">
                    Filter vaste (permanent) banen eruit — apart van ZZP/interim hierboven.
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)] hover:underline"
                onClick={() => {
                  setHunt({ ...hunt, roles: DEFAULT_ROLES });
                  setRolesText(DEFAULT_ROLES.join("\n"));
                }}
              >
                Standaardfuncties terugzetten
              </button>
            </Section>

            <Section
              id="volgen"
              title="Kantoren & recruiters"
              hint="Recruiters met LinkedIn-URL worden gescand op vacature-/kans-posts (Recruiter-feeds → Via bureau). Zonder URL geen feed-sync."
            >
              <div className="rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-3.5 py-3 text-[0.8rem] leading-relaxed text-[var(--muted)]">
                <p>
                  <strong className="text-[var(--ink)]">Bureau toevoegen:</strong> typ alleen de
                  bureanaam (bijv. Yacht) → <em>Bureau toevoegen</em>. Geen website-URL nodig.
                </p>
                <p className="mt-2">
                  <strong className="text-[var(--ink)]">Recruiter toevoegen:</strong> open het bureau
                  → typ de naam, of plak een LinkedIn-profiel-URL (`linkedin.com/in/…`) →{" "}
                  <em>+ Recruiter</em>. Of klik <em>Zoek recruiters</em> om automatisch LinkedIn-namen
                  op te halen.
                </p>
                <p className="mt-2">
                  Vink aan wie je volgt. Opslaan onderaan. Bevestigde bureau-kansen landen daarna in
                  Kansen.
                </p>
              </div>

              <input
                className="ws-input"
                placeholder="Zoek recruiter of bureau…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Zoek recruiters"
              />

              {q && filteredFlat.length ? (
                <div className="max-h-[40vh] overflow-y-auto overscroll-contain rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-3 py-3">
                  <p className="ws-label mb-2">Zoekresultaten · {filteredFlat.length}</p>
                  <ul className="space-y-2">
                    {filteredFlat.map((row) => (
                      <li key={`${row.agencyId}-${row.recruiter.name}`}>
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                            checked={row.recruiter.enabled && row.agencyEnabled}
                            onChange={(e) =>
                              setRecruiterEnabled(row.agencyId, row.recruiter.name, e.target.checked)
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--ink)]">
                              {row.recruiter.name}
                            </span>
                            <span className="block text-[0.72rem] text-[var(--muted)]">
                              {[row.agencyName, row.recruiter.brand, row.recruiter.title]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {q && !filteredFlat.length ? (
                <p className="text-sm text-[var(--muted)]">Geen recruiters voor “{query}”.</p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="ws-input min-w-0 flex-1"
                  placeholder="Bureanaam, bv. Yacht (geen link)"
                  value={newBureau}
                  onChange={(e) => setNewBureau(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBureau();
                    }
                  }}
                />
                <button type="button" className="btn-ink btn-tool shrink-0" onClick={addBureau}>
                  Bureau toevoegen
                </button>
              </div>

              {!q ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {visibleAgencies.map((a) => {
                  const shownRecruiters = q
                    ? a.recruiters.filter((r) => matchesQuery(q, r.name, r.title, r.brand, a.name))
                    : a.recruiters;
                  const hits = found[a.id] || [];
                  return (
                    <div
                      key={a.id}
                      className={`rounded-[var(--radius)] border px-3 py-3 ${
                        a.enabled
                          ? "border-[var(--line)] bg-[var(--surface-2)]/40"
                          : "border-[var(--line)]/70 bg-[var(--surface-2)] opacity-80"
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-[var(--accent)]"
                            checked={a.enabled}
                            onChange={(e) => setAgencyEnabled(a.id, e.target.checked)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--ink)]">{a.name}</span>
                            <span className="mt-0.5 block text-[0.72rem] text-[var(--muted)]">
                              {a.recruiters.filter((r) => r.enabled).length}/{a.recruiters.length}{" "}
                              recruiters aan
                              {a.custom ? " · zelf toegevoegd" : ""}
                            </span>
                          </span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn-ghost btn-tool"
                            disabled={findBusy === a.id}
                            onClick={() => void findRecruiters(a.id)}
                          >
                            {findBusy === a.id ? "Zoeken…" : "Zoek recruiters"}
                          </button>
                          {a.custom ? (
                            <button
                              type="button"
                              className="btn-ghost btn-tool text-[var(--muted)] hover:text-[var(--warn)]"
                              onClick={() => removeAgency(a.id)}
                            >
                              Verwijderen
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {findMsg[a.id] ? (
                        <p className="mt-2 text-[0.75rem] text-[var(--muted)]">{findMsg[a.id]}</p>
                      ) : null}

                      {hits.length ? (
                        <div className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[0.72rem] font-semibold text-[var(--ink)]">
                              Gevonden op LinkedIn
                            </p>
                            <button
                              type="button"
                              className="text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
                              onClick={() => mergeFound(a.id, hits)}
                            >
                              Alles toevoegen
                            </button>
                          </div>
                          <ul className="space-y-2">
                            {hits.map((p) => {
                              const already = a.recruiters.some(
                                (r) => r.name.toLowerCase() === p.name.toLowerCase()
                              );
                              return (
                                <li key={p.url || p.name} className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="block text-[0.85rem] font-medium text-[var(--ink)]">
                                      {p.name}
                                    </span>
                                    {p.title ? (
                                      <span className="block text-[0.7rem] text-[var(--muted)]">{p.title}</span>
                                    ) : null}
                                  </span>
                                  {already ? (
                                    <span className="shrink-0 text-[0.7rem] text-[var(--muted)]">staat erin</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="shrink-0 text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
                                      onClick={() => mergeFound(a.id, [p])}
                                    >
                                      Toevoegen
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {a.enabled ? (
                        <div className="mt-3 space-y-2 border-t border-[var(--line)]/70 pt-3">
                          {shownRecruiters.map((r) => (
                            <div key={`${a.id}-${r.name}`} className="flex items-start gap-2 pl-1">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                                  checked={r.enabled}
                                  onChange={(e) => setRecruiterEnabled(a.id, r.name, e.target.checked)}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[0.85rem] font-medium text-[var(--ink)]">
                                    {r.name}
                                  </span>
                                  {[r.brand, r.title].filter(Boolean).length ? (
                                    <span className="block text-[0.7rem] text-[var(--muted)]">
                                      {[r.brand, r.title].filter(Boolean).join(" · ")}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                              <button
                                type="button"
                                className="btn-ghost btn-tool !min-h-10 !w-10 !px-0 text-base text-[var(--muted)] hover:text-[var(--warn)]"
                                onClick={() => removeRecruiter(a.id, r.name)}
                                aria-label={`${r.name} verwijderen`}
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                            <input
                              className="ws-input min-w-0 flex-1 bg-[var(--surface-2)]"
                              placeholder="Naam of LinkedIn-URL (linkedin.com/in/…)"
                              value={newRecruiter[a.id] || ""}
                              onChange={(e) =>
                                setNewRecruiter((prev) => ({ ...prev, [a.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addRecruiter(a.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn-ghost btn-tool shrink-0"
                              onClick={() => addRecruiter(a.id)}
                            >
                              + Recruiter
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              ) : null}
            </Section>

            <Section
              id="bench"
              title="Bench (ZZP’ers)"
              hint="Jullie echte mensen voor Voorstel. Geen fictieve namen meer — shortlist komt alleen uit deze lijst."
            >
              <ul className="space-y-3">
                {(hunt.bench || []).map((p, idx) => (
                  <li key={p.id} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {p.name || "Naamloos"}
                        {p.title ? <span className="font-normal text-[var(--muted)]"> · {p.title}</span> : null}
                      </p>
                      <button
                        type="button"
                        className="text-[0.72rem] font-semibold text-[var(--warn)] hover:underline"
                        onClick={() =>
                          setHunt({
                            ...hunt,
                            bench: (hunt.bench || []).filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Verwijder
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Naam
                        <input
                          className="ws-input mt-0.5"
                          value={p.name}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, name: e.target.value };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Titel
                        <input
                          className="ws-input mt-0.5"
                          value={p.title}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, title: e.target.value };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Familie
                        <select
                          className="ws-input mt-0.5"
                          value={p.family}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, family: e.target.value as RoleFamily };
                            setHunt({ ...hunt, bench });
                          }}
                        >
                          {ROLE_FAMILIES.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Stad
                        <input
                          className="ws-input mt-0.5"
                          value={p.city}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, city: e.target.value };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Tarief €/u
                        <input
                          type="number"
                          className="ws-input mt-0.5"
                          value={p.rate}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, rate: Number(e.target.value) || 0 };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
                        Beschikbaar
                        <select
                          className="ws-input mt-0.5"
                          value={p.available}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = {
                              ...p,
                              available: e.target.value as BenchPerson["available"],
                            };
                            setHunt({ ...hunt, bench });
                          }}
                        >
                          <option value="nu">Nu</option>
                          <option value="2w">±2 weken</option>
                          <option value="1m">±1 maand</option>
                        </select>
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)] sm:col-span-2">
                        Stack (komma’s)
                        <input
                          className="ws-input mt-0.5"
                          value={p.stack.join(", ")}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = {
                              ...p,
                              stack: e.target.value
                                .split(/[,;]/)
                                .map((s) => s.trim())
                                .filter(Boolean),
                            };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)] sm:col-span-2">
                        LinkedIn-URL (optioneel)
                        <input
                          className="ws-input mt-0.5"
                          value={p.linkedinUrl || ""}
                          placeholder="https://www.linkedin.com/in/…"
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, linkedinUrl: e.target.value || undefined };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <label className="block text-[0.72rem] font-medium text-[var(--muted)] sm:col-span-2">
                        Laatste opdracht
                        <input
                          className="ws-input mt-0.5"
                          value={p.last}
                          onChange={(e) => {
                            const bench = [...(hunt.bench || [])];
                            bench[idx] = { ...p, last: e.target.value };
                            setHunt({ ...hunt, bench });
                          }}
                        />
                      </label>
                      <fieldset className="sm:col-span-2">
                        <legend className="text-[0.72rem] font-medium text-[var(--muted)]">Domeinen</legend>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(["overheid", "finance", "zorg", "logistiek", "energie", "tech"] as Domain[]).map(
                            (d) => {
                              const on = p.domains.includes(d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  className={`ws-chip !py-1 ${on ? "ws-chip--on" : ""}`}
                                  onClick={() => {
                                    const bench = [...(hunt.bench || [])];
                                    bench[idx] = {
                                      ...p,
                                      domains: on
                                        ? p.domains.filter((x) => x !== d)
                                        : [...p.domains, d],
                                    };
                                    setHunt({ ...hunt, bench });
                                  }}
                                >
                                  {d}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </fieldset>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-ghost btn-tool"
                onClick={() =>
                  setHunt({
                    ...hunt,
                    bench: [
                      ...(hunt.bench || []),
                      {
                        id: `bp_${Date.now().toString(36)}`,
                        name: "",
                        title: "",
                        family: "ba-pm",
                        city: "Nederland",
                        rate: 90,
                        available: "nu",
                        zzpYears: 5,
                        stack: [],
                        domains: ["tech"],
                        last: "",
                        highlights: [],
                      },
                    ],
                  })
                }
              >
                + ZZP’er toevoegen
              </button>
            </Section>

            {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
            {saved ? (
              <p className="text-sm text-[var(--green)]">
                Opgeslagen. Via bureau volgt wie je hier aanzet.
              </p>
            ) : null}

            <div className="sticky bottom-[var(--mobile-nav-pad)] z-10 -mx-5 border-t border-[var(--line)] bg-[var(--bg)]/95 px-5 py-3 backdrop-blur md:static md:bottom-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
              <button type="submit" disabled={busy} className="btn-ink btn-tool w-full disabled:opacity-50 sm:w-auto">
                {busy ? "Opslaan…" : "Instellingen opslaan"}
              </button>
            </div>
          </form>
        )}
      </main>
    </AppShell>
  );
}
