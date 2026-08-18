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
  "cloud-devops": { overheid: "teamleider IV", corporate: "engineering manager" },
  software: { overheid: "teamleider ontwikkeling", corporate: "engineering manager" },
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
  keywords: string;
  hint: string;
};

/**
 * Eén gerichte LinkedIn-zoekterm: afdeling als die specifiek is, anders
 * de beslisser-titel die bij deze rol + dit type org hoort.
 */
export function hmSearchPlan(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
}): HmSearchPlan {
  const dept = opts.department?.trim() || "";
  if (dept.length >= 3 && !GENERIC_DEPT.test(dept)) {
    return { keywords: dept, hint: `in ${dept}` };
  }

  const family =
    detectFamily(`${opts.openingTitle || ""} ${opts.roleLabel}`) ||
    detectFamily(dept);
  const overheid = isPublicSector(opts.company, opts.sector);
  if (family) {
    const title = overheid ? DECIDERS[family].overheid : DECIDERS[family].corporate;
    return { keywords: title, hint: title };
  }
  return {
    keywords: overheid ? "opdrachtgever" : "hiring manager",
    hint: overheid ? "opdrachtgever" : "hiring manager",
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
      },
    };
  });
}
