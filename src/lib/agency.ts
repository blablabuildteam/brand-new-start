import {
  huntSettings,
  recruiterKey,
  type ManagedAgency,
  type ManagedRecruiter,
} from "@/lib/hunt";

export type AgencyRecruiter = {
  name: string;
  title?: string;
  /** Niche-merk binnen de groep, als die publiek zo opereert. */
  brand?: string;
  linkedinUrl?: string;
};

export type Agency = {
  id: string;
  name: string;
  aliases: string[];
  linkedinSlug?: string;
  /** Korte toelichting op de watchlist, geen marketing. */
  note?: string;
  recruiters: AgencyRecruiter[];
};

/**
 * Standaardcatalogus van contracting-bureaus.
 * In Instellingen kun je deze aan/uit zetten en eigen bureaus toevoegen.
 */
export const AGENCY_WATCHLIST: Agency[] = [
  {
    id: "vibegroup",
    name: "Vibe Group",
    aliases: [
      "vibegroup",
      "vibe group",
      "vibe-group",
      "vibe-group-global",
      "visser van baars",
      "visser & van baars",
      "spilberg",
      "eswelt",
      "tergos",
    ],
    linkedinSlug: "vibe-group-global",
    note: "Vier merken: Visser & Van Baars (data), Spilberg (dev/test), Eswelt (ERP/CRM), Tergos (infra/security).",
    recruiters: [
      {
        name: "Britt van der Klink",
        title: "Senior Team Manager",
        brand: "Visser & Van Baars",
        linkedinUrl: "https://www.linkedin.com/in/britt-van-der-klink-939887140",
      },
      {
        name: "Tygo Limburg",
        title: "Consultant .NET freelance",
        brand: "Spilberg",
        linkedinUrl: "https://www.linkedin.com/in/tygo-limburg-0118bb1a7",
      },
      {
        name: "Nathan Lassen",
        title: "Consultant SAP freelance",
        brand: "Eswelt",
        linkedinUrl: "https://www.linkedin.com/in/nathan-lassen-172010220",
      },
      {
        name: "Quinten Vallina",
        title: "Senior Consultant Cloud & DevOps",
        brand: "Tergos",
        linkedinUrl: "https://www.linkedin.com/in/quinten-vallina-89856a1a4",
      },
    ],
  },
  {
    id: "s3",
    name: "SThree",
    aliases: [
      "s3",
      "sthree",
      "s3 groep",
      "s3 group",
      "s3 recruitment",
      "computer futures",
      "computerfutures",
    ],
    linkedinSlug: "sthree-plc",
    note: "Jij zei S3. Publiek is dat SThree (Amsterdam/Utrecht). NL IT-delivery loopt vooral via Computer Futures.",
    recruiters: [
      {
        name: "Florine Rebel",
        title: "Principal Consultant",
        brand: "Computer Futures",
        linkedinUrl: "https://www.linkedin.com/in/florine-rebel",
      },
      {
        name: "Frederik Weulen Kranenberg",
        title: "Recruitment Consultant",
        brand: "Computer Futures",
        linkedinUrl: "https://www.linkedin.com/in/frederik-weulen-kranenberg-31801b1a7",
      },
    ],
  },
  {
    id: "next-moove",
    name: "The Next Moove",
    aliases: ["the next moove", "next moove", "nextmoove", "thenextmoove"],
    linkedinSlug: "thenextmoove",
    recruiters: [
      {
        name: "Bo Verschuren",
        title: "Strategic Account Manager",
        linkedinUrl: "https://www.linkedin.com/in/boverschuren",
      },
      {
        name: "Michael Alles",
        title: "Owner / Consultant",
        linkedinUrl: "https://www.linkedin.com/in/michaelalles",
      },
      {
        name: "Timo de Raat",
        title: "Owner / Consultant",
        linkedinUrl: "https://www.linkedin.com/in/timod1",
      },
    ],
  },
  {
    id: "elevation",
    name: "Elevation Partners",
    aliases: [
      "elevation",
      "elevation partners",
      "elevation group",
      "elevation recruitment",
      "elevation.nl",
      "elevationpartners",
    ],
    linkedinSlug: "elevation-partners-nederland",
    note: "IT + supply chain. Elevation Group is de holding; Partners plaatst de klantrollen.",
    recruiters: [
      {
        name: "Lara Lakeman",
        title: "Consultant Data & BI",
        linkedinUrl: "https://www.linkedin.com/in/lara-lakeman-17010a183",
      },
      {
        name: "Teun Welvaarts",
        title: "Sales consultant JVM",
        linkedinUrl: "https://www.linkedin.com/in/teunwelvaarts",
      },
    ],
  },
  {
    id: "kando",
    name: "Kando Solutions",
    aliases: ["kando", "kando solutions", "kando-solutions", "kando solutions recruitment"],
    linkedinSlug: "kando-solutions-recruitment",
    note: "Solo DevOps/cloud/data freelance-recruitment (Amsterdam). Founder: David Arkinstall.",
    recruiters: [
      {
        name: "David Arkinstall",
        title: "Founder & DevOps Recruiter",
        brand: "Kando",
        linkedinUrl: "https://www.linkedin.com/in/daveatkando",
      },
    ],
  },
];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asAgency(m: ManagedAgency): Agency {
  return {
    id: m.id,
    name: m.name,
    aliases: m.aliases.length ? m.aliases : [m.name.toLowerCase()],
    note: m.note,
    recruiters: m.recruiters.map((r) => ({
      name: r.name,
      title: r.title,
      brand: r.brand,
      linkedinUrl: r.linkedinUrl,
    })),
  };
}

