"use client";

/** Recruitment Scout mark — live radar lock. */

export function ScoutMark({
  className = "h-8 w-8",
  variant = "solid",
  animated = true,
}: {
  className?: string;
  /** solid = ink tile for nav; ghost = outline; mark = green fill */
  variant?: "solid" | "ghost" | "mark";
  animated?: boolean;
}) {
  const ink = variant === "ghost" ? "transparent" : variant === "mark" ? "#1a5c45" : "#141816";
  const ring = variant === "solid" ? "#f2eee6" : "#141816";
  const accent = variant === "solid" ? "#5fd4a0" : "#1a5c45";
  const stroke = variant === "ghost" ? "#141816" : "none";

  return (
    <svg
      viewBox="0 0 40 40"
      className={`scout-mark ${animated ? "scout-mark--live" : ""} ${className}`}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="11"
        fill={ink}
        stroke={stroke}
        strokeWidth={variant === "ghost" ? 1.5 : 0}
      />

      <circle
        cx="20"
        cy="20"
        r="11.2"
        stroke={ring}
        strokeWidth="1.15"
        opacity={variant === "solid" ? 0.22 : 0.2}
      />
      <circle
        cx="20"
        cy="20"
        r="7.4"
        stroke={ring}
        strokeWidth="1.15"
        opacity={variant === "solid" ? 0.38 : 0.32}
      />

      {/* Sweep wedge */}
      <g className="scout-mark__spin" style={{ transformOrigin: "20px 20px" }}>
        <path
          d="M20 20 L20 9 A11 11 0 0 1 29.5 15.2 Z"
          fill={accent}
          opacity={variant === "solid" ? 0.28 : 0.2}
        />
        <path
          d="M20 20 L29.5 15.2"
          stroke={accent}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="30.2" cy="14.6" r="1.85" fill={accent} className="scout-mark__blip" />
      </g>

      <circle cx="20" cy="20" r="2.15" fill={accent} />
      <circle cx="20" cy="20" r="4.6" stroke={accent} strokeWidth="1.2" opacity={0.4} />
    </svg>
  );
}

export function ScoutWordmark({
  name = "Recruitment Scout",
  compact = false,
}: {
  name?: string;
  compact?: boolean;
}) {
  const short = name.includes(" ") ? name.split(" ").pop()! : name;

  return (
    <span className="scout-wm">
      <ScoutMark className="scout-wm__mark" />
      <span className="scout-wm__text">
        {compact ? (
          <span className="scout-wm__name">{short}</span>
        ) : (
          <>
            <span className="scout-wm__lead">Recruitment</span>
            <span className="scout-wm__name scout-wm__name--full">Scout</span>
            <span className="scout-wm__name scout-wm__name--short">{short}</span>
          </>
        )}
      </span>
    </span>
  );
}
