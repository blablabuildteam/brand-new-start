import raw from "@/data/demo-prospects.json";

export type DemoProspect = {
  slug: string;
  agencyName: string;
  contactFirstName: string;
  website: string;
  /** Bestandsnaam onder /public/demo-logos/ — null = tekst-badge. */
  logoFile: string | null;
  brandColor: string | null;
  niche: string;
  city: string;
  calendarUrl: string | null;
};

const PROSPECTS = raw as DemoProspect[];

export function listDemoProspects(): DemoProspect[] {
  return PROSPECTS;
}

export function getDemoProspect(slug: string | null | undefined): DemoProspect | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase();
  return PROSPECTS.find((p) => p.slug.toLowerCase() === key) || null;
}

export function demoLogoUrl(prospect: DemoProspect): string | null {
  if (!prospect.logoFile) return null;
  return `/demo-logos/${prospect.logoFile}`;
}

/** CTA zonder aparte agenda-tool: mailt Kevin. Optioneel overschrijven met DEMO_CTA_URL. */
export function defaultDemoCalendarUrl() {
  return (
    process.env.DEMO_CTA_URL?.trim() ||
    "mailto:kevin@blablabuild.com?subject=Recruitment%20Scout%20demo"
  );
}

export function prospectCalendarUrl(prospect: DemoProspect | null) {
  return prospect?.calendarUrl?.trim() || defaultDemoCalendarUrl();
}
