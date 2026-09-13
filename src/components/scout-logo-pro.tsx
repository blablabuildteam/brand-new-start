"use client";

import type { ReactNode } from "react";

/**
 * Next-level logo lockups — each is a full brand mark, not icon+font.
 * Crafted as self-contained SVGs / compositions.
 */

type Props = { className?: string };

const ink = "#0f1412";
const paper = "#f3eee4";
const forest = "#14533f";
const moss = "#2a7a58";
const chalk = "#efe9df";
const signal = "#3dcf8e";

/** 01 — Arc Cut: Scout wordmark with a live sweep arc cutting the S */
export function LogoArcCut({ className }: Props) {
  return (
    <svg viewBox="0 0 280 72" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="arcSweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={moss} stopOpacity="0" />
          <stop offset="55%" stopColor={moss} stopOpacity="0.55" />
          <stop offset="100%" stopColor={signal} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r="28" fill={paper} stroke="#d4cdc0" strokeWidth="1.2" />
      <circle cx="36" cy="36" r="18" stroke={forest} strokeWidth="1.1" opacity="0.28" />
      <circle cx="36" cy="36" r="11" stroke={forest} strokeWidth="1.25" opacity="0.5" />
      <path d="M36 36 L36 18 A18 18 0 0 1 51 28 Z" fill="url(#arcSweep)" />
      <path d="M36 36 L51 28" stroke={forest} strokeWidth="2" strokeLinecap="round" />
      <circle cx="52.2" cy="27.2" r="2.4" fill={signal} />
      <circle cx="36" cy="36" r="2.6" fill={forest} />
      <text
        x="78"
        y="46"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="34"
        letterSpacing="-0.06em"
      >
        Scout
      </text>
      <text
        x="78"
        y="22"
        fill={forest}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="9"
        letterSpacing="0.28em"
      >
        RECRUITMENT
      </text>
    </svg>
  );
}

/** 02 — Masthead: journal-style with rules */
export function LogoMasthead({ className }: Props) {
  return (
    <svg viewBox="0 0 300 78" className={className} aria-hidden fill="none">
      <line x1="0" y1="10" x2="300" y2="10" stroke={ink} strokeWidth="1.2" />
      <line x1="0" y1="14" x2="300" y2="14" stroke={ink} strokeWidth="0.5" opacity="0.35" />
      <text
        x="150"
        y="48"
        textAnchor="middle"
        fill={ink}
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontWeight="600"
        fontSize="36"
        letterSpacing="0.08em"
      >
        RECRUITMENT SCOUT
      </text>
      <line x1="0" y1="62" x2="300" y2="62" stroke={ink} strokeWidth="0.5" opacity="0.35" />
      <line x1="0" y1="66" x2="300" y2="66" stroke={ink} strokeWidth="1.2" />
      <circle cx="150" cy="72" r="2" fill={forest} />
    </svg>
  );
}

/** 03 — Night Capsule: dark pill with neon ping + custom stack */
export function LogoNightCapsule({ className }: Props) {
  return (
    <svg viewBox="0 0 260 56" className={className} aria-hidden fill="none">
      <rect x="0" y="0" width="56" height="56" rx="28" fill={ink} />
      <circle cx="28" cy="28" r="16" stroke={chalk} strokeWidth="1" opacity="0.2" />
      <circle cx="28" cy="28" r="9" stroke={signal} strokeWidth="1.4" opacity="0.7" />
      <circle cx="28" cy="28" r="2.8" fill={signal} />
      <circle cx="39" cy="18" r="2.2" fill={signal} className="logo-pulse" />
      <text
        x="70"
        y="24"
        fill={ink}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight="500"
        fontSize="10"
        letterSpacing="0.18em"
        opacity="0.55"
      >
        DESK // LIVE
      </text>
      <text
        x="70"
        y="44"
        fill={ink}
        fontFamily="Unbounded, system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.03em"
      >
        Scout
      </text>
    </svg>
  );
}

