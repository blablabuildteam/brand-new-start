import {
  AGENCY_WATCHLIST,
  isWatchedAgency,
  matchAgency,
  watchedAgencies,
  watchedRecruitersFor,
  type Agency,
  type AgencyRecruiter,
} from "@/lib/agency";
import {
  extractVacancyFacts,
  guessEndClient,
  leadStatusFromGuess,
  type ClientGuess,
  type VacancyFacts,
} from "@/lib/end-client";
import { detectRoleLabel } from "@/lib/niche";
import { listSignals, patchSignalRaw } from "@/lib/store";

export type LeadStatus = "suggest" | "review" | "weak" | "confirmed" | "rejected";

export type AgencyLead = {
  id: string;
  demo: boolean;
  employment: "contract";
  title: string;
  roleLabel: string;
  agency: { id: string; name: string };
  recruiter: { name: string | null; title: string | null; url: string | null };
  facts: VacancyFacts;
  guess: ClientGuess | null;
  /** true als de gok van OpenAI komt */
  aiGuess: boolean;
  status: LeadStatus;
  confirmedClient: string | null;
  evidenceUrl: string | null;
  summary: string;
  signalId?: string;
};

type Review = {
  status: "confirmed" | "rejected";
  clientName?: string;
};

type StoredAi = {
  guess: ClientGuess;
  at: string;
  model?: string;
};

const g = globalThis as unknown as {
  __bnsLeadReviews?: Map<string, Review>;
  __bnsAiGuesses?: Map<string, StoredAi>;
};

function reviews() {
  if (!g.__bnsLeadReviews) g.__bnsLeadReviews = new Map();
  return g.__bnsLeadReviews;
}

function aiGuesses() {
  if (!g.__bnsAiGuesses) g.__bnsAiGuesses = new Map();
  return g.__bnsAiGuesses;
}

function applyReview(lead: AgencyLead): AgencyLead {
  const r = reviews().get(lead.id);
  if (!r) return lead;
  return {
    ...lead,
    status: r.status,
    confirmedClient: r.status === "confirmed" ? r.clientName || lead.guess?.name || null : null,
  };
}

function applyStoredAi(lead: AgencyLead, stored?: StoredAi | null): AgencyLead {
  const mem = stored || aiGuesses().get(lead.id);
  if (!mem?.guess) return lead;
  return {
    ...lead,
    guess: mem.guess,
    aiGuess: true,
    status:
      lead.status === "confirmed" || lead.status === "rejected"
        ? lead.status
        : leadStatusFromGuess(mem.guess),
  };
}

function buildLead(opts: {
  id: string;
  demo: boolean;
  title: string;
  text: string;
  agency: Agency;
  recruiter: AgencyLead["recruiter"];
  evidenceUrl?: string | null;
  signalId?: string;
  storedReview?: Review | null;
  storedAi?: StoredAi | null;
}): AgencyLead {
  const facts = extractVacancyFacts(`${opts.title}\n${opts.text}`);
  const ruleGuess = guessEndClient({ title: opts.title, text: opts.text });
  const auto = leadStatusFromGuess(ruleGuess);
  const stored = opts.storedReview;
  const base: AgencyLead = {
    id: opts.id,
    demo: opts.demo,
    employment: "contract",
    title: opts.title,
    roleLabel: detectRoleLabel(`${opts.title} ${opts.text}`),
    agency: { id: opts.agency.id, name: opts.agency.name },
    recruiter: opts.recruiter,
    facts,
    guess: ruleGuess,
    aiGuess: false,
    status: stored?.status || auto,
    confirmedClient: stored?.status === "confirmed" ? stored.clientName || ruleGuess?.name || null : null,
    evidenceUrl: opts.evidenceUrl || null,
    summary: opts.text.replace(/\s+/g, " ").trim().slice(0, 280),
    signalId: opts.signalId,
  };
  return applyReview(applyStoredAi(base, opts.storedAi));
}

function asLeadRecruiter(r: AgencyRecruiter | undefined): AgencyLead["recruiter"] {
  if (!r) return { name: null, title: null, url: null };
  const title = [r.brand, r.title].filter(Boolean).join(" · ") || null;
  return { name: r.name, title, url: r.linkedinUrl || null };
}

type DemoSeed = {
  id: string;
  agency: Agency;
  recruiter: AgencyLead["recruiter"];
  title: string;
  text: string;
  evidenceUrl?: string;
};

