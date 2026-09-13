"use client";

/** Recruitment Scout mark + wordmark lockups. */

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

/** How the text sits next to the mark */
export type ScoutLockup =
  | "flat" /* one line: Recruitment Scout */
  | "stack" /* RECRUITMENT over Scout */
  | "scout" /* mark + Scout only */
  | "pair" /* Recruitment / Scout same size stacked */
  | "slash"; /* Recruitment / Scout with slash */

const TONES: Record<
  ScoutMarkTone,
  { bg: string; ring: string; accent: string; stroke?: string }
> = {
  light: { bg: "#f4efe6", ring: "#1a5c45", accent: "#1a5c45", stroke: "#d4cdc0" },
  sage: { bg: "#d8ebe2", ring: "#0f1412", accent: "#0f3d2e" },
  outline: { bg: "transparent", ring: "#1a5c45", accent: "#1a5c45", stroke: "#1a5c45" },
  ink: { bg: "#0f1412", ring: "#5a6b63", accent: "#3dcf8e" },
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
        rx="8.5"
        fill={t.bg}
        stroke={t.stroke || "none"}
        strokeWidth={t.stroke ? 1.25 : 0}
      />
      <circle cx="16" cy="16" r="9" stroke={t.ring} strokeWidth="1.1" opacity="0.35" />
      <circle cx="16" cy="16" r="5.5" stroke={t.ring} strokeWidth="1.1" opacity="0.55" />

      <g className="scout-mark__spin">
        <path d="M16 16 L16 7.2 A8.8 8.8 0 0 1 23.6 12 Z" fill={t.accent} fillOpacity="0.18" />
        <path d="M16 16 L23.6 12" stroke={t.accent} strokeWidth="1.55" strokeLinecap="round" />
        <circle cx="24.1" cy="11.7" r="1.45" fill={t.accent} className="scout-mark__blip" />
      </g>

      <circle cx="16" cy="16" r="1.7" fill={t.accent} />
    </svg>
  );
}

export function ScoutWordmark({
  tone = "light",
  font = "sora",
  lockup = "stack",
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
