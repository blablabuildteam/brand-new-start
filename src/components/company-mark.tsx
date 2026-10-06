"use client";

import { useState } from "react";

/** Company mark: real logo when available, initials fallback on error/empty. */
export function CompanyMark({
  name,
  logoUrl,
  logoUrls,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  logoUrls?: string[] | null;
  size?: "sm" | "md" | "lg";
}) {
  const [index, setIndex] = useState(0);
  const letter = (name.trim().slice(0, 1) || "?").toUpperCase();
  const dim =
    size === "lg" ? "h-10 w-10 text-[0.8rem]" : size === "sm" ? "h-7 w-7 text-[0.62rem]" : "h-8 w-8 text-[0.7rem]";
  const urls = [...(logoUrl ? [logoUrl] : []), ...(logoUrls || [])].filter(Boolean);
  const src = urls[index];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${dim} shrink-0 rounded object-contain bg-white border border-[var(--line)]`}
        onError={() => setIndex((i) => i + 1)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-[var(--muted)]`}
      aria-hidden
    >
      {letter}
    </span>
  );
}
