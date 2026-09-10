export type AgencyRecruiter = {
  name: string;
  title?: string;
};

export type Agency = {
  id: string;
  name: string;
  aliases: string[];
  linkedinSlug?: string;
  recruiters: AgencyRecruiter[];
};

/** Vaste contracting-watchlist — later naar Instellingen. */
export const AGENCY_WATCHLIST: Agency[] = [
  {
    id: "vibegroup",
    name: "VibeGroup",
    aliases: ["vibegroup", "vibe group", "vibe-group"],
    linkedinSlug: "vibegroup",
    recruiters: [
      { name: "Lisa Hendriks", title: "Principal Recruiter" },
      { name: "Mark de Vries", title: "Talent Partner" },
    ],
  },
  {
    id: "s3",
    name: "S3",
    aliases: ["s3 groep", "s3 group", "s3 recruitment"],
    linkedinSlug: "s3-groep",
    recruiters: [{ name: "Sanne Bakker", title: "Recruiter" }],
  },
  {
    id: "next-moove",
    name: "The Next Moove",
    aliases: ["the next moove", "next moove", "nextmoove"],
    linkedinSlug: "the-next-moove",
    recruiters: [{ name: "Thomas Kuipers", title: "Managing Partner" }],
  },
  {
    id: "elevation",
    name: "Elevation",
    aliases: ["elevation recruitment", "elevation.nl"],
    linkedinSlug: "elevation-recruitment",
    recruiters: [{ name: "Noor El Idrissi", title: "Recruiter IT" }],
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
    if (a.aliases.some((al) => n === al || n.includes(al) || al.includes(n))) return a;
  }
  return null;
}

export function isAgencyName(name: string | null | undefined): boolean {
  return Boolean(matchAgency(name));
}
