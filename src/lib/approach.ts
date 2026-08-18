import { hmSearchPlan } from "@/lib/hm-hunt";
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

const EXTRA_SLUGS: Record<string, string[]> = {
  "nn group": ["nn-group", "nationale-nederlanden"],
  nn: ["nn-group"],
  "nationale nederlanden": ["nn-group", "nationale-nederlanden"],
};

function slugifyCompanyName(name: string): string {
  return linkedinCompanyQuery(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** LinkedIn company-pagina’s om current-company te filteren (geen keyword-zoek op de naam). */
export function linkedinCompanyUrls(name: string, knownUrl?: string | null): string[] {
  const slugs: string[] = [];
  const seen = new Set<string>();
  const add = (slug: string) => {
    const s = slug.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!s || seen.has(s) || /^(jobs|search|feed|in|school)$/i.test(s)) return;
    seen.add(s);
    slugs.push(s);
  };
  const known = linkedinCompanySlug(knownUrl);
  if (known) add(known);
  const q = linkedinCompanyQuery(name).toLowerCase();
  for (const extra of EXTRA_SLUGS[q] || []) add(extra);
  const guessed = slugifyCompanyName(name);
  if (guessed) add(guessed);
  return slugs.map((s) => `https://www.linkedin.com/company/${s}`);
}

export function linkedinPeopleAtCompany(opts: {
  company: string;
  companyLinkedinUrl?: string | null;
  keywords: string;
}): string {
  const keywords = opts.keywords.replace(/\s+/g, " ").trim();
  const simple = keywords.replace(/[()"]/g, " ").replace(/\bOR\b/gi, " ").replace(/\s+/g, " ").trim();
  const urls = linkedinCompanyUrls(opts.company, opts.companyLinkedinUrl);
  const slug = urls[0] ? linkedinCompanySlug(urls[0]) : null;
  if (slug) {
    const base = `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/`;
    return simple ? `${base}?keywords=${encodeURIComponent(simple)}` : base;
  }
  const companyQ = linkedinCompanyQuery(opts.company);
  const q = [simple, `"${companyQ}"`].filter(Boolean).join(" ");
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
  sector?: string | null;
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
          opts.org.hmHits?.find((h) => h.name === opts.org.hiringManager)?.url ||
          (!opts.org.contactName || opts.org.contactName === opts.org.hiringManager
            ? opts.org.contactUrl
            : null),
      }),
      cta: "bericht",
    });
    for (const hit of opts.org.hmHits || []) {
      if (hit.name === opts.org.hiringManager) continue;
      targets.push({
        kind: "person",
        label: hit.name,
        subtitle: hit.title || (hit.company ? `bij ${hit.company}` : "Ook mogelijk"),
        url: linkedinPersonUrl({
          name: hit.name,
          company: opts.company,
          companyLinkedinUrl: companyUrl,
          profileUrl: hit.url,
        }),
        cta: "bericht",
      });
    }
    return { department: opts.org.department, targets };
  }

  const plan = hmSearchPlan({
    company: opts.company,
    roleLabel: opts.roleLabel,
    openingTitle: opts.openingTitle,
    department: opts.org.department,
    sector: opts.sector,
  });
  targets.push({
    kind: "search",
    label: "Nog niet bekend",
    subtitle: `Zoek ${plan.keywords} bij ${short}`,
    url: linkedinPeopleAtCompany({
      company: opts.company,
      companyLinkedinUrl: companyUrl,
      keywords: plan.keywords,
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
      subtitle: recruiter ? "Recruiter · vraag wie de manager is" : opts.org.contactTitle,
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
