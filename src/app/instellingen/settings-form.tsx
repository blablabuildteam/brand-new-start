"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
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

export default function SettingsForm() {
  const [hunt, setHunt] = useState<SettingsPayload | null>(null);
  const [rolesText, setRolesText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newBureau, setNewBureau] = useState("");
  const [newRecruiter, setNewRecruiter] = useState<Record<string, string>>({});

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
              hint="Zet bureaus aan/uit, voeg er zelf toe, en vink direct de recruiters aan die je volgt."
            >
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

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() =>
                    updateAgencies(
                      hunt.agencies.map((a) => ({
                        ...a,
                        enabled: true,
                        recruiters: a.recruiters.map((r) => ({ ...r, enabled: true })),
                      }))
                    )
                  }
                >
                  Alles aan
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() =>
                    updateAgencies(
                      hunt.agencies.map((a) => ({
                        ...a,
                        enabled: false,
                        recruiters: a.recruiters.map((r) => ({ ...r, enabled: false })),
                      }))
                    )
                  }
                >
                  Alles uit
                </button>
              </div>

              <div className="space-y-3">
                {hunt.agencies.map((a) => (
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
                          {a.note ? (
                            <span className="mt-0.5 block text-[0.72rem] text-[var(--muted)]">{a.note}</span>
                          ) : (
                            <span className="mt-0.5 block text-[0.72rem] text-[var(--muted)]">
                              {a.recruiters.filter((r) => r.enabled).length}/{a.recruiters.length}{" "}
                              recruiters aan
                              {a.custom ? " · zelf toegevoegd" : ""}
                            </span>
                          )}
                        </span>
                      </label>
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

                    {a.enabled ? (
                      <div className="mt-3 space-y-2 border-t border-[var(--line)]/70 pt-3">
                        {a.recruiters.map((r) => (
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
                            placeholder="Recruiter toevoegen…"
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
                ))}
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
