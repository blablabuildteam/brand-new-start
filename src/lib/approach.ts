import { detectFamily, type RoleFamily } from "@/lib/niche";
import type { OrgContext } from "@/lib/org-context";

/** Wie je bij deze rol-familie meestal wilt hebben — niet de recruiter. */
const DECIDERS: Record<RoleFamily, { title: string; why: string }[]> = {
  agile: [
    { title: "Delivery Manager", why: "Vaak de hiring-beslisser" },
    { title: "Head of Agile", why: "Practice / chapter-eigenaar" },
    { title: "Chapter Lead", why: "Lijn van Scrum Masters" },
  ],
  "ba-pm": [
    { title: "IT Manager", why: "Budgethouder inhuur" },
    { title: "Product Owner", why: "Dagelijks opdrachtgever" },
    { title: "Head of Business Analysis", why: "Practice-eigenaar" },
  ],
  "cloud-devops": [
    { title: "Engineering Manager", why: "Teamlead DevOps/platform" },
    { title: "Head of Platform", why: "Platform-capaciteit" },
    { title: "CTO", why: "Als er geen EM is" },
  ],
  software: [
    { title: "Engineering Manager", why: "Lijn van het bouwteam" },
    { title: "Tech Lead", why: "Inhoudelijke poortwachter" },
    { title: "Head of Engineering", why: "Inhuur op schaal" },
  ],
  data: [
    { title: "Head of Data", why: "Data/BI-capaciteit" },
    { title: "Data Engineering Manager", why: "Lijn data engineers" },
    { title: "CDO", why: "Als er geen data-manager is" },
  ],
  "frontend-design": [
    { title: "Head of Design", why: "UX/design-inhuur" },
    { title: "Engineering Manager", why: "Frontend in een bouwteam" },
    { title: "Product Manager", why: "Interne opdrachtgever" },
  ],
  security: [
    { title: "CISO", why: "Beslisser security" },
    { title: "Security Manager", why: "Operationele inhuur" },
    { title: "BISO", why: "Business-opdrachtgever" },
  ],
  test: [
    { title: "Test Manager", why: "Stuurt testcapaciteit" },
    { title: "QA Lead", why: "Poortwachter kwaliteit" },
    { title: "Delivery Manager", why: "Als test onder delivery hangt" },
  ],
  "architecture-apps": [
    { title: "Enterprise Architect", why: "Poortwachter architectuur" },
    { title: "IT Manager", why: "Applicatiebeheer-inhuur" },
    { title: "Head of Architecture", why: "Als die functie bestaat" },
  ],
};

export type ApproachTarget = {
  kind: "person" | "search";
  label: string;
  subtitle?: string | null;
  why: string;
  url: string;
  source: "vacature" | "poster" | "linkedin-zoek";
};

export function linkedinPeopleSearch(company: string, keywords: string) {
  const q = `${keywords} ${company} Nederland`.replace(/\s+/g, " ").trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&origin=SWITCH_SEARCH_VERTICAL`;
}

export function buildApproach(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  org: OrgContext;
}): { department: string | null; targets: ApproachTarget[] } {
  const family =
    detectFamily(`${opts.openingTitle || ""} ${opts.roleLabel}`) ||
    detectFamily(opts.org.department || "");
  const targets: ApproachTarget[] = [];
  const seen = new Set<string>();

  function add(t: ApproachTarget) {
    const key = `${t.kind}:${t.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(t);
  }

  if (opts.org.hiringManager) {
    add({
      kind: "person",
      label: opts.org.hiringManager,
      subtitle: opts.org.hiringManagerTitle,
      why: opts.org.department || "Genoemd in de vacature",
      url: linkedinPeopleSearch(opts.company, opts.org.hiringManager),
      source: "vacature",
    });
  }

  if (opts.org.contactName) {
    const recruiter = /recruiter|talent acquisition|werving|staffing|intercedent/i.test(
      opts.org.contactTitle || ""
    );
    add({
      kind: "person",
      label: opts.org.contactName,
      subtitle: opts.org.contactTitle,
      why: recruiter ? "Recruiter — vraag naar de manager" : "Zette de opdracht online",
      url: opts.org.contactUrl || linkedinPeopleSearch(opts.company, opts.org.contactName),
      source: "poster",
    });
  }

  const titles = family ? DECIDERS[family] : DECIDERS["ba-pm"];
  const deptHint = opts.org.department ? `${opts.org.department} ` : "";
  for (const row of titles.slice(0, 3)) {
    add({
      kind: "search",
      label: row.title,
      subtitle: null,
      why: row.why,
      url: linkedinPeopleSearch(opts.company, `${deptHint}${row.title}`),
      source: "linkedin-zoek",
    });
  }

  return { department: opts.org.department, targets: targets.slice(0, 5) };
}
