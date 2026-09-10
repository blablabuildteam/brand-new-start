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
  /**
   * Bureaus die je volgt (ids uit de catalogus).
   * `undefined` = nog niet gezet → alle bureaus.
   */
  agencyIds?: string[];
  /**
   * Recruiters die je volgt (`bureauId::naam`).
   * `undefined` = nog niet gezet → alle recruiters.
   */
  recruiterIds?: string[];
  /**
   * Eindklanten / careers-pagina’s die je volgt.
   * `undefined` = nog niet gezet → standaard aan.
   */
  companyIds?: string[];
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
    agencyIds: normalizeIds(raw?.agencyIds),
    recruiterIds: normalizeIds(raw?.recruiterIds),
    companyIds: normalizeIds(raw?.companyIds),
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
