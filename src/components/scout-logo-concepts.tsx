"use client";

import type { ReactNode } from "react";

/** Distinct logo concept marks — each is a different visual idea, not a font tweak. */

const INK = "#0f1412";
const MARK = "#1a5c45";
const PAPER = "#f4efe6";
const LINE = "#d4cdc0";

function Tile({
  children,
  bg = PAPER,
  stroke,
  round = 8.5,
}: {
  children: ReactNode;
  bg?: string;
  stroke?: string;
  round?: number;
}) {
  return (
    <svg viewBox="0 0 32 32" className="logo-concept__svg" aria-hidden fill="none">
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx={round}
        fill={bg}
        stroke={stroke || "none"}
        strokeWidth={stroke ? 1.2 : 0}
      />
      {children}
    </svg>
  );
}

/** A — classic radar (current baseline) */
export function MarkRadar() {
  return (
    <Tile stroke={LINE}>
      <circle cx="16" cy="16" r="9" stroke={MARK} strokeWidth="1.1" opacity="0.35" />
      <circle cx="16" cy="16" r="5.5" stroke={MARK} strokeWidth="1.1" opacity="0.55" />
      <path d="M16 16 L16 7.2 A8.8 8.8 0 0 1 23.6 12 Z" fill={MARK} fillOpacity="0.18" />
      <path d="M16 16 L23.6 12" stroke={MARK} strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="24.1" cy="11.7" r="1.45" fill={MARK} />
      <circle cx="16" cy="16" r="1.7" fill={MARK} />
    </Tile>
  );
}

/** B — RS monogram, interlocking letters */
export function MarkMonogram() {
  return (
    <Tile bg={MARK} round={9}>
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fill={PAPER}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="13"
        letterSpacing="-0.06em"
      >
        RS
      </text>
    </Tile>
  );
}

/** C — optical scope / crosshair */
export function MarkScope() {
  return (
    <Tile stroke={LINE}>
      <circle cx="16" cy="16" r="10" stroke={INK} strokeWidth="1.3" />
      <circle cx="16" cy="16" r="6.2" stroke={MARK} strokeWidth="1.2" />
      <path d="M16 4.5 V9.5 M16 22.5 V27.5 M4.5 16 H9.5 M22.5 16 H27.5" stroke={INK} strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.6" fill={MARK} />
    </Tile>
  );
}

/** D — soft ping (concentric only, no sweep) */
export function MarkPing() {
  return (
    <svg viewBox="0 0 32 32" className="logo-concept__svg" aria-hidden fill="none">
      <circle cx="16" cy="16" r="14" fill="transparent" />
      <circle cx="16" cy="16" r="11.5" stroke={MARK} strokeWidth="1" opacity="0.22" />
      <circle cx="16" cy="16" r="7.5" stroke={MARK} strokeWidth="1.2" opacity="0.45" />
      <circle cx="16" cy="16" r="3.2" stroke={MARK} strokeWidth="1.4" />
      <circle cx="16" cy="16" r="1.5" fill={MARK} />
    </svg>
  );
}

/** E — compass rose */
export function MarkCompass() {
  return (
    <Tile bg="#e8f0ea" round={16}>
      <path d="M16 5 L18.2 14.2 L27 16 L18.2 17.8 L16 27 L13.8 17.8 L5 16 L13.8 14.2 Z" fill={MARK} />
      <circle cx="16" cy="16" r="2.2" fill={PAPER} />
      <circle cx="16" cy="16" r="1.1" fill={INK} />
    </Tile>
  );
}

/** F — signal bars */
export function MarkSignal() {
  return (
    <Tile stroke={LINE} round={7}>
      <rect x="7" y="18" width="3.2" height="7" rx="1" fill={MARK} opacity="0.4" />
      <rect x="12.4" y="13.5" width="3.2" height="11.5" rx="1" fill={MARK} opacity="0.65" />
      <rect x="17.8" y="9" width="3.2" height="16" rx="1" fill={MARK} />
      <rect x="23.2" y="6" width="3.2" height="19" rx="1" fill={INK} />
    </Tile>
  );
}

/** G — route S (trail / map path) */
export function MarkRouteS() {
  return (
    <Tile bg={INK} round={8}>
      <path
        d="M10 10.5 C10 8.5 12 7.5 15 7.5 C19.5 7.5 22 9.5 22 12 C22 14.5 19.5 15.5 16 16.5 C12.5 17.5 10 18.5 10 21 C10 23.5 12.5 24.5 16.5 24.5 C20 24.5 22.5 23 22.5 21"
        stroke={PAPER}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22.5" cy="21" r="1.8" fill="#3dcf8e" />
    </Tile>
  );
}

