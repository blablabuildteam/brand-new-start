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
  compact,
}: {
  kans: number;
  large?: boolean;
  /** Alleen getal (lijsten met weinig ruimte). */
  compact?: boolean;
}) {
  const tone = scoreTone(kans);
  const band = BAND_SHORT[tone] || "Score";

  return (
    <span
      className={`ws-score ws-score--${tone} ${large ? "ws-score--lg" : ""} ${compact ? "ws-score--compact" : ""}`}
      data-tip={`${SCORE_BAND[tone]} · ${kans}/${SCORE_MAX}`}
      title={`${SCORE_BAND[tone]} · ${kans}/${SCORE_MAX}`}
    >
      {!compact ? <span className="ws-score__band">{band}</span> : null}
      <span className="ws-score__value">
        <strong>{kans}</strong>
        <span className="ws-score__max">/{SCORE_MAX}</span>
      </span>
    </span>
  );
}
