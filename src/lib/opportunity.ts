import { AGENCY_WATCHLIST, matchAgency, type Agency, type AgencyRecruiter } from "@/lib/agency";
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

const g = globalThis as unknown as { __bnsLeadReviews?: Map<string, Review> };

function reviews() {
  if (!g.__bnsLeadReviews) g.__bnsLeadReviews = new Map();
  return g.__bnsLeadReviews;
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
}): AgencyLead {
  const facts = extractVacancyFacts(`${opts.title}\n${opts.text}`);
  const guess = guessEndClient({ title: opts.title, text: opts.text });
  const auto = leadStatusFromGuess(guess);
  const stored = opts.storedReview;
  return {
    id: opts.id,
    demo: opts.demo,
    employment: "contract",
    title: opts.title,
    roleLabel: detectRoleLabel(`${opts.title} ${opts.text}`),
    agency: { id: opts.agency.id, name: opts.agency.name },
    recruiter: opts.recruiter,
    facts,
    guess,
    status: stored?.status || auto,
    confirmedClient: stored?.status === "confirmed" ? stored.clientName || guess?.name || null : null,
    evidenceUrl: opts.evidenceUrl || null,
    summary: opts.text.replace(/\s+/g, " ").trim().slice(0, 280),
    signalId: opts.signalId,
  };
}

function asLeadRecruiter(r: AgencyRecruiter | undefined): AgencyLead["recruiter"] {
  if (!r) return { name: null, title: null, url: null };
  const title = [r.brand, r.title].filter(Boolean).join(" · ") || null;
  return { name: r.name, title, url: r.linkedinUrl || null };
}

