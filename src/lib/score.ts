import { createHash } from "crypto";
import type { Signal } from "@/lib/db/schema";

export type ScoreFactor = { label: string; points: number; source?: string };

export function fingerprintOf(parts: {
  source: string;
  company: string;
  title: string;
  evidenceUrl?: string | null;
}): string {
  const base = [
    parts.source,
    parts.company.trim().toLowerCase(),
    parts.title.trim().toLowerCase(),
    (parts.evidenceUrl || "").split("?")[0],
  ].join("|");
  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}

function rawOf(s: Signal): Record<string, unknown> {
  return s.raw && typeof s.raw === "object" ? (s.raw as Record<string, unknown>) : {};
}

function parsePostedAt(raw: Record<string, unknown>): Date | null {
  const v = raw.postedAt;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function applicantsOf(raw: Record<string, unknown>): number | null {
  const v = raw.applicants;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

export type ScoreOptions = {
  /** Andere unieke openingen bij hetzelfde bedrijf (na dedup). */
  siblingOpenings?: number;
  /** Prefer this title/role when scoring one opening. */
  primary?: Signal | null;
};

export function scoreSignals(
  companySignals: Signal[],
  opts: ScoreOptions = {}
): {
  kans: number;
  status: "hot" | "warm" | "watch" | "cold";
  factors: ScoreFactor[];
  sources: string[];
  roleLabel: string;
  angle: string;
} {
  const factors: ScoreFactor[] = [];
  const sources = [...new Set(companySignals.map((s) => s.source))];
  const roleLabel =
    opts.primary?.roleLabel ||
    companySignals.map((s) => s.roleLabel).find(Boolean) ||
    companySignals[0]?.roleLabel ||
    "IT contracting";

  const hasContract = companySignals.some(
    (s) =>
      s.source === "job-type" ||
      /zzp|interim|contract|freelance/i.test(s.employmentHint || "") ||
      /zzp|interim|contract|freelance/i.test(s.summary)
  );
  if (hasContract) {
    factors.push({
      label: "Vacature/signaal noemt contract · interim · ZZP",
      points: 35,
      source: "job-type",
    });
  }

  const tenders = companySignals.filter((s) => s.source === "tender");
  if (tenders.length) {
    factors.push({
      label: `Aanbesteding / award (${tenders.length})`,
      points: Math.min(40, 25 + tenders.length * 5),
      source: "tender",
    });
  }

  const pulses = companySignals.filter((s) => s.source === "pulse");
  if (pulses.length) {
    factors.push({
      label: `${pulses.length}× team-melding (gesprek / ZZP besproken)`,
      points: Math.min(35, 18 + pulses.length * 10),
      source: "pulse",
    });
  }

  // Combo: hard vacancy evidence + candidate intel
  if (hasContract && pulses.length) {
    factors.push({
      label: "Combo: contract-vacature + team-melding",
      points: 12,
      source: "pulse",
    });
  }

  const stale = companySignals.filter((s) => s.source === "stale-job");
  if (stale.length) {
    factors.push({
      label: "Vacature blijft hangen → interim-pitch kans",
      points: 12,
      source: "stale-job",
    });
  }

  const agency = companySignals.filter((s) => s.source === "agency-swarm");
  if (agency.length >= 1) {
    factors.push({
      label: "Meerdere bureaus / posts op dezelfde rol",
      points: 10,
      source: "agency-swarm",
    });
  }

  // Channels / volume — meerdere bronnen = sterker signaal
  const channels = new Set(
    companySignals
      .map((s) => {
        const ch = rawOf(s).channel;
        return typeof ch === "string" ? ch : null;
      })
      .filter(Boolean)
  );
  if (channels.size >= 2) {
    factors.push({
      label: `Op ${channels.size} bronnen tegelijk`,
      points: 14,
      source: "job-type",
    });
  }

  const jobSignals = companySignals.filter((s) => s.source === "job-type");
  const siblings = opts.siblingOpenings ?? 0;
  if (siblings >= 1) {
    factors.push({
      label:
        siblings === 1
          ? "Nog 1 andere open contracting-kans bij dit bedrijf"
          : `Nog ${siblings} andere open contracting-kansen bij dit bedrijf`,
      points: Math.min(12, 6 + (siblings - 1) * 3),
      source: "job-type",
    });
  } else if (jobSignals.length >= 2 && opts.siblingOpenings === undefined) {
    // Legacy company-bundel: meerdere job-signalen zonder opening-split
    factors.push({
      label: `${jobSignals.length} contract-vacatures bij dit bedrijf`,
      points: Math.min(12, 6 + (jobSignals.length - 2) * 3),
      source: "job-type",
    });
  }

  // Recency on first-seen / scrape time
  const newest = Math.max(...companySignals.map((s) => s.seenAt.getTime()));
  const days = (Date.now() - newest) / (1000 * 60 * 60 * 24);
  if (days <= 1) factors.push({ label: "Net op de radar (≤24u)", points: 14 });
  else if (days <= 3) factors.push({ label: "Vers signaal (≤3 dagen)", points: 10 });
  else if (days <= 10) factors.push({ label: "Recent (≤10 dagen)", points: 5 });

  // Posting age + applicants from board raw metadata
  let bestFreshPost = false;
  let bestStaleLowApps = false;
  for (const s of companySignals) {
    const raw = rawOf(s);
    const posted = parsePostedAt(raw);
    const apps = applicantsOf(raw);
    if (posted) {
      const ageDays = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 2) bestFreshPost = true;
      if (ageDays >= 14 && (apps === null || apps <= 8)) bestStaleLowApps = true;
    } else if (apps !== null && apps <= 5 && days >= 7) {
      bestStaleLowApps = true;
    }
  }
  if (bestFreshPost) {
    factors.push({
      label: "Net gepost (≤2 dagen op de board)",
      points: 12,
      source: "job-type",
    });
  }
  if (bestStaleLowApps && !stale.length) {
    factors.push({
      label: "Lang open / weinig aanmeldingen → pitch-kans",
      points: 12,
      source: "stale-job",
    });
  }

  let kans = factors.reduce((a, f) => a + f.points, 0);
  kans = Math.max(5, Math.min(98, kans));

  const status: "hot" | "warm" | "watch" | "cold" =
    kans >= 75 ? "hot" : kans >= 55 ? "warm" : kans >= 35 ? "watch" : "cold";

  const angle = hasContract
    ? bestStaleLowApps
      ? "Contract-rol die blijft hangen — goed moment om te pitchen."
      : bestFreshPost
        ? "Verse contract-vacature — snel reageren."
        : "Staat al als interim/ZZP/contract in de markt — snelle pitch."
    : tenders.length
      ? "Award/project binnen — capaciteit vullen met SM/agile delivery."
      : "Nog geen hard contract-bewijs in de tekst — check de vacature of wacht op een sterker signaal.";

  return { kans, status, factors, sources, roleLabel, angle };
}

/** Score is opgetelde factoren, afgekapt op 98. */
export const SCORE_MAX = 98;
export const SCORE_THRESHOLDS = {
  hot: 75,
  warm: 55,
  watch: 35,
} as const;

/**
 * Uitleg voor /methode en UI — score is geen vaste “inschatting één keer”,
 * maar een herschatting bij elke sync uit actuele signalen.
 */
export const SCORE_METHOD = {
  intro:
    "De kans-score is de som van bewijsfactoren (max 98). Bij elke sync of refresh herberekenen we die uit de signalen die er nu zijn. Versheidspunten kunnen dus dalen als een vacature ouder wordt; nieuwe vacatures, team-meldingen of extra bronnen kunnen de score verhogen.",
  bands: [
    {
      id: "hot",
      label: "Sterke kans",
      min: SCORE_THRESHOLDS.hot,
      meaning: "Genoeg bewijs om nu te benaderen.",
    },
    {
      id: "warm",
      label: "Warme kans",
      min: SCORE_THRESHOLDS.warm,
      meaning:
        "Scoreband ≥55 — niet dat de score ‘groeit in de tijd’, maar dat er al serieuze signalen zijn. Nog 1–2 sterke factoren en het is hot.",
    },
    {
      id: "watch",
      label: "Volgen",
      min: SCORE_THRESHOLDS.watch,
      meaning: "Op de radar, nog te weinig bewijs voor actie.",
    },
    {
      id: "cold",
      label: "Zwak",
      min: 0,
      meaning: "Lage prioriteit.",
    },
  ],
  factors: [
    { when: "Vacature noemt contract / interim / ZZP", points: "+35" },
    { when: "Aanbesteding / award", points: "+25–40" },
    { when: "Team-melding (pulse)", points: "+18–35" },
    { when: "Combo contract-vacature + team-melding", points: "+12" },
    { when: "Vacature blijft hangen / weinig aanmeldingen", points: "+12" },
    { when: "Meerdere bureaus op dezelfde rol", points: "+10" },
    { when: "Zelfde kans op ≥2 bronnen", points: "+14" },
    { when: "Andere openingen bij hetzelfde bedrijf", points: "+6–12" },
    { when: "Net op de radar (≤24u / ≤3d / ≤10d)", points: "+14 / +10 / +5" },
    { when: "Net gepost op de board (≤2 dagen)", points: "+12" },
  ],
} as const;
