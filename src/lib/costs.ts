/**
 * Signal stack cost model — keep scrapers expensive-only where APIs fail.
 * Numbers are MVP planning estimates (EUR), small NL niche (BNS kernrollen).
 */

export type SourceTier = "free-api" | "owned" | "paid-hard" | "paid-open" | "human";

export type SourceCost = {
  id: string;
  label: string;
  tier: SourceTier;
  tool: "none" | "apify" | "firecrawl" | "tenderned" | "pulse" | "paste";
  /** Why this source is worth paying for */
  quality: "kritisch" | "hoog" | "middel" | "laag";
  /** Efficient cadence for MVP */
  cadence: string;
  /** Approx EUR / month at MVP volume */
  eurPerMonth: { low: number; high: number };
  /** How we stay cheap */
  efficiency: string;
};

export const SOURCE_COST_MODEL: SourceCost[] = [
  {
    id: "linkedin-jobs",
    label: "LinkedIn Jobs",
    tier: "paid-hard",
    tool: "apify",
    quality: "hoog",
    cadence: "handmatig · advies 1×/3 dagen",
    /** ~10 runs/m × €0,40–2,50 */
    eurPerMonth: { low: 4, high: 25 },
    efficiency: "Alleen BNS-rollen + contract/ZZP-filters. Dedup op URL. Losse sync.",
  },
  {
    id: "indeed",
    label: "Indeed NL",
    tier: "paid-hard",
    tool: "apify",
    quality: "hoog",
    cadence: "handmatig · advies 1×/3 dagen · alle BNS-rollen",
    /** ~10 runs/m × €0,80–4,50 */
    eurPerMonth: { low: 8, high: 45 },
    efficiency: "Eigen sync-ronde. Alle rollen per run via Apify startUrls.",
  },
  {
    id: "freelance-nl",
    label: "Freelance.nl",
    tier: "paid-open",
    tool: "firecrawl",
    quality: "middel",
    cadence: "handmatig · advies 1×/3 dagen",
    /** ~10 runs/m × €0,30–2,00 */
    eurPerMonth: { low: 3, high: 20 },
    efficiency: "Eigen sync-ronde. Zoekpagina’s via Firecrawl — niet gebundeld met Indeed.",
  },
  {
    id: "firecrawl-careers",
    label: "Careers / platforms",
    tier: "paid-open",
    tool: "firecrawl",
    quality: "middel",
    cadence: "handmatig · watchlist",
    eurPerMonth: { low: 2, high: 12 },
    efficiency: "Vaste careers-URL’s in platforms.ts. Apart van Freelance.nl.",
  },
  {
    id: "tenderned",
    label: "TenderNed awards",
    tier: "free-api",
    tool: "tenderned",
    quality: "hoog",
    cadence: "nog niet live (credentials)",
    eurPerMonth: { low: 0, high: 0 },
    efficiency: "Officiële API — geen scraper.",
  },
  {
    id: "pulse",
    label: "Team-meldingen",
    tier: "owned",
    tool: "pulse",
    quality: "hoog",
    cadence: "realtime (handmatig)",
    eurPerMonth: { low: 0, high: 0 },
    efficiency: "Eigen input — geen scraperkosten. UI volgt later.",
  },
];

export const PLATFORM_COST = {
  vercel: { low: 0, high: 20, note: "Hobby oké; Pro als je lange Apify-runs nodig hebt" },
  database: { low: 0, high: 15, note: "Neon Postgres (live)" },
};

export function sumRange(items: { low: number; high: number }[]) {
  return {
    low: items.reduce((a, x) => a + x.low, 0),
    high: items.reduce((a, x) => a + x.high, 0),
  };
}

export function mvpMonthlyTotal() {
  const sources = sumRange(SOURCE_COST_MODEL.map((s) => s.eurPerMonth));
  const platform = sumRange([PLATFORM_COST.vercel, PLATFORM_COST.database]);
  /** Actieve scrapers bij advies-cadans (geen auto-cron) */
  const active = SOURCE_COST_MODEL.filter((s) =>
    ["linkedin-jobs", "indeed", "freelance-nl"].includes(s.id)
  );
  const activeRange = sumRange(active.map((s) => s.eurPerMonth));
  return {
    sources,
    platform,
    /** Typisch als je ~1×/3d LinkedIn + Indeed + Freelance.nl draait */
    liveNow: {
      low: activeRange.low + PLATFORM_COST.vercel.low + PLATFORM_COST.database.low,
      high: activeRange.high + PLATFORM_COST.vercel.high + PLATFORM_COST.database.high,
      note: "Handmatig · advies 1×/3d · LinkedIn + Indeed + Freelance.nl + Neon/Vercel. Geen auto-cron.",
    },
    /** Inclusief careers-watchlist */
    withFirecrawl: {
      low: sources.low + platform.low,
      high: sources.high + platform.high,
      note: "Zelfde stack + careers-watchlist (+ TenderNed/pulse ≈ €0).",
    },
    total: { low: sources.low + platform.low, high: sources.high + platform.high },
  };
}

/**
 * Placement economics — BNS verdient op uurtarief-marge
 * (klant-uurtarief − ZZP-uurtarief), niet op een flat fee.
 */
