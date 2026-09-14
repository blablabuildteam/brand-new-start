import { researchEndClient } from "@/lib/research/agent";
import type { ResearchDepth } from "@/lib/research/types";

/**
 * Eval-set for End-client Intelligence.
 *
 * Without this, "de AI is beter geworden" is a feeling. Each case has a known
 * (or strongly evidenced) end client, so prompt/scoring changes can be measured
 * instead of guessed. Add real closed deals here — that is where the value is.
 */

export type EvalCase = {
  id: string;
  title: string;
  text: string;
  agencyName: string;
  recruiterName?: string;
  /** Accepted answers, including aliases and spelling variants. */
  expected: string[];
  /** Names that would be a hard miss (e.g. the agency itself). */
  forbidden?: string[];
  /**
   * Several answers are defensible. A correct answer at low confidence is then
   * good behaviour, not bad calibration.
   */
  ambiguous?: boolean;
  /**
   * Vacancy already contains the client name (title/code). Trivial — not the
   * metric we optimise. The product is anonymous high-confidence hits.
   */
  nameLeak?: boolean;
  note?: string;
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: "booking_genai",
    title: "Booking — 12785 — SE2 GenAI",
    text: "GenAI Developer - Java | AWS | Kubernetes. For an international e-commerce client, we are looking for an experienced Gen AI Developer to help build and scale intelligent, cloud-native solutions used by millions of users. You will work in a modern microservices environment where Java, AWS, and Kubernetes form the backbone, and Generative AI is becoming a core part of the platform. Location: Diemen. Role type: Contract. Start: ASAP.",
    agencyName: "Computer Futures",
    expected: ["Booking.com", "Booking", "Booking Holdings"],
    forbidden: ["Computer Futures", "SThree"],
    nameLeak: true,
    note: "Naamlek in de titel — triviaal. Mag ~100% zijn; telt niet mee voor de productmetriek.",
  },
  {
    id: "port_sap_alc",
    title: "Scrum Master gezocht | SAP ERP-transformatie",
    text: "Voor een strategisch SAP ERP-transformatieprogramma bij een klant van mij zoek ik een ervaren Scrum Master. 5+ jaar ervaring als Scrum Master; ervaring met complexe transformaties; SAP/ERP-ervaring, bij voorkeur S/4HANA. Locatie Rotterdam. Programma Asset Life Cycle (ALC). SAP als centraal platform, geïntegreerd met o.a. IoT, GIS, ACC en ServiceNow. Scrum Master voor teams rond SAP, integratie en datamigratie. Opdracht circa 24 uur per week.",
    agencyName: "Vibe Group",
    expected: ["Havenbedrijf Rotterdam", "Port of Rotterdam"],
    forbidden: ["Vibe Group"],
    note: "PRODUCTCASE: geen klantnaam. Asset Life Cycle + GIS + Rotterdam moet met hoge zekerheid Havenbedrijf opleveren.",
  },
  {
    id: "spilberg_java_ams",
    title: "Senior Software Engineer — Backend",
    text: "Currently we have several open positions at our client located in Amsterdam. Position: Senior Software Engineer - Backend (8+ years of experience). Location: Amsterdam - Hybrid. Team: High Traffic environment. Startdate: As soon as possible. Hourly rate: €85-90. Technical stack: Java, Spring Boot, Docker, Kubernetes, Microservice, API integrations, Terraform, CI/CD, Kafka, Streaming platforms (Flink, Kafka Streams), AWS, JS Frameworks (React, Vue).",
    agencyName: "Spilberg",
    recruiterName: "Nicky Klaver",
    expected: ["Booking.com", "Adyen", "bol", "bol.com", "Albert Heijn", "ING", "Catawiki"],
    forbidden: ["Spilberg"],
    ambiguous: true,
    note: "Bewust breed: high-traffic Amsterdam + Java/Kafka/AWS. Test of het model in de juiste vijver vist, niet of het één naam raakt.",
  },
  {
    id: "iam_azure_hybrid",
    title: "Freelance Cloud Engineer — IAM & security",
    text: "Voor een relatie van Tergos ben ik per direct op zoek naar een freelance Cloud Engineer met affiniteit voor Identity & Access Management en security tooling. Bouwen en beheren van security- en IAM-toolkits via Terraform (IaC). Ondersteunen van developmentteams bij integratie in CI/CD-processen. Ervaring met Azure, Kubernetes (AKS), Terraform, CI/CD. Kennis van IAM-oplossingen zoals Keycloak. Start: z.s.m. Duur: 6 of 12 maanden. Locatie: Hybride. Uren: 40.",
    agencyName: "Tergos",
    expected: [],
    forbidden: ["Tergos"],
    note: "Kalibratie-case: te weinig signalen. Goed gedrag = lage confidence, niet een stoere gok.",
  },
];

