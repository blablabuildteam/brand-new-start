"use client";

import { SCORE_MAX, SCORE_THRESHOLDS } from "@/lib/score";

export function scoreTone(kans: number) {
  if (kans >= SCORE_THRESHOLDS.hot) return "hot";
  if (kans >= SCORE_THRESHOLDS.warm) return "warm";
  if (kans >= SCORE_THRESHOLDS.watch) return "watch";
  return "cold";
}

export const SCORE_BAND: Record<string, string> = {
  hot: "Sterke kans",
  warm: "Warme kans",
  watch: "Volgen",
  cold: "Zwak",
};

const BAND_SHORT: Record<string, string> = {
  hot: "Sterk",
  warm: "Warm",
  watch: "Volgen",
  cold: "Zwak",
};

/** Eén score-component overal: band + getal, rustig en leesbaar. */
export function ScoreChip({
  kans,
  large,
  percent,
  label,
}: {
  kans: number;
  large?: boolean;
  /** Zekerheid van de opdrachtgever, zelfde vorm als de kans-score. */
  percent?: boolean;
  /** Vervangt de bandnaam, bijvoorbeeld Bevestigd. */
  label?: string;
}) {
  const tone = scoreTone(kans);
  const band = label || BAND_SHORT[tone] || "Score";
  const tip = percent
    ? `${label || SCORE_BAND[tone]} · zekerheid ${kans}%`
    : `${SCORE_BAND[tone]} · ${kans}/${SCORE_MAX}`;

  return (
    <span
      className={`ws-score ws-score--${tone} ${large ? "ws-score--lg" : ""}`}
      data-tip={tip}
      title={tip}
    >
      <span className="ws-score__band">{band}</span>
      <span className="ws-score__value">
        <strong>{kans}</strong>
        <span className="ws-score__max">{percent ? "%" : `/${SCORE_MAX}`}</span>
      </span>
    </span>
  );
}
