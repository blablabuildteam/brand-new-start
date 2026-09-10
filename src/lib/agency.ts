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
 * Vaste contracting-watchlist — later naar Instellingen.
 * Alleen publiek gevonden, client-facing consultants (geen interne TA).
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
];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchAgency(companyName: string | null | undefined): Agency | null {
  const n = norm(companyName || "");
  if (!n) return null;
  for (const a of AGENCY_WATCHLIST) {
    if (norm(a.name) === n) return a;
    if (
      a.aliases.some((al) => {
        const a1 = norm(al);
        if (!a1) return false;
        if (n === a1) return true;
        return a1.length >= 4 && n.includes(a1);
      })
    ) {
      return a;
    }
  }
  return null;
}

export function isAgencyName(name: string | null | undefined): boolean {
  return Boolean(matchAgency(name));
}