/** Standaardlijst → managed (alles aan). */
export function seedManagedAgencies(
  agencyIds?: string[],
  recruiterIds?: string[]
): ManagedAgency[] {
  const agencySet = agencyIds ? new Set(agencyIds) : null;
  const recSet = recruiterIds ? new Set(recruiterIds) : null;
  return AGENCY_WATCHLIST.map((a) => ({
    id: a.id,
    name: a.name,
    aliases: a.aliases,
    note: a.note,
    linkedinSlug: a.linkedinSlug,
    enabled: agencySet ? agencySet.has(a.id) : true,
    custom: false,
    recruiters: a.recruiters.map(
      (r): ManagedRecruiter => ({
        name: r.name,
        title: r.title,
        brand: r.brand,
        linkedinUrl: r.linkedinUrl,
        enabled: recSet ? recSet.has(recruiterKey(a.id, r.name)) : true,
      })
    ),
  }));
}

/** Volledige catalogus (seed + zelf toegevoegd), inclusief uitgeschakelde. */
export function agencyCatalog(): ManagedAgency[] {
  const stored = huntSettings().agencies;
  if (stored?.length) return stored;
  return seedManagedAgencies(huntSettings().agencyIds, huntSettings().recruiterIds);
}

/** Alle bureau-ids in de actieve catalogus. */
export function allAgencyIds() {
  return agencyCatalog().map((a) => a.id);
}

/** Alle recruiter-keys in de actieve catalogus. */
export function allRecruiterIds() {
  return agencyCatalog().flatMap((a) => a.recruiters.map((r) => recruiterKey(a.id, r.name)));
}

/** Bureaus die je volgt (aan). */
export function watchedAgencies(): Agency[] {
  return agencyCatalog().filter((a) => a.enabled).map(asAgency);
}

/** Recruiters die je volgt binnen een bureau. */
export function watchedRecruitersFor(agency: Agency): AgencyRecruiter[] {
  const managed = agencyCatalog().find((a) => a.id === agency.id);
  if (!managed) return agency.recruiters;
  return managed.recruiters
    .filter((r) => r.enabled)
    .map((r) => ({
      name: r.name,
      title: r.title,
      brand: r.brand,
      linkedinUrl: r.linkedinUrl,
    }));
}

export function matchAgency(companyName: string | null | undefined): Agency | null {
  const n = norm(companyName || "");
  if (!n) return null;
  for (const a of agencyCatalog()) {
    if (norm(a.name) === n) return asAgency(a);
    if (
      a.aliases.some((al) => {
        const a1 = norm(al);
        if (!a1) return false;
        if (n === a1) return true;
        return a1.length >= 4 && n.includes(a1);
      })
    ) {
      return asAgency(a);
    }
  }
  return null;
}

export function isAgencyName(name: string | null | undefined): boolean {
  return Boolean(matchAgency(name));
}

/**
 * Detacheerders, brokers en vacaturebanken die zichzelf als "bedrijf" op een
 * jobboard zetten. Jobboards belooft vacatures bij eindklanten; zonder deze
 * filter staan bemiddelaars als OverheidZZP of Jobster daar als opdrachtgever.
 */
