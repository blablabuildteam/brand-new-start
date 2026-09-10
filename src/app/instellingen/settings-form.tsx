"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_ROLES, type EmploymentKind, type HuntSettings } from "@/lib/hunt";

type CatalogAgency = {
  id: string;
  name: string;
  note?: string;
  recruiters: { id: string; name: string; title?: string; brand?: string }[];
};

type CatalogCompany = {
  id: string;
  name: string;
  label: string;
  sector?: string;
};

type Catalog = {
  employmentKinds: { id: EmploymentKind; label: string; hint: string }[];
  agencies: CatalogAgency[];
  companies: CatalogCompany[];
};

type SettingsPayload = HuntSettings & {
  agencyIds: string[];
  recruiterIds: string[];
  companyIds: string[];
  catalog: Catalog;
};

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

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

function CheckRow({
  checked,
  onChange,
  title,
  subtitle,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 hover:border-[var(--accent)]/25">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--ink)]">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-[0.72rem] leading-snug text-[var(--muted)]">{subtitle}</span> : null}
      </span>
    </label>
  );
}

export default function SettingsForm() {
  const [hunt, setHunt] = useState<SettingsPayload | null>(null);
  const [rolesText, setRolesText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        if (!j?.catalog) return;
        setHunt(j);
        setRolesText(j.roles.join("\n"));
      });
  }, []);

  const selectedAgencies = useMemo(() => new Set(hunt?.agencyIds || []), [hunt?.agencyIds]);
  const selectedRecruiters = useMemo(() => new Set(hunt?.recruiterIds || []), [hunt?.recruiterIds]);
  const selectedCompanies = useMemo(() => new Set(hunt?.companyIds || []), [hunt?.companyIds]);
  const selectedKinds = useMemo(() => new Set(hunt?.employmentKinds || []), [hunt?.employmentKinds]);

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
          agencyIds: hunt.agencyIds,
          recruiterIds: hunt.recruiterIds,
          companyIds: hunt.companyIds,
        }),
      });
      if (!res.ok) {
        setError("Opslaan mislukt");
        return;
      }
      const next = (await res.json()) as SettingsPayload;
      setHunt((prev) => (prev ? { ...prev, ...next, catalog: prev.catalog } : prev));
      setRolesText(next.roles.join("\n"));
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  function setAgency(id: string, on: boolean) {
    if (!hunt) return;
    const agencyIds = on ? [...new Set([...hunt.agencyIds, id])] : hunt.agencyIds.filter((x) => x !== id);
    let recruiterIds = hunt.recruiterIds;
    const agency = hunt.catalog.agencies.find((a) => a.id === id);
    if (!on && agency) {
      const drop = new Set(agency.recruiters.map((r) => r.id));
      recruiterIds = recruiterIds.filter((r) => !drop.has(r));
    }
    if (on && agency) {
      recruiterIds = [...new Set([...recruiterIds, ...agency.recruiters.map((r) => r.id)])];
    }
    setHunt({ ...hunt, agencyIds, recruiterIds });
  }

  return (
    <AppShell current="instellingen" title="Instellingen" subtitle="Wat je zoekt en wie je volgt" fill={false}>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 sm:px-6 md:px-7 md:py-8">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Hier stuur je de desk: welke functies en soorten opdrachten je wilt, welke bureaus en
          recruiters je volgt, en welke eindklanten op de radar mogen.
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

            <Section
              title="Wat je zoekt"
              hint="Functies en soort opdracht. Sync en radar filteren hierop."
            >
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
                <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">Meerdere mogelijk.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {hunt.catalog.employmentKinds.map((k) => (
                    <CheckRow
                      key={k.id}
                      checked={selectedKinds.has(k.id)}
                      title={k.label}
                      subtitle={k.hint}
                      onChange={() =>
                        setHunt({
                          ...hunt,
                          employmentKinds: toggleId(hunt.employmentKinds, k.id) as EmploymentKind[],
                        })
                      }
                    />
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
                    Vaste banen uitfilteren — ZZP, interim, contract en detachering blijven over.
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
              title="Bureaus"
              hint="Welke agencies je volgt op Bureaus. Uit = geen leads van dat bureau."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() =>
                    setHunt({
                      ...hunt,
                      agencyIds: hunt.catalog.agencies.map((a) => a.id),
                      recruiterIds: hunt.catalog.agencies.flatMap((a) => a.recruiters.map((r) => r.id)),
                    })
                  }
                >
                  Alles aan
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() => setHunt({ ...hunt, agencyIds: [], recruiterIds: [] })}
                >
                  Alles uit
                </button>
              </div>
              <div className="grid gap-2">
                {hunt.catalog.agencies.map((a) => (
                  <CheckRow
                    key={a.id}
                    checked={selectedAgencies.has(a.id)}
                    title={a.name}
                    subtitle={a.note || `${a.recruiters.length} recruiters`}
                    onChange={() => setAgency(a.id, !selectedAgencies.has(a.id))}
                  />
                ))}
              </div>
            </Section>

            <Section
              title="Recruiters"
              hint="Mensen die je wilt volgen binnen de bureaus hierboven."
            >
              <div className="space-y-4">
                {hunt.catalog.agencies
                  .filter((a) => selectedAgencies.has(a.id))
                  .map((a) => (
                    <div key={a.id}>
                      <p className="ws-label mb-2">{a.name}</p>
                      <div className="grid gap-2">
                        {a.recruiters.map((r) => (
                          <CheckRow
                            key={r.id}
                            checked={selectedRecruiters.has(r.id)}
                            title={r.name}
                            subtitle={[r.brand, r.title].filter(Boolean).join(" · ")}
                            onChange={() =>
                              setHunt({ ...hunt, recruiterIds: toggleId(hunt.recruiterIds, r.id) })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                {!hunt.catalog.agencies.some((a) => selectedAgencies.has(a.id)) ? (
                  <p className="text-sm text-[var(--muted)]">Zet eerst een bureau aan.</p>
                ) : null}
              </div>
            </Section>

            <Section
              title="Eindklanten"
              hint="Bedrijven waarvan we de careers-pagina meenemen bij een sync (directe lane)."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() =>
                    setHunt({ ...hunt, companyIds: hunt.catalog.companies.map((c) => c.id) })
                  }
                >
                  Alles aan
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-tool"
                  onClick={() => setHunt({ ...hunt, companyIds: [] })}
                >
                  Alles uit
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {hunt.catalog.companies.map((c) => (
                  <CheckRow
                    key={c.id}
                    checked={selectedCompanies.has(c.id)}
                    title={c.name}
                    subtitle={[c.sector, c.label].filter(Boolean).join(" · ")}
                    onChange={() =>
                      setHunt({ ...hunt, companyIds: toggleId(hunt.companyIds, c.id) })
                    }
                  />
                ))}
              </div>
            </Section>

            {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
            {saved ? (
              <p className="text-sm text-[var(--green)]">
                Opgeslagen. Volgende sync en Bureaus volgen dit kader.
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
