/**
 * Platforms / careers pages we want Firecrawl to watch.
 * Edit this list — no secrets needed.
 */
export type PlatformTarget = {
  id: string;
  company: string;
  label: string;
  /** Careers or jobs listing URL (open web — Firecrawl) */
  careersUrl: string;
  sector?: string;
  enabled: boolean;
};

export const PLATFORM_TARGETS: PlatformTarget[] = [
  {
    id: "adyen",
    company: "Adyen",
    label: "Adyen careers",
    careersUrl: "https://www.adyen.com/careers/jobs",
    sector: "Fintech",
    enabled: true,
  },
  {
    id: "ing",
    company: "ING",
    label: "ING jobs",
    careersUrl: "https://www.ing.jobs/Netherlands/vacancies.htm",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "achmea",
    company: "Achmea",
    label: "Achmea werkenbij",
    careersUrl: "https://werkenbijachmea.nl/vacatures",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "rabobank",
    company: "Rabobank",
    label: "Rabobank careers",
    careersUrl: "https://www.rabobank.nl/werken-bij/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "nn",
    company: "NN Group",
    label: "NN careers",
    careersUrl: "https://careers.nn-group.com/",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "schiphol",
    company: "Schiphol",
    label: "Schiphol werkenbij",
    careersUrl: "https://www.werkenbijschiphol.nl/vacatures",
    sector: "Aviation",
    enabled: true,
  },
  {
    id: "booking",
    company: "Booking.com",
    label: "Booking.com jobs",
    careersUrl: "https://jobs.booking.com/careers",
    sector: "Travel tech",
    enabled: true,
  },
  {
    id: "coolblue",
    company: "Coolblue",
    label: "Coolblue jobs",
    careersUrl: "https://www.coolblue.nl/werken-bij-coolblue/vacatures",
    sector: "Retail",
    enabled: true,
  },
  {
    id: "asr",
    company: "a.s.r.",
    label: "a.s.r. werkenbij",
    careersUrl: "https://www.werkenbijasr.nl/vacatures",
    sector: "Verzekeringen",
    enabled: true,
  },
  {
    id: "bunq",
    company: "Bunq",
    label: "Bunq careers",
    careersUrl: "https://www.bunq.com/en/careers",
    sector: "Fintech",
    enabled: true,
  },
  {
    id: "abn",
    company: "ABN AMRO",
    label: "ABN AMRO careers",
    careersUrl: "https://www.abnamro.com/nl/careers/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "volksbank",
    company: "de Volksbank",
    label: "de Volksbank werkenbij",
    careersUrl: "https://werkenbij.devolksbank.nl/vacatures",
    sector: "Bank",
    enabled: true,
  },
  {
    id: "bol",
    company: "bol",
    label: "bol jobs",
    careersUrl: "https://careers.bol.com/nl/vacatures/",
    sector: "E-commerce",
    enabled: true,
  },
  {
    id: "kpn",
    company: "KPN",
    label: "KPN jobs",
    careersUrl: "https://jobs.kpn.com/nl/vacatures",
    sector: "Telecom",
    enabled: true,
  },
];

export function enabledPlatforms() {
  return PLATFORM_TARGETS.filter((p) => p.enabled);
}
