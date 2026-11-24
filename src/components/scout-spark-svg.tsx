/** Scout-mark voor favicon en app-icoon (ImageResponse kan geen client-componenten of CSS-klassen aan). */
export function ScoutSparkSvg({ size, square = false }: { size: number; square?: boolean }) {
  const bg = "#2340f0";
  const fg = "#ffffff";
  const dot = "#ff5a24";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {square ? <rect width="32" height="32" fill={bg} /> : <rect x="0" y="0" width="32" height="32" rx="8" fill={bg} />}
      <path d="M16 6.8 L17.15 13.6 L16 16 L14.85 13.6 Z" fill={fg} />
      <path d="M16 25.2 L17.15 18.4 L16 16 L14.85 18.4 Z" fill={fg} />
      <path d="M25.2 16 L18.4 17.15 L16 16 L18.4 14.85 Z" fill={fg} />
      <path d="M6.8 16 L13.6 17.15 L16 16 L13.6 14.85 Z" fill={fg} />
      <path d="M22.5 9.5 L18.1 14.45 L16 16 L17.55 13.9 Z" fill={fg} opacity="0.85" />
      <path d="M22.5 22.5 L18.1 17.55 L16 16 L17.55 18.1 Z" fill={fg} opacity="0.85" />
      <path d="M9.5 22.5 L13.9 17.55 L16 16 L14.45 18.1 Z" fill={fg} opacity="0.85" />
      <path d="M9.5 9.5 L13.9 14.45 L16 16 L14.45 13.9 Z" fill={fg} opacity="0.85" />
      <circle cx="16" cy="16" r="2" fill={dot} stroke={bg} strokeWidth="0.8" />
    </svg>
  );
}