/** 04 — Interlock RS: custom geometric monogram as the brand */
export function LogoInterlock({ className }: Props) {
  return (
    <svg viewBox="0 0 240 64" className={className} aria-hidden fill="none">
      <rect x="0" y="2" width="60" height="60" rx="14" fill={forest} />
      {/* Custom R */}
      <path
        d="M14 46 V18 H28 C35 18 39 22 39 28 C39 33.5 35.5 37 30 37.5 L40 46 H34.5 L25.5 38 H20 V46 Z M20 33 H28 C31.5 33 33.5 31 33.5 28 C33.5 25 31.5 23 28 23 H20 Z"
        fill={chalk}
      />
      {/* Custom S overlapping */}
      <path
        d="M42 22.5 C42 18.5 45.5 16 51 16 C56.5 16 60 18.8 60 22.8 C60 26.2 57.5 28 53 29.2 L48 30.6 C45.2 31.4 43.5 32.6 43.5 35.2 C43.5 38.2 46.2 40 50.5 40 C55 40 58.2 37.5 58.5 33.5"
        stroke={signal}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <text
        x="76"
        y="28"
        fill={ink}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="11"
        letterSpacing="0.22em"
      >
        RECRUITMENT
      </text>
      <text
        x="76"
        y="50"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="26"
        letterSpacing="-0.04em"
      >
        Scout
      </text>
    </svg>
  );
}

/** 05 — Horizon: wordmark bisected by a scan line + rising find */
export function LogoHorizon({ className }: Props) {
  return (
    <svg viewBox="0 0 280 70" className={className} aria-hidden fill="none">
      <text
        x="0"
        y="48"
        fill={ink}
        fontFamily="Big Shoulders Display, Impact, sans-serif"
        fontWeight="700"
        fontSize="48"
        letterSpacing="0.02em"
      >
        SCOUT
      </text>
      <line x1="0" y1="35" x2="200" y2="35" stroke={forest} strokeWidth="1.5" />
      <circle cx="214" cy="35" r="5" fill={forest} />
      <circle cx="214" cy="35" r="10" stroke={forest} strokeWidth="1" opacity="0.35" className="logo-ring" />
      <circle cx="214" cy="35" r="16" stroke={forest} strokeWidth="0.8" opacity="0.18" className="logo-ring" />
      <text
        x="0"
        y="16"
        fill={forest}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="9"
        letterSpacing="0.32em"
      >
        RECRUITMENT
      </text>
    </svg>
  );
}

/** 06 — Blueprint: construction / technical drawing aesthetic */
export function LogoBlueprint({ className }: Props) {
  return (
    <svg viewBox="0 0 270 72" className={className} aria-hidden fill="none">
      <rect x="1" y="1" width="70" height="70" rx="4" fill="#e4eef0" stroke="#7a9aaa" strokeWidth="1" />
      <path d="M8 8 H20 M8 8 V20" stroke="#7a9aaa" strokeWidth="0.8" />
      <path d="M62 8 H50 M62 8 V20" stroke="#7a9aaa" strokeWidth="0.8" />
      <path d="M8 64 H20 M8 64 V52" stroke="#7a9aaa" strokeWidth="0.8" />
      <path d="M62 64 H50 M62 64 V52" stroke="#7a9aaa" strokeWidth="0.8" />
      <circle cx="36" cy="36" r="22" stroke="#5a7a88" strokeWidth="0.9" strokeDasharray="2 3" />
      <circle cx="36" cy="36" r="13" stroke={forest} strokeWidth="1.3" />
      <path d="M36 36 L50 24" stroke={forest} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="50" cy="24" r="2.2" fill={moss} />
      <circle cx="36" cy="36" r="2" fill={ink} />
      <text
        x="86"
        y="32"
        fill={ink}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight="500"
        fontSize="10"
        letterSpacing="0.12em"
      >
        OPPORTUNITY DESK
      </text>
      <text
        x="86"
        y="54"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="28"
        letterSpacing="-0.045em"
      >
        Scout
      </text>
    </svg>
  );
}

