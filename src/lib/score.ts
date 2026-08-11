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

export function scoreSignals(companySignals: Signal[]): {
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

  // Recency boost
  const newest = Math.max(...companySignals.map((s) => s.seenAt.getTime()));
  const days = (Date.now() - newest) / (1000 * 60 * 60 * 24);
  if (days <= 3) factors.push({ label: "Vers signaal (≤3 dagen)", points: 10 });
  else if (days <= 10) factors.push({ label: "Recent (≤10 dagen)", points: 5 });

  let kans = factors.reduce((a, f) => a + f.points, 0);
  kans = Math.max(5, Math.min(98, kans));

  const status: "hot" | "warm" | "watch" | "cold" =
    kans >= 75 ? "hot" : kans >= 55 ? "warm" : kans >= 35 ? "watch" : "cold";

  const angle = hasContract
    ? "Staat al als interim/ZZP/contract in de markt — snelle pitch."
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
