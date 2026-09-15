"use client";

/** Recruitment Scout mark — lime spark lockup (Apollo-inspired, own geometry). */

export type ScoutMarkTone = "light" | "sage" | "outline" | "ink";

export type ScoutWordFont =
  | "outfit"
  | "syne"
  | "sora"
  | "bricolage"
  | "fraunces"
  | "instrument"
  | "manrope"
  | "dm";

export type ScoutLockup =
  | "flat"
  | "stack"
  | "scout"
  | "pair"
  | "slash";

const TONES: Record<
  ScoutMarkTone,
  { bg: string; fg: string; stroke?: string }
> = {
  light: { bg: "#f9ff2c", fg: "#0a0a0a" },
  sage: { bg: "#fcff66", fg: "#0a0a0a" },
  outline: { bg: "transparent", fg: "#0a0a0a", stroke: "#0a0a0a" },
  ink: { bg: "#0a0a0a", fg: "#f9ff2c" },
};

const FONTS: Record<ScoutWordFont, string> = {
  outfit: '"Outfit", system-ui, sans-serif',
  syne: '"Syne", system-ui, sans-serif',
  sora: '"Sora", system-ui, sans-serif',
  bricolage: '"Bricolage Grotesque", system-ui, sans-serif',
  fraunces: '"Fraunces", Georgia, serif',
  instrument: '"Instrument Serif", Georgia, serif',
  manrope: '"Manrope", system-ui, sans-serif',
  dm: '"DM Sans", system-ui, sans-serif',
};

/** Eight-point spark inside a rounded tile. */
export function ScoutMark({
  className = "h-8 w-8",
  animated = true,
  tone = "light",
}: {
  className?: string;
  animated?: boolean;
  tone?: ScoutMarkTone;
}) {
  const t = TONES[tone];

  return (
    <svg
      viewBox="0 0 32 32"
      className={`scout-mark ${animated ? "scout-mark--live" : ""} ${className}`}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="9"
        fill={t.bg}
        stroke={t.stroke || "none"}
        strokeWidth={t.stroke ? 1.5 : 0}
      />
      <g transform="translate(16 16)">
        <g className="scout-mark__spin">
          {/* Cardinal rays */}
          <path d="M0 -9.2 L1.15 -2.4 L0 0 L-1.15 -2.4 Z" fill={t.fg} />
          <path d="M0 9.2 L1.15 2.4 L0 0 L-1.15 2.4 Z" fill={t.fg} />
          <path d="M9.2 0 L2.4 1.15 L0 0 L2.4 -1.15 Z" fill={t.fg} />
          <path d="M-9.2 0 L-2.4 1.15 L0 0 L-2.4 -1.15 Z" fill={t.fg} />
          {/* Diagonal rays (shorter) */}
          <path d="M6.5 -6.5 L2.1 -1.55 L0 0 L1.55 -2.1 Z" fill={t.fg} opacity="0.85" />
          <path d="M6.5 6.5 L2.1 1.55 L0 0 L1.55 2.1 Z" fill={t.fg} opacity="0.85" />
          <path d="M-6.5 6.5 L-2.1 1.55 L0 0 L-1.55 2.1 Z" fill={t.fg} opacity="0.85" />
          <path d="M-6.5 -6.5 L-2.1 -1.55 L0 0 L-1.55 -2.1 Z" fill={t.fg} opacity="0.85" />
          <circle cx="0" cy="0" r="1.35" fill={t.fg} className="scout-mark__blip" />
        </g>
      </g>
    </svg>
  );
}

export function ScoutWordmark({
  tone = "light",
  font = "dm",
  lockup = "scout",
}: {
  name?: string;
  tone?: ScoutMarkTone;
  font?: ScoutWordFont;
  lockup?: ScoutLockup;
}) {
  const face = { fontFamily: FONTS[font] };

  return (
    <span className={`scout-wm scout-wm--${lockup}`}>
      <ScoutMark className="scout-wm__mark" tone={tone} />
      {lockup === "flat" ? (
        <span className="scout-wm__flat" style={face}>
          Recruitment Scout
        </span>
      ) : null}
      {lockup === "stack" ? (
        <span className="scout-wm__stack" style={face}>
          <span className="scout-wm__kicker">Recruitment</span>
          <span className="scout-wm__hero">Scout</span>
        </span>
      ) : null}
      {lockup === "scout" ? (
        <span className="scout-wm__solo" style={face}>
          Scout
        </span>
      ) : null}
      {lockup === "pair" ? (
        <span className="scout-wm__pair" style={face}>
          <span>Recruitment</span>
          <span>Scout</span>
        </span>
      ) : null}
      {lockup === "slash" ? (
        <span className="scout-wm__slash" style={face}>
          Recruitment <span className="scout-wm__sep">/</span> Scout
        </span>
      ) : null}
    </span>
  );
}

export const SCOUT_WORD_FONTS = FONTS;