function demoSeeds(): DemoSeed[] {
  const vibe = AGENCY_WATCHLIST[0]!;
  const s3 = AGENCY_WATCHLIST[1]!;
  const moove = AGENCY_WATCHLIST[2]!;
  const elev = AGENCY_WATCHLIST[3]!;
  const britt = vibe.recruiters[0];
  const nathan = vibe.recruiters[2];
  const quinten = vibe.recruiters[3];
  const frederik = s3.recruiters[1];
  const bo = moove.recruiters[0];
  const lara = elev.recruiters[0];
  return [
    {
      id: "demo_port_scrum",
      agency: vibe,
      recruiter: asLeadRecruiter(britt),
      title: "Scrum Master gezocht | SAP ERP-transformatie",
      text:
        "Voor een strategisch SAP ERP-transformatieprogramma bij een klant van mij zoek ik een ervaren Scrum Master. We zoeken: 5+ jaar ervaring als Scrum Master; ervaring met complexe transformaties; SAP/ERP-ervaring, bij voorkeur S/4HANA. Locatie Rotterdam. Programma Asset Life Cycle (ALC). SAP als centraal platform, geïntegreerd met o.a. IoT, GIS, ACC en ServiceNow. Scrum Master voor teams rond SAP, integratie en datamigratie. Opdracht circa 24 uur per week. Interesse of ken je iemand? Stuur een DM.",
      evidenceUrl: "https://www.linkedin.com/",
    },
    {
      id: "demo_cf_booking",
      agency: s3,
      recruiter: asLeadRecruiter(frederik),
      title: "Booking — 12785 — SE2 GenAI",
      text:
        "GenAI Developer - Java | AWS | Kubernetes. For an international e-commerce client, we are looking for an experienced Gen AI Developer to help build and scale intelligent, cloud-native solutions used by millions of users. You will work in a modern microservices environment where Java, AWS, and Kubernetes form the backbone, and Generative AI is becoming a core part of the platform. Location: Diemen. Role type: Contract. Start: ASAP. Computer Futures.",
      evidenceUrl: "https://www.computerfutures.com/en-nl/job/booking---12785---se2-genai/4057144/",
    },
    {
      id: "demo_moove_hypotheken",
      agency: moove,
      recruiter: asLeadRecruiter(bo),
      title: "Freelance Functioneel Tester (Hypotheken)",
      text:
        "Momenteel voor een klant van The Next Moove op zoek naar een ervaren (functioneel) tester. Wat breng je mee? Minimaal 5 jaar ervaring als (functioneel) Tester. Ervaring met het werken in een Agile/Scrum omgeving. Ervaring met verschillende testsoorten. Ervaring met testframeworks voor het schrijven en uitvoeren van geautomatiseerde test (pre). Kennis van de hypotheeksector (harde eis). Sterke stakeholdermanagementvaardigheden. Playwright ervaring (pre). Freelance opdracht | Hypotheken. Randstad.",
      evidenceUrl: "https://www.linkedin.com/in/boverschuren",
    },
    {
      id: "demo_spilberg_java",
      agency: vibe,
      recruiter: {
        name: "Nicky Klaver",
        title: "Spilberg · Consultant",
        url: null,
      },
      title: "Senior Software Engineer — Backend",
      text:
        "Are you looking for an Senior Software Engineer position at a large international company? Currently we have several open positions at our client located in Amsterdam. Position: Senior Software Engineer - Backend (8+ years of experience). Location: Amsterdam - Hybrid. Team: High Traffic environment. Startdate: As soon as possible. Hourly rate: €85-90. Technical stack: Java, Spring Boot, Docker, Kubernetes, Microservice, API integrations, Terraform, CI/CD, Kafka, Streaming platforms (Flink, Kafka Streams), AWS, JS Frameworks (React, Vue). Freelance/projects. Posted by Nicky Klaver, nklaver@spilberg.nl.",
      evidenceUrl: "https://spilberg.com/senior-software-engineer-BBBH222439",
    },
    {
      id: "demo_tergos_cloud",
      agency: vibe,
      recruiter: asLeadRecruiter(quinten),
      title: "Freelance Cloud Engineer — IAM & security",
      text:
        "Voor een relatie van Tergos ben ik per direct op zoek naar een freelance Cloud Engineer met affiniteit voor Identity & Access Management en security tooling. Wat ga je doen? Bouwen en beheren van security- en IAM-toolkits via Terraform (IaC). Ondersteunen van developmentteams bij integratie in CI/CD-processen. Meedenken over en implementeren van security- en architectuurrichtlijnen. Inrichten van monitoring, logging en alerting. Wie ben jij? Ervaring met Azure, Kubernetes (AKS), Terraform, CI/CD. Kennis van IAM-oplossingen zoals Keycloak. Start: z.s.m. Duur: 6 of 12 maanden. Locatie: Hybride. Uren: 40.",
      evidenceUrl: "https://www.linkedin.com/in/quinten-vallina-89856a1a4",
    },
    {
      id: "demo_elev_food",
      agency: elev,
      recruiter: asLeadRecruiter(lara),
      title: "IT/OT Engineer — food",
      text:
        "Ben jij de verbindende schakel tussen IT, OT en productie, en wil je écht impact maken op de digitalisering van een productieomgeving? Voor een internationaal opererend familiebedrijf in de foodsector zijn wij op zoek naar een IT/OT Engineer. 32-40 uur. Vast dienstverband. Omgeving Den Bosch. Elevation Partners.",
      evidenceUrl: "https://www.elevationpartners.nl/vacatures/",
    },
    {
      id: "demo_eswelt_sap",
      agency: vibe,
      recruiter: asLeadRecruiter(nathan),
      title: "Freelance / Interim SAP NetWeaver / Basis — S/4HANA",
      text:
        "Für unseren Kunden aus der Industrie suchen wir einen erfahrenen Freelance/Interim SAP NetWeaver / Basis Experten. Du übernimmst fachlich und operativ die Konzeption, Administration und Optimierung der SAP Landschaft und unterstützt technische Transformationsprojekte mit klarer Roadmap, S/4HANA Conversion, Migrationen, Integrationen und Betriebsaufgaben. Hybrid-Einsatz in NRW, Start Mitte-Ende Januar. Eswelt / Vibe Group. Contact: nlassen@eswelt.nl.",
      evidenceUrl: "https://www.linkedin.com/in/nathan-lassen-172010220",
    },
    {
      id: "demo_cf_ai_gov",
      agency: s3,
      recruiter: asLeadRecruiter(frederik),
      title: "Data & AI Literacy Governance Specialist",
      text:
        "I'm currently working on a Data & AI Program governance specialist and trainer for an opportunity with a large international company in Amsterdam. The role focuses on Data Literacy & AI Literacy programmes, Data Governance initiatives, Training and enablement across the business, Stakeholder management in a large tech environment, Creating standards, guidelines and playbooks. ZZP / Freelance only. Location Amsterdam 2-3 times per week. Contract 40 hours weekly for initially 6 months. Start date ASAP, September 1st ok. Location listed: Diemen. Consultant: Frederik Weulen Kranenberg. Computer Futures.",
      evidenceUrl: "https://www.computerfutures.com/en-nl/job/data--ai-literacy-governance-specialist/4064248/",
    },
    {
      id: "demo_visser_data",
      agency: vibe,
      recruiter: asLeadRecruiter(britt),
      title: "Data analist",
      text:
        "Ben jij een ervaren Data Analist die complexe datasets weet om te zetten in waardevolle inzichten? Als Data Analist speel je een sleutelrol in het verzamelen, modelleren, analyseren en visualiseren van data. Schrijven en optimaliseren van complexe SQL-query's. Bouwen en onderhouden van datamodellen en ETL/ELT-processen. Minimaal 6 jaar ervaring. Python en/of R. Pré: dbt, Git, moderne cloud-omgeving (AWS, Azure of GCP). Hybrid, Hoofddorp. Vast dienstverband. Een uitdagende functie binnen een data-gedreven organisatie. Visser & Van Baars. Contact op de vacature: Danny Smit.",
      evidenceUrl: "https://visservanbaars.com/nl/data-analist-BBBH228241",
    },
  ];
}

