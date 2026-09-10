/**
 * Vaste careers-URL’s voor Firecrawl-sync (technisch, beperkt).
 * Eindklanten zelf komen van de radar — niet via een checklist in Instellingen.
 */
export type PlatformTarget = {
  id: string;
  company: string;
  label: string;
  /** Careers of jobs-URL (open web — Firecrawl) */
  careersUrl: string;
  sector?: string;
  enabled: boolean;
};

export const PLATFORM_TARGETS: PlatformTarget[] = [
  {
    id: "adyen",
    company: "Adyen",
    label: "Adyen — vacatures",
    careersUrl: "https://www.adyen.com/careers/jobs",
    sector: "Fintech",
    enabled: true,
  },
  {
    id: "ing",
    company: "ING",
    label: "ING — vacatures",
    careersUrl: "https://www.ing.jobs/Netherlands/vacancies.htm",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "achmea",
    company: "Achmea",
    label: "Achmea — werken bij",
    careersUrl: "https://werkenbijachmea.nl/vacatures",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "rabobank",
    company: "Rabobank",
    label: "Rabobank — vacatures",
    careersUrl: "https://www.rabobank.nl/werken-bij/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "nn",
    company: "NN Group",
    label: "NN Group — careers",
    careersUrl: "https://careers.nn-group.com/",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "schiphol",
    company: "Schiphol",
    label: "Schiphol — werken bij",
    careersUrl: "https://www.werkenbijschiphol.nl/vacatures",
    sector: "Luchtvaart",
    enabled: true,
  },
  {
    id: "booking",
    company: "Booking.com",
    label: "Booking.com — jobs",
    careersUrl: "https://jobs.booking.com/careers",
    sector: "Travel tech",
    enabled: true,
  },
  {
    id: "coolblue",
    company: "Coolblue",
    label: "Coolblue — vacatures",
    careersUrl: "https://www.coolblue.nl/werken-bij-coolblue/vacatures",
    sector: "Retail",
    enabled: true,
  },
  {
    id: "asr",
    company: "a.s.r.",
    label: "a.s.r. — werken bij",
    careersUrl: "https://www.werkenbijasr.nl/vacatures",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "bunq",
    company: "Bunq",
    label: "Bunq — careers",
    careersUrl: "https://www.bunq.com/en/careers",
    sector: "Fintech",
    enabled: true,
  },
  {
    id: "abn",
    company: "ABN AMRO",
    label: "ABN AMRO — vacatures",
    careersUrl: "https://www.abnamro.com/nl/careers/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "volksbank",
    company: "de Volksbank",
    label: "de Volksbank — vacatures",
    careersUrl: "https://werkenbij.devolksbank.nl/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "bol",
    company: "bol",
    label: "bol — vacatures",
    careersUrl: "https://careers.bol.com/nl/vacatures/",
    sector: "E-commerce",
    enabled: true,
  },
  {
    id: "kpn",
    company: "KPN",
    label: "KPN — vacatures",
    careersUrl: "https://jobs.kpn.com/nl/vacatures",
    sector: "Telecom",
    enabled: true,
  },
];

export function allCompanyIds() {
  return PLATFORM_TARGETS.map((p) => p.id);
}

export function defaultCompanyIds() {
  return PLATFORM_TARGETS.filter((p) => p.enabled).map((p) => p.id);
}

/** Careers-bronnen die bij sync meegaan (vaste technische lijst). */
export function enabledPlatforms() {
  return PLATFORM_TARGETS.filter((p) => p.enabled);
}
