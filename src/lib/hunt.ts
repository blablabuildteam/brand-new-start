import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";

/** Soort opdracht waarop sync/radar filtert. */
export type EmploymentKind = "zzp" | "interim" | "contract" | "detachering";

export const EMPLOYMENT_KINDS: { id: EmploymentKind; label: string; hint: string }[] = [
  { id: "zzp", label: "ZZP", hint: "Zelfstandige / freelance" },
  { id: "interim", label: "Interim", hint: "Tijdelijke inhuur" },
  { id: "contract", label: "Contract", hint: "Contractrollen op boards" },
  { id: "detachering", label: "Detachering", hint: "Via bureau gedetacheerd" },
];

export type ManagedRecruiter = {
  name: string;
  title?: string;
  brand?: string;
  linkedinUrl?: string;
  enabled: boolean;
};

export type ManagedAgency = {
  id: string;
  name: string;
  aliases: string[];
  note?: string;
  enabled: boolean;
  /** Zelf toegevoegd → mag verwijderd worden. */
  custom?: boolean;
  recruiters: ManagedRecruiter[];
};

export type HuntSettings = {
  /** Naam van de desk (sidebar / topbar). */
  name: string;
  /** Regio of markt, bv. Nederland. */
  market: string;
  /** Functies / rollen die je zoekt. */
  roles: string[];
  /** Soort opdracht (zoektermen). */
  employmentKinds: EmploymentKind[];
  /** Vaste banen uitsluiten. */
  requireContract: boolean;
  /** Bureaus + recruiters (aan/uit + zelf toevoegen). */
  agencies?: ManagedAgency[];
  /**
   * Eindklanten / careers-pagina’s die je volgt.
   * `undefined` = nog niet gezet → standaard aan.
   */
  companyIds?: string[];
  /** @deprecated legacy — gemigreerd naar agencies[].enabled */
  agencyIds?: string[];
  /** @deprecated legacy — gemigreerd naar recruiters[].enabled */
  recruiterIds?: string[];
};

/** Standaard functies — aanpasbaar in Instellingen. */
export const DEFAULT_ROLES = [
  "Scrum Master",
  "Agile Coach",
  "Business Analist",
  "Business Analyst",
  "Product Owner",
  "DevOps Engineer",
  "Platform Engineer",
  "Project Manager",
  "Test Lead",
  "Release Train Engineer",
  "Change Manager",
  "Solution Architect",
  "Node.js",
];

export const DEFAULT_EMPLOYMENT: EmploymentKind[] = ["zzp", "interim", "contract", "detachering"];

export const DEFAULT_HUNT: HuntSettings = {
  name: "Regie",
  market: "Nederland",
  roles: DEFAULT_ROLES,
  employmentKinds: DEFAULT_EMPLOYMENT,
  requireContract: true,
};

const SETTINGS_ID = "default";
const KIND_SET = new Set<EmploymentKind>(EMPLOYMENT_KINDS.map((k) => k.id));

let cache: HuntSettings = DEFAULT_HUNT;

export function huntSettings(): HuntSettings {
  return cache;
}

export function huntRoles(): string[] {
  return cache.roles.length ? cache.roles : DEFAULT_ROLES;
}

export function employmentSearchTerms(): string[] {
  const kinds = cache.employmentKinds?.length ? cache.employmentKinds : DEFAULT_EMPLOYMENT;
  const map: Record<EmploymentKind, string> = {
    zzp: "ZZP",
    interim: "interim",
    contract: "contract",
    detachering: "detachering",
  };
  return kinds.map((k) => map[k]);
}

export function recruiterKey(agencyId: string, name: string) {
  return `${agencyId}::${name.trim().toLowerCase()}`;
}

export function slugAgencyId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `custom_${base || "bureau"}_${Date.now().toString(36)}`;
}

