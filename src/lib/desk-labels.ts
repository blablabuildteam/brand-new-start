/**
 * Desk labels — two radars, different sources.
 * Routes stay /radar and /leads; only user-facing names live here.
 */
/** Wat de recruiter ziet als LinkedIn geen manager teruggeeft. Nooit de ruwe actor-regel. */
export function hmSearchMessage(detail?: string | null) {
  if (detail === "no-apify-token") return "LinkedIn-zoeken staat uit.";
  if (detail === "no-company-linkedin") return "Geen LinkedIn-pagina van dit bedrijf gevonden.";
  if (!detail || /actor=|harvestapi|linkedin-profile/i.test(detail)) {
    return "Geen hiring manager gevonden op LinkedIn voor deze rol.";
  }
  return detail;
}

export const DESK = {
  direct: {
    id: "radar" as const,
    nav: "Jobboards",
    title: "Jobboards",
    subtitle: "Vacatures bij eindklanten · score 55+ wordt een kans",
    foldTitle: "Wat is Jobboards?",
    foldMeta: "Kans-score · drempel 55",
    href: "/radar",
    short: "jobboards",
  },
  bureau: {
    id: "leads" as const,
    nav: "Recruiter feed",
    title: "Recruiter feed",
    subtitle: "Posts van kantoren · wie is de opdrachtgever?",
    foldTitle: "Wat is Recruiter feed?",
    foldMeta: "Stap 1 · opdrachtgever bevestigen",
    href: "/leads",
    short: "recruiter feed",
  },
  kansen: {
    id: "kansen" as const,
    nav: "Kansen",
    title: "Kansen",
    subtitle: "Opdrachtgever → manager → contact → bericht",
    href: "/kansen",
  },
  voorstel: {
    id: "voorstel" as const,
    nav: "Voorstel",
    title: "Voorstel",
    subtitle: "Stap 4 · bericht aan de hiring manager",
    href: "/regie",
  },
} as const;

/** One-liner for homepage / login. */
export const DESK_FLOW = `${DESK.direct.nav}, ${DESK.bureau.nav}, ${DESK.kansen.nav} en ${DESK.voorstel.nav}`;
