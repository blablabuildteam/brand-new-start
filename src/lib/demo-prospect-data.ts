import type { CrmOpportunity, CrmStage } from "@/lib/crm";
import type { DemoProspect } from "@/lib/demo-prospects";
import { regieHref } from "@/lib/desk-links";

type SeedKans = {
  role: string;
  title: string;
  client: string;
  sector: string;
  kans: number;
  stage: CrmStage;
  proofSite: string | null;
  proof: string;
  hmName: string | null;
  hmTitle: string | null;
  daysAgo: number;
  lane?: "bureau" | "direct";
  dealEur?: number;
};

function titled(name: string, city: string) {
  const c = city.trim();
  return c ? `${name} · ${c}` : name;
}

function named(stem: string, city: string) {
  const c = city.trim();
  return c ? `${stem} ${c}` : stem;
}

function bij(stem: string, city: string) {
  const c = city.trim();
  return c ? `${stem} bij ${c}` : stem;
}

/** Fictieve HM-namen — geen echte personen, wel NL-klinkend. */
const HM = {
  a: { name: "Noor Veldkamp", title: "Engineering Manager" },
  b: { name: "Thijs Akkerman", title: "Teamlead Delivery" },
  c: { name: "Lotte Meijer", title: "Chapter Lead" },
  d: { name: "Bram Hofman", title: "IT Manager" },
  e: { name: "Iris Kuipers", title: "Product Owner" },
  f: { name: "Daan Verbeek", title: "Security Lead" },
} as const;

const FAKE_AGENCIES = ["TalentBridge NL", "CodeMatch", "HireStack", "Nova Interim", "StackPeople"] as const;

