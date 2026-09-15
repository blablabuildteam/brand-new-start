/**
 * Desk labels — both desks are radars; source differs.
 * Routes stay /radar and /leads; only user-facing names live here.
 */
export const DESK = {
  direct: {
    id: "radar" as const,
    nav: "Direct",
    title: "Direct",
    subtitle: "Jobboards · vacatures bij eindklanten",
    foldTitle: "Wat is Direct?",
    foldMeta: "LinkedIn · Indeed · Freelance.nl",
    href: "/radar",
    short: "direct",
  },
  bureau: {
    id: "leads" as const,
    nav: "Via bureau",
    title: "Via bureau",
    subtitle: "Recruiter-feeds · eindklant bevestigen",
    foldTitle: "Wat is Via bureau?",
    foldMeta: "Feeds · eindklant · HM",
    href: "/leads",
    short: "via bureau",
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
