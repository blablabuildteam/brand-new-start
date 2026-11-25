"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Step = {
  id: string;
  title: string;
  text: string;
  href?: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    id: "feed",
    title: "1 · Recruiter feed",
    text: "Hier leest Scout mee op posts van andere bureaus: “een klant van mij zoekt…”. Geen naam, wel een opdracht.",
    href: "/leads",
    cta: "Bekijk de feed",
  },
  {
    id: "kansen",
    title: "2 · Kansen",
    text: "Zodra de eindklant bekend is, staat de kans hier: bewijs, hiring manager en de volgende stap.",
    href: "/kansen",
    cta: "Naar Kansen",
  },
  {
    id: "detail",
    title: "3 · Open een rij",
    text: "Klik een kans open. Je ziet het bewijs online en rechts de logische volgende actie (manager, mail/tel, bericht).",
    href: "/kansen",
    cta: "Begrepen",
  },
  {
    id: "bericht",
    title: "4 · Bericht",
    text: "Als mail/tel er is, staat hier een concept aan de hiring manager. Jij past aan en verstuurt zelf.",
    href: "/regie",
    cta: "Naar Bericht",
  },
  {
    id: "done",
    title: "Klaar om te klikken",
    text: "Jobboards toont in deze demo weinig — de feed + Kansen zijn het verhaal. Past het? Mail Kevin voor 15 minuten.",
    cta: "Tour sluiten",
  },
];

function storageKey(slug: string) {
  return `scout-demo-tour:v2:${slug}`;
}

export function DemoTour({
  slug,
  agencyName,
  accent,
}: {
  slug: string;
  agencyName: string;
  accent: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(storageKey(slug));
      setOpen(!done);
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, [slug]);

  useEffect(() => {
    function onStart() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener("demo:tour", onStart);
    return () => window.removeEventListener("demo:tour", onStart);
  }, []);

  if (!ready || !open) return null;

  const cur = STEPS[step]!;
  const last = step >= STEPS.length - 1;

  function finish() {
    try {
      window.localStorage.setItem(storageKey(slug), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function next() {
    if (cur.href && pathname !== cur.href) router.push(cur.href);
    if (last) {
      finish();
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[3.75rem] z-40 flex justify-center px-3 md:bottom-5"
      role="dialog"
      aria-label="Demo-rondleiding"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-[var(--radius)] border bg-[var(--surface)] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        style={{ borderColor: accent }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Rondleiding · {agencyName}
            </p>
            <h2 className="mt-0.5 text-[0.95rem] font-semibold text-[var(--ink)]">{cur.title}</h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded px-1.5 text-[0.75rem] text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={finish}
            aria-label="Tour sluiten"
          >
            Overslaan
          </button>
        </div>
        <p className="text-[0.82rem] leading-snug text-[var(--muted)]">{cur.text}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i === step ? accent : "var(--line)" }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" className="btn-tool text-[0.75rem]" onClick={() => setStep((s) => s - 1)}>
                Terug
              </button>
            ) : null}
            <button type="button" className="btn-ink btn-tool text-[0.75rem]" onClick={next}>
              {cur.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function startDemoTour() {
  window.dispatchEvent(new Event("demo:tour"));
}
