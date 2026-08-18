import { BENCH, type BenchPerson, type Domain } from "@/lib/bench";
import { detectFamily, type RoleFamily } from "@/lib/niche";
import {
  buildApproach,
  companyLinkedinFromSignals,
  linkedinCompanyQuery,
  linkedinPeopleAtCompany,
} from "@/lib/approach";
import type { OrgContext } from "@/lib/org-context";

export type PlacementInput = {
  company: string;
  openingTitle: string;
  roleLabel: string;
  department?: string | null;
  hiringManager?: string | null;
  hiringManagerTitle?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactUrl?: string | null;
  summary?: string;
  companyLinkedinUrl?: string | null;
};

export type FitFactor = { label: string; points: number };

export type RankedPerson = {
  person: BenchPerson;
  score: number;
  factors: FitFactor[];
  why: string[];
  linkedinUrl: string;
};

export type PlacementProposal = {
  company: string;
  companyShort: string;
  openingTitle: string;
  roleLabel: string;
  family: RoleFamily | null;
  domain: Domain | null;
  mustHaves: string[];
  hiring: ReturnType<typeof buildApproach>["targets"];
  shortlist: RankedPerson[];
  runnerUp: RankedPerson | null;
  pitch: string;
  hmMessage: string;
  candidateMessages: { id: string; name: string; body: string }[];
  booleanSearch: string;
  cost: { benchEur: number; liveScrapeEur: { low: number; high: number }; note: string };
  scanned: number;
};

const DOMAIN_HINTS: [RegExp, Domain][] = [
  [/politie|defensie|rijksoverheid|gemeente|ministerie|provincie|omgevingsdienst|belasting|uwv|duo|kadaster|waterschap|veiligheidsregio|ggd|rechtbank/, "overheid"],
  [/bank|verzeker|pensioen|nn group|rabobank|ing\b|abn|aegon|achmea|a.s.r|asr |mollie|adyen|bunq/, "finance"],
  [/ziekenhuis|umc|ggz|zorg|vvt|apotheek/, "zorg"],
  [/logistiek|schiphol|haven|postnl|coolblue|bol\.com|ns |prorail/, "logistiek"],
  [/energie|alliander|enexis|tennet|gasunie|vattenfall/, "energie"],
];

const AVAIL_NL = { nu: "per direct", "2w": "binnen 2 weken", "1m": "over ±4 weken" } as const;

function detectDomain(text: string): Domain | null {
  const t = text.toLowerCase();
  for (const [re, d] of DOMAIN_HINTS) {
    if (re.test(t)) return d;
  }
  return null;
}

function extractMustHaves(text: string, family: RoleFamily | null): string[] {
  const hay = text.toLowerCase();
  const catalog: Record<RoleFamily, string[]> = {
    agile: ["SAFe", "Scrum", "Kanban", "Jira", "release train"],
    "ba-pm": ["BPMN", "SQL", "Jira", "Azure DevOps", "Archimate", "SAFe", "Power BI"],
    "cloud-devops": ["Kubernetes", "Terraform", "Azure", "AWS", "GCP", "CI/CD"],
    software: ["Java", "Kotlin", "Node.js", "TypeScript", ".NET", "Kafka", "Spring"],
    data: ["dbt", "Snowflake", "Python", "SQL", "Airflow", "Power BI"],
    "frontend-design": ["Figma", "React", "WCAG", "TypeScript", "design system"],
    security: ["IAM", "ISO 27001", "BIO", "NIS2", "SIEM"],
    test: ["Playwright", "Cypress", "TMap", "Azure DevOps", "ketentest"],
    "architecture-apps": ["Archimate", "TOGAF", "NORA", "Azure", "integratie"],
  };
  const pool = family ? catalog[family] : Object.values(catalog).flat();
  const hit = pool.filter((k) => hay.includes(k.toLowerCase()));
  return [...new Set(hit)].slice(0, 5);
}

function scorePerson(p: BenchPerson, opts: {
  family: RoleFamily | null;
  domain: Domain | null;
  mustHaves: string[];
  text: string;
}): { score: number; factors: FitFactor[]; why: string[] } {
  const factors: FitFactor[] = [];
  const why: string[] = [];

  if (opts.family && p.family === opts.family) {
    factors.push({ label: "Zelfde rol-familie", points: 36 });
  } else if (opts.family) {
    factors.push({ label: "Andere rol-familie", points: -18 });
  }

  if (opts.domain && p.domains.includes(opts.domain)) {
    factors.push({ label: `Domein ${opts.domain}`, points: 22 });
    why.push(p.highlights[0] || p.last);
  }

  const stackHits = p.stack.filter((s) =>
    opts.mustHaves.some((m) => m.toLowerCase() === s.toLowerCase()) ||
    opts.text.toLowerCase().includes(s.toLowerCase())
  );
  if (stackHits.length) {
    const pts = Math.min(24, stackHits.length * 8);
    factors.push({ label: `Stack: ${stackHits.slice(0, 3).join(", ")}`, points: pts });
    why.push(`Overlap ${stackHits.slice(0, 3).join(", ")}`);
  }

  if (p.available === "nu") {
    factors.push({ label: "Per direct beschikbaar", points: 12 });
  } else if (p.available === "2w") {
    factors.push({ label: "Binnen 2 weken", points: 6 });
  }

  if (p.zzpYears >= 8) factors.push({ label: `${p.zzpYears} jaar ZZP`, points: 8 });
  else if (p.zzpYears >= 5) factors.push({ label: `${p.zzpYears} jaar ZZP`, points: 4 });

  if (/\bzuid|brabant|eindhoven|tilburg|den bosch|maastricht/i.test(opts.text) &&
      /eindhoven|tilburg|den bosch|maastricht|heerlen/i.test(p.city)) {
    factors.push({ label: `Regio ${p.city}`, points: 8 });
  }

  const score = Math.max(0, factors.reduce((a, f) => a + f.points, 0));
  if (!why.length) why.push(p.last);
  if (why.length < 2 && p.highlights[1]) why.push(p.highlights[1]);
  return { score, factors: factors.filter((f) => f.points > 0 || f.points < 0), why: why.slice(0, 2) };
}

