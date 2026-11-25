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

/** Compacte demo-balk + welkomstkaart + tracking + tour + zachte CTA. */
export function DemoProspectChrome({
  prospect,
  banner,
}: {
  prospect: DemoProspectInfo | null;
  banner: string;
}) {
  const [showCta, setShowCta] = useState(false);
  const [ctaClosed, setCtaClosed] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
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
  const calendarUrl = prospect?.calendarUrl || "mailto:kevin@blablabuild.com";

  // Zachte CTA niet tegelijk met de rondleiding tonen — anders stapelen twee kaarten.
  useEffect(() => {
    function onTour(e: Event) {
      setTourOpen(Boolean((e as CustomEvent<boolean>).detail));
    }
    window.addEventListener("demo:tour-state", onTour);
    return () => window.removeEventListener("demo:tour-state", onTour);
  }, []);

  return (
    <div className="demo-chrome shrink-0">
      {prospect ? (
        <div
          className="demo-welcome flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] px-4 py-2 md:px-6"
          style={{
            borderLeft: `4px solid ${accent}`,
            background: `color-mix(in srgb, ${accent} 7%, var(--surface))`,
          }}
        >
          {!logoBroken && prospect.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prospect.logoUrl}
              alt=""
              className="h-7 w-auto max-w-[7rem] rounded-md bg-[#111] object-contain px-1.5 py-0.5"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <span
              className="inline-flex h-7 max-w-[8rem] items-center truncate rounded-md px-2 text-[0.7rem] font-bold"
              style={{ background: accent, color: inkOnBrand(accent) }}
              title={prospect.agencyName}
            >
              {prospect.agencyName}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] font-semibold leading-snug text-[var(--ink)]">
              Demo voor {prospect.agencyName}
            </p>
            <p className="truncate text-[0.72rem] leading-snug text-[var(--muted)]">
              Voorbeelddata
              <span className="hidden lg:inline">{prospect.niche ? ` (${prospect.niche})` : ""}</span>
              {" · "}alles is klikbaar, er gaat niets naar buiten
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-1.5 md:flex md:w-auto md:shrink-0">
            <button type="button" className="btn-tool justify-center text-[0.72rem]" onClick={() => reopenDemoEntry()}>
              Wat is dit?
            </button>
            <button type="button" className="btn-tool justify-center text-[0.72rem]" onClick={() => startDemoTour()}>
              Rondleiding
            </button>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink btn-tool justify-center no-underline text-[0.72rem]"
            >
              Plan 15 min
            </a>
          </div>
        </div>
      ) : (
        <p className="demo-banner border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-center text-[0.72rem] leading-snug text-[var(--muted)] md:px-6">
          {banner}
        </p>
      )}

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
        <DemoTour
          slug={prospect.slug}
          agencyName={prospect.agencyName}
          accent={accent}
          calendarUrl={calendarUrl}
        />
      ) : null}

      {showCta && !tourOpen && !ctaClosed ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[3.5rem] z-30 flex justify-center px-3 md:inset-x-auto md:bottom-5 md:right-5"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-[var(--radius)] border bg-[var(--surface)] py-2 pl-3 pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            style={{ borderColor: accent }}
          >
            <p className="text-[0.75rem] leading-snug text-[var(--ink)]">
              Past dit bij jullie?<span className="hidden sm:inline"> Plan 15 minuten met Kevin.</span>
            </p>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink btn-tool shrink-0 no-underline text-[0.75rem]"
            >
              Plan in
            </a>
            <button
              type="button"
              className="shrink-0 rounded px-1.5 text-[0.9rem] leading-none text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => setCtaClosed(true)}
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
