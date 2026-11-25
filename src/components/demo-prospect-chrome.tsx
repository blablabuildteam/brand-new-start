"use client";

import { useEffect, useRef, useState } from "react";
import { inkOnBrand } from "@/lib/demo-prospects";
import { DemoTour, startDemoTour } from "@/components/demo-tour";
import { DemoEntryModal, reopenDemoEntry } from "@/components/demo-entry";

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

/** Welkomstkaart + balk + tracking + tour + zachte CTA. */
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
          className="demo-welcome border-b border-[var(--line)] px-4 py-3.5 md:px-6"
          style={{
            borderLeft: `4px solid ${accent}`,
            background: `color-mix(in srgb, ${accent} 6%, var(--surface))`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {!logoBroken && prospect.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prospect.logoUrl}
                    alt=""
                    className="h-9 w-auto max-w-[8.5rem] rounded-md bg-[#111] object-contain px-1.5 py-0.5"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  <span
                    className="inline-flex h-9 max-w-[9rem] items-center truncate rounded-md px-2.5 text-[0.72rem] font-bold"
                    style={{ background: accent, color: inkOnBrand(accent) }}
                    title={prospect.agencyName}
                  >
                    {prospect.agencyName}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[0.92rem] font-semibold text-[var(--ink)]">
                    Demo voor {prospect.agencyName}
                  </p>
                  <p className="text-[0.75rem] text-[var(--muted)]">
                    {[prospect.niche, prospect.city].filter(Boolean).join(" · ") || "Voorbeelddata"}
                    {" · "}
                    niets gaat naar buiten
                  </p>
                </div>
              </div>
              <p className="mt-2 max-w-2xl text-[0.88rem] leading-snug text-[var(--ink)]/80">
                {prospect.welcome}
              </p>
              <p className="mt-1.5 text-[0.78rem] text-[var(--muted)]">
                Pad: Recruiter feed → Kansen (eindklant + bewijs) → Bericht
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="btn-tool text-[0.75rem]"
                onClick={() => reopenDemoEntry()}
              >
                Wat is dit?
              </button>
              <button
                type="button"
                className="btn-ink btn-tool text-[0.75rem]"
                onClick={() => startDemoTour()}
              >
                Start rondleiding
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {prospect ? (
        <DemoEntryModal
          slug={prospect.slug}
          agencyName={prospect.agencyName}
          contactFirstName={prospect.contactFirstName}
          niche={prospect.niche}
          city={prospect.city}
          logoUrl={prospect.logoUrl}
          brandColor={prospect.brandColor}
          accent={accent}
        />
      ) : null}

      {prospect ? (
        <DemoTour slug={prospect.slug} agencyName={prospect.agencyName} accent={accent} />
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
