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

export type ScorePart = { label: string; points?: number };

/**
 * Zelfde score overal: band, metertje, getal.
 * Kans-score vult tot 98, zekerheid tot 100. Hover toont de opbouw.
 */
export function ScoreChip({
  kans,
  large,
  percent,
  label,
  parts,
}: {
  kans: number;
  large?: boolean;
  /** Zekerheid van de opdrachtgever. Zelfde metertje, schaal 100. */
  percent?: boolean;
  /** Vervangt de bandnaam, bijvoorbeeld Bevestigd. */
  label?: string;
  /** Punten die optellen (kans) of aanwijzingen (zekerheid). */
  parts?: ScorePart[];
}) {
  const tone = scoreTone(kans);
  const band = label || BAND_SHORT[tone] || "Score";
  const max = percent ? 100 : SCORE_MAX;
  const fill = Math.max(4, Math.min(100, Math.round((kans / max) * 100)));
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

  return (
    <span
      className={`ws-score ws-score--${tone} ${large ? "ws-score--lg" : ""}`}
      onMouseEnter={(e) => open(e.currentTarget)}
      onMouseLeave={scheduleClose}
    >
      <span className="ws-score__band">{band}</span>
      <span className="ws-score__track" aria-hidden>
        <span style={{ width: `${fill}%` }} />
      </span>
      <span className="ws-score__value">
        <strong>{kans}</strong>
        <span className="ws-score__max">{percent ? "%" : `/${SCORE_MAX}`}</span>
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
                {percent ? "Zekerheid opdrachtgever" : "Kans-score"}
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
              <span className="ws-score__pop-foot">
                {percent
                  ? "Het metertje loopt van 0 tot 100."
                  : rows.length
                    ? "Het metertje is de som van deze punten, maximaal 98."
                    : "Het metertje loopt tot 98."}
              </span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
