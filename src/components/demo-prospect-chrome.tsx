"use client";

import { useEffect, useRef, useState } from "react";

export type DemoProspectInfo = {
  slug: string;
  agencyName: string;
  contactFirstName: string;
  website: string;
  logoUrl: string | null;
  brandColor: string | null;
  niche: string;
  city: string;
  welcome: string;
  calendarUrl: string;
};

/** Welkomstblok + tracking + zachte CTA na 2 minuten. */
export function DemoProspectChrome({
  prospect,
  banner,
}: {
  prospect: DemoProspectInfo | null;
  banner: string;
}) {
  const [showCta, setShowCta] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const started = useRef(Date.now());
  const sent = useRef(0);

  useEffect(() => {
    if (!prospect?.brandColor) return;
    document.documentElement.style.setProperty("--demo-accent", prospect.brandColor);
    return () => {
      document.documentElement.style.removeProperty("--demo-accent");
    };
  }, [prospect]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowCta(true), 120_000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!prospect) return;

    function pulse() {
      const elapsed = Math.floor((Date.now() - started.current) / 1000);
      const delta = elapsed - sent.current;
      if (delta < 15) return;
      const chunk = Math.min(60, delta);
      sent.current += chunk;
      void fetch("/api/demo/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: chunk }),
        keepalive: true,
      }).catch(() => null);
    }

    const id = window.setInterval(pulse, 30_000);
    function onHide() {
      if (document.visibilityState === "hidden") pulse();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", pulse);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", pulse);
      pulse();
    };
  }, [prospect]);

  useEffect(() => {
    if (!prospect) return;
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-demo-kans]");
      const id = el?.getAttribute("data-demo-kans");
      if (!id) return;
      void fetch("/api/demo/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kansId: id }),
      }).catch(() => null);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [prospect]);

  const accent = prospect?.brandColor || "#2340f0";

  return (
    <div className="demo-chrome shrink-0">
      <p
        className="demo-banner border-b border-[var(--line)] px-4 py-2 text-center text-[0.72rem] leading-snug text-[var(--muted)] md:px-6"
        style={{
          background: prospect
            ? `color-mix(in srgb, ${accent} 10%, var(--surface-2))`
            : "var(--surface-2)",
        }}
      >
        {banner}
      </p>

      {prospect ? (
        <div
          className="demo-welcome flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3 md:px-6"
          style={{ borderLeft: `3px solid ${accent}` }}
        >
          <div className="demo-welcome__brand flex min-w-0 items-center gap-2">
            {!logoBroken && prospect.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prospect.logoUrl}
                alt=""
                className="h-7 w-auto max-w-[7.5rem] rounded-md bg-[#111] object-contain px-1.5 py-0.5"
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <span
                className="inline-flex h-7 max-w-[8rem] items-center truncate rounded-md px-2 text-[0.68rem] font-bold text-white"
                style={{ background: accent }}
                title={prospect.agencyName}
              >
                {prospect.agencyName}
              </span>
            )}
            <span className="text-[0.78rem] font-semibold text-[var(--ink)]">
              Demo voor {prospect.agencyName}
            </span>
          </div>
          <p className="min-w-0 flex-1 text-[0.8rem] leading-snug text-[var(--muted)]">{prospect.welcome}</p>
        </div>
      ) : null}

      {showCta ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[3.5rem] z-30 flex justify-center px-3 md:bottom-4"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto flex max-w-lg flex-wrap items-center gap-2 rounded-[var(--radius)] border bg-[var(--surface)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            style={{ borderColor: accent }}
          >
            <p className="text-[0.75rem] text-[var(--ink)]">
              Past dit bij hoe jij werkt? Plan 15 minuten met Kevin.
            </p>
            <a
              href={prospect?.calendarUrl || "mailto:kevin@blablabuild.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink btn-tool no-underline text-[0.75rem]"
            >
              Plan in
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
