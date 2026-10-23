import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";

/** Aandeel blablabuild in de marge (of fee) per soort business. BNS krijgt de rest. */
export const SHARES = {
  firstRole: 0.3,
  extension: 0.2,
  secondRole: 0.15,
  account: 0.1,
  costs: 0.3,
} as const;

/** Maanden zonder lopende opdracht waarna een account niet meer meetelt. */
export const ACCOUNT_LAPSE_MONTHS = 12;

/**
 * Versie van de overeenkomst op /pilot. Ophogen bij elke inhoudelijke wijziging:
 * een handtekening geldt alleen voor de versie waarop gezet is.
 */
export const AGREEMENT_VERSION = "2026-10-23";

export const OUR_SIGNATURE = {
  party: "blablabuild",
  signedAt: "2026-10-23",
  version: AGREEMENT_VERSION,
} as const;

export type BnsSignature = {
  name: string;
  title: string;
  email: string;
  signedAt: string;
  version: string;
  ip?: string | null;
};

const SIGN_ID = "agreement-signature";

type Stored = { bns?: BnsSignature | null };

const g = globalThis as unknown as { __bnsAgreement?: Stored };

export async function loadBnsSignature(): Promise<BnsSignature | null> {
  if (!hasDatabase()) return g.__bnsAgreement?.bns ?? null;
  try {
    const rows = await getDb()
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.id, SIGN_ID))
      .limit(1);
    const data = rows[0]?.data as unknown as Stored | undefined;
    return data?.bns ?? null;
  } catch {
    return null;
  }
}

export async function saveBnsSignature(sig: BnsSignature | null) {
  const data: Stored = { bns: sig };
  if (!hasDatabase()) {
    g.__bnsAgreement = data;
    return;
  }
  const value = data as unknown as typeof workspaceSettings.$inferInsert.data;
  await getDb()
    .insert(workspaceSettings)
    .values({ id: SIGN_ID, data: value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: workspaceSettings.id, set: { data: value, updatedAt: new Date() } });
}

export function signedCurrent(sig: BnsSignature | null) {
  return Boolean(sig && sig.version === AGREEMENT_VERSION);
}

export function dateNl(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
