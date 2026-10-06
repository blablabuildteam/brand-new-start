/**
 * Contracting-kader: ingestelde rollen (Instellingen) + interne families voor matching.
 */

import { huntRoles, huntSettings } from "@/lib/hunt";

export const NICHE = {
  id: "contracting-nl",
  label: "Contracting NL",
  market: "Nederland",
} as const;

export type RoleFamily =
  | "agile"
  | "cloud-devops"
  | "software"
  | "data"
  | "frontend-design"
  | "security"
  | "ba-pm"
  | "test"
  | "architecture-apps";

/** Practice areas — intern voor familie-detectie, niet de hunt-gate. */
export const ROLE_FAMILIES: {
  id: RoleFamily;
  label: string;
  keywords: string[];
}[] = [
  {
    id: "agile",
    label: "Agile / Scrum",
    keywords: [
      "scrum master",
      "scrummaster",
      "agile coach",
      "agile delivery",
      "delivery manager",
      "delivery lead",
      "release train engineer",
      "rte",
      "safe coach",
      "kanban coach",
      "chapter lead agile",
      "tribe coach",
      "product owner",
    ],
  },
  {
    id: "cloud-devops",
    label: "Cloud & DevOps",
    keywords: [
      "devops",
      "cloud engineer",
      "platform engineer",
      "sre",
      "site reliability",
      "kubernetes",
      "ci/cd",
      "azure devops",
      "aws engineer",
      "gcp engineer",
    ],
  },
  {
    id: "software",
    label: "Software engineering",
    keywords: [
      "java",
      "node.js",
      "nodejs",
      "node js",
      ".net",
      "dotnet",
      "c#",
      "backend engineer",
      "backend developer",
      "full stack",
      "fullstack",
      "software engineer",
      "software developer",
    ],
  },
  {
    id: "data",
    label: "Data & intelligence",
    keywords: [
      "data engineer",
      "data scientist",
      "data analyst",
      "analytics engineer",
      "bi developer",
      "machine learning",
      "ml engineer",
    ],
  },
  {
    id: "frontend-design",
    label: "Frontend & product design",
    keywords: [
      "frontend",
      "front-end",
      "react",
      "typescript",
      "javascript",
      "ux designer",
      "ui designer",
      "product designer",
      "service designer",
    ],
  },
  {
    id: "security",
    label: "Information security",
    keywords: [
      "biso",
      "ciso",
      "iam",
      "identity and access",
      "security engineer",
      "security specialist",
      "cybersecurity",
      "information security",
    ],
  },
  {
    id: "ba-pm",
    label: "Business analysis & project",
    keywords: [
      "business analist",
      "business analyst",
      "functioneel ontwerper",
      "project manager",
      "projectmanager",
      "project lead",
      "programma manager",
      "program manager",
    ],
  },
  {
    id: "test",
    label: "Test",
    keywords: [
      "test engineer",
      "test lead",
      "testanalist",
      "test analyst",
      "qa engineer",
      "quality assurance",
      "cucumber",
    ],
  },
  {
    id: "architecture-apps",
    label: "Architecture & application management",
    keywords: [
      "enterprise architect",
      "it architect",
      "solution architect",
      "application manager",
      "applicatiebeheerder",
      "workplace engineer",
    ],
  },
];

export const CONTRACT_KEYWORDS = [
  "zzp",
  "interim",
  "freelance",
  "freelancer",
  "contractor",
  "contracting",
  "detachering",
  "detacheringsovereenkomst",
  "secondment",
  "tijdelijke opdracht",
  "tijdelijke inhuur",
  "externe inhuur",
  "inhuur",
  "uurtarief",
  "hourly rate",
  "day rate",
  "dagprijs",
  "temporary",
  "temp contract",
  "externe kracht",
  "opdrachtbasis",
] as const;

/**
 * Woorden die alléén externe inhuur kunnen betekenen. Bewust zonder "extern"
 * en "contracting": die staan in de boilerplate van half de vacaturemarkt
 * ("externe kandidaten", "IT contracting bureau") en lieten vaste banen door.
 */
