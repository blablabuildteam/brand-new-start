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

type SettingsPayload = {
  name: string;
  market: string;
  roles: string[];
  requireContract: boolean;
  employmentKinds: EmploymentKind[];
  agencies: ManagedAgency[];
  catalog: {
    employmentKinds: { id: EmploymentKind; label: string; hint: string }[];
  };
};

type FoundPerson = { name: string; title: string | null; url: string | null };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="ws-panel px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
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
    const name = (newRecruiter[agencyId] || "").trim();
    if (name.length < 2) return;
    updateAgencies(
      hunt.agencies.map((a) => {
        if (a.id !== agencyId) return a;
        if (a.recruiters.some((r) => r.name.toLowerCase() === name.toLowerCase())) return a;
        const rec: ManagedRecruiter = { name, enabled: true };
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
              catalog: prev.catalog,
            }
          : prev
      );
      setRolesText(next.roles.join("\n"));
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell current="instellingen" title="Instellingen" subtitle="Wat je zoekt en wie je volgt">
      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 sm:px-6 md:px-7 md:py-8">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Stuur de desk met functies, soort opdracht, en de bureaus/recruiters die je volgt.
          Eindklanten komen vanzelf uit de radar — die vink je niet handmatig aan.
        </p>

        {!hunt ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4 pb-8">
            <Section title="Werkruimte" hint="Naam en regio van deze desk.">
              <label className="block text-sm font-medium">
                Desknaam
                <input
                  className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                  value={hunt.name}
                  onChange={(e) => setHunt({ ...hunt, name: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Regio
                <input
                  className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                  value={hunt.market}
                  onChange={(e) => setHunt({ ...hunt, market: e.target.value })}
                  placeholder="Nederland"
                />
              </label>
            </Section>

            <Section title="Wat je zoekt" hint="Functies en soort opdracht. Sync en radar filteren hierop.">
              <label className="block text-sm font-medium">
                Functies
                <span className="mt-0.5 block text-[0.75rem] font-normal text-[var(--muted)]">
                  Eén functie per regel — dit worden je zoekopdrachten.
                </span>
                <textarea
                  rows={10}
                  className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm"
                  value={rolesText}
                  onChange={(e) => setRolesText(e.target.value)}
                />
              </label>
              <div>
                <p className="text-sm font-medium">Soort opdracht</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {hunt.catalog.employmentKinds.map((k) => (
                    <label
                      key={k.id}
                      className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] px-3 py-2.5 hover:border-[var(--accent)]/25"
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
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={hunt.requireContract}
                  onChange={(e) => setHunt({ ...hunt, requireContract: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-[var(--ink)]">Alleen contracting</span>
                  <span className="mt-0.5 block text-[0.75rem] text-[var(--muted)]">
                    Vaste banen uitfilteren.
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
              title="Bureaus & recruiters"
              hint="Zoek in je lijst, haal recruiters op bij een bureau, en vink aan wie je volgt."
            >
              <input
                className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm"
                placeholder="Zoek recruiter of bureau…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Zoek recruiters"
              />

              {q && filteredFlat.length ? (
                <div className="rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-3 py-3">
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
                  className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm"
                  placeholder="Nieuw bureau, bv. Yacht"
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

              <div className="space-y-3">
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
                          ? "border-[var(--line)] bg-[var(--surface)]"
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
                              className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--warn)]"
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
                                className="shrink-0 text-[0.7rem] text-[var(--muted)] hover:text-[var(--warn)]"
                                onClick={() => removeRecruiter(a.id, r.name)}
                                aria-label={`${r.name} verwijderen`}
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                            <input
                              className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2 text-sm"
                              placeholder="Recruiter handmatig…"
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
            </Section>

            {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
            {saved ? (
              <p className="text-sm text-[var(--green)]">
                Opgeslagen. Bureaus volgt wie je hier aanzet.
              </p>
            ) : null}

            <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
              <button type="submit" disabled={busy} className="btn-ink btn-tool disabled:opacity-50">
                {busy ? "Opslaan…" : "Instellingen opslaan"}
              </button>
            </div>
          </form>
        )}
      </main>
    </AppShell>
  );
}
