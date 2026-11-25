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

function channel(hex: string) {
  const n = parseInt(hex, 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

/** Donkere of lichte inkt zodat een merkkleur-badge leesbaar blijft. */
export function inkOnBrand(hex: string | null | undefined) {
  const light = "#ffffff";
  const dark = "#1a1a1a";
  const raw = (hex || "").trim();
  const m = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return light;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const L =
    0.2126 * channel(h.slice(0, 2)) +
    0.7152 * channel(h.slice(2, 4)) +
    0.0722 * channel(h.slice(4, 6));
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const darkL = channel("1a") * 0.2126 + channel("1a") * 0.7152 + channel("1a") * 0.0722;
  return contrast(L, darkL) >= contrast(L, 1) ? dark : light;
}
