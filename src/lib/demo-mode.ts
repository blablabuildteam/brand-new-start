import type { SessionUser } from "@/lib/auth";
import { partnerForEmail } from "@/lib/partner-brand";

/** Publiek demo-account voor rondleidingen — geen BNS-branding, geen live data. */
export const DEMO_EMAIL = "demo@blablabuild.com";

export function isDemoEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase() === DEMO_EMAIL;
}

export function isDemoUser(session: SessionUser | null | undefined) {
  return Boolean(session && isDemoEmail(session.email));
}

/** Partner (BNS) of admin — mag De afspraak / pilot zien. Demo niet. */
export function canSeePartnerDeal(session: SessionUser | null | undefined) {
  if (!session) return false;
  if (session.role === "admin") return true;
  return Boolean(partnerForEmail(session.email));
}

export const DEMO_BANNER =
  "Demo-omgeving · sample data · sync en kosten staan uit. Niets hiervan is live klantwerk.";
