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

export const HM_SEARCH_VER = 2;

export type HmSearchPlan = {
  /** LinkedIn-zoekterm. Bedrijfsnaam hoort hier nooit in — dat treft alumni. */
  keywords: string;
  hint: string;
  mode: "title" | "department";
  department?: string | null;
};

const ROLE_STOP =
  /^(business|analyst|analist|freelancer|freelance|zzp|interim|consultant|senior|medior|junior|contract|engineer|developer|specialist|the|and|voor|een|van|bij|met)$/i;

function searchableDept(dept: string): string | null {
  const s = dept.trim();
  if (s.length < 3 || GENERIC_DEPT.test(s)) return null;
  if (/[\/|&]/.test(s)) return null;
  return s;
}

/** “Hyper Automation” uit de vacaturetitel, niet “Business Analyst (Freelancer)”. */
export function distinctiveTeam(openingTitle?: string, department?: string | null): string | null {
  const dept = searchableDept(department || "");
  if (dept) return dept;
  const kept = (openingTitle || "")
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !ROLE_STOP.test(w));
  if (!kept.length) return null;
  return kept.join(" ").slice(0, 80);
}

/**
 * Zoek in het team + een manager-woord, of een beslisser-titel.
 * Nooit de bedrijfsnaam — LinkedIn matcht die op oude werkgevers.
 */
export function hmSearchPlan(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
}): HmSearchPlan {
  const team = distinctiveTeam(opts.openingTitle, opts.department);
  const family =
    detectFamily(`${opts.openingTitle || ""} ${opts.roleLabel}`) ||
    detectFamily(team || "");
  const overheid = isPublicSector(opts.company, opts.sector);
  const title = family
    ? overheid
      ? DECIDERS[family].overheid
      : DECIDERS[family].corporate
    : overheid
      ? "teamleider"
      : "manager";
  if (team) {
    return {
      keywords: `"${team}" (manager OR lead OR head OR chapter OR owner)`,
      hint: team,
      mode: "department",
      department: team,
    };
  }
  return {
    keywords: title,
    hint: title,
    mode: "title",
    department: null,
  };
}

type WithOrg = {
  id: string;
  roleLabel: string;
  openingTitle: string;
  org: OrgContext;
};

/** Zelfde bedrijf én dezelfde afdeling: hergebruik een bekende naam. */
export function borrowHiringManager<T extends WithOrg>(openings: T[]): T[] {
  return openings.map((o) => {
    if (o.org.hiringManager) return o;
    const donor = openings.find((x) => {
      if (x.id === o.id || !x.org.hiringManager) return false;
      return (
        Boolean(x.org.department && o.org.department) &&
        x.org.department!.toLowerCase() === o.org.department!.toLowerCase()
      );
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
  company: string | null;
  score: number;
};

const DECIDER_HINT =
  /\b(manager|lead|director|head|hoofd|opdrachtgever|informatiemanager|owner|ciso|architect|chapter|tribe|delivery)\b/i;

const COMPANY_CANON: Record<string, string> = {
  nn: "nn",
  "nn group": "nn",
  "nationale nederlanden": "nn",
  "nationale-nederlanden": "nn",
};

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(b\.?\s*v\.?|n\.?\s*v\.?|inc|ltd|groep|group|nederland|netherlands|the)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyCanon(name: string): string {
  const raw = name.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (/\bnn\b/.test(raw) || /nationale nederlanden/.test(raw)) return "nn";
  const n = normalizeCompany(name);
  return COMPANY_CANON[n] || n;
}

export function sameEmployer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ca = companyCanon(a);
  const cb = companyCanon(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return true;
  return false;
}

function looksLikeAlumni(text: string, targetCompany: string): boolean {
  if (!/\b(ex-|former|voorheen|previously|alumni)\b/i.test(text)) return false;
  const token = companyCanon(targetCompany).split(" ")[0];
  return Boolean(token) && token.length >= 2 && text.toLowerCase().includes(token);
}

export function rankHmCandidates(
  people: {
    name: string;
    title: string | null;
    url: string | null;
    headline?: string | null;
    company?: string | null;
    atCompany: boolean;
  }[],
  plan: HmSearchPlan,
  companyName: string
): HmCandidate[] {
  const dept = plan.department?.toLowerCase() || "";
  const ranked: HmCandidate[] = [];
  for (const p of people) {
    if (!p.atCompany) continue;
    const title = `${p.title || ""} ${p.headline || ""}`.trim();
    if (/recruiter|talent acquisition|sourcer|werving|staffing|intercedent/i.test(title)) continue;
    if (!p.name || !p.name.includes(" ")) continue;
    if (looksLikeAlumni(title, companyName)) continue;
    let score = 1;
    const hay = title.toLowerCase();
    if (dept && hay.includes(dept)) score += 36;
    if (DECIDER_HINT.test(title)) score += 18;
    if (p.url) score += 6;
    ranked.push({
      name: p.name,
      title: p.title,
      url: p.url,
      company: p.company || null,
      score,
    });
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
