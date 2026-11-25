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

/**
 * Leeg: Brand New Start is gesloten (zie `disabled` in auth.ts), dus login en
 * sidebar tonen weer het Recruitment Scout-logo. Nieuwe partner? Voeg hem hier toe.
 */
export const PARTNERS: PartnerBrand[] = [];

export function partnerForEmail(email: string | null | undefined): PartnerBrand | null {
  if (!email) return null;
  return PARTNERS.find((p) => p.match(email)) ?? null;
}