function demoLeads(): AgencyLead[] {
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
    buildLead({
      id: "demo_cf_booking",
      demo: true,
      agency: s3,
      recruiter: asLeadRecruiter(frederik),
      title: "Booking — 12785 — SE2 GenAI",
      text:
        "GenAI Developer - Java | AWS | Kubernetes. For an international e-commerce client, we are looking for an experienced Gen AI Developer to help build and scale intelligent, cloud-native solutions used by millions of users. You will work in a modern microservices environment where Java, AWS, and Kubernetes form the backbone, and Generative AI is becoming a core part of the platform. Location: Diemen. Role type: Contract. Start: ASAP. Computer Futures.",
      evidenceUrl: "https://www.computerfutures.com/en-nl/job/booking---12785---se2-genai/4057144/",
    }),
    buildLead({
      id: "demo_moove_hypotheken",
      demo: true,
      agency: moove,
      recruiter: asLeadRecruiter(bo),
      title: "Freelance Functioneel Tester (Hypotheken)",
      text:
        "Momenteel voor een klant van The Next Moove op zoek naar een ervaren (functioneel) tester. Wat breng je mee? Minimaal 5 jaar ervaring als (functioneel) Tester. Ervaring met het werken in een Agile/Scrum omgeving. Ervaring met verschillende testsoorten. Ervaring met testframeworks voor het schrijven en uitvoeren van geautomatiseerde test (pre). Kennis van de hypotheeksector (harde eis). Sterke stakeholdermanagementvaardigheden. Playwright ervaring (pre). Freelance opdracht | Hypotheken. Randstad.",
      evidenceUrl: "https://www.linkedin.com/in/boverschuren",
    }),
    buildLead({
      id: "demo_spilberg_java",
      demo: true,
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
    }),
    buildLead({
      id: "demo_tergos_cloud",
      demo: true,
      agency: vibe,
      recruiter: asLeadRecruiter(quinten),
      title: "Freelance Cloud Engineer — IAM & security",
      text:
        "Voor een relatie van Tergos ben ik per direct op zoek naar een freelance Cloud Engineer met affiniteit voor Identity & Access Management en security tooling. Wat ga je doen? Bouwen en beheren van security- en IAM-toolkits via Terraform (IaC). Ondersteunen van developmentteams bij integratie in CI/CD-processen. Meedenken over en implementeren van security- en architectuurrichtlijnen. Inrichten van monitoring, logging en alerting. Wie ben jij? Ervaring met Azure, Kubernetes (AKS), Terraform, CI/CD. Kennis van IAM-oplossingen zoals Keycloak. Start: z.s.m. Duur: 6 of 12 maanden. Locatie: Hybride. Uren: 40.",
      evidenceUrl: "https://www.linkedin.com/in/quinten-vallina-89856a1a4",
    }),
    buildLead({
      id: "demo_elev_food",
      demo: true,
      agency: elev,
      recruiter: asLeadRecruiter(lara),
      title: "IT/OT Engineer — food",
      text:
        "Ben jij de verbindende schakel tussen IT, OT en productie, en wil je écht impact maken op de digitalisering van een productieomgeving? Voor een internationaal opererend familiebedrijf in de foodsector zijn wij op zoek naar een IT/OT Engineer. 32-40 uur. Vast dienstverband. Omgeving Den Bosch. Elevation Partners.",
      evidenceUrl: "https://www.elevationpartners.nl/vacatures/",
    }),
    buildLead({
      id: "demo_eswelt_sap",
      demo: true,
      agency: vibe,
      recruiter: asLeadRecruiter(nathan),
      title: "Freelance / Interim SAP NetWeaver / Basis — S/4HANA",
      text:
        "Für unseren Kunden aus der Industrie suchen wir einen erfahrenen Freelance/Interim SAP NetWeaver / Basis Experten. Du übernimmst fachlich und operativ die Konzeption, Administration und Optimierung der SAP Landschaft und unterstützt technische Transformationsprojekte mit klarer Roadmap, S/4HANA Conversion, Migrationen, Integrationen und Betriebsaufgaben. Hybrid-Einsatz in NRW, Start Mitte-Ende Januar. Eswelt / Vibe Group. Contact: nlassen@eswelt.nl.",
      evidenceUrl: "https://www.linkedin.com/in/nathan-lassen-172010220",
    }),
    buildLead({
      id: "demo_cf_ai_gov",
      demo: true,
      agency: s3,
      recruiter: asLeadRecruiter(frederik),
      title: "Data & AI Literacy Governance Specialist",
      text:
        "I'm currently working on a Data & AI Program governance specialist and trainer for an opportunity with a large international company in Amsterdam. The role focuses on Data Literacy & AI Literacy programmes, Data Governance initiatives, Training and enablement across the business, Stakeholder management in a large tech environment, Creating standards, guidelines and playbooks. ZZP / Freelance only. Location Amsterdam 2-3 times per week. Contract 40 hours weekly for initially 6 months. Start date ASAP, September 1st ok. Location listed: Diemen. Consultant: Frederik Weulen Kranenberg. Computer Futures.",
      evidenceUrl: "https://www.computerfutures.com/en-nl/job/data--ai-literacy-governance-specialist/4064248/",
    }),
    buildLead({
      id: "demo_visser_data",
      demo: true,
      agency: vibe,
      recruiter: asLeadRecruiter(britt),
      title: "Data analist",
      text:
        "Ben jij een ervaren Data Analist die complexe datasets weet om te zetten in waardevolle inzichten? Als Data Analist speel je een sleutelrol in het verzamelen, modelleren, analyseren en visualiseren van data. Schrijven en optimaliseren van complexe SQL-query's. Bouwen en onderhouden van datamodellen en ETL/ELT-processen. Minimaal 6 jaar ervaring. Python en/of R. Pré: dbt, Git, moderne cloud-omgeving (AWS, Azure of GCP). Hybrid, Hoofddorp. Vast dienstverband. Een uitdagende functie binnen een data-gedreven organisatie. Visser & Van Baars. Contact op de vacature: Danny Smit.",
      evidenceUrl: "https://visservanbaars.com/nl/data-analist-BBBH228241",
    }),
  ].map(applyReview);
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
    if (!agency) continue;
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
      })
    );
  }
  live.sort((a, b) => {
    const rank = { review: 0, suggest: 1, weak: 2, confirmed: 3, rejected: 4 };
    return rank[a.status] - rank[b.status];
  });
  return {
    watchlist: AGENCY_WATCHLIST.map((a) => ({
      id: a.id,
      name: a.name,
      note: a.note,
      recruiters: a.recruiters.map((r) => ({
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
