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
  "contractor",
  "contract",
  "detachering",
  "detacheringsovereenkomst",
  "tijdelijk",
  "temporary",
  "extern",
] as const;

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

export function matchesContract(text: string): boolean {
  const t = text.toLowerCase();
  return CONTRACT_KEYWORDS.some((k) => t.includes(k));
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