export type EvalResult = {
  id: string;
  expected: string[];
  top: string | null;
  confidence: number | null;
  ranking: { name: string; confidence: number }[];
  hitAt1: boolean;
  hitAt3: boolean;
  forbiddenHit: boolean;
  /** For cases without a known answer: did it stay appropriately humble? */
  calibrated: boolean;
  detail: string;
  ms: number;
};

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(b\.?v\.?|n\.?v\.?|holdings?|group|nederland|netherlands)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function matches(name: string, expected: string[]) {
  const n = normalizeName(name);
  if (!n) return false;
  return expected.some((e) => {
    const x = normalizeName(e);
    return x.length >= 3 && (n === x || n.includes(x) || x.includes(n));
  });
}

export async function runEvalCase(c: EvalCase, depth: ResearchDepth): Promise<EvalResult> {
  const started = Date.now();
  const res = await researchEndClient({
    title: c.title,
    text: c.text,
    agencyName: c.agencyName,
    recruiterName: c.recruiterName,
    depth,
  });

  const ranking = (res.report?.ranking || []).map((r) => ({ name: r.name, confidence: r.confidence }));
  const top = res.guess?.name || null;
  const confidence = res.guess?.confidence ?? null;
  const openCase = c.expected.length === 0;

  const hitAt1 = !openCase && Boolean(top && matches(top, c.expected));
  const hitAt3 = !openCase && ranking.slice(0, 3).some((r) => matches(r.name, c.expected));
  const forbiddenHit = Boolean(c.forbidden?.length) && ranking.some((r) => matches(r.name, c.forbidden!));

  // Calibration depends on the case type:
  // - nameLeak: trivial → expect ~100
  // - anonymous product case: expect high confidence on hit (≥85)
  // - ambiguous / open: stay humble
  const calibrated = openCase
    ? (confidence ?? 0) <= 55
    : c.nameLeak
      ? hitAt1 && (confidence ?? 0) >= 95
      : c.ambiguous
        ? (confidence ?? 0) <= 70
        : hitAt1
          ? (confidence ?? 0) >= 85
          : (confidence ?? 0) <= 55;

  return {
    id: c.id,
    expected: c.expected,
    top,
    confidence,
    ranking,
    hitAt1,
    hitAt3,
    forbiddenHit,
    calibrated,
    detail: res.detail,
    ms: Date.now() - started,
  };
}

export async function runEval(opts?: { depth?: ResearchDepth; ids?: string[] }) {
  const depth = opts?.depth || "standard";
  const cases = opts?.ids?.length ? EVAL_CASES.filter((c) => opts.ids!.includes(c.id)) : EVAL_CASES;

  const results: EvalResult[] = [];
  // Sequential: the web budget and Anthropic rate limits are per run, not per case.
  for (const c of cases) {
    results.push(await runEvalCase(c, depth));
  }

  const byId = new Map(cases.map((c) => [c.id, c]));
  const scored = results.filter((r) => r.expected.length > 0);
  const anonymous = scored.filter((r) => !byId.get(r.id)?.nameLeak && !byId.get(r.id)?.ambiguous);
  const nameLeaks = scored.filter((r) => byId.get(r.id)?.nameLeak);
  const strict = scored.filter((r) => !byId.get(r.id)?.ambiguous);
  const hits1 = scored.filter((r) => r.hitAt1).length;
  const hits3 = scored.filter((r) => r.hitAt3).length;
  const anonHits = anonymous.filter((r) => r.hitAt1);

  return {
    depth,
    cases: results.length,
    metrics: {
      /** North-star: anonymous vacancies with one right answer. */
      anonymousHitAt1: anonymous.length
        ? Number((anonHits.length / anonymous.length).toFixed(2))
        : null,
      avgConfidenceOnAnonymousHit: avg(anonHits.map((r) => r.confidence ?? 0)),
      nameLeakHitAt1: nameLeaks.length
        ? Number((nameLeaks.filter((r) => r.hitAt1).length / nameLeaks.length).toFixed(2))
        : null,
      avgConfidenceOnNameLeak: avg(nameLeaks.filter((r) => r.hitAt1).map((r) => r.confidence ?? 0)),
      hitAt1: scored.length ? Number((hits1 / scored.length).toFixed(2)) : null,
      hitAt1Strict: strict.length
        ? Number((strict.filter((r) => r.hitAt1).length / strict.length).toFixed(2))
        : null,
      hitAt3: scored.length ? Number((hits3 / scored.length).toFixed(2)) : null,
      calibration: results.length
        ? Number((results.filter((r) => r.calibrated).length / results.length).toFixed(2))
        : null,
      agencyLeaks: results.filter((r) => r.forbiddenHit).length,
      avgConfidenceOnHit: avg(scored.filter((r) => r.hitAt1).map((r) => r.confidence ?? 0)),
      avgConfidenceOnMiss: avg(scored.filter((r) => !r.hitAt1).map((r) => r.confidence ?? 0)),
      avgMs: avg(results.map((r) => r.ms)),
    },
    results,
  };
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