const INTERMEDIARY_HINTS = [
  // Woorden in de naam
  "detach",
  "secondment",
  "uitzend",
  "werving en selectie",
  "staffing",
  "resourcing",
  "recruitment",
  "recruiting",
  "recruiter",
  "payroll",
  "interim",
  "zzp",
  "freelance",
  "jobboard",
  "vacaturebank",
  "consultancy",
  "consulting",
  "talent solutions",
  "it-diensten",
  "detachering",
  "detacheer",
  // Merken zonder herkenbaar woord in de naam
  "jobster",
  "ubique",
  "la fosse",
  "gazelle global",
  "next ventures",
  "global enterprise partners",
  "xecutive",
  "dev talents",
  "nextgen",
  "algoteque",
  "coherenza",
  "itproposal",
  "source me",
  "all about work",
  "oxford global",
  "suited",
  "overheidzzp",
  "overheid zzp",
  "kando",
  "kando solutions",
  // NL contracting / staffing
  "yacht",
  "hays",
  "brunel",
  "randstad",
  "tempo team",
  "headfirst",
  "head first",
  "youngcapital",
  "young capital",
  "undutchables",
  "manpower",
  "adedasco",
  "computer futures",
  "michael page",
  "robert half",
  "robert walters",
  "harvey nash",
  "modis",
  "akkodis",
  "experis",
  "spiie",
  "spilberg",
  "seven hills",
  "the next moove",
  "elevation partners",
  "vibe group",
  "sthree",
  // SThree-merken — komen los van "SThree" op de jobboards voorbij
  "huxley",
  "progressive recruitment",
  "real staffing",
  "global enterprise partners",
  "darwin recruitment",
  "nicoll curtin",
  "austin fraser",
  "levy associates",
  "levy professionals",
  "linkedtalent",
  "linked talent",
  "amoria bond",
  "project & change",
  "project and change",
  "project & change talents",
  "yer consulting",
  "yer group",
  "unique nederland",
  "unique netherland",
  // Big4 / strategy (geen eindklant op jobboards)
  "deloitte",
  "pwc",
  "pricewaterhouse",
  "kpmg",
  "ernst & young",
  "ernst and young",
  "mckinsey",
  "bain & company",
  "bain and company",
  "boston consulting",
  // IT consultancies
  "win consultancy",
  "win digital",
  "win group",
  "win it",
  "cgi ",
  "accenture",
  "capgemini",
  "ordina",
  "atos",
  "sopra steria",
  "inetum",
  "ctac",
  "ilionx",
  "quintor",
  "info support",
  "sogyo",
  "codecentric",
  "conclude",
  "conclusion",
  "motion10",
  "motion 10",
  "delta-n",
  "delta n",
  "intravatis",
  "blinklane",
  "xebia",
  "macaw",
  "luminis",
  "trifork",
  "valori",
  "cegeka",
  "vx company",
  "topicus",
  "incentro",
  "sogeti",
  "infosys",
  "cognizant",
  "wipro",
  "tata consultancy",
];

/** Runtime-leren via “Geen eindklant — verberg”. */
let learnedIntermediaries = new Set<string>();

export function setLearnedIntermediaries(names: Iterable<string>) {
  const next = new Set<string>();
  for (const raw of names) {
    const n = norm(raw);
    if (n.length >= 2) next.add(n);
  }
  learnedIntermediaries = next;
}

export function looksLikeIntermediary(name: string | null | undefined): boolean {
  const n = norm(name || "");
  if (!n) return false;
  if (SHORT_INTERMEDIARIES.has(n)) return true;
  if (learnedIntermediaries.has(n)) return true;
  // Short merknamen: "win" dekt "win group" / "win consultancy"
  for (const short of SHORT_INTERMEDIARIES) {
    if (short.length >= 3 && (n === short || n.startsWith(`${short} `))) return true;
  }
  return INTERMEDIARY_HINTS.some((hint) => n.includes(hint.trim()));
}

/** Korte merknamen die bureaus/consultancies zijn (geen eindklant). */
const SHORT_INTERMEDIARIES = new Set([
  "win",
  "ctac",
  "cgi",
  "atos",
  "capgemini",
  "accenture",
  "ordina",
  "sogeti",
  "infosys",
  "tcs",
  "wipro",
  "hcl",
  "cognizant",
  "yacht",
  "yer",
  "hays",
  "brunel",
  "randstad",
  "headfirst",
  "youngcapital",
  "deloitte",
  "pwc",
  "kpmg",
  "ey",
  "mckinsey",
  "bcg",
  "bain",
  "conclusion",
  "valori",
  "cegeka",
  "topicus",
  "incentro",
  "xebia",
  "ilionx",
  "quintor",
  "sthree",
  "modis",
  "akkodis",
  "experis",
  "manpower",
]);

/** Geen eindklant op Jobboards: junk, watchlist-bureau of consultancy/broker. */
export function isBlockedEndClientName(name: string | null | undefined): boolean {
  if (!name || !name.trim()) return true;
  return isAgencyName(name) || looksLikeIntermediary(name);
}

/** Of dit bureau op jouw volglijst staat. */
export function isWatchedAgency(agencyId: string): boolean {
  const a = agencyCatalog().find((x) => x.id === agencyId);
  return a ? a.enabled : false;
}
