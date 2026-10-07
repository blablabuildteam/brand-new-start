"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DEFAULT_ROLES,
  parseCompanyInput,
  parseRecruiterInput,
  slugAgencyId,
  type EmploymentKind,
  type ManagedAgency,
  type ManagedRecruiter,
} from "@/lib/hunt";
import type { BenchPerson } from "@/lib/bench";
import { agencyLogoUrls } from "@/lib/company-logo";
import { CompanyMark } from "@/components/company-mark";

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
  user?: { email: string; role?: string };
  /** Bureaus die op jouw rollen sourcen, gezien op Jobboards. */
  suggestions?: AgencySuggestion[];
};

type AgencySuggestion = {
  id: string;
  name: string;
  openings: number;
  roles: string[];
  linkedinUrl: string | null;
};

type FoundPerson = { name: string; title: string | null; url: string | null };

function Section({
  id,
  hint,
  children,
}: {
  id?: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`ws-panel px-4 py-4 ${id ? "scroll-mt-24" : ""}`}>
      <p className="text-[0.8rem] leading-relaxed text-[var(--muted)]">{hint}</p>
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
  const [newRecruiter, setNewRecruiter] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [findBusy, setFindBusy] = useState<string | null>(null);
  const [found, setFound] = useState<Record<string, FoundPerson[]>>({});
  const [findMsg, setFindMsg] = useState<Record<string, string>>({});

  const [settingsTab, setSettingsTab] = useState<"jobboards" | "feed">("jobboards");
  const [newBureauLinkedin, setNewBureauLinkedin] = useState("");
  const [bureauErr, setBureauErr] = useState("");
  const [recruiterErr, setRecruiterErr] = useState<Record<string, string>>({});
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [rejected, setRejected] = useState<{ key: string; name: string; at: string }[]>([]);
  /** Recruiterslijst per bureau: standaard dicht, zodat Vibe niet de pagina opvreet. */
  const [openRecruiters, setOpenRecruiters] = useState<Record<string, boolean>>({});

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
    fetch("/api/radar/reject-company")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rejected?: { key: string; name: string; at: string }[] } | null) => {
        if (j?.rejected) setRejected(j.rejected);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hunt) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "volgen" || hash === "feed") setSettingsTab("feed");
    if (hash === "jobboards") setSettingsTab("jobboards");
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

  /** Suggesties die je nog niet volgt (de lijst komt van de server, zonder refetch). */
  const suggestions = useMemo(() => {
    if (!hunt?.suggestions) return [];
    const have = new Set(hunt.agencies.map((a) => a.name.toLowerCase()));
    return hunt.suggestions.filter(
      (s) => !have.has(s.name.toLowerCase()) && !dismissed.includes(s.id)
    );
  }, [hunt, dismissed]);

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

  // Toevoegen slaat direct op; verwijderen moet dat ook, anders staat het
  // bureau na een refresh weer in de lijst.
  function removeAgency(id: string) {
    if (!hunt) return;
    const next = hunt.agencies.filter((a) => a.id !== id);
    updateAgencies(next);
    void persistSettings(next);
  }

  function removeRecruiter(agencyId: string, name: string) {
    if (!hunt) return;
    const next = hunt.agencies.map((a) =>
      a.id !== agencyId ? a : { ...a, recruiters: a.recruiters.filter((r) => r.name !== name) }
    );
    updateAgencies(next);
    void persistSettings(next);
  }

  function addBureau() {
    if (!hunt) return;
    const parsed = parseCompanyInput(newBureauLinkedin);
    if (!parsed.ok) {
      setBureauErr(parsed.reason);
      setError(parsed.reason);
      return;
    }
    const name = parsed.name;
    if (hunt.agencies.some((a) => a.name.toLowerCase() === name.toLowerCase() || a.linkedinSlug === parsed.slug)) {
      setBureauErr("Dit bureau staat er al in.");
      setError("Dit bureau staat er al in.");
      return;
    }
    const agency: ManagedAgency = {
      id: slugAgencyId(name),
      name,
      aliases: [name.toLowerCase()],
      enabled: true,
      custom: true,
      recruiters: [],
      linkedinSlug: parsed.slug,
    };
    const next = [agency, ...hunt.agencies];
    updateAgencies(next);
    setNewBureauLinkedin("");
    setBureauErr("");
    setError("");
    setSettingsTab("feed");
    void persistSettings(next);
  }

  /** Bureau uit de Jobboards-suggesties volgen — URL komt van de vacature zelf. */
  function addSuggestedBureau(s: AgencySuggestion) {
    if (!hunt || !s.linkedinUrl) return;
    const parsed = parseCompanyInput(s.linkedinUrl);
    if (!parsed.ok) {
      setError(`${s.name}: ${parsed.reason}`);
      return;
    }
    if (hunt.agencies.some((a) => a.linkedinSlug === parsed.slug)) {
      setDismissed((d) => [...d, s.id]);
      return;
    }
    const agency: ManagedAgency = {
      id: slugAgencyId(s.name),
      name: s.name,
      aliases: [s.name.toLowerCase()],
      enabled: true,
      custom: true,
      recruiters: [],
      linkedinSlug: parsed.slug,
      note: `Gezien op Jobboards · ${s.openings}× contract${s.roles.length ? ` · ${s.roles.join(", ")}` : ""}`,
    };
    const next = [agency, ...hunt.agencies];
    updateAgencies(next);
    setDismissed((d) => [...d, s.id]);
    setError("");
    void persistSettings(next);
  }

  function setAgencyLinkedin(agencyId: string, raw: string) {
    if (!hunt) return;
    const parsed = parseCompanyInput(raw);
    if (!parsed.ok) {
      if (!raw.trim()) {
        const next = hunt.agencies.map((a) => (a.id === agencyId ? { ...a, linkedinSlug: undefined } : a));
        updateAgencies(next);
        return;
      }
      setError(parsed.reason);
      return;
    }
    const next = hunt.agencies.map((a) => (a.id === agencyId ? { ...a, linkedinSlug: parsed.slug } : a));
    updateAgencies(next);
  }

  function addRecruiter(agencyId: string) {
    if (!hunt) return;
    const raw = (newRecruiter[agencyId] || "").trim();
    const parsed = parseRecruiterInput(raw);
    if (!parsed.ok) {
      setRecruiterErr((prev) => ({ ...prev, [agencyId]: parsed.reason }));
      setError(parsed.reason);
      return;
    }
    const { name, linkedinUrl } = parsed;
    const agency = hunt.agencies.find((a) => a.id === agencyId);
    if (
      agency?.recruiters.some(
        (r) => r.linkedinUrl === linkedinUrl || r.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      const reason = "Deze recruiter staat er al in.";
      setRecruiterErr((prev) => ({ ...prev, [agencyId]: reason }));
      setError(reason);
      return;
    }
    const next = hunt.agencies.map((a) => {
      if (a.id !== agencyId) return a;
      const rec: ManagedRecruiter = {
        name,
        enabled: true,
        linkedinUrl,
      };
      return { ...a, recruiters: [...a.recruiters, rec], enabled: true };
    });
    updateAgencies(next);
    setNewRecruiter((prev) => ({ ...prev, [agencyId]: "" }));
    setRecruiterErr((prev) => ({ ...prev, [agencyId]: "" }));
    setError("");
    setOpenRecruiters((prev) => ({ ...prev, [agencyId]: true }));
    void persistSettings(next);
  }

  function mergeFound(agencyId: string, people: FoundPerson[]) {
    if (!hunt) return;
    const next = hunt.agencies.map((a) => {
      if (a.id !== agencyId) return a;
      const existing = new Set(a.recruiters.map((r) => r.name.toLowerCase()));
      const extra: ManagedRecruiter[] = people
        .filter((p) => p.name && p.url && /linkedin\.com\/in\//i.test(p.url) && !existing.has(p.name.toLowerCase()))
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
    });
    updateAgencies(next);
    setFound((prev) => ({ ...prev, [agencyId]: [] }));
    setOpenRecruiters((prev) => ({ ...prev, [agencyId]: true }));
    void persistSettings(next);
  }

  async function findRecruiters(agencyId: string) {
    if (!hunt) return;
    const agency = hunt.agencies.find((a) => a.id === agencyId);
    if (!agency) return;
    if (!agency.linkedinSlug) {
      setFindMsg((prev) => ({
        ...prev,
        [agencyId]: "Vul eerst de LinkedIn company-URL van dit bureau in.",
      }));
      return;
    }
    setFindBusy(agencyId);
    setFindMsg((prev) => ({ ...prev, [agencyId]: "" }));
    setError("");
    try {
      const res = await fetch("/api/settings/recruiters-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId,
          companyName: agency.name,
          companyLinkedinUrl: `https://www.linkedin.com/company/${agency.linkedinSlug}`,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        people?: FoundPerson[];
        linkedinBrowse?: string;
      };
      if (!res.ok || j.error) {
        setFindMsg((prev) => ({
          ...prev,
          [agencyId]: j.error || "Zoeken mislukt",
        }));
        setFound((prev) => ({ ...prev, [agencyId]: j.people || [] }));
        return;
      }
      const people = j.people || [];
      setFound((prev) => ({ ...prev, [agencyId]: people }));
      setFindMsg((prev) => ({
        ...prev,
        [agencyId]: people.length
          ? `${people.length} gevonden — voeg toe wie je wilt, daarna opslaan.`
          : "Geen recruiters gevonden. Check de company-URL of zoek handmatig op LinkedIn.",
      }));
    } finally {
      setFindBusy(null);
    }
  }

  async function persistSettings(nextAgencies?: ManagedAgency[]) {
    if (!hunt) return false;
    setError("");
    setSaved(false);
    setBusy(true);
    const roles = rolesText
      .split(/\n|,/)
      .map((r) => r.trim())
      .filter(Boolean);
    const agencies = nextAgencies ?? hunt.agencies;
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
          agencies,
          bench: hunt.bench || [],
        }),
      });
      if (!res.ok) {
        setError("Opslaan mislukt");
        return false;
      }
      const next = (await res.json()) as SettingsPayload;
      setHunt((prev) =>
        prev
          ? {
              ...prev,
              ...next,
              agencies: next.agencies || agencies,
              bench: next.bench || prev.bench || [],
              catalog: prev.catalog,
              integrations: prev.integrations,
            }
          : prev
      );
      if (next.roles) setRolesText(next.roles.join("\n"));
      setSaved(true);
      const { cacheClear, cacheSet } = await import("@/lib/client-cache");
      cacheClear("settings");
      cacheSet("settings", next);
      return true;
    } catch {
      setError("Opslaan mislukt");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await persistSettings();
  }

  return (
    <AppShell current="instellingen" title="Instellingen" subtitle="Jobboards en recruiter feed">
      <main className="ws-shell ws-shell--page">
        {hunt?.user?.role === "admin" && hunt.integrations ? (
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                ["database", "Database", hunt.integrations.database],
                ["anthropic", "AI", hunt.integrations.anthropic],
                ["apify", "Apify", hunt.integrations.apify],
                ["lusha", "Lusha", hunt.integrations.lusha],
                ["firecrawl", "Firecrawl", hunt.integrations.firecrawl],
              ] as const
            ).map(([key, label, ok]) => (
              <li
                key={key}
                className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${
                  ok
                    ? "border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]"
                    : "border-[var(--warn)]/30 bg-[var(--warn-soft)] text-[var(--warn)]"
                }`}
              >
                {ok ? "✓" : "○"} {label}
              </li>
            ))}
          </ul>
        ) : null}
        <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Onderdelen">
          {(
            [
              ["jobboards", "Jobboards"],
              ["feed", "Recruiter feed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`ws-chip ${settingsTab === id ? "ws-chip--on" : ""}`}
              onClick={() => {
                setSettingsTab(id);
                window.history.replaceState(null, "", `#${id}`);
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {!hunt ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 pb-2">
            {settingsTab === "jobboards" ? (
            <Section
              id="jobboards"
              hint="Rollen en externe plaatsing. Alleen eindklanten op de radar."
            >
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
                  Alleen externe plaatsing. Vast dienstverband hoort hier niet.
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
                    Filter interne werving (vast dienstverband) eruit — deze desk is voor externe
                    plaatsingen.
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

              {rejected.length ? (
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">Handmatig verborgen</p>
                  <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                    Via <em>Geen eindklant — verberg</em> op Jobboards.
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {rejected.map((r) => (
                      <li key={r.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-[var(--ink)]">{r.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
                          onClick={() => {
                            void (async () => {
                              const res = await fetch("/api/radar/reject-company", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ company: r.name, undo: true }),
                              });
                              if (!res.ok) return;
                              setRejected((prev) => prev.filter((x) => x.key !== r.key));
                            })();
                          }}
                        >
                          Terugzetten
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Section>
            ) : null}

            {settingsTab === "feed" ? (
            <Section
              id="feed"
              hint="Twee verschillende links. Bureau = company-pagina. Recruiter = persoonsprofiel. Verkeerde link? Dan zegt het formulier het meteen."
            >
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

              {!q && suggestions.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-[var(--ink)]">
                    Gezien op Jobboards — {suggestions.length} bureaus op jouw rollen
                  </p>
                  <p className="text-[0.78rem] leading-relaxed text-[var(--muted)]">
                    Deze partijen plaatsen contract-vacatures in precies jouw rollen. Ze staan niet
                    op Jobboards omdat ze geen eindklant zijn — ze zitten op dezelfde stoel als jij.
                    Volg ze, dan zie je via hun recruiters voor welke eindklant ze zoeken.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {suggestions.slice(0, suggestionsOpen ? 40 : 6).map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)]/40 px-3 py-2"
                      >
                        <CompanyMark
                          name={s.name}
                          logoUrls={agencyLogoUrls({
                            name: s.name,
                            id: s.id,
                            linkedinSlug: s.linkedinUrl?.split("/company/")[1] || null,
                          })}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-[var(--ink)]">{s.name}</span>
                          <span className="block truncate text-[0.72rem] text-[var(--muted)]">
                            {s.openings}× contract ·{" "}
                            {s.roles.length ? s.roles.join(", ") : "rol onbekend"}
                          </span>
                        </span>
                        {s.linkedinUrl ? (
                          <button
                            type="button"
                            className="btn-ink btn-tool shrink-0"
                            onClick={() => addSuggestedBureau(s)}
                          >
                            Volgen
                          </button>
                        ) : (
                          <span className="shrink-0 text-[0.72rem] text-[var(--muted)]">
                            geen LinkedIn-pagina gevonden
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {suggestions.length > 6 ? (
                    <button
                      type="button"
                      className="self-start text-[0.78rem] text-[var(--muted)] underline underline-offset-2"
                      onClick={() => setSuggestionsOpen((v) => !v)}
                    >
                      {suggestionsOpen
                        ? "Minder tonen"
                        : `Alle ${suggestions.length} bureaus tonen`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <p className="text-sm text-[var(--ink)]">Bureau toevoegen</p>
                <p className="text-[0.78rem] leading-relaxed text-[var(--muted)]">
                  Alleen de LinkedIn-pagina van het kantoor. Open het bureau op LinkedIn en kopieer de URL — die
                  eindigt op <span className="text-[var(--ink)]">linkedin.com/company/…</span>. Geen website, geen
                  /in/-profiel, geen vacature.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="ws-input min-w-0 flex-1"
                    placeholder="https://www.linkedin.com/company/vibe-group-global"
                    value={newBureauLinkedin}
                    onChange={(e) => {
                      setNewBureauLinkedin(e.target.value);
                      if (bureauErr) setBureauErr("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBureau();
                      }
                    }}
                    aria-label="LinkedIn company-URL van het bureau"
                  />
                  <button type="button" className="btn-ink btn-tool shrink-0" onClick={addBureau}>
                    Bureau toevoegen
                  </button>
                </div>
                {bureauErr ? <p className="text-[0.78rem] text-[var(--warn)]">{bureauErr}</p> : null}
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
                            <span className="flex items-center gap-2">
                              <CompanyMark
                                name={a.name}
                                logoUrls={agencyLogoUrls({
                                  name: a.name,
                                  id: a.id,
                                  linkedinSlug: a.linkedinSlug,
                                })}
                                size="sm"
                              />
                              <span className="block text-sm font-semibold text-[var(--ink)]">{a.name}</span>
                            </span>
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
                          <button
                            type="button"
                            className="btn-ghost btn-tool text-[var(--muted)] hover:text-[var(--warn)]"
                            title={
                              a.custom
                                ? "Bureau uit je lijst halen"
                                : "Bureau uit je lijst halen (ook standaardbureaus)"
                            }
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `${a.name} verwijderen uit je feed-lijst? Recruiters verdwijnen mee.`
                                )
                              ) {
                                return;
                              }
                              removeAgency(a.id);
                            }}
                          >
                            Verwijderen
                          </button>
                        </div>
                      </div>

                      <label className="mt-2 block text-[0.72rem] font-medium text-[var(--muted)]">
                        LinkedIn company
                        <input
                          className="ws-input mt-0.5"
                          placeholder="linkedin.com/company/…"
                          value={
                            a.linkedinSlug
                              ? `https://www.linkedin.com/company/${a.linkedinSlug}`
                              : ""
                          }
                          onChange={(e) => setAgencyLinkedin(a.id, e.target.value)}
                          onBlur={(e) => {
                            if (!hunt) return;
                            const raw = e.target.value.trim();
                            if (!raw) {
                              const next = hunt.agencies.map((x) =>
                                x.id === a.id ? { ...x, linkedinSlug: undefined } : x
                              );
                              updateAgencies(next);
                              void persistSettings(next);
                              return;
                            }
                            const parsed = parseCompanyInput(raw);
                            if (!parsed.ok) {
                              setError(parsed.reason);
                              return;
                            }
                            const next = hunt.agencies.map((x) =>
                              x.id === a.id ? { ...x, linkedinSlug: parsed.slug } : x
                            );
                            updateAgencies(next);
                            void persistSettings(next);
                          }}
                        />
                        {!a.linkedinSlug ? (
                          <span className="mt-0.5 block text-[0.68rem] text-[var(--warn)]">
                            Nodig voor “Zoek recruiters”
                          </span>
                        ) : null}
                      </label>

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
                              const hasIn = Boolean(p.url && /linkedin\.com\/in\//i.test(p.url));
                              return (
                                <li key={p.url || p.name} className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="block text-[0.85rem] font-medium text-[var(--ink)]">
                                      {p.name}
                                    </span>
                                    {p.title ? (
                                      <span className="block text-[0.7rem] text-[var(--muted)]">{p.title}</span>
                                    ) : null}
                                    {!hasIn ? (
                                      <span className="block text-[0.7rem] text-[var(--warn)]">
                                        Geen /in/-URL — niet toevoegen, anders faalt de feed.
                                      </span>
                                    ) : null}
                                  </span>
                                  {already ? (
                                    <span className="shrink-0 text-[0.7rem] text-[var(--muted)]">staat erin</span>
                                  ) : hasIn ? (
                                    <button
                                      type="button"
                                      className="shrink-0 text-[0.72rem] font-semibold text-[var(--accent)] hover:underline"
                                      onClick={() => mergeFound(a.id, [p])}
                                    >
                                      Toevoegen
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {a.enabled ? (
                        <div className="mt-3 space-y-2 border-t border-[var(--line)]/70 pt-3">
                          {shownRecruiters.length ? (
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 rounded-[var(--radius)] px-1 py-1 text-left text-[0.78rem] font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
                              aria-expanded={Boolean(openRecruiters[a.id])}
                              onClick={() =>
                                setOpenRecruiters((prev) => ({
                                  ...prev,
                                  [a.id]: !prev[a.id],
                                }))
                              }
                            >
                              <span>
                                {shownRecruiters.length} recruiter
                                {shownRecruiters.length === 1 ? "" : "s"}
                                <span className="font-normal text-[var(--muted)]">
                                  {" "}
                                  · {shownRecruiters.filter((r) => r.enabled).length} aan
                                </span>
                              </span>
                              <span className="text-[var(--muted)]" aria-hidden>
                                {openRecruiters[a.id] ? "▲" : "▼"}
                              </span>
                            </button>
                          ) : (
                            <p className="text-[0.72rem] text-[var(--muted)]">Nog geen recruiters.</p>
                          )}

                          {openRecruiters[a.id]
                            ? shownRecruiters.map((r) => (
                                <div key={`${a.id}-${r.name}`} className="flex items-start gap-2 pl-1">
                                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                                      checked={r.enabled}
                                      onChange={(e) =>
                                        setRecruiterEnabled(a.id, r.name, e.target.checked)
                                      }
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
                                      {!r.linkedinUrl ? (
                                        <span className="block text-[0.7rem] text-[var(--warn)]">
                                          Geen /in/-URL — de feed kan deze recruiter niet ophalen.
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
                              ))
                            : null}

                          <div className="flex flex-col gap-1.5 pt-1">
                            <p className="text-[0.72rem] text-[var(--muted)]">
                              Snel toevoegen:{" "}
                              <span className="text-[var(--ink)]">linkedin.com/in/…</span>
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                className="ws-input min-w-0 flex-1 bg-[var(--surface-2)]"
                                placeholder="https://www.linkedin.com/in/…"
                                value={newRecruiter[a.id] || ""}
                                onChange={(e) => {
                                  setNewRecruiter((prev) => ({ ...prev, [a.id]: e.target.value }));
                                  if (recruiterErr[a.id])
                                    setRecruiterErr((prev) => ({ ...prev, [a.id]: "" }));
                                }}
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
                            {recruiterErr[a.id] ? (
                              <p className="text-[0.78rem] text-[var(--warn)]">{recruiterErr[a.id]}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              ) : null}
            </Section>
            ) : null}


            {error ? <p className="text-sm text-[var(--warn)]">{error}</p> : null}
            {saved ? (
              <p className="text-sm text-[var(--green)]">Opgeslagen.</p>
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