export const ROI_MODEL = {
  currency: "EUR",
  /** Indicatief: wat de klant betaalt per uur */
  clientRatePerHour: { low: 95, high: 125 },
  /** Indicatief: wat de ZZP’er ontvangt per uur */
  contractorRatePerHour: { low: 75, high: 95 },
  /** Marge per uur = client − contractor (range) */
  marginPerHour: { low: 15, high: 35 },
  /** Typische opdrachtduur */
  hoursPerWeek: 36,
  weeksPerPlacement: { low: 13, high: 26 }, // ~3–6 maanden
  marginPerPlacement(opts?: {
    marginPerHour?: number;
    hoursPerWeek?: number;
    weeks?: number;
  }) {
    const m = opts?.marginPerHour ?? 20;
    const h = opts?.hoursPerWeek ?? ROI_MODEL.hoursPerWeek;
    const w = opts?.weeks ?? 20;
    return Math.round(m * h * w);
  },
  breakEvenPlacementsPerYear(annualCost: number, marginPerPlacement: number) {
    return Math.max(1, Math.ceil(annualCost / Math.max(1, marginPerPlacement)));
  },
  narrative: [
    "Verdienste = (klant-uurtarief − ZZP-uurtarief) × uren × weken.",
    "1 extra interim-plaatsing/jaar dekt typisch de jaarkosten van de signal-stack.",
    "Stack is handmatig (geen cron): je stuurt zelf hoe vaak je LinkedIn / Indeed / Freelance.nl draait.",
    "Kwaliteit > volume: liever sterke niche-hits dan dagelijkse max-scrapes.",
  ],
};

/** Collect-first policy — fill the niche; score ranks later. Caps = soft cost brakes. */
export const INGEST_POLICY = {
  linkedinOwnerPostsMax: 40,
  linkedinOwnerCadenceHours: 24,
  /** Alle enabled careers-URL’s meenemen (watchlist is al klein) */
  careersMaxUrlsPerRun: 40,
  careersOnlyIfOnRadar: true,
  requireNicheMatch: true,
  dedupeByFingerprint: true,
  preferApiOverScrape: true,
  /**
   * Sync-caps: collect-first — liever alle BNS-rollen per boards-run,
   * minder vaak (advies ~1×/3 dagen) dan 1 rol/dag.
   */
  syncMarketUrls: 30,
  syncMarketJobs: 80,
  /** Totaal Indeed-items over alle rol-queries samen */
  syncIndeedMax: 80,
  /** Aantal BNS-rollen per Indeed-sync (alle = BOARD_QUERIES.length) */
  syncIndeedQueries: 12,
  syncFreelanceQueries: 12,
  /** Advies-cadans boards (Indeed + Freelance.nl), niet de dagelijkse cron */
  boardsCadenceDays: 3,
} as const;

/**
 * Indicatieve kosten per sync-run (EUR) bij huidige caps.
 * Geen factuur — ruwe range: Apify compute + Firecrawl credits.
 */
export const SYNC_COST_PER_RUN = {
  currency: "EUR",
  disclaimer:
    "Schatting per sync. Echte rekening = Apify-usage + Firecrawl-credits. Geen bron draait automatisch — alles handmatig.",
  meaning: [
    "Je betaalt providers per scrape/run — niet per ‘mooie hit’.",
    "Filteren (niche) is gratis in onze app: we gooien noise weg ná het ophalen.",
    "Dus: grotere caps = meer kans op goede signalen, maar je betaalt ook voor wat we wegfilteren.",
    "1 sterke plaatsing dekt typisch maanden stack-kosten (zie Kosten / ROI).",
  ],
  actions: {
    market: {
      label: "LinkedIn Jobs",
      tool: "Apify",
      eur: { low: 0.4, high: 2.5 },
      what: `tot ${INGEST_POLICY.syncMarketUrls} zoek-URL’s · ~${INGEST_POLICY.syncMarketJobs} jobs · advies 1×/${INGEST_POLICY.boardsCadenceDays}d`,
    },
    indeed: {
      label: "Indeed NL",
      tool: "Apify",
      eur: { low: 0.8, high: 4.5 },
      what: `${INGEST_POLICY.syncIndeedQueries} rollen · ~${INGEST_POLICY.syncIndeedMax} items · advies 1×/${INGEST_POLICY.boardsCadenceDays}d`,
    },
    "freelance-nl": {
      label: "Freelance.nl",
      tool: "Firecrawl",
      eur: { low: 0.3, high: 2.0 },
      what: `${INGEST_POLICY.syncFreelanceQueries} zoekpagina’s · advies 1×/${INGEST_POLICY.boardsCadenceDays}d`,
    },
    boards: {
      label: "Indeed + Freelance.nl (legacy bundel)",
      tool: "Apify + Firecrawl",
      eur: { low: 1.1, high: 6.5 },
      what: `Liever apart syncen — Indeed of Freelance.nl los`,
    },
    platforms: {
      label: "Careers-platforms",
      tool: "Firecrawl",
      eur: { low: 0.2, high: 1.2 },
      what: `tot ${INGEST_POLICY.careersMaxUrlsPerRun} careers-pagina’s`,
    },
    all: {
      label: "Sync alles",
      tool: "Apify + Firecrawl",
      eur: { low: 1.5, high: 9.0 },
      what: "LinkedIn + Indeed + Freelance.nl (careers apart)",
    },
  },
} as const;