function demoLeads(): AgencyLead[] {
  return demoSeeds().map((s) =>
    buildLead({
      id: s.id,
      demo: true,
      agency: s.agency,
      recruiter: s.recruiter,
      title: s.title,
      text: s.text,
      evidenceUrl: s.evidenceUrl,
    })
  );
}

function reviewFromRaw(raw: Record<string, unknown> | null | undefined): Review | null {
  const v = raw?.leadReview;
  if (!v || typeof v !== "object") return null;
  const o = v as { status?: string; clientName?: string };
  if (o.status === "confirmed" || o.status === "rejected") {
    return { status: o.status, clientName: typeof o.clientName === "string" ? o.clientName : undefined };
  }
  return null;
}

function aiFromRaw(raw: Record<string, unknown> | null | undefined): StoredAi | null {
  const v = raw?.aiClientGuess;
  if (!v || typeof v !== "object") return null;
  const o = v as { guess?: ClientGuess; at?: string; model?: string };
  if (!o.guess?.name || typeof o.guess.confidence !== "number") return null;
  return {
    guess: o.guess,
    at: typeof o.at === "string" ? o.at : new Date().toISOString(),
    model: typeof o.model === "string" ? o.model : undefined,
  };
}

export type WatchlistRow = {
  id: string;
  name: string;
  note?: string;
  recruiters: { name: string; title?: string; brand?: string; linkedinUrl?: string }[];
};

