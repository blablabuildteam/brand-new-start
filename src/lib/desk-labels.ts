/**
 * Desk labels — two radars, different sources.
 * Routes stay /radar and /leads; only user-facing names live here.
 */
export const DESK = {
  direct: {
    id: "radar" as const,
    nav: "Jobboards",
    title: "Jobboards",
    subtitle: "LinkedIn · Indeed · Freelance.nl",
    foldTitle: "Wat is Jobboards?",
    foldMeta: "Directe vacatures · kans-score",
    href: "/radar",
    short: "jobboards",
  },
  bureau: {
    id: "leads" as const,
    nav: "Recruiter feed",
    title: "Recruiter feed",
    subtitle: "Posts van kantoren die je volgt",
    foldTitle: "Wat is Recruiter feed?",
    foldMeta: "Eindklant bevestigen · HM",
    href: "/leads",
    short: "recruiter feed",
  },
  kansen: {
    id: "kansen" as const,
    nav: "Kansen",
    title: "Kansen",
    subtitle: "Eén lijst · volgende actie",
    href: "/kansen",
  },
  voorstel: {
    id: "voorstel" as const,
    nav: "Voorstel",
    title: "Voorstel",
    subtitle: "Bericht klaarzetten",
    href: "/regie",
  },
} as const;

/** One-liner for homepage / login. */
export const DESK_FLOW = `${DESK.direct.nav}, ${DESK.bureau.nav}, ${DESK.kansen.nav} en ${DESK.voorstel.nav}`;
