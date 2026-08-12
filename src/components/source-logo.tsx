import Image from "next/image";

const SOURCE_LOGOS: Record<string, { src: string; alt: string; className?: string }> = {
  "linkedin-jobs": {
    src: "/assets/sources/linkedin.png",
    alt: "LinkedIn",
    className: "h-4 w-4 rounded-[3px] object-cover",
  },
  indeed: {
    src: "/assets/sources/indeed.png",
    alt: "Indeed",
    className: "h-3.5 w-auto max-w-[3.6rem] object-contain object-left",
  },
  "freelance-nl": {
    src: "/assets/sources/freelance-nl.png",
    alt: "Freelance.nl",
    className: "h-3.5 w-auto max-w-[5.5rem] object-contain object-left",
  },
};

export function sourceChannelsFromRow(signals: { channel?: string | null; channelLabel?: string | null }[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of signals) {
    const ch = s.channel || "";
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

export function SourceLogo({
  channel,
  size = "sm",
}: {
  channel: string;
  size?: "sm" | "md";
}) {
  const logo = SOURCE_LOGOS[channel];
  if (!logo) return null;
  const box = size === "md" ? "h-5" : "h-4";
  const wide = channel === "freelance-nl" || channel === "indeed";
  return (
    <span
      className={`inline-flex items-center justify-center ${box}`}
      title={logo.alt}
      aria-label={logo.alt}
    >
      <Image
        src={logo.src}
        alt={logo.alt}
        width={size === "md" ? (wide ? 110 : 72) : wide ? 88 : 56}
        height={size === "md" ? 20 : 16}
        className={logo.className}
      />
    </span>
  );
}

export function SourceLogos({
  channels,
  size = "sm",
}: {
  channels: string[];
  size?: "sm" | "md";
}) {
  const withLogo = channels.filter((c) => SOURCE_LOGOS[c]);
  if (!withLogo.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {withLogo.map((ch) => (
        <SourceLogo key={ch} channel={ch} size={size} />
      ))}
    </span>
  );
}
