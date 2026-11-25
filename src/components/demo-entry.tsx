"use client";

import { useEffect, useState } from "react";
import { inkOnBrand } from "@/lib/demo-prospects";
import { startDemoTour } from "@/components/demo-tour";

function entryKey(slug: string) {
  return `scout-demo-entry:v1:${slug}`;
}

/** Eerste scherm bij binnenkomst — groter en duidelijker dan de tour-kaart. */
export function DemoEntryModal({
  slug,
  agencyName,
  contactFirstName,
  niche,
  city,
  logoUrl,
  brandColor,
  accent,
}: {
  slug: string;
  agencyName: string;
  contactFirstName: string;
  niche: string;
  city: string;
  logoUrl: string | null;
  brandColor: string | null;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    try {
      setOpen(!window.localStorage.getItem(entryKey(slug)));
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, [slug]);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("demo:entry", onOpen);
    return () => window.removeEventListener("demo:entry", onOpen);
  }, []);

  if (!ready || !open) return null;

  const first = contactFirstName.trim().split(" en ")[0]?.trim() || "";
  const focus = [niche, city].filter(Boolean).join(" · ");

  function dismiss(startTour: boolean) {
    try {
      window.localStorage.setItem(entryKey(slug), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    if (startTour) {
      window.setTimeout(() => startDemoTour(), 80);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Welkom in de demo"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
        style={{ borderColor: accent }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: `color-mix(in srgb, ${accent} 12%, var(--surface))` }}
        >
          {!logoBroken && logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-auto max-w-[7.5rem] rounded-md bg-[#111] object-contain px-1.5 py-0.5"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <span
              className="inline-flex h-10 max-w-[8rem] items-center truncate rounded-md px-2.5 text-[0.75rem] font-bold"
              style={{ background: brandColor || accent, color: inkOnBrand(brandColor || accent) }}
            >
              {agencyName}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Jouw demo-werkplek
            </p>
            <p className="truncate text-[1rem] font-semibold text-[var(--ink)]">{agencyName}</p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <h2 className="text-[1.25rem] font-semibold leading-snug text-[var(--ink)]">
              {first ? `Hoi ${first}, ` : ""}dit is Scout — in 4 klikken duidelijk.
            </h2>
            <p className="mt-1.5 text-[0.9rem] leading-snug text-[var(--muted)]">
              Voorbeelddata voor {agencyName}
              {focus ? ` · ${focus}` : ""}. Er gaat niets naar buiten; sync en kosten staan uit.
            </p>
          </div>

          <ol className="space-y-2.5 text-[0.88rem] text-[var(--ink)]">
            <li className="flex gap-2.5">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
                style={{ background: accent }}
              >
                1
              </span>
              <span>
                <strong>Recruiter feed</strong> — vage posts van andere bureaus (“een klant van mij zoekt…”).
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
                style={{ background: accent }}
              >
                2
              </span>
              <span>
                <strong>Kansen</strong> — Scout noemt de eindklant, met bewijs en de volgende stap.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
                style={{ background: accent }}
              >
                3
              </span>
              <span>
                <strong>Bericht</strong> — concept aan de hiring manager, jij verstuurt zelf.
              </span>
            </li>
          </ol>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-tool" onClick={() => dismiss(false)}>
              Zelf rondkijken
            </button>
            <button type="button" className="btn-ink btn-tool" onClick={() => dismiss(true)}>
              Start de rondleiding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function reopenDemoEntry() {
  window.dispatchEvent(new Event("demo:entry"));
}