export async function listAgencyLeads(): Promise<{
  watchlist: WatchlistRow[];
  live: AgencyLead[];
  demo: AgencyLead[];
}> {
  const rows = await listSignals(400);
  const live: AgencyLead[] = [];
  for (const s of rows) {
    const agency = matchAgency(s.company?.name);
    if (!agency || !isWatchedAgency(agency.id)) continue;
    const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
    const text = [s.summary, typeof raw.description === "string" ? raw.description : ""].join("\n");
    const poster =
      (typeof raw.jobPosterName === "string" && raw.jobPosterName) ||
      (typeof raw.contactName === "string" && raw.contactName) ||
      null;
    live.push(
      buildLead({
        id: s.id,
        demo: false,
        title: s.title,
        text,
        agency,
        recruiter: {
          name: poster,
          title: typeof raw.jobPosterTitle === "string" ? raw.jobPosterTitle : null,
          url: typeof raw.jobPosterProfileUrl === "string" ? raw.jobPosterProfileUrl : null,
        },
        evidenceUrl: s.evidenceUrl,
        signalId: s.id,
        storedReview: reviewFromRaw(raw),
        storedAi: aiFromRaw(raw),
      })
    );
  }
  live.sort((a, b) => {
    const rank = { review: 0, suggest: 1, weak: 2, confirmed: 3, rejected: 4 };
    return rank[a.status] - rank[b.status];
  });
  return {
    watchlist: watchedAgencies().map((a) => ({
      id: a.id,
      name: a.name,
      note: a.note,
      recruiters: watchedRecruitersFor(a).map((r) => ({
        name: r.name,
        title: r.title,
        brand: r.brand,
        linkedinUrl: r.linkedinUrl,
      })),
    })),
    live,
    demo: demoLeads(),
  };
}

/** Volledige vacaturetekst voor AI — demo of live signal. */
export async function leadSourceForAi(id: string): Promise<{
  lead: AgencyLead;
  title: string;
  text: string;
  agencyName: string;
} | null> {
  const demo = demoSeeds().find((s) => s.id === id);
  if (demo) {
    const lead = buildLead({
      id: demo.id,
      demo: true,
      agency: demo.agency,
      recruiter: demo.recruiter,
      title: demo.title,
      text: demo.text,
      evidenceUrl: demo.evidenceUrl,
    });
    return {
      lead: applyStoredAi(applyReview(lead)),
      title: demo.title,
      text: demo.text,
      agencyName: demo.agency.name,
    };
  }

  const rows = await listSignals(400);
  const s = rows.find((r) => r.id === id);
  if (!s) return null;
  const agency = matchAgency(s.company?.name);
  if (!agency) return null;
  const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
  const text = [s.summary, typeof raw.description === "string" ? raw.description : ""]
    .filter(Boolean)
    .join("\n");
  const data = await listAgencyLeads();
  const lead = data.live.find((l) => l.id === id);
  if (!lead) return null;
  return { lead, title: s.title, text, agencyName: agency.name };
}

export async function saveAiGuess(
  id: string,
  guess: ClientGuess,
  meta?: { model?: string }
): Promise<AgencyLead | null> {
  const stored: StoredAi = {
    guess,
    at: new Date().toISOString(),
    model: meta?.model,
  };
  aiGuesses().set(id, stored);

  const src = await leadSourceForAi(id);
  if (!src) return null;

  if (src.lead.signalId) {
    await patchSignalRaw(src.lead.signalId, {
      aiClientGuess: stored,
    });
  }

  return applyStoredAi(applyReview({ ...src.lead, guess, aiGuess: true }), stored);
}

export async function reviewLead(
  id: string,
  action: "confirmed" | "rejected",
  clientName?: string
): Promise<AgencyLead | null> {
  const data = await listAgencyLeads();
  const lead = [...data.live, ...data.demo].find((l) => l.id === id);
  if (!lead) return null;
  const next: Review = {
    status: action,
    clientName: action === "confirmed" ? clientName || lead.guess?.name : undefined,
  };
  reviews().set(id, next);
  if (lead.signalId) {
    await patchSignalRaw(lead.signalId, {
      leadReview: { ...next, at: new Date().toISOString() },
    });
  }
  return applyReview({
    ...lead,
    status: action,
    confirmedClient: next.clientName || lead.guess?.name || null,
  });
}
