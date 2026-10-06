/** Company logo helpers — scrape field first, then light domain guess. */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function httpUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return null;
}

/** Pull logo URL from a signal/job raw blob. */
export function logoFromRaw(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const company = asRecord(raw.company);
  const candidates = [
    raw.companyLogo,
    raw.companyLogoUrl,
    raw.logo,
    raw.logoUrl,
    company?.logo,
    company?.logoUrl,
    company?.image,
  ];
  for (const c of candidates) {
    const u = httpUrl(c);
    if (u) return u;
  }
  return null;
}

export function logoFromSignals(
  signals: { raw?: unknown }[] | null | undefined
): string | null {
  for (const s of signals || []) {
    const raw = asRecord(s.raw);
    const logo = logoFromRaw(raw);
    if (logo) return logo;
  }
  return null;
}

/** Guess a logo via Clearbit from a cleaned company name (.nl then .com). */
export function guessCompanyLogo(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  const base = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(b\.?\s*v\.?|n\.?\s*v\.?|groep|group|holding|the|inc|ltd|llc|bv|nv)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  if (base.length < 3) return null;
  return `https://logo.clearbit.com/${base}.nl`;
}

/** Domain → Clearbit when we have a company website / LinkedIn company URL host. */
export function logoFromDomainHint(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const hints = [
    raw.companyUrl,
    raw.companyWebsite,
    raw.website,
    raw.url,
    asRecord(raw.company)?.url,
    asRecord(raw.company)?.website,
  ];
  for (const h of hints) {
    const u = httpUrl(h);
    if (!u) continue;
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      if (!host || host.includes("linkedin.com") || host.includes("indeed.") || host.includes("freelance.nl")) {
        continue;
      }
      return `https://logo.clearbit.com/${host}`;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function resolveCompanyLogo(opts: {
  raw?: Record<string, unknown> | null;
  signals?: { raw?: unknown }[] | null;
  companyName?: string | null;
  /** When true, append Clearbit guess if nothing else (img onError falls back). */
  allowGuess?: boolean;
}): string | null {
  return (
    logoFromRaw(opts.raw) ||
    logoFromSignals(opts.signals) ||
    logoFromDomainHint(opts.raw) ||
    (opts.allowGuess ? guessCompanyLogo(opts.companyName) : null)
  );
}

const AGENCY_LOGO_HOST: Record<string, string> = {
  vibegroup: "thevibegroup.com",
  "vibe-group-global": "thevibegroup.com",
  sthree: "sthree.com",
  "sthree-plc": "sthree.com",
  thenextmoove: "thenextmoove.nl",
  "elevation-partners-nederland": "elevationpartners.nl",
  kando: "kando-solutions.com",
  "kando-solutions-recruitment": "kando-solutions.com",
};

function favicon(host: string) {
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`;
}

/** Logo-kandidaten voor een recruitmentkantoor (eerste die laadt wint). */
export function agencyLogoUrls(opts: {
  name: string;
  id?: string;
  linkedinSlug?: string | null;
}): string[] {
  const urls: string[] = [];
  const host = AGENCY_LOGO_HOST[opts.id || ""] || AGENCY_LOGO_HOST[opts.linkedinSlug || ""];
  if (host) {
    urls.push(`https://logo.clearbit.com/${host}`, favicon(host));
  }
  const guess = guessCompanyLogo(opts.name);
  if (guess) urls.push(guess);
  const com = guess?.replace(/\.nl$/, ".com");
  if (com && com !== guess) urls.push(com);
  if (opts.linkedinSlug) {
    const compact = opts.linkedinSlug.replace(/-nederland|-global|-plc|-groep|-group$/i, "").replace(/-/g, "");
    if (compact.length >= 3) {
      urls.push(`https://logo.clearbit.com/${compact}.nl`, `https://logo.clearbit.com/${compact}.com`);
      urls.push(favicon(`${compact}.nl`), favicon(`${compact}.com`));
    }
  }
  return [...new Set(urls)];
}