/** 07 — Ribbon Crest: folded banner mark */
export function LogoRibbon({ className }: Props) {
  return (
    <svg viewBox="0 0 260 68" className={className} aria-hidden fill="none">
      <path d="M8 14 H52 L46 34 L52 54 H8 L14 34 Z" fill={forest} />
      <path d="M14 20 H44 L40 34 L44 48 H14 L18 34 Z" fill={chalk} fillOpacity="0.12" />
      <circle cx="30" cy="34" r="6" stroke={chalk} strokeWidth="1.6" />
      <circle cx="30" cy="34" r="2" fill={signal} />
      <text
        x="68"
        y="30"
        fill={ink}
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontStyle="italic"
        fontSize="16"
      >
        Recruitment
      </text>
      <text
        x="68"
        y="54"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="28"
        letterSpacing="-0.04em"
      >
        Scout
      </text>
    </svg>
  );
}

/** 08 — Crop Marks: brutalist cut SCOUT with registration marks */
export function LogoCrop({ className }: Props) {
  return (
    <svg viewBox="0 0 250 70" className={className} aria-hidden fill="none">
      <path d="M4 8 H14 M4 8 V18" stroke={ink} strokeWidth="1.2" />
      <path d="M236 8 H226 M236 8 V18" stroke={ink} strokeWidth="1.2" />
      <path d="M4 62 H14 M4 62 V52" stroke={ink} strokeWidth="1.2" />
      <path d="M236 62 H226 M236 62 V52" stroke={ink} strokeWidth="1.2" />
      <rect x="22" y="16" width="196" height="38" fill={ink} />
      <text
        x="120"
        y="43"
        textAnchor="middle"
        fill={chalk}
        fontFamily="Archivo Black, system-ui, sans-serif"
        fontSize="26"
        letterSpacing="0.14em"
      >
        SCOUT
      </text>
      <rect x="198" y="16" width="8" height="8" fill={signal} />
    </svg>
  );
}

/** 09 — Glass Lens: refractive dual-tone lens */
export function LogoLens({ className }: Props) {
  return (
    <svg viewBox="0 0 250 64" className={className} aria-hidden fill="none">
      <defs>
        <radialGradient id="lensGlow" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#d8ebe2" />
          <stop offset="55%" stopColor="#a8c4b4" />
          <stop offset="100%" stopColor={forest} />
        </radialGradient>
        <linearGradient id="lensShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="40%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#lensGlow)" />
      <circle cx="32" cy="32" r="28" fill="url(#lensShine)" />
      <circle cx="32" cy="32" r="18" stroke={chalk} strokeWidth="1.2" opacity="0.45" />
      <circle cx="32" cy="32" r="6" fill={ink} fillOpacity="0.85" />
      <circle cx="24" cy="22" r="4" fill="white" fillOpacity="0.35" />
      <text
        x="74"
        y="28"
        fill={ink}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="10"
        letterSpacing="0.2em"
      >
        RECRUITMENT
      </text>
      <text
        x="74"
        y="50"
        fill={ink}
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="600"
        fontSize="26"
        letterSpacing="-0.02em"
      >
        Scout
      </text>
    </svg>
  );
}

/** 10 — Script Pair: italic recruitment + geometric scout */
export function LogoScriptPair({ className }: Props) {
  return (
    <svg viewBox="0 0 260 72" className={className} aria-hidden fill="none">
      <text
        x="0"
        y="28"
        fill={forest}
        fontFamily="Instrument Serif, Georgia, serif"
        fontStyle="italic"
        fontSize="22"
      >
        Recruitment
      </text>
      <text
        x="0"
        y="60"
        fill={ink}
        fontFamily="Unbounded, system-ui, sans-serif"
        fontWeight="700"
        fontSize="32"
        letterSpacing="-0.04em"
      >
        Scout
      </text>
      <path d="M118 52 Q 160 40 210 54" stroke={moss} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="214" cy="54" r="3" fill={forest} />
    </svg>
  );
}

/** 11 — Totem: vertical letter stack (compact square lockup) */
export function LogoTotem({ className }: Props) {
  return (
    <svg viewBox="0 0 160 72" className={className} aria-hidden fill="none">
      <rect x="0" y="0" width="52" height="72" rx="10" fill={ink} />
      {["S", "C", "O", "U", "T"].map((ch, i) => (
        <text
          key={ch}
          x="26"
          y={16 + i * 12}
          textAnchor="middle"
          fill={i === 0 ? signal : chalk}
          fontFamily="Syne, system-ui, sans-serif"
          fontWeight="800"
          fontSize="11"
          letterSpacing="0.05em"
        >
          {ch}
        </text>
      ))}
      <text
        x="66"
        y="32"
        fill={ink}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="10"
        letterSpacing="0.16em"
      >
        RECRUITMENT
      </text>
      <text
        x="66"
        y="54"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="24"
        letterSpacing="-0.04em"
      >
        Desk
      </text>
    </svg>
  );
}

