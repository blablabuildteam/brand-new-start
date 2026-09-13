/** Recruitment Scout mark — scope locking onto a signal. */

export function ScoutMark({
  className = "h-8 w-8",
  variant = "solid",
}: {
  className?: string;
  /** solid = ink tile for nav; ghost = outline for light fields */
  variant?: "solid" | "ghost" | "mark";
}) {
  const ink = variant === "ghost" ? "transparent" : variant === "mark" ? "#1a5c45" : "#141816";
  const ring = variant === "solid" ? "#f2eee6" : "#141816";
  const accent = variant === "solid" ? "#5fd4a0" : "#1a5c45";
  const stroke = variant === "ghost" ? "#141816" : "none";

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
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
      {/* Outer scope arc */}
      <path
        d="M28.8 11.2A11.2 11.2 0 1 0 20 31.2"
        stroke={ring}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={variant === "solid" ? 0.35 : 0.28}
      />
      {/* Mid arc */}
      <path
        d="M26.2 13.8A7.5 7.5 0 1 0 20 27.5"
        stroke={ring}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={variant === "solid" ? 0.55 : 0.45}
      />
      {/* Lock needle */}
      <path
        d="M20 20 L29.2 10.8"
        stroke={accent}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Bearing tick */}
      <circle cx="30.2" cy="9.8" r="2.15" fill={accent} />
      {/* Core */}
      <circle cx="20" cy="20" r="2.4" fill={accent} />
      <circle
        cx="20"
        cy="20"
        r="5.2"
        stroke={accent}
        strokeWidth="1.35"
        opacity={0.45}
      />
    </svg>
  );
}

export function ScoutWordmark({
  name = "Recruitment Scout",
  compact = false,
}: {
  name?: string;
  /** Show mark + short label on tight nav */
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
            <span className="scout-wm__name scout-wm__name--full">{name}</span>
            <span className="scout-wm__name scout-wm__name--short">{short}</span>
          </>
        )}
      </span>
    </span>
  );
}
