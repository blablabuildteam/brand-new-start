"use client";

/** Recruitment Scout mark — clean live radar. */

export function ScoutMark({
  className = "h-8 w-8",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`scout-mark ${animated ? "scout-mark--live" : ""} ${className}`}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="#0f1412" />
      <circle cx="16" cy="16" r="9.25" stroke="#3d4a44" strokeWidth="1" />
      <circle cx="16" cy="16" r="5.75" stroke="#5a6b63" strokeWidth="1" />

      <g className="scout-mark__spin">
        <path d="M16 16 L16 7 A9 9 0 0 1 23.9 12.1 Z" fill="#3dcf8e" fillOpacity="0.22" />
        <path d="M16 16 L23.9 12.1" stroke="#3dcf8e" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="24.35" cy="11.85" r="1.55" fill="#3dcf8e" className="scout-mark__blip" />
      </g>

      <circle cx="16" cy="16" r="1.85" fill="#3dcf8e" />
    </svg>
  );
}

export function ScoutWordmark({
  name = "Recruitment Scout",
}: {
  name?: string;
}) {
  return (
    <span className="scout-wm">
      <ScoutMark className="scout-wm__mark" />
      <span className="scout-wm__name">{name}</span>
    </span>
  );
}
