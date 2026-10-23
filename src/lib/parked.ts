import type { ParkedCompany } from "@/lib/desk-meta";
import { companyKey } from "@/lib/score";

export const parkedKey = companyKey;

export type ParkedRow = ParkedCompany & { key: string };

let active = new Map<string, ParkedRow>();

export function isParkActive(row: Pick<ParkedCompany, "until">, now = Date.now()) {
  return !row.until || new Date(row.until).getTime() > now;
}

/** Called whenever desk-meta is loaded or saved, so sync gates see the latest list. */
export function setParkedCompanies(rows: Record<string, ParkedCompany> | undefined) {
  const next = new Map<string, ParkedRow>();
  for (const [key, row] of Object.entries(rows || {})) {
    if (!row?.name || !isParkActive(row)) continue;
    next.set(parkedKey(row.name) || key, { ...row, key });
  }
  active = next;
}

export function activeParked(): ParkedRow[] {
  return [...active.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function parkedFor(name: string | null | undefined): ParkedRow | null {
  const k = parkedKey(name || "");
  if (k.length < 2) return null;
  return active.get(k) || null;
}

export function isParkedCompany(name: string | null | undefined): boolean {
  return Boolean(parkedFor(name));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Feed-posts zonder AI-naam: noemt de tekst letterlijk een geparkeerd bedrijf? */
export function parkedMentionIn(text: string): ParkedRow | null {
  if (!text || !active.size) return null;
  const hay = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const row of active.values()) {
    const name = row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (name.length < 4) continue;
    if (new RegExp(`(^|[^a-z0-9])${escapeRe(name)}([^a-z0-9]|$)`).test(hay)) return row;
  }
  return null;
}