function hmFirstName(targets: ReturnType<typeof buildApproach>["targets"]) {
  const person = targets.find((t) => t.kind === "person" && t.cta === "bericht");
  if (!person) return null;
  return person.label.split(/\s+/)[0] || person.label;
}

export function buildPlacement(input: PlacementInput): PlacementProposal {
  const blob = `${input.company} ${input.openingTitle} ${input.roleLabel} ${input.department || ""} ${input.summary || ""}`;
  const family =
    detectFamily(`${input.openingTitle} ${input.roleLabel}`) ||
    detectFamily(input.department || "") ||
    detectFamily(input.summary || "");
  const domain = detectDomain(blob);
  const mustHaves = extractMustHaves(blob, family);
  const companyShort = linkedinCompanyQuery(input.company);

  const org: OrgContext = {
    department: input.department || null,
    hiringManager: input.hiringManager || null,
    hiringManagerTitle: input.hiringManagerTitle || null,
    contactName: input.contactName || null,
    contactTitle: input.contactTitle || null,
    contactUrl: input.contactUrl || null,
  };
  const hiring = buildApproach({
    company: input.company,
    roleLabel: input.roleLabel,
    openingTitle: input.openingTitle,
    org,
    companyLinkedinUrl: input.companyLinkedinUrl,
  }).targets;

  const ranked: RankedPerson[] = BENCH.map((person) => {
    const s = scorePerson(person, { family, domain, mustHaves, text: blob });
    return {
      person,
      score: s.score,
      factors: s.factors,
      why: s.why,
      linkedinUrl: linkedinPeopleAtCompany({
        company: input.company,
        companyLinkedinUrl: input.companyLinkedinUrl,
        keywords: `"${person.name}"`,
      }),
    };
  }).sort((a, b) => b.score - a.score);

  const shortlist = ranked.filter((r) => r.score > 0).slice(0, 3);
  const runnerUp = ranked[3] && ranked[3].score > 0 ? ranked[3] : null;

  const start = shortlist.some((s) => s.person.available === "nu")
    ? "deze maand"
    : "binnen twee tot vier weken";
  const pitch =
    shortlist.length === 3
      ? `Drie ZZP’ers klaar voor ${input.roleLabel.toLowerCase()} bij ${companyShort} — ${start}.`
      : `Te weinig match in de bench voor ${input.roleLabel}; boolean-zoek staat klaar.`;

  const hmName = hmFirstName(hiring);
  const greet = hmName ? `Hoi ${hmName}` : `Hoi`;
  const lines = shortlist
    .map((s, i) => `${i + 1}. ${s.person.name} (${s.person.title}, ${s.person.city}) — ${s.why[0]}`)
    .join("\n");
  const hmMessage = `${greet},

Voor ${input.openingTitle} bij ${input.company} kan ik drie ZZP’ers voorstellen die ${start} kunnen starten:

${lines || "(nog geen match in de huidige bench)"}

Past het om 20 minuten te bellen? Ik stuur cv’s na een kort ja.
`;

  const candidateMessages = shortlist.map((s) => ({
    id: s.person.id,
    name: s.person.name,
    body: `Hoi ${s.person.name.split(" ")[0]},

${input.company} zoekt ${input.roleLabel} (${input.openingTitle}). ${s.why[0]}.
Start ${AVAIL_NL[s.person.available]}, ZZP.

Heb je ruimte voor een kort gesprek?
`,
  }));

  const roleQ = input.roleLabel;
  const booleanSearch = `("${roleQ}" OR "${input.openingTitle}") AND (ZZP OR freelance OR interim OR contract) AND "${companyShort === input.company ? "Nederland" : companyShort}"`;

  return {
    company: input.company,
    companyShort,
    openingTitle: input.openingTitle,
    roleLabel: input.roleLabel,
    family,
    domain,
    mustHaves,
    hiring,
    shortlist,
    runnerUp,
    pitch,
    hmMessage: hmMessage.trim(),
    candidateMessages,
    booleanSearch,
    cost: {
      benchEur: 0,
      liveScrapeEur: { low: 1, high: 5 },
      note: "Bench-match is €0. Live people-scrape (optioneel, later) ≈ €1–5 per opening.",
    },
    scanned: BENCH.length,
  };
}

export function placementFromSignals(opts: {
  company: string;
  openingTitle: string;
  roleLabel: string;
  org: OrgContext;
  signals: { summary?: string | null; raw?: Record<string, unknown> | null }[];
}): PlacementProposal {
  const summary = opts.signals
    .map((s) => [s.summary, typeof s.raw?.description === "string" ? s.raw.description : ""].join("\n"))
    .join("\n");
  return buildPlacement({
    company: opts.company,
    openingTitle: opts.openingTitle,
    roleLabel: opts.roleLabel,
    department: opts.org.department,
    hiringManager: opts.org.hiringManager,
    hiringManagerTitle: opts.org.hiringManagerTitle,
    contactName: opts.org.contactName,
    contactTitle: opts.org.contactTitle,
    contactUrl: opts.org.contactUrl,
    summary,
    companyLinkedinUrl: companyLinkedinFromSignals(opts.signals),
  });
}
