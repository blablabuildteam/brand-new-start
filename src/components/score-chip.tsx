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

export function ScoreChip({ kans, large }: { kans: number; large?: boolean }) {
  const tone = scoreTone(kans);
  const cls =
    tone === "hot"
      ? "border-[var(--green)]/40 bg-[var(--green-soft)] text-[var(--green)]"
      : tone === "warm"
        ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]"
        : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-md border ${cls} ${
        large ? "min-w-[3.6rem] px-2.5 py-1.5" : "min-w-[2.8rem] px-2 py-1"
      }`}
      data-tip={`Kans-score ${kans}/${SCORE_MAX} — som van factoren`}
      style={{ fontFamily: "var(--mono)" }}
    >
      <span className={`font-semibold tabular-nums ${large ? "text-lg" : "text-sm"}`}>{kans}</span>
      <span className="text-[0.58rem] opacity-80">/{SCORE_MAX}</span>
    </span>
  );
}