/** H — circular stamp seal */
export function MarkStamp() {
  return (
    <svg viewBox="0 0 32 32" className="logo-concept__svg" aria-hidden fill="none">
      <circle cx="16" cy="16" r="14.2" stroke={MARK} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="11.2" stroke={MARK} strokeWidth="0.9" opacity="0.5" />
      <text
        x="16"
        y="18.2"
        textAnchor="middle"
        fill={MARK}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="7.5"
        letterSpacing="0.12em"
      >
        SCOUT
      </text>
    </svg>
  );
}

/** I — binocular / dual lens */
export function MarkLenses() {
  return (
    <Tile stroke={LINE} round={10}>
      <circle cx="11.5" cy="16" r="5.4" stroke={INK} strokeWidth="1.4" />
      <circle cx="20.5" cy="16" r="5.4" stroke={INK} strokeWidth="1.4" />
      <path d="M14.2 13.2 H17.8" stroke={MARK} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11.5" cy="16" r="1.5" fill={MARK} />
      <circle cx="20.5" cy="16" r="1.5" fill={MARK} />
    </Tile>
  );
}

/** J — map grid with hot cell */
export function MarkGrid() {
  return (
    <Tile bg="#ebe5d8" stroke={LINE} round={6}>
      {[8, 16, 24].map((x) => (
        <path key={`v${x}`} d={`M${x} 6 V26`} stroke={INK} strokeWidth="0.7" opacity="0.2" />
      ))}
      {[8, 16, 24].map((y) => (
        <path key={`h${y}`} d={`M6 ${y} H26`} stroke={INK} strokeWidth="0.7" opacity="0.2" />
      ))}
      <rect x="16.5" y="8.5" width="7" height="7" rx="1.2" fill={MARK} />
      <circle cx="20" cy="12" r="1.3" fill={PAPER} />
    </Tile>
  );
}

/** K — north needle / find arrow */
export function MarkNeedle() {
  return (
    <Tile bg={PAPER} stroke={LINE} round={16}>
      <path d="M16 6 L20.5 20 L16 17.2 L11.5 20 Z" fill={MARK} />
      <path d="M16 17.2 L16 25.5" stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    </Tile>
  );
}

/** L — solid ink disc (inverted radar silhouette) */
export function MarkInkDisc() {
  return (
    <svg viewBox="0 0 32 32" className="logo-concept__svg" aria-hidden fill="none">
      <circle cx="16" cy="16" r="14.5" fill={INK} />
      <circle cx="16" cy="16" r="8.5" stroke={PAPER} strokeWidth="1.1" opacity="0.35" />
      <circle cx="16" cy="16" r="5" stroke={PAPER} strokeWidth="1.1" opacity="0.55" />
      <path d="M16 16 L16 8.2 A7.8 7.8 0 0 1 22.8 12.5 Z" fill="#3dcf8e" fillOpacity="0.35" />
      <path d="M16 16 L22.8 12.5" stroke="#3dcf8e" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="23.2" cy="12.2" r="1.4" fill="#3dcf8e" />
      <circle cx="16" cy="16" r="1.5" fill={PAPER} />
    </svg>
  );
}

/** M — pennant / flag */
export function MarkPennant() {
  return (
    <Tile stroke={LINE} round={7}>
      <path d="M9 7 V25" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.5 8 L24 13.2 L9.5 18.5 Z" fill={MARK} />
      <circle cx="14.2" cy="13.2" r="1.2" fill={PAPER} />
    </Tile>
  );
}

/** N — diamond lock (opportunity gem) */
export function MarkDiamond() {
  return (
    <Tile bg="#e7e0d4" round={8}>
      <path d="M16 5.5 L26 16 L16 26.5 L6 16 Z" stroke={INK} strokeWidth="1.35" fill="none" />
      <path d="M16 10 L21.5 16 L16 22 L10.5 16 Z" fill={MARK} />
    </Tile>
  );
}

export type ConceptId =
  | "radar"
  | "monogram"
  | "scope"
  | "ping"
  | "compass"
  | "signal"
  | "route"
  | "stamp"
  | "lenses"
  | "grid"
  | "needle"
  | "ink"
  | "pennant"
  | "diamond"
  | "type";

export const CONCEPT_MARKS: Record<Exclude<ConceptId, "type">, () => ReactNode> = {
  radar: MarkRadar,
  monogram: MarkMonogram,
  scope: MarkScope,
  ping: MarkPing,
  compass: MarkCompass,
  signal: MarkSignal,
  route: MarkRouteS,
  stamp: MarkStamp,
  lenses: MarkLenses,
  grid: MarkGrid,
  needle: MarkNeedle,
  ink: MarkInkDisc,
  pennant: MarkPennant,
  diamond: MarkDiamond,
};
