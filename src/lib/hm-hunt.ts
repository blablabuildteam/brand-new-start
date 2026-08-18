import { detectFamily, type RoleFamily } from "@/lib/niche";
import type { OrgContext } from "@/lib/org-context";

const PUBLIC_SECTOR =
  /politie|defensie|rijksoverheid|gemeente|ministerie|provincie|omgevingsdienst|belasting|uwv|duo|kadaster|waterschap|veiligheidsregio|ggd|rechtbank|overheid/i;

const GENERIC_DEPT =
  /^(other|engineering|information technology|it|consulting|business|management|project management|analyst|design|research|other\/unknown)$/i;

/** Wie meestal tekent voor inhuur — zoektermen, geen verzonnen personen. */
const DECIDERS: Record<RoleFamily, { overheid: string; corporate: string }> = {
  agile: { overheid: "agile lead", corporate: "delivery manager" },
  "ba-pm": { overheid: "informatiemanager", corporate: "IT manager" },
  "cloud-devops": { overheid: "teamleider", corporate: "engineering manager" },
  software: { overheid: "teamleider", corporate: "engineering manager" },
  data: { overheid: "data owner", corporate: "head of data" },
  "frontend-design": { overheid: "product owner", corporate: "head of design" },
  security: { overheid: "CISO", corporate: "CISO" },
  test: { overheid: "test manager", corporate: "QA manager" },
  "architecture-apps": { overheid: "enterprise architect", corporate: "IT architect" },
};

export function isPublicSector(company: string, sector?: string | null): boolean {
  return PUBLIC_SECTOR.test(`${company} ${sector || ""}`);
}

export type HmSearchPlan = {
  /** LinkedIn-zoekterm: een titel die mensen écht op hun profiel zetten. */
  keywords: string;
  hint: string;
  mode: "title" | "department";
  department?: string | null;
};

function searchableDept(dept: string): string | null {
  const s = dept.trim();
  if (s.length < 3 || GENERIC_DEPT.test(s)) return null;
  if (/[\/|&]/.test(s)) return null;
  return s;
}

/**
 * Zoekterm voor LinkedIn: altijd een functietitel, nooit een interne afdelingsnaam.
 * Afdeling is hint/ranking — “hyper automation” levert op LinkedIn bijna nooit hits.
 */
export function hmSearchPlan(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
}): HmSearchPlan {
  const dept = searchableDept(opts.department || "");
  const family =
    detectFamily(`${opts.openingTitle || ""} ${opts.roleLabel}`) ||
    detectFamily(dept || "");
  const overheid = isPublicSector(opts.company, opts.sector);
  const title = family
    ? overheid
      ? DECIDERS[family].overheid
      : DECIDERS[family].corporate
    : overheid
      ? "teamleider"
      : "manager";
  return {
    keywords: title,
    hint: dept ? `${title} in ${dept}` : title,
    mode: "title",
    department: dept,
  };
}

type WithOrg = {
  id: string;
  roleLabel: string;
  openingTitle: string;
  org: OrgContext;
};

/** Zelfde bedrijf, zelfde afdeling of rol-familie: hergebruik een bekende naam. */
export function borrowHiringManager<T extends WithOrg>(openings: T[]): T[] {
  return openings.map((o) => {
    if (o.org.hiringManager) return o;
    const family = detectFamily(`${o.openingTitle} ${o.roleLabel}`);
    const donor = openings.find((x) => {
      if (x.id === o.id || !x.org.hiringManager) return false;
      const sameDept =
        Boolean(x.org.department && o.org.department) &&
        x.org.department!.toLowerCase() === o.org.department!.toLowerCase();
      const donorFamily = detectFamily(`${x.openingTitle} ${x.roleLabel}`);
      const sameFamily = Boolean(family && donorFamily && family === donorFamily);
      return sameDept || sameFamily;
    });
    if (!donor) return o;
    return {
      ...o,
      org: {
        ...o.org,
        hiringManager: donor.org.hiringManager,
        hiringManagerTitle:
          o.org.hiringManagerTitle || donor.org.hiringManagerTitle || donor.org.department,
        hmHits: o.org.hmHits?.length ? o.org.hmHits : donor.org.hmHits,
      },
    };
  });
}

export type HmCandidate = {
  name: string;
  title: string | null;
  url: string | null;
  score: number;
};

const DECIDER_HINT =
  /\b(manager|lead|director|head|hoofd|opdrachtgever|informatiemanager|owner|ciso|architect|chapter|tribe|delivery)\b/i;

export function rankHmCandidates(
  people: { name: string; title: string | null; url: string | null; headline?: string | null }[],
  plan: HmSearchPlan
): HmCandidate[] {
  const needle = plan.keywords.toLowerCase();
  const dept = plan.department?.toLowerCase() || "";
  const ranked: HmCandidate[] = [];
  for (const p of people) {
    const title = `${p.title || ""} ${p.headline || ""}`.trim();
    if (/recruiter|talent acquisition|sourcer|werving|staffing|intercedent/i.test(title)) continue;
    if (!p.name || !p.name.includes(" ")) continue;
    let score = 1;
    const hay = title.toLowerCase();
    if (hay.includes(needle)) score += 40;
    if (dept && hay.includes(dept)) score += 22;
    if (DECIDER_HINT.test(title)) score += 18;
    if (p.url) score += 6;
    ranked.push({ name: p.name, title: p.title, url: p.url, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const unique: HmCandidate[] = [];
  for (const r of ranked) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
    if (unique.length >= 3) break;
  }
  return unique;
}
