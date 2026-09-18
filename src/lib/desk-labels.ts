/**
 * Desk labels — two radars, different sources.
 * Routes stay /radar and /leads; only user-facing names live here.
 */
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