/** 12 — Orbit Word: Scout with orbital ring through the O */
export function LogoOrbit({ className }: Props) {
  return (
    <svg viewBox="0 0 280 70" className={className} aria-hidden fill="none">
      <text
        x="8"
        y="50"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="42"
        letterSpacing="-0.055em"
      >
        Sc
      </text>
      {/* Custom O as orbit */}
      <ellipse cx="108" cy="38" rx="22" ry="22" stroke={ink} strokeWidth="3.2" fill="none" />
      <ellipse
        cx="108"
        cy="38"
        rx="30"
        ry="12"
        stroke={moss}
        strokeWidth="1.6"
        fill="none"
        transform="rotate(-28 108 38)"
      />
      <circle cx="132" cy="28" r="3.2" fill={signal} />
      <text
        x="138"
        y="50"
        fill={ink}
        fontFamily="Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="42"
        letterSpacing="-0.055em"
      >
        ut
      </text>
      <text
        x="8"
        y="14"
        fill={forest}
        fontFamily="Sora, system-ui, sans-serif"
        fontWeight="600"
        fontSize="9"
        letterSpacing="0.3em"
      >
        RECRUITMENT
      </text>
    </svg>
  );
}

export type LogoConcept = {
  letter: string;
  id: string;
  name: string;
  vibe: string;
  Logo: (p: Props) => ReactNode;
};

export const LOGO_CONCEPTS: LogoConcept[] = [
  {
    letter: "A",
    id: "arc-cut",
    name: "Arc Cut",
    vibe: "Radar + custom Scout wordmark — de upgrade van wat je nu hebt",
    Logo: LogoArcCut,
  },
  {
    letter: "B",
    id: "masthead",
    name: "Masthead",
    vibe: "Editorial journal — premium bureau, geen SaaS-icoon",
    Logo: LogoMasthead,
  },
  {
    letter: "C",
    id: "night",
    name: "Night Capsule",
    vibe: "Ops / live desk — donkere capsule met signaal",
    Logo: LogoNightCapsule,
  },
  {
    letter: "D",
    id: "interlock",
    name: "Interlock RS",
    vibe: "Custom monogram — lettermerk zoals een agency seal",
    Logo: LogoInterlock,
  },
  {
    letter: "E",
    id: "horizon",
    name: "Horizon",
    vibe: "Scanline door SCOUT — bold, poster-achtig",
    Logo: LogoHorizon,
  },
  {
    letter: "F",
    id: "blueprint",
    name: "Blueprint",
    vibe: "Technische tekening — craft & precisie",
    Logo: LogoBlueprint,
  },
  {
    letter: "G",
    id: "ribbon",
    name: "Ribbon Crest",
    vibe: "Banner-zegel — traditioneel recruiting, modern gedaan",
    Logo: LogoRibbon,
  },
  {
    letter: "H",
    id: "crop",
    name: "Crop Marks",
    vibe: "Brutalist print-cut — hard, memorabel",
    Logo: LogoCrop,
  },
  {
    letter: "I",
    id: "lens",
    name: "Glass Lens",
    vibe: "Refractieve lens — soft luxury, depth",
    Logo: LogoLens,
  },
  {
    letter: "J",
    id: "script",
    name: "Script Pair",
    vibe: "Italic + geometric — contrast als merkhandtekening",
    Logo: LogoScriptPair,
  },
  {
    letter: "K",
    id: "totem",
    name: "Totem",
    vibe: "Verticale lettertoren — uniek silhouet in de nav",
    Logo: LogoTotem,
  },
  {
    letter: "L",
    id: "orbit",
    name: "Orbit O",
    vibe: "De O van Scout is een baan met blip — wordmark als mark",
    Logo: LogoOrbit,
  },
];
