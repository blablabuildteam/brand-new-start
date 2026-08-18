import { detectFamily, type RoleFamily } from "@/lib/niche";
import type { OrgContext } from "@/lib/org-context";

/** Wie je bij deze rol-familie meestal wilt hebben — niet de recruiter. */
const DECIDERS: Record<RoleFamily, { title: string; why: string }[]> = {
  agile: [
    { title: "Delivery Manager", why: "Stuurt agile delivery; vaak de echte hiring-beslisser." },
    { title: "Head of Agile", why: "Eigenaar van de SM/coach-practice." },
    { title: "Chapter Lead", why: "Lijn van Scrum Masters in de tribe." },
  ],
  "ba-pm": [
    { title: "IT Manager", why: "Vaak budgethouder voor BA/PM-inhuur." },
    { title: "Product Owner", why: "Dagelijks opdrachtgever van de analist." },
    { title: "Head of Business Analysis", why: "Practice-eigenaar als die er is." },
  ],
  "cloud-devops": [
    { title: "Engineering Manager", why: "Teamlead van DevOps/platform." },
    { title: "Head of Platform", why: "Beslist over platform/SRE-capaciteit." },
    { title: "CTO", why: "Alleen bij kleinere orgs / geen duidelijke afdeling." },
  ],
  software: [
    { title: "Engineering Manager", why: "Lijnmanager van het bouwteam." },
    { title: "Tech Lead", why: "Inhoudelijke poortwachter." },
    { title: "Head of Engineering", why: "Capaciteit en inhuur op schaal." },
  ],
  data: [
    { title: "Head of Data", why: "Eigenaar data/BI-capaciteit." },
    { title: "Data Engineering Manager", why: "Lijn van data engineers." },
    { title: "CDO", why: "Als er geen data-manager in beeld is." },
  ],
  "frontend-design": [
    { title: "Head of Design", why: "UX/product design inhuur." },
    { title: "Engineering Manager", why: "Frontend in een bouwteam." },
    { title: "Product Manager", why: "Vaak de interne opdrachtgever." },
  ],
  security: [
    { title: "CISO", why: "Beslisser information security." },
    { title: "Security Manager", why: "Operationele inhuur in het security-team." },
    { title: "BISO", why: "Business-kant van security, vaak de opdrachtgever." },
  ],
  test: [
    { title: "Test Manager", why: "Stuurt testcapaciteit." },
    { title: "QA Lead", why: "Inhoudelijke poortwachter kwaliteit." },
    { title: "Delivery Manager", why: "Als test in de delivery-lijn hangt." },
  ],
  "architecture-apps": [
    { title: "Enterprise Architect", why: "Poortwachter architectuur-inhuur." },
    { title: "IT Manager", why: "Applicatiebeheer / workplace inhuur." },
    { title: "Head of Architecture", why: "Als die functie bestaat." },
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
      why: opts.org.department
        ? `Genoemd in de vacature · ${opts.org.department}`
        : "Genoemd als manager / rapportagelijn in de vacature.",
      url: linkedinPeopleSearch(opts.company, opts.org.hiringManager),
      source: "vacature",
    });
  }

  if (opts.org.contactName) {
    add({
      kind: "person",
      label: opts.org.contactName,
      subtitle: opts.org.contactTitle,
      why: "Zette de opdracht online — vraag naar de hiring manager op de afdeling.",
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
      subtitle: opts.company,
      why: row.why,
      url: linkedinPeopleSearch(opts.company, `${deptHint}${row.title}`),
      source: "linkedin-zoek",
    });
  }

  return { department: opts.org.department, targets: targets.slice(0, 5) };
}
