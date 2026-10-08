/**
 * Detecteer of een watchlist-recruiter nog bij het bureau lijkt te werken,
 * op basis van author-meta uit de LinkedIn posts-actor (geen extra Apify-call).
 */

import { matchAgency, type Agency } from "@/lib/agency";
import type { LinkedInPost } from "@/lib/ingest/linkedin";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mentionsAgency(agency: Agency, blob: string) {
  const n = norm(blob);
  if (!n) return false;
  const names = [agency.name, ...(agency.aliases || [])].map(norm).filter((x) => x.length >= 3);
  return names.some((a) => n === a || n.includes(a) || a.includes(n));
}

/** Headline / occupation + eventuele werkgever uit een posts-actor item. */
export function authorWorkHint(raw: Record<string, unknown> | null | undefined): {
  headline: string | null;
  employer: string | null;
} {
  if (!raw || typeof raw !== "object") return { headline: null, employer: null };
  const author = (raw.author || raw.authorInfo || raw.actor || raw.profile) as
    | Record<string, unknown>
    | undefined;
  const headline =
    str(author?.occupation) ||
    str(author?.headline) ||
    str(author?.title) ||
    str(raw.authorHeadline) ||
    str(raw.authorOccupation) ||
    null;
  const employerDirect =
    str(author?.companyName) ||
    str(author?.company) ||
    str((author?.company as { name?: unknown } | undefined)?.name) ||
    str(raw.authorCompany) ||
    null;
  let employer = employerDirect;
  if (!employer && headline) {
    const m = headline.match(/\s+(?:at|bij|@|·|-)\s+([^|•\n]{2,80})$/i);
    if (m?.[1]) employer = m[1].trim();
  }
  return { headline, employer };
}

export type AgencyFit = "ok" | "left" | "unknown";

/**
 * ok = headline/werkgever noemt het watchlist-bureau
 * left = duidelijk ergens anders (of "ex-/voorheen" + bureau)
 * unknown = te weinig info
 */
export function agencyFitOf(
  agency: Agency,
  hint: { headline: string | null; employer: string | null }
): AgencyFit {
  const blob = [hint.headline, hint.employer].filter(Boolean).join(" ");
  if (!blob.trim()) return "unknown";

  const leftMarker = /\b(ex-|former|voorheen|previously|alumni|ex )\b/i.test(blob);
  if (leftMarker && mentionsAgency(agency, blob)) return "left";

  if (mentionsAgency(agency, blob)) return "ok";

  if (hint.employer && hint.employer.length >= 3) {
    const other = matchAgency(hint.employer);
    if (other && other.id !== agency.id) return "left";
    // "Recruiter at Acme" zonder match op watchlist-bureau
    if (/\b(at|bij|@)\b/i.test(hint.headline || "") && !mentionsAgency(agency, hint.employer)) {
      return "left";
    }
  }

  return "unknown";
}

/** Beste hint uit een batch posts (eerste met inhoud wint). */
export function workHintFromPosts(posts: LinkedInPost[]): {
  headline: string | null;
  employer: string | null;
} {
  for (const p of posts) {
    const h = authorWorkHint(p.raw || null);
    if (h.headline || h.employer) return h;
  }
  return { headline: null, employer: null };
}

export function watchlistAlertId(linkedinUrl: string) {
  const key = linkedinUrl
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48);
  return `watchlist_left_${key || "unknown"}`;
}
