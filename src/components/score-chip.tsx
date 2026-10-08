"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SCORE_MAX, SCORE_THRESHOLDS } from "@/lib/score";

export function scoreTone(kans: number) {
  if (kans >= SCORE_THRESHOLDS.hot) return "hot";
  if (kans >= SCORE_THRESHOLDS.warm) return "warm";
  if (kans >= SCORE_THRESHOLDS.watch) return "watch";
  return "cold";
}

/** Lange namen voor tooltips / docs — niet meer op de chip zelf. */
export const SCORE_BAND: Record<string, string> = {
  hot: "Sterke kans",
  warm: "Warme kans",
  watch: "Volgen",
  cold: "Zwak",
};

export type ScorePart = { label: string; points?: number };

/**
 * Alleen cijfer + kleur. Hover toont opbouw / uitleg.
 * Optionele `label` (bv. Bevestigd) vervangt het cijfer niet — staat in de tip.
 */
export function ScoreChip({
  kans,
  large,
  percent,
  label,
  parts,
  hint,
}: {
  kans: number;
  large?: boolean;
  /** Zekerheid van de opdrachtgever. Zelfde chip, schaal 100. */
  percent?: boolean;
  /** Extra status in de hover (Bevestigd / Weg). */
  label?: string;
  /** Punten die optellen (kans) of aanwijzingen (zekerheid). */
  parts?: ScorePart[];
  /** Extra uitleg onder de pop — bv. waarom Weg / Te dun. */
  hint?: string;
}) {
  const tone = scoreTone(kans);
  const rows = (parts || []).filter((p) => p.label).slice(0, 5);
  const [box, setBox] = useState<{ top: number; left: number; above: boolean; maxH: number } | null>(null);
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setBox(null), 140);
  }

  function open(el: HTMLElement) {
    cancelClose();
    const r = el.getBoundingClientRect();
    const width = 248;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const gutter = window.innerWidth < 1024 ? 78 : 16;
    const spaceBelow = window.innerHeight - r.bottom - gutter;
    const spaceAbove = r.top - 16;
    const above = spaceBelow < 240 && spaceAbove > spaceBelow;
    setBox({
      top: above ? r.top - 8 : r.bottom + 8,
      left,
      above,
      maxH: Math.max(140, Math.floor(above ? spaceAbove : spaceBelow)),
    });
  }

  const aria = percent
    ? `Zekerheid ${kans}%${label ? ` · ${label}` : ""}`
    : `Score ${kans} van ${SCORE_MAX}${label ? ` · ${label}` : ""}`;

  return (
    <span
      className={`ws-score ws-score--${tone} ${large ? "ws-score--lg" : ""}`}
      aria-label={aria}
      onMouseEnter={(e) => open(e.currentTarget)}
      onMouseLeave={scheduleClose}
    >
      <span className="ws-score__dot" aria-hidden />
      <span className="ws-score__value">
        <strong>{kans}</strong>
        {!percent ? <span className="ws-score__max">/{SCORE_MAX}</span> : <span className="ws-score__max">%</span>}
      </span>
      {box && typeof document !== "undefined"
        ? createPortal(
            <span
              className={`ws-score__pop ${box.above ? "ws-score__pop--above" : ""}`}
              style={{ top: box.top, left: box.left, maxHeight: box.maxH }}
              role="tooltip"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <span className="ws-score__pop-h">
                {label || (percent ? "Zekerheid opdrachtgever" : "Kans-score")}
                <span>
                  {kans}
                  {percent ? "%" : `/${SCORE_MAX}`}
                </span>
              </span>
              {rows.length ? (
                <ul>
                  {rows.map((p, i) => (
                    <li key={i}>
                      {p.points != null ? <span>+{p.points}</span> : null}
                      {p.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              {hint ? <span className="ws-score__pop-foot">{hint}</span> : null}
              {!hint && !percent && rows.length ? (
                <span className="ws-score__pop-foot">Som van deze punten, max {SCORE_MAX}.</span>
              ) : null}
              {!hint && !rows.length && !percent ? (
                <span className="ws-score__pop-foot">
                  {SCORE_BAND[tone] || "Score"} · drempel warm {SCORE_THRESHOLDS.warm}+.
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
