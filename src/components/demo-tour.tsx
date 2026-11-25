"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Step = {
  id: string;
  title: string;
  text: string;
  /** Wat de bezoeker nu zelf kan proberen. */
  tryIt?: string;
  href?: string;
};

const STEPS: Step[] = [
  {
    id: "feed",
    title: "Recruiter feed",
    text: "Andere bureaus posten “een klant van mij zoekt…”. Geen naam, wel een opdracht. Scout leest die posts voor je mee.",
    tryIt: "Open het tabje AI nodig en klik bij een post op AI zoeken — Scout zoekt de eindklant en laat het bewijs zien.",
    href: "/leads",
  },
  {
    id: "confirm",
    title: "Eindklant bevestigen",
    text: "Je ziet een naam, een score en waarom: wat uit de post komt, wat online gevonden is en wat Scout eerder zag. Jij beslist.",
    tryIt: "Klopt de naam? Klik Bevestig — de post gaat door naar Kansen.",
    href: "/leads",
  },
  {
    id: "kansen",
    title: "Kansen",
    text: "Elke kans heeft één volgende stap, rechts in de rij: manager zoeken → mail/tel → bericht.",
    tryIt: "Klik Zoek manager of Haal mail/tel bij een kans.",
    href: "/kansen",
  },
  {
    id: "bericht",
    title: "Bericht",
    text: "Scout schrijft een concept aan de hiring manager, op basis van de opdracht. Jij kopieert en verstuurt zelf — er gaat nooit iets automatisch de deur uit.",
    href: "/regie",
  },
  {
    id: "done",
    title: "Dat is de hele lus",
    text: "Van een vage post naar een gesprek met de manager, in een paar klikken. Benieuwd hoe dit uitpakt met jullie eigen niches en concurrenten?",
  },
];

function doneKey(slug: string) {
  return `scout-demo-tour:v4:${slug}:done`;
}

function stepKey(slug: string) {
  return `scout-demo-tour:v4:${slug}:step`;
}

function readStep(slug: string) {
  try {
    const raw = window.sessionStorage.getItem(stepKey(slug));
    const n = raw ? Number(raw) : 0;
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(STEPS.length - 1, Math.floor(n)));
  } catch {
    return 0;
  }
}

function writeStep(slug: string, step: number) {
  try {
    window.sessionStorage.setItem(stepKey(slug), String(step));
  } catch {
    /* ignore */
  }
}

function announce(open: boolean) {
  window.dispatchEvent(new CustomEvent("demo:tour-state", { detail: open }));
}

export function DemoTour({
  slug,
  agencyName,
  accent,
  calendarUrl,
}: {
  slug: string;
  agencyName: string;
  accent: string;
  calendarUrl: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [min, setMin] = useState(false);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(doneKey(slug));
      const inProgress = window.sessionStorage.getItem(stepKey(slug));
      if (!done && inProgress != null) {
        // Rondleiding loopt: stap bewaren over pagina's.
        setStep(readStep(slug));
        setOpen(true);
      }
    } catch {
      /* geen storage: tour start alleen via knop */
    }
    setReady(true);
  }, [slug]);

  useEffect(() => {
    function onStart() {
      try {
        window.localStorage.removeItem(doneKey(slug));
      } catch {
        /* ignore */
      }
      writeStep(slug, 0);
      setStep(0);
      setMin(false);
      setOpen(true);
    }
    window.addEventListener("demo:tour", onStart);
    return () => window.removeEventListener("demo:tour", onStart);
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    announce(open);
  }, [open, ready]);

  useEffect(() => {
    if (!open) return;
    writeStep(slug, step);
  }, [open, slug, step]);

  if (!ready || !open) return null;

  const cur = STEPS[step]!;
  const last = step >= STEPS.length - 1;
  const elsewhere = Boolean(cur.href && pathname !== cur.href);

  function finish() {
    try {
      window.localStorage.setItem(doneKey(slug), "1");
      window.sessionStorage.removeItem(stepKey(slug));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function go(nextStep: number) {
    const target = STEPS[nextStep];
    if (target?.href && pathname !== target.href) router.push(target.href);
    setStep(nextStep);
    setMin(false);
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    // Huidige stap hoort op een andere pagina → eerst daarheen.
    if (elsewhere && cur.href) {
      router.push(cur.href);
      return;
    }
    go(step + 1);
  }

  if (min) {
    return (
      <button
        type="button"
        className="fixed bottom-[3.75rem] right-3 z-40 rounded-full border bg-[var(--surface)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--ink)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:bottom-5 md:right-5"
        style={{ borderColor: accent }}
        onClick={() => setMin(false)}
      >
        Rondleiding · stap {step + 1}/{STEPS.length}
      </button>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[3.75rem] z-40 flex justify-center px-3 md:inset-x-auto md:bottom-5 md:right-5 md:px-0"
      role="dialog"
      aria-label="Demo-rondleiding"
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-[var(--radius)] border bg-[var(--surface)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)] md:p-3.5"
        style={{ borderColor: accent }}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Rondleiding<span className="hidden md:inline"> · {agencyName}</span> · {step + 1}/{STEPS.length}
            </p>
            <h2 className="mt-0.5 text-[0.95rem] font-semibold text-[var(--ink)]">{cur.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="rounded px-1.5 text-[0.75rem] text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => setMin(true)}
              aria-label="Rondleiding even inklappen"
              title="Inklappen"
            >
              –
            </button>
            <button
              type="button"
              className="rounded px-1.5 text-[0.75rem] text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={finish}
              aria-label="Rondleiding sluiten"
            >
              Sluiten
            </button>
          </div>
        </div>
        <p className="text-[0.8rem] leading-snug text-[var(--muted)] md:text-[0.82rem]">{cur.text}</p>
        {cur.tryIt && !elsewhere ? (
          <p
            className="mt-2 rounded-md px-2.5 py-1.5 text-[0.8rem] leading-snug text-[var(--ink)]"
            style={{ background: `color-mix(in srgb, ${accent} 10%, var(--surface))` }}
          >
            <strong className="font-semibold">Probeer:</strong> {cur.tryIt}
          </p>
        ) : null}
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
              <button type="button" className="btn-tool text-[0.75rem]" onClick={() => go(step - 1)}>
                Terug
              </button>
            ) : null}
            {last ? (
              <>
                <button type="button" className="btn-tool text-[0.75rem]" onClick={finish}>
                  Zelf verder
                </button>
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ink btn-tool no-underline text-[0.75rem]"
                  onClick={finish}
                >
                  Plan 15 min
                </a>
              </>
            ) : (
              <button type="button" className="btn-ink btn-tool text-[0.75rem]" onClick={next}>
                {elsewhere ? (
                  `Ga naar ${cur.title}`
                ) : (
                  <>
                    Volgende<span className="hidden md:inline">: {STEPS[step + 1]!.title}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function startDemoTour() {
  window.dispatchEvent(new Event("demo:tour"));
}