const STRONG_EXTERNAL =
  /\b(zzp|zzp'?ers?|interim|freelance|freelancers?|contractor|detachering|detacheringsovereenkomst|secondment|uurtarief|dagtarief|dagprijs|hourly rate|day rate|inhuur|opdrachtbasis)\b/i;

export function hasStrongExternalSignal(text: string): boolean {
  return STRONG_EXTERNAL.test(text);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CONTRACT_RE = new RegExp(`\\b(${CONTRACT_KEYWORDS.map(escapeRe).join("|")})\\b`, "i");

/** Signalen voor interne werving / vast dienstverband — nooit externe plaatsing. */
export const PERMANENT_HINTS = [
  "vast dienstverband",
  "vaste dienst",
  "vast contract",
  "vaste aanstelling",
  "onbepaalde tijd",
  "permanent contract",
  "permanent position",
  "permanent role",
  "full-time permanent",
  "fulltime permanent",
  "in loondienst",
  "arbeidsovereenkomst voor onbepaalde",
  "arbeidscontract voor onbepaalde",
] as const;

/** "geen vast dienstverband" is juist een ZZP-signaal, geen interne werving. */
function permanentNegated(t: string): boolean {
  return /\b(geen|niet|nooit|zonder)\b[^.!?]{0,40}?(vast[a-z]*\s+(dienstverband|dienst|contract|aanstelling)|loondienst|onbepaalde tijd)/.test(
    t
  );
}

export function looksLikePermanent(text: string): boolean {
  const t = text.toLowerCase();
  if (permanentNegated(t)) return false;

  // Titel en eerste regel komen van de werkgever zelf. Staat daar "vast
  // contract", dan is het een vaste baan — ook als verderop in de boilerplate
  // "interim" of "inhuur" valt.
  const head = t.slice(0, 180);
  const headPerm =
    PERMANENT_HINTS.some((k) => head.includes(k)) ||
    (/\bvast\b/.test(head) && /\b(dienstverband|dienst|aanstelling|loondienst)\b/.test(head));
  if (headPerm && !hasStrongExternalSignal(head)) return true;

  if (PERMANENT_HINTS.some((k) => t.includes(k))) {
    return !hasStrongExternalSignal(t);
  }
  if (/\bvast\b/.test(t) && /\b(dienstverband|dienst|salaris|fte|loondienst|aanstelling)\b/.test(t)) {
    return !hasStrongExternalSignal(t);
  }
  return false;
}

export function matchesContract(text: string): boolean {
  const t = text.toLowerCase();
  if (CONTRACT_RE.test(t)) return true;
  // "contract" alleen met externe companion — bare "arbeidscontract" telt niet
  if (
    /\b(contract\s*(rol|role|basis|positie|position|assignment|opdracht)|contracting)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\bcontract\b/.test(t) &&
    /\b(zzp|interim|freelance|freelancer|detach|tijdelijk|temp|extern|inhuur|contractor)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Externe plaatsing: contract/ZZP/interim — niet vast in dienst. */
export function isExternalPlacementText(text: string): boolean {
  if (looksLikePermanent(text)) return false;
  return matchesContract(text);
}

export type EmploymentVerdict = "extern" | "vast" | "onbekend";

/**
 * Het dienstverband-veld van de jobboard is het hardste signaal dat we hebben.
 * "Full-time" betekent op LinkedIn een dienstverband, niet een opdracht —
 * dat veld negeren was de reden dat de radar volliep met perm-rollen.
 */
export function employmentTypeVerdict(raw: string | null | undefined): EmploymentVerdict {
  const t = (raw || "").toLowerCase().trim();
  if (!t) return "onbekend";
  if (/contract|interim|zzp|freelance|temporary|tijdelijk|detach|secondment/.test(t)) {
    return /\bpermanent\b|\bvast\b/.test(t) ? "vast" : "extern";
  }
  if (/full[\s-]?time|part[\s-]?time|permanent|vast|loondienst/.test(t)) return "vast";
  return "onbekend";
}

/**
 * Eén beslissing voor "is dit een externe plaatsing?", op basis van het
 * dienstverband-veld én de tekst. Gebruik dit overal; losse tekstchecks
 * lieten te veel vaste banen door.
 */
export function isExternalRole(opts: { text: string; employmentType?: string | null }): boolean {
  const verdict = employmentTypeVerdict(opts.employmentType);
  if (verdict === "extern") return true;
  if (verdict === "vast") {
    // Een Full-time post met een uurtarief- of ZZP-passage is alsnog inhuur.
    return hasStrongExternalSignal(opts.text) && !looksLikePermanent(opts.text);
  }
  return isExternalPlacementText(opts.text);
}

/** Korte uitleg waarom iets niet op de radar hoort. */
export function notExternalReason(opts: { text: string; employmentType?: string | null }): string {
  const verdict = employmentTypeVerdict(opts.employmentType);
  if (verdict === "vast") {
    return `vast dienstverband (jobboard: ${opts.employmentType})`;
  }
  if (looksLikePermanent(opts.text)) return "vast dienstverband (interne werving)";
  return "geen externe plaatsing (ZZP/interim/contract)";
}

export const TENDER_KEYWORDS = [
  "scrum",
  "agile",
  "devops",
  "cloud",
  "softwareontwikkeling",
  "software development",
  "data platform",
  "cybersecurity",
  "informatiebeveiliging",
  "projectmanagement",
  "digitale transformatie",
  "applicatiebeheer",
] as const;

function compact(s: string) {
  return s.toLowerCase().replace(/[\s./-]+/g, "");
}

function roleNeedles(role: string): string[] {
  const r = role.toLowerCase().trim();
  if (r.length < 2) return [];
  const swapped = r.replace(/\banalist\b/g, "analyst").replace(/\banalyst\b/g, "analist");
  return [...new Set([r, compact(r), swapped, compact(swapped)].filter((x) => x.length >= 2))];
}

export function matchesRole(text: string): boolean {
  const t = text.toLowerCase();
  const tc = compact(text);
  for (const role of huntRoles()) {
    for (const n of roleNeedles(role)) {
      if (t.includes(n)) return true;
      const nc = compact(n);
      if (nc.length >= 5 && tc.includes(nc)) return true;
    }
  }
  return false;
}

export function matchesTender(text: string): boolean {
  const t = text.toLowerCase();
  return TENDER_KEYWORDS.some((k) => t.includes(k)) || matchesRole(t);
}

export function detectFamily(text: string): RoleFamily | null {
  const t = text.toLowerCase();
  for (const family of ROLE_FAMILIES) {
    if (family.keywords.some((k) => t.includes(k))) return family.id;
  }
  return null;
}

export function detectRoleLabel(text: string): string {
  const t = text.toLowerCase();
  const checks: [string, string][] = [
    ["agile coach", "Agile Coach"],
    ["scrum master", "Scrum Master"],
    ["scrummaster", "Scrum Master"],
    ["product owner", "Product Owner"],
    ["release train", "Release Train Engineer"],
    ["business analist", "Business Analist"],
    ["business analyst", "Business Analyst"],
    ["project manager", "Project Manager"],
    ["projectmanager", "Project Manager"],
    ["test lead", "Test Lead"],
    ["test engineer", "Test Engineer"],
    ["devops", "DevOps Engineer"],
    ["platform engineer", "Platform Engineer"],
    ["cloud engineer", "Cloud Engineer"],
    ["data engineer", "Data Engineer"],
    ["data scientist", "Data Scientist"],
    ["enterprise architect", "Enterprise Architect"],
    ["solution architect", "Solution Architect"],
    ["application manager", "Application Manager"],
    ["biso", "BISO"],
    ["iam", "IAM Engineer"],
    ["node.js", "Node.js Developer"],
    ["nodejs", "Node.js Developer"],
    ["react", "React / Frontend"],
    ["typescript", "TypeScript Developer"],
    [".net", ".NET Developer"],
    ["java", "Java Developer"],
    ["ux designer", "UX Designer"],
    ["workplace engineer", "Workplace Engineer"],
  ];
  for (const [needle, label] of checks) {
    if (t.includes(needle)) return label;
  }
  const family = detectFamily(t);
  if (family) {
    return ROLE_FAMILIES.find((f) => f.id === family)?.label || "IT contracting";
  }
  return "IT contracting";
}