function normalizeKinds(raw: unknown): EmploymentKind[] {
  if (!Array.isArray(raw)) return DEFAULT_EMPLOYMENT;
  const kinds = [
    ...new Set(
      raw
        .map((k) => String(k).trim().toLowerCase())
        .filter((k): k is EmploymentKind => KIND_SET.has(k as EmploymentKind))
    ),
  ];
  return kinds.length ? kinds : DEFAULT_EMPLOYMENT;
}

function normalizeIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))].slice(0, 80);
}

function cleanRecruiter(raw: unknown): ManagedRecruiter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (name.length < 2) return null;
  return {
    name: name.slice(0, 80),
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 80) : undefined,
    brand: typeof o.brand === "string" && o.brand.trim() ? o.brand.trim().slice(0, 60) : undefined,
    linkedinUrl:
      typeof o.linkedinUrl === "string" && o.linkedinUrl.trim()
        ? o.linkedinUrl.trim().slice(0, 200)
        : undefined,
    enabled: o.enabled !== false,
  };
}

export function normalizeManagedAgencies(raw: unknown): ManagedAgency[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: ManagedAgency[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (name.length < 2) continue;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim().slice(0, 64)
        : slugAgencyId(name);
    const aliases = Array.isArray(o.aliases)
      ? o.aliases
          .map((a) => String(a).trim().toLowerCase())
          .filter((a) => a.length >= 2)
          .slice(0, 20)
      : [name.toLowerCase()];
    const recruiters = Array.isArray(o.recruiters)
      ? o.recruiters.map(cleanRecruiter).filter((r): r is ManagedRecruiter => Boolean(r)).slice(0, 30)
      : [];
    out.push({
      id,
      name: name.slice(0, 80),
      aliases: aliases.length ? aliases : [name.toLowerCase()],
      note: typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 200) : undefined,
      enabled: o.enabled !== false,
      custom: o.custom === true || id.startsWith("custom_"),
      recruiters,
    });
  }
  return out;
}

function normalize(raw: Partial<HuntSettings> | null | undefined): HuntSettings {
  const roles = Array.isArray(raw?.roles)
    ? [...new Set(raw.roles.map((r) => r.trim()).filter((r) => r.length >= 2))].slice(0, 24)
    : DEFAULT_ROLES;
  return {
    name: (raw?.name || DEFAULT_HUNT.name).trim().slice(0, 40) || DEFAULT_HUNT.name,
    market: (raw?.market || DEFAULT_HUNT.market).trim().slice(0, 40) || DEFAULT_HUNT.market,
    roles: roles.length ? roles : DEFAULT_ROLES,
    employmentKinds: normalizeKinds(raw?.employmentKinds),
    requireContract: raw?.requireContract !== false,
    agencies: normalizeManagedAgencies(raw?.agencies),
    companyIds: normalizeIds(raw?.companyIds),
    agencyIds: normalizeIds(raw?.agencyIds),
    recruiterIds: normalizeIds(raw?.recruiterIds),
  };
}

export async function loadHuntSettings(): Promise<HuntSettings> {
  if (!hasDatabase()) {
    cache = DEFAULT_HUNT;
    return cache;
  }
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.id, SETTINGS_ID))
      .limit(1);
    const row = rows[0];
    cache = row ? normalize(row.data as Partial<HuntSettings>) : DEFAULT_HUNT;
  } catch {
    cache = DEFAULT_HUNT;
  }
  return cache;
}

export async function saveHuntSettings(input: Partial<HuntSettings>): Promise<HuntSettings> {
  const next = normalize({ ...cache, ...input });
  cache = next;
  if (!hasDatabase()) return next;
  const db = getDb();
  await db
    .insert(workspaceSettings)
    .values({ id: SETTINGS_ID, data: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: workspaceSettings.id,
      set: { data: next, updatedAt: new Date() },
    });
  return next;
}

export function marketSearchQueries() {
  const extras = employmentSearchTerms();
  const fallback = ["ZZP", "interim", "contract"] as const;
  const terms = (extras.length ? extras : fallback) as string[];
  return huntRoles().map((role) => ({
    role,
    extras: terms,
  }));
}
