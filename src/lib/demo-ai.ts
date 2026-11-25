/**
 * Gesimuleerde "AI zoeken" voor de demo-omgeving.
 *
 * Prospects moeten de kernstap (vage post → eindklant mét bewijs) kunnen zien,
 * zonder dat een demo-klik echte Anthropic/web-kosten maakt. Elke sample-post
 * heeft daarom een vast, geloofwaardig resultaat — inclusief een twijfelgeval
 * en posts die de AI terecht wegzet (vast dienstverband = geen opdracht).
 */
import type { ClientGuess } from "@/lib/end-client";
import type { ResearchProgress, ResearchReport } from "@/lib/research/types";

type DemoHit = {
  kind: "hit";
  guess: ClientGuess;
  sources: string[];
  queries: string[];
};

type DemoMiss = {
  kind: "miss";
  detail: string;
  notAssignment: boolean;
};

export type DemoAiOutcome = DemoHit | DemoMiss;

function band(c: number): ResearchReport["confidenceBand"] {
  if (c >= 85) return "very_high";
  if (c >= 70) return "high";
  if (c >= 45) return "medium";
  if (c >= 25) return "low";
  return "very_low";
}

function hit(opts: {
  name: string;
  confidence: number;
  summary: string;
  check: string;
  evidence: ClientGuess["evidence"];
  alternatives?: ClientGuess["alternatives"];
  counter?: string[];
  sources: string[];
  queries: string[];
}): DemoHit {
  const guess: ClientGuess = {
    name: opts.name,
    confidence: opts.confidence,
    evidence: opts.evidence,
    alternatives: opts.alternatives || [],
    source: "ai",
    summary: opts.summary,
    check: opts.check,
  };
  guess.report = {
    method: "ai",
    depth: "standard",
    confidenceBand: band(opts.confidence),
    hypothesis: `${opts.name} — ${opts.summary}`,
    why: opts.summary,
    ranking: [
      {
        name: opts.name,
        confidence: opts.confidence,
        why: opts.evidence.map((e) => e.label).join("; "),
        evidence: opts.evidence.map((e) => ({
          claim: e.label,
          strength: e.weight >= 70 ? "high" : e.weight >= 40 ? "medium" : "low",
          source: e.quote,
        })),
        counterEvidence: opts.counter || [],
      },
      ...(opts.alternatives || []).map((a) => ({
        name: a.name,
        confidence: a.confidence,
        why: "Past deels op sector en regio",
        whyLower: "Minder overlap met stack en timing",
        evidence: [],
        counterEvidence: [],
      })),
    ],
    counterEvidence: opts.counter || [],
    timeline: [],
    sources: opts.sources.map((title) => ({ title, tier: 2 as const })),
    scoringNotes: "Demo · vast voorbeeldresultaat, geen live webzoektocht.",
    openQuestions: [opts.check],
    trace: {
      rounds: 2,
      queries: opts.queries,
      searches: opts.queries.length,
      scrapes: Math.min(2, opts.sources.length),
      internalMatches: 1,
    },
  };
  return { kind: "hit", guess, sources: opts.sources, queries: opts.queries };
}

