export function RegieMark({
  className = "h-7 w-7",
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill={onDark ? "#2a2620" : "#1b1914"} />
      <circle cx="16" cy="16" r="7.5" stroke="#e8e0c8" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="3.2" stroke="#ceff00" strokeWidth="1.4" />
      <path d="M16 16 L26 8" stroke="#ceff00" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.35" fill="#ceff00" />
    </svg>
  );
}

export function RegieWordmark({
  name = "Regie",
  dark = false,
}: {
  name?: string;
  dark?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <RegieMark onDark={dark} />
      <span
        className={`text-[1.15rem] font-bold tracking-tight ${dark ? "text-[#f3eee4]" : "text-[var(--ink)]"}`}
        style={{ fontFamily: "var(--display)" }}
      >
        {name}
      </span>
    </span>
  );
}
