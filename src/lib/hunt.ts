import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";

export type HuntSettings = {
  name: string;
  market: string;
  roles: string[];
  requireContract: boolean;
};

/** Standaardkader — aanpasbaar in Instellingen. */
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

export const DEFAULT_HUNT: HuntSettings = {
  name: "Regie",
  market: "Nederland",
  roles: DEFAULT_ROLES,
  requireContract: true,
};

const SETTINGS_ID = "default";

let cache: HuntSettings = DEFAULT_HUNT;

export function huntSettings(): HuntSettings {
  return cache;
}

export function huntRoles(): string[] {
  return cache.roles.length ? cache.roles : DEFAULT_ROLES;
}

function normalize(raw: Partial<HuntSettings> | null | undefined): HuntSettings {
  const roles = Array.isArray(raw?.roles)
    ? [...new Set(raw.roles.map((r) => r.trim()).filter((r) => r.length >= 2))].slice(0, 24)
    : DEFAULT_ROLES;
  return {
    name: (raw?.name || DEFAULT_HUNT.name).trim().slice(0, 40) || DEFAULT_HUNT.name,
    market: (raw?.market || DEFAULT_HUNT.market).trim().slice(0, 40) || DEFAULT_HUNT.market,
    roles: roles.length ? roles : DEFAULT_ROLES,
    requireContract: raw?.requireContract !== false,
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
    cache = row ? normalize(row.data) : DEFAULT_HUNT;
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
  return huntRoles().map((role) => ({
    role,
    extras: ["ZZP", "interim", "contract"] as const,
  }));
}
