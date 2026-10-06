import { detectFamily, type RoleFamily } from "@/lib/niche";
import type { OrgContext } from "@/lib/org-context";

const PUBLIC_SECTOR =
  /politie|defensie|rijksoverheid|gemeente|ministerie|provincie|omgevingsdienst|belasting|uwv|duo|kadaster|waterschap|veiligheidsregio|ggd|rechtbank|overheid/i;

const GENERIC_DEPT =
  /^(other|engineering|information technology|it|consulting|business|management|project management|analyst|design|research|other\/unknown)$/i;

/** Wie meestal tekent voor inhuur — meerdere titels, nooit kaal “manager”/“lead”. */
const TITLE_SETS: Record<RoleFamily, { overheid: string[]; corporate: string[] }> = {
  agile: {
    overheid: ["informatiemanager", "product owner", "teamleider"],
    corporate: ["delivery manager", "product owner", "agile coach"],
  },
  "ba-pm": {
    overheid: ["informatiemanager", "product owner", "teamleider"],
    corporate: ["IT manager", "product owner", "delivery manager", "informatiemanager"],
  },
  "cloud-devops": {
    overheid: ["teamleider", "informatiemanager", "chapter lead"],
    corporate: ["engineering manager", "chapter lead", "teamleider"],
  },
  software: {
    overheid: ["teamleider", "informatiemanager"],
    corporate: ["engineering manager", "engineering lead", "teamleider"],
  },
  data: {
    overheid: ["informatiemanager", "data owner", "teamleider"],
    corporate: ["head of data", "data owner", "engineering manager"],
  },
  "frontend-design": {
    overheid: ["product owner", "teamleider"],
    corporate: ["product owner", "head of design", "engineering manager"],
  },
  security: {
    overheid: ["CISO", "informatiemanager", "teamleider"],
    corporate: ["CISO", "security manager", "engineering manager"],
  },
  test: {
    overheid: ["test manager", "teamleider"],
    corporate: ["QA manager", "test manager", "engineering manager"],
  },
  "architecture-apps": {
    overheid: ["enterprise architect", "informatiemanager"],
    corporate: ["IT architect", "engineering manager", "enterprise architect"],
  },
};

const GENERIC_TITLES = ["IT manager", "engineering manager", "informatiemanager", "teamleider"];

function titlesQuery(titles: string[]): string {
  const uniq = [...new Set(titles.map((t) => t.trim()).filter((t) => t.length >= 3))].slice(0, 4);
  return uniq.map((t) => `"${t}"`).join(" OR ");
}

export function isPublicSector(company: string, sector?: string | null): boolean {
  return PUBLIC_SECTOR.test(`${company} ${sector || ""}`);
}

export const HM_SEARCH_VER = 2;

export type HmSearchPlan = {
  /** LinkedIn-zoekterm. Bedrijfsnaam hoort hier nooit in — dat treft alumni. */
  keywords: string;
  hint: string;
  mode: "person" | "department" | "titles";
  department?: string | null;
  namedPerson?: string | null;
  titles?: string[];
};

const ROLE_STOP =
  /^(business|analyst|analist|freelancer|freelance|zzp|interim|consultant|senior|medior|junior|contract|engineer|developer|specialist|the|and|voor|een|van|bij|met)$/i;

function searchableDept(dept: string): string | null {
  const s = dept.trim();
  if (s.length < 3 || GENERIC_DEPT.test(s)) return null;
  if (/[\/|&]/.test(s)) return null;
  return s;
}

/** “Hyper Automation” / “(Core Platform Engineering)” uit de vacaturetitel. */
export function distinctiveTeam(openingTitle?: string, department?: string | null): string | null {
  const dept = searchableDept(department || "");
  if (dept) return dept;

  const title = (openingTitle || "").trim();
  // Haakjes eerst: "Sr. Platform Engineer (Core Platform Engineering)" → teamnaam
  const paren = title.match(/\(([^)]{3,60})\)/);
  if (paren?.[1]) {
    const inner = searchableDept(paren[1].trim()) || paren[1].trim();
    if (inner.length >= 3 && !GENERIC_DEPT.test(inner)) return inner.slice(0, 60);
  }

  const kept = title
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !ROLE_STOP.test(w) && !/^sr\.?$/i.test(w));
  if (!kept.length) return null;
  // Te lang = ruis (hele titel) → laat family-titel zoeken
  if (kept.length > 4) return null;
  // Één generiek woord ("Platform") is te breed voor LinkedIn
  if (kept.length === 1 && /^(platform|cloud|data|security|devops|software|digital|engineering)$/i.test(kept[0]!)) {
    return null;
  }
  return kept.join(" ").slice(0, 60);
}

/**
 * Volgorde: (1) naam uit de vacature (2) herkenbaar team (3) 2–4 inhuur-titels.
 * Nooit de bedrijfsnaam — LinkedIn matcht die op oude werkgevers.
 */
export function hmSearchPlan(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
  namedPerson?: string | null;
  extraTitles?: string[] | null;
}): HmSearchPlan {
  const named = (opts.namedPerson || "").replace(/\s+/g, " ").trim();
  if (named.length >= 5 && named.includes(" ")) {
    return {
      keywords: `"${named}"`,
      hint: named,
      mode: "person",
      namedPerson: named,
      department: null,
    };
  }

  const team = distinctiveTeam(opts.openingTitle, opts.department);
  const family =
    detectFamily(`${opts.openingTitle || ""} ${opts.roleLabel}`) ||
    detectFamily(team || "");
  const overheid = isPublicSector(opts.company, opts.sector);
  const titles =
    opts.extraTitles?.length
      ? opts.extraTitles
      : family
        ? overheid
          ? TITLE_SETS[family].overheid
          : TITLE_SETS[family].corporate
        : GENERIC_TITLES;
  const q = titlesQuery(titles);

  if (team) {
    return {
      keywords: `"${team}" (${q})`,
      hint: team,
      mode: "department",
      department: team,
      titles,
    };
  }
  return {
    keywords: q,
    hint: titles[0] || "IT manager",
    mode: "titles",
    department: null,
    titles,
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

const STRONG_DECIDER =
  /\b(hiring manager|engineering manager|informatiemanager|delivery manager|director|head of|hoofd|chapter lead|tribe lead|teamleider|product owner|ciso|engineering lead|qa manager|test manager)\b/i;
const WEAK_LEAD = /\b(lead|head|owner|manager)\b/i;

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
    if (plan.namedPerson && p.name.toLowerCase() === plan.namedPerson.toLowerCase()) score += 48;
    else if (
      plan.namedPerson &&
      p.name.toLowerCase().includes(plan.namedPerson.toLowerCase().split(" ")[0] || "___")
    ) {
      score += 12;
    }
    if (dept && hay.includes(dept)) score += 36;
    if (STRONG_DECIDER.test(title)) score += 22;
    else if (WEAK_LEAD.test(title)) score += 4;
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