function nicheSeeds(niche: string, city: string): SeedKans[] {
  const n = niche.toLowerCase();
  // Pure security/cyber eerst; "developers + security" valt onder developer-pack.
  if ((n.includes("security") || n.includes("cyber")) && !n.includes("developer")) {
    return [
      {
        role: "Security Engineer",
        title: titled("Security Engineer", city),
        client: "Overheidsdienst",
        sector: "Overheid",
        kans: 88,
        stage: "bevestigd",
        proofSite: "werkenvoornederland.nl",
        proof: "Zelfde rol en regio",
        hmName: null,
        hmTitle: null,
        daysAgo: 1,
      },
      {
        role: "SOC Analyst",
        title: "Freelance SOC Analyst (24×7)",
        client: "Fintech in de Randstad",
        sector: "Fintech",
        kans: 84,
        stage: "hm",
        proofSite: "inhuurdesk.nl",
        proof: "Noemt opdrachtgever bij naam",
        hmName: HM.f.name,
        hmTitle: HM.f.title,
        daysAgo: 2,
      },
      {
        role: "IAM Specialist",
        title: "IAM / SailPoint Specialist",
        client: "Bank in Amsterdam",
        sector: "Bank",
        kans: 91,
        stage: "hm",
        proofSite: "freep.nl",
        proof: "Zelfde stack en regio",
        hmName: HM.a.name,
        hmTitle: "IAM Lead",
        daysAgo: 3,
      },
      {
        role: "Cloud Security Architect",
        title: "Cloud Security Architect (Azure)",
        client: "Zorggroep",
        sector: "Zorg",
        kans: 79,
        stage: "outreach",
        proofSite: null,
        proof: "Match op meerdere bronnen",
        hmName: HM.d.name,
        hmTitle: "CISO (a.i.)",
        daysAgo: 5,
      },
      {
        role: "Penetration Tester",
        title: "Pen tester · red team",
        client: "Retailketen NL",
        sector: "Retail",
        kans: 76,
        stage: "hm",
        proofSite: "bijoranje.nl",
        proof: "Zelfde opdracht, andere recruiter",
        hmName: HM.b.name,
        hmTitle: "Security Chapter",
        daysAgo: 4,
      },
      {
        role: "GRC Consultant",
        title: "GRC / ISO27001 Consultant",
        client: "Verzekeraar",
        sector: "Verzekeringen",
        kans: 72,
        stage: "bevestigd",
        proofSite: null,
        proof: "Alleen algemene woorden — jij beslist",
        hmName: null,
        hmTitle: null,
        daysAgo: 6,
      },
      {
        role: "DevSecOps Engineer",
        title: "DevSecOps Engineer",
        client: named("Tech scale-up", city),
        sector: "Tech",
        kans: 85,
        stage: "outreach",
        proofSite: "linkedin.com",
        proof: "Vacature noemt eindklant",
        hmName: HM.c.name,
        hmTitle: "Head of Platform",
        daysAgo: 7,
      },
      {
        role: "OT Security Specialist",
        title: "OT / ICS Security",
        client: "Netbeheerder",
        sector: "Energie",
        kans: 90,
        stage: "won",
        proofSite: "inhuurdesk.nl",
        proof: "Noemt opdrachtgever bij naam",
        hmName: HM.e.name,
        hmTitle: "OT Security Manager",
        daysAgo: 35,
        lane: "direct",
        dealEur: 18720,
      },
      {
        role: "Privacy Officer",
        title: "Interim Privacy Officer",
        client: "Gemeente",
        sector: "Overheid",
        kans: 68,
        stage: "bevestigd",
        proofSite: null,
        proof: "Zwak bewijs — niet voorgesteld als zeker",
        hmName: null,
        hmTitle: null,
        daysAgo: 8,
      },
      {
        role: "AppSec Engineer",
        title: "Application Security Engineer",
        client: "SaaS in Utrecht",
        sector: "SaaS",
        kans: 82,
        stage: "hm",
        proofSite: "werkenbij.nl",
        proof: "Zelfde titel en stack",
        hmName: HM.a.name,
        hmTitle: "AppSec Lead",
        daysAgo: 3,
      },
    ];
  }

  if (n.includes("zzp")) {
    return [
      {
        role: "Java Developer",
        title: titled("ZZP Java Developer", city),
        client: "Publieke omroep",
        sector: "Media",
        kans: 87,
        stage: "bevestigd",
        proofSite: "freep.nl",
        proof: "Zelfde rol en regio",
        hmName: null,
        hmTitle: null,
        daysAgo: 1,
      },
      {
        role: "Scrum Master",
        title: "Freelance Scrum Master",
        client: "Zorgverzekeraar",
        sector: "Zorg",
        kans: 83,
        stage: "hm",
        proofSite: "inhuurdesk.nl",
        proof: "Noemt opdrachtgever",
        hmName: HM.b.name,
        hmTitle: HM.b.title,
        daysAgo: 2,
      },
      {
        role: "Cloud Engineer",
        title: "Cloud Engineer AWS (ZZP)",
        client: named("Scale-up", city),
        sector: "Tech",
        kans: 90,
        stage: "hm",
        proofSite: "werkenbij.nl",
        proof: "Zelfde stack",
        hmName: HM.a.name,
        hmTitle: HM.a.title,
        daysAgo: 3,
      },
      {
        role: "Data Engineer",
        title: "Data Engineer Databricks",
        client: "Retailketen NL",
        sector: "Retail",
        kans: 78,
        stage: "outreach",
        proofSite: "bijoranje.nl",
        proof: "Match op bronnen",
        hmName: HM.c.name,
        hmTitle: "Data Platform Lead",
        daysAgo: 5,
      },
      {
        role: "Business Analyst",
        title: "Freelance Business Analyst",
        client: "Bank",
        sector: "Bank",
        kans: 74,
        stage: "hm",
        proofSite: null,
        proof: "Meerdere hints, geen harde naamlek",
        hmName: HM.e.name,
        hmTitle: HM.e.title,
        daysAgo: 4,
      },
      {
        role: "Test Automation Engineer",
        title: "Test Automation (Playwright)",
        client: "Overheid · agentschap",
        sector: "Overheid",
        kans: 81,
        stage: "bevestigd",
        proofSite: "werkenvoornederland.nl",
        proof: "Zelfde opdracht",
        hmName: null,
        hmTitle: null,
        daysAgo: 6,
      },
      {
        role: "DevOps Engineer",
        title: "DevOps / Kubernetes",
        client: "Logistiek concern",
        sector: "Logistiek",
        kans: 86,
        stage: "outreach",
        proofSite: "linkedin.com",
        proof: "Vacature noemt klant",
        hmName: HM.d.name,
        hmTitle: "Platform Manager",
        daysAgo: 7,
      },
      {
        role: "Frontend Developer",
        title: "React Frontend (ZZP)",
        client: "E-commerce",
        sector: "E-commerce",
        kans: 77,
        stage: "hm",
        proofSite: "freep.nl",
        proof: "Zelfde regio",
        hmName: HM.a.name,
        hmTitle: "Frontend Lead",
        daysAgo: 3,
      },
      {
        role: "SAP Consultant",
        title: "SAP FI/CO Consultant",
        client: "Industrie",
        sector: "Industrie",
        kans: 92,
        stage: "won",
        proofSite: "inhuurdesk.nl",
        proof: "Noemt opdrachtgever bij naam",
        hmName: HM.b.name,
        hmTitle: "SAP Program Manager",
        daysAgo: 40,
        lane: "direct",
        dealEur: 21060,
      },
      {
        role: "Integration Specialist",
        title: "MuleSoft Integration",
        client: named("Dienstverlener", city),
        sector: "Dienstverlening",
        kans: 70,
        stage: "bevestigd",
        proofSite: null,
        proof: "Zwak bewijs",
        hmName: null,
        hmTitle: null,
        daysAgo: 8,
      },
      {
        role: "Product Owner",
        title: "Freelance Product Owner",
        client: "Telco",
        sector: "Telecom",
        kans: 80,
        stage: "hm",
        proofSite: "bijoranje.nl",
        proof: "Zelfde titel",
        hmName: HM.e.name,
        hmTitle: "Head of Digital",
        daysAgo: 4,
      },
    ];
  }

  // Default: Java/cloud (and similar)
  return [
    {
      role: "Java Developer",
      title: titled("Senior Java Developer", city),
      client: bij("Netbeheerder", city),
      sector: "Energie",
      kans: 90,
      stage: "bevestigd",
      proofSite: "inhuurdesk.nl",
      proof: "Noemt de opdrachtgever bij naam",
      hmName: null,
      hmTitle: null,
      daysAgo: 1,
    },
    {
      role: "Kotlin Developer",
      title: "Kotlin / Spring Boot Engineer",
      client: "Fintech Amsterdam",
      sector: "Fintech",
      kans: 88,
      stage: "hm",
      proofSite: "werkenbij.nl",
      proof: "Zelfde stack en regio",
      hmName: HM.a.name,
      hmTitle: HM.a.title,
      daysAgo: 2,
    },
    {
      role: "Cloud Engineer",
      title: "Cloud Engineer (Azure)",
      client: "Overheidsdienst",
      sector: "Overheid",
      kans: 85,
      stage: "hm",
      proofSite: "werkenvoornederland.nl",
      proof: "Zelfde rol, regio",
      hmName: HM.b.name,
      hmTitle: "Cloud Chapter Lead",
      daysAgo: 3,
    },
    {
      role: "Platform Engineer",
      title: "Platform Engineer Kubernetes",
      client: named("Tech scale-up", city),
      sector: "Tech",
      kans: 91,
      stage: "outreach",
      proofSite: "linkedin.com",
      proof: "Vacature noemt eindklant",
      hmName: HM.c.name,
      hmTitle: HM.c.title,
      daysAgo: 4,
    },
    {
      role: "Data Engineer",
      title: "Data Engineer Snowflake / dbt",
      client: "Retailketen NL",
      sector: "Retail",
      kans: 82,
      stage: "hm",
      proofSite: "freep.nl",
      proof: "Zelfde opdracht elders",
      hmName: HM.d.name,
      hmTitle: "Data Platform Lead",
      daysAgo: 5,
    },
    {
      role: "Backend Engineer",
      title: "Backend Engineer Java 21",
      client: "Bank",
      sector: "Bank",
      kans: 79,
      stage: "bevestigd",
      proofSite: null,
      proof: "Meerdere hints — jij bevestigt",
      hmName: null,
      hmTitle: null,
      daysAgo: 6,
    },
    {
      role: "Solution Architect",
      title: "Solution Architect Cloud",
      client: "Verzekeraar",
      sector: "Verzekeringen",
      kans: 86,
      stage: "hm",
      proofSite: "bijoranje.nl",
      proof: "Zelfde regio en domein",
      hmName: HM.e.name,
      hmTitle: "Enterprise Architect",
      daysAgo: 3,
    },
    {
      role: "DevOps Engineer",
      title: "DevOps / GitOps",
      client: "Logistiek concern",
      sector: "Logistiek",
      kans: 77,
      stage: "outreach",
      proofSite: null,
      proof: "Match op tech + plaats",
      hmName: HM.a.name,
      hmTitle: "SRE Manager",
      daysAgo: 7,
    },
    {
      role: "Full Stack Java",
      title: "Full Stack Java / React",
      client: "Zorggroep",
      sector: "Zorg",
      kans: 73,
      stage: "bevestigd",
      proofSite: "inhuurdesk.nl",
      proof: "Gedeeltelijke match",
      hmName: null,
      hmTitle: null,
      daysAgo: 8,
    },
    {
      role: "AWS Architect",
      title: "AWS Solutions Architect",
      client: bij("SaaS", city),
      sector: "SaaS",
      kans: 89,
      stage: "won",
      proofSite: "freep.nl",
      proof: "Noemt opdrachtgever bij naam",
      hmName: HM.b.name,
      hmTitle: "Head of Engineering",
      daysAgo: 38,
      lane: "direct",
      dealEur: 16848,
    },
    {
      role: "Integration Developer",
      title: "Java Integration (Kafka)",
      client: "Telco",
      sector: "Telecom",
      kans: 81,
      stage: "hm",
      proofSite: "werkenbij.nl",
      proof: "Zelfde titel",
      hmName: HM.c.name,
      hmTitle: "Integration Lead",
      daysAgo: 4,
    },
  ];
}

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** 8–12 voorbeeldkansen, afgestemd op niche + stad. */
export function buildProspectCrmItems(prospect: DemoProspect): CrmOpportunity[] {
  const seeds = nicheSeeds(prospect.niche, prospect.city).slice(0, 11);
  return seeds.map((s, i) => {
    const id = `crm_demo_${prospect.slug}_${i}`;
    const foundAt = daysAgoIso(s.daysAgo);
    const lane = s.lane || "bureau";
    const where = prospect.city.trim() ? ` in ${prospect.city.trim()}` : "";
    const hasMail = s.stage === "hm" || s.stage === "outreach" || s.stage === "won";
    const first = (s.hmName || "hm").split(" ")[0]!.toLowerCase();
    const email =
      s.hmName && hasMail && (s.stage === "outreach" || s.stage === "won" || i % 2 === 0)
        ? `${first}.${i}@example.com`
        : null;
    const agency = FAKE_AGENCIES[i % FAKE_AGENCIES.length]!;
    const deal =
      s.stage === "won"
        ? {
            endClient: s.client,
            title: s.title,
            roleLabel: s.role,
            lane,
            contactedAt: daysAgoIso(s.daysAgo + 10),
            wonAt: daysAgoIso(Math.max(5, s.daysAgo - 20)),
            closedBy: "demo@blablabuild.com",
            marginPerHour: 18,
            hoursPerWeek: 36,
            weeks: 26,
            dealEur: s.dealEur || 16848,
            note: "ZZP · 6 maanden",
            updatedAt: daysAgoIso(Math.max(5, s.daysAgo - 20)),
          }
        : s.stage === "outreach"
          ? {
              endClient: s.client,
              title: s.title,
              roleLabel: s.role,
              lane,
              agencyName: agency,
              contactedAt: daysAgoIso(1),
              contactedBy: "demo@blablabuild.com",
              updatedAt: daysAgoIso(1),
            }
          : null;

    return {
      id,
      lane,
      stage: s.stage,
      endClient: s.client,
      roleLabel: s.role,
      title: s.title,
      kans: s.kans,
      hiringManager: s.hmName,
      hiringManagerTitle: s.hmTitle,
      hiringManagerUrl: s.hmName ? "https://www.linkedin.com/in/example" : null,
      hiringManagerEmail: email,
      hiringManagerPhone: email && s.stage !== "hm" ? "+31 6 12 00 00 00" : null,
      lushaStatus: email ? ("ok" as const) : null,
      hmHits: s.hmName
        ? [
            {
              name: s.hmName,
              title: s.hmTitle || "Hiring manager",
              url: "https://www.linkedin.com/in/example",
              score: 80 + (i % 10),
              why: "Titel + bedrijf matchen de opdracht",
              email: email || undefined,
              lushaStatus: email ? ("ok" as const) : undefined,
            },
          ]
        : [],
      agencyName: lane === "bureau" ? agency : null,
      recruiterName: lane === "bureau" ? "Recruiter" : null,
      evidenceUrl: s.proofSite ? `https://${s.proofSite}` : null,
      foundAt,
      stillLive: true,
      sector: s.sector,
      kansFactors: [
        { label: "Opdracht in post", points: 20 },
        { label: s.proof, points: Math.min(40, Math.round(s.kans / 3)) },
      ],
      openingCount: 1,
      sources: lane === "direct" ? ["Indeed", "Inhuurdesk"] : ["Recruiter feed"],
      bronLabel: lane === "direct" ? "Jobboards" : "Recruiter feed",
      bronDetail: lane === "direct" ? "Indeed · Inhuurdesk" : agency,
      lastSeenAt: foundAt,
      freshness: "actueel" as const,
      freshnessLabel: s.daysAgo < 10 ? "< 10 dagen" : "Ouder",
      confirmedAt: foundAt,
      href: regieHref({ companyId: id, openingId: id }),
      companyId: null,
      openingId: null,
      extractSummary: `Post: “een klant van mij zoekt een ${s.role}${where}”. Scout vond de eindklant (${s.client.toLowerCase()}); in de demo staat de echte naam afgeschermd.`,
      logoUrl: null,
      sourceChannel: lane === "direct" ? "indeed" : "agency-swarm",
      // false zodat de desk-flow werkt; banner markeert voorbeelddata.
      demo: false,
      deal,
    };
  });
}

export function prospectWelcome(prospect: DemoProspect) {
  const name = prospect.contactFirstName.trim();
  const lead = name
    ? `Hoi ${name.split(" en ")[0]!.trim()}, dit is Scout voor ${prospect.agencyName}.`
    : `Dit is Scout voor ${prospect.agencyName}.`;
  return `${lead} Begin bij de rondleiding, of open meteen een post in de feed.`;
}

export function prospectBanner(prospect: DemoProspect) {
  return `Demo · ${prospect.agencyName} · voorbeelddata · sync en kosten staan uit`;
}
