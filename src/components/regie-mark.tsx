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
      <rect width="32" height="32" rx="8" fill={onDark ? "#2c2c2c" : "#1a1a1a"} />
      <circle cx="16" cy="16" r="7.5" stroke="#f7f5f2" strokeWidth="1.5" opacity="0.55" />
      <circle cx="16" cy="16" r="3.2" stroke="#ebf212" strokeWidth="1.5" />
      <path d="M16 16 L26 8" stroke="#ebf212" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.35" fill="#ebf212" />
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
        className={`text-[1.2rem] font-normal tracking-tight ${dark ? "text-white" : "text-[var(--ink)]"}`}
        style={{ fontFamily: "var(--display)" }}
      >
        {name}
      </span>
    </span>
  );
}