const OUTCOMES: Record<string, DemoAiOutcome> = {
  demo_tergos_cloud: hit({
    name: "Alliander",
    confidence: 84,
    summary: "Zelfde stack (Azure/AKS, Terraform, Keycloak) en dezelfde looptijd als een eigen vacature van de netbeheerder.",
    check: "vraag Quinten of het team onder ‘Digital Security’ valt — dan zit je goed.",
    evidence: [
      { label: "Stack in de post", quote: "Azure, Kubernetes (AKS), Terraform, CI/CD … Keycloak", weight: 55, origin: "post" },
      { label: "Eigen vacature eindklant met dezelfde IAM-toolkit", weight: 80, origin: "web" },
      { label: "Recruiter plaatste eerder 2 cloud-rollen bij deze klant", weight: 60, origin: "history" },
    ],
    alternatives: [
      { name: "Enexis", confidence: 41 },
      { name: "Stedin", confidence: 33 },
    ],
    counter: ["Locatie staat alleen als ‘hybride’ — geen stad bevestigd."],
    sources: ["Werkenbij-pagina eindklant · Cloud Security Engineer (IAM)", "Eerdere post zelfde recruiter · Azure Platform Engineer"],
    queries: ["\"Keycloak\" \"AKS\" Terraform vacature IAM", "Tergos cloud engineer IAM opdracht"],
  }),
  demo_cf_ai_gov: hit({
    name: "Booking.com",
    confidence: 88,
    summary: "Computer Futures + ‘Diemen’ + ‘large international tech company’ — hetzelfde patroon als hun andere Booking-opdrachten.",
    check: "valt het programma onder Data Governance of onder L&D? Dat bepaalt wie de hiring manager is.",
    evidence: [
      { label: "Omschrijving van de klant", quote: "large international company in Amsterdam", weight: 35, origin: "post" },
      { label: "Locatie in de post", quote: "Location listed: Diemen", weight: 50, origin: "post" },
      { label: "Zelfde bureau plaatst Booking-rollen met codes als ‘SE2’", weight: 75, origin: "history" },
      { label: "Data & AI Literacy-programma publiek aangekondigd", weight: 70, origin: "web" },
    ],
    alternatives: [{ name: "Adyen", confidence: 22 }],
    sources: ["Bureau-vacature Booking — 12785 — SE2 GenAI", "Artikel over AI-literacy-programma eindklant"],
    queries: ["\"Data & AI Literacy\" Amsterdam programma", "Computer Futures Diemen contract data governance"],
  }),
  demo_eswelt_sap: hit({
    name: "thyssenkrupp Materials Services",
    confidence: 58,
    summary: "Industrie in NRW met een lopende S/4HANA-conversie — past, maar er zijn meer kandidaten.",
    check: "twijfelgeval — vraag Nathan naar de branche of de start in januari voordat je de manager zoekt.",
    evidence: [
      { label: "Regio + sector in de post", quote: "Kunden aus der Industrie … Hybrid-Einsatz in NRW", weight: 45, origin: "post" },
      { label: "Lopend programma", quote: "S/4HANA Conversion", weight: 30, origin: "post" },
      { label: "Publieke S/4HANA-conversie bij deze klant", weight: 55, origin: "web" },
    ],
    alternatives: [
      { name: "Henkel", confidence: 39 },
      { name: "Evonik", confidence: 31 },
    ],
    counter: ["Duitstalige post via een NL-bureau — eindklant kan ook een partner van de klant zijn."],
    sources: ["Persbericht S/4HANA-migratie", "Bureau-profiel Eswelt · SAP Basis"],
    queries: ["S/4HANA Conversion NRW Industrie 2026", "SAP Basis Freelance NRW Januar"],
  }),
  demo_elev_food: {
    kind: "miss",
    detail: "Vast dienstverband (32–40 uur) — geen freelance opdracht, dus weggezet.",
    notAssignment: true,
  },
  demo_visser_data: {
    kind: "miss",
    detail: "Vaste baan bij het bureau zelf (‘vast dienstverband’) — geen opdracht voor een eindklant.",
    notAssignment: true,
  },
};

export function demoAiOutcome(id: string): DemoAiOutcome {
  return (
    OUTCOMES[id] || {
      kind: "miss",
      detail: "Te weinig aanknopingspunten in de post om een eindklant te noemen.",
      notAssignment: false,
    }
  );
}

const STEPS: { label: string; detail: string; pct: number; ms: number }[] = [
  { label: "Post lezen", detail: "Stack, locatie, looptijd en bureau eruit halen", pct: 18, ms: 700 },
  { label: "Terugzoeken", detail: "Eerdere posts van deze recruiter + eigen geheugen", pct: 42, ms: 900 },
  { label: "Web zoeken", detail: "Vacatures en nieuws van mogelijke eindklanten", pct: 70, ms: 1200 },
  { label: "Bewijs wegen", detail: "Score per kandidaat en tegenbewijs", pct: 92, ms: 700 },
];

/** Speelt een korte, realistische voortgang af (± 3,5 s). */
export async function playDemoProgress(emit: (p: ResearchProgress) => void) {
  const total = STEPS.reduce((s, x) => s + x.ms, 0);
  let spent = 0;
  for (const [i, step] of STEPS.entries()) {
    emit({
      step: `demo-${i}`,
      label: step.label,
      detail: step.detail,
      pct: step.pct,
      etaSec: Math.max(1, Math.round((total - spent) / 1000)),
    });
    await new Promise((r) => setTimeout(r, step.ms));
    spent += step.ms;
  }
}
