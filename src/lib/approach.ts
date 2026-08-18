import type { OrgContext } from "@/lib/org-context";

/** LinkedIn geoUrn for the Netherlands. */
const NL_GEO = "102890883";

export type ApproachTarget = {
  kind: "person" | "search";
  label: string;
  subtitle?: string | null;
  url: string;
  /** Wat de recruiter nu moet doen. */
  cta: "bericht" | "zoek";
};

export function companyLinkedinFromSignals(
  signals: { raw?: Record<string, unknown> | null }[]
): string | null {
  for (const s of signals) {
    const raw = s.raw;
    if (!raw) continue;
    for (const key of ["companyLinkedinUrl", "companyUrl"] as const) {
      const u = raw[key];
      if (typeof u === "string" && linkedinCompanySlug(u)) return u;
    }
  }
  return null;
}

export function linkedinCompanySlug(url?: string | null): string | null {
  if (!url) return null;
  try {
    const href = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(href);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/company\/([^/?#]+)/i);
    if (!m?.[1]) return null;
    const slug = decodeURIComponent(m[1]).replace(/\/+$/, "");
    if (!slug || /^(jobs|search|feed|in|school)$/i.test(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

/**
 * Job boards often use an org-unit name that nobody lists as LinkedIn company.
 * Shorten to the parent people actually work at (Politie, Gemeente X, …).
 */
export function linkedinCompanyQuery(name: string): string {
  let s = name
    .replace(/\s*[–—|].*$/, "")
    .replace(/\b(b\.?\s*v\.?|n\.?\s*v\.?|v\.?\s*o\.?\s*f\.?)\b/gi, "")
    .replace(/\b(nederland|netherlands|the netherlands)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  if (!words.length) return name.trim();
  if (/^(gemeente|ministerie|provincie|universiteit|hogeschool|waterschap|veiligheidsregio|ggd)$/i.test(words[0])) {
    return words.slice(0, 3).join(" ");
  }
  if (words.length >= 4) return words[0];
  return s;
}

export function linkedinPeopleAtCompany(opts: {
  company: string;
  companyLinkedinUrl?: string | null;
  keywords: string;
}): string {
  const slug = linkedinCompanySlug(opts.companyLinkedinUrl);
  const keywords = opts.keywords.replace(/\s+/g, " ").trim();
  if (slug) {
    const base = `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/`;
    return keywords ? `${base}?keywords=${encodeURIComponent(keywords)}` : base;
  }
  const companyQ = linkedinCompanyQuery(opts.company);
  const q = [keywords, `"${companyQ}"`].filter(Boolean).join(" ");
  return (
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}` +
    `&geoUrn=${encodeURIComponent(`["${NL_GEO}"]`)}&origin=FACETED_SEARCH`
  );
}

export function linkedinPersonUrl(opts: {
  name: string;
  company: string;
  companyLinkedinUrl?: string | null;
  profileUrl?: string | null;
}): string {
  if (opts.profileUrl && /linkedin\.com\/in\//i.test(opts.profileUrl)) return opts.profileUrl;
  return linkedinPeopleAtCompany({
    company: opts.company,
    companyLinkedinUrl: opts.companyLinkedinUrl,
    keywords: `"${opts.name.trim()}"`,
  });
}

export function buildApproach(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  org: OrgContext;
  companyLinkedinUrl?: string | null;
}): { department: string | null; targets: ApproachTarget[] } {
  const companyUrl = opts.companyLinkedinUrl || null;
  const short = linkedinCompanyQuery(opts.company);
  const targets: ApproachTarget[] = [];

  if (opts.org.hiringManager) {
    targets.push({
      kind: "person",
      label: opts.org.hiringManager,
      subtitle: opts.org.hiringManagerTitle || opts.org.department,
      url: linkedinPersonUrl({
        name: opts.org.hiringManager,
        company: opts.company,
        companyLinkedinUrl: companyUrl,
        profileUrl:
          !opts.org.contactName || opts.org.contactName === opts.org.hiringManager
            ? opts.org.contactUrl
            : null,
      }),
      cta: "bericht",
    });
    return { department: opts.org.department, targets };
  }

  const keyword = opts.org.department || "manager";
  targets.push({
    kind: "search",
    label: "Nog niet bekend",
    subtitle: `Vind bij ${short}`,
    url: linkedinPeopleAtCompany({
      company: opts.company,
      companyLinkedinUrl: companyUrl,
      keywords: keyword,
    }),
    cta: "zoek",
  });

  if (opts.org.contactName) {
    const recruiter = /recruiter|talent acquisition|werving|staffing|intercedent/i.test(
      opts.org.contactTitle || ""
    );
    targets.push({
      kind: "person",
      label: opts.org.contactName,
      subtitle: recruiter ? "Recruiter" : opts.org.contactTitle,
      url: linkedinPersonUrl({
        name: opts.org.contactName,
        company: opts.company,
        companyLinkedinUrl: companyUrl,
        profileUrl: opts.org.contactUrl,
      }),
      cta: "bericht",
    });
  }

  return { department: opts.org.department, targets };
}
