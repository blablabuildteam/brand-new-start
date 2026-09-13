/**
 * Partner white-label for desk (AppShell).
 * Public homepage blijft Recruitment Scout; de workspace is van de partner.
 */

export type PartnerBrand = {
  id: string;
  name: string;
  tagline: string;
  logoSrc: string;
  /** Match email or domain */
  match: (email: string) => boolean;
};

export const PARTNERS: PartnerBrand[] = [
  {
    id: "brand-new-start",
    name: "Brand New Start",
    tagline: "IT contracting",
    logoSrc: "/assets/bns-logo.png",
    match: (email) => {
      const e = email.trim().toLowerCase();
      return e === "recruiter@brandnewstart.nl" || e.endsWith("@brandnewstart.nl");
    },
  },
];

export function partnerForEmail(email: string | null | undefined): PartnerBrand | null {
  if (!email) return null;
  return PARTNERS.find((p) => p.match(email)) ?? null;
}
