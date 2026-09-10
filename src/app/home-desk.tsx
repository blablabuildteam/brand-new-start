"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlablaLogo } from "@/components/blabla-logo";

const STEPS = [
  {
    n: "1",
    title: "Signaal",
    text: "Opdrachten komen binnen via LinkedIn, Indeed en Freelance.nl — of via bureaus op je watchlist.",
  },
  {
    n: "2",
    title: "Eindklant",
    text: "Plaatst het bedrijf zelf, dan ís dat de klant. Plaatst een bureau, dan raad je eerst de echte organisatie en bevestig je die.",
  },
  {
    n: "3",
    title: "Manager",
    text: "Pas daarna zoek je drie namen bij díe organisatie. Mail en telefoon via Lusha alleen als jij klikt.",
  },
  {
    n: "4",
    title: "Voorstel",
    text: "Regie zet het bericht klaar. Jij verstuurt — niks gaat automatisch de deur uit.",
  },
];

const LANES = [
  { name: "Radar", what: "Opdrachten van eindklanten" },
  { name: "Bureaus", what: "Agency-vacature → echte klant" },
  { name: "Manager", what: "Drie namen bij het juiste bedrijf" },
  { name: "Contact", what: "Mail of bel, per persoon" },
  { name: "Voorstel", what: "Bericht klaarzetten" },
];

export default function HomeDesk() {
  const router = useRouter();
  const [name, setName] = useState("Regie");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login?next=/");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j: { name?: string } | null) => {
        if (j?.name) setName(j.name);
      })
      .catch(() => null);
  }, [router]);

  return (
    <div className="desk-home min-h-dvh">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div>
          <p className="text-lg font-semibold tracking-tight md:text-xl" style={{ fontFamily: "var(--display)" }}>
            {name}
          </p>
          <p className="text-[0.72rem] text-[var(--muted)]">Recruitment-desk</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/login", { method: "DELETE" });
            router.replace("/login");
          }}
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline"
        >
          Uitloggen
        </button>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-16 pt-4 md:px-8 md:pt-8">
        <p
          className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]"
          style={{ fontFamily: "var(--mono)" }}
        >
          Kies je vak
        </p>
        <h1
          className="mt-2 max-w-xl text-[1.85rem] font-bold leading-[1.15] tracking-tight md:text-[2.35rem]"
          style={{ fontFamily: "var(--display)" }}
        >
          Twee manieren om te werven.
          <span className="block text-[var(--accent)]">Eén desk.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-[var(--muted)]">
          Permanent is werving & selectie: een vaste baan bij de werkgever. Contracting is interim en
          ZZP: een opdracht, waarbij de echte klant soms achter een bureau zit.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2 lg:gap-5">
          <article
            className="desk-card desk-card--soon animate-fade-in rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] md:p-7"
            aria-disabled="true"
          >
            <div className="flex items-start justify-between gap-3">
              <p
                className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--muted)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                Permanent
              </p>
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Binnenkort
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight md:text-2xl" style={{ fontFamily: "var(--display)" }}>
              Werving & selectie
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Vaste functies. De organisatie op de vacature ís de werkgever. Je zoekt de hiring manager
              daar, en doet een voorstel voor een vast contract — geen ZZP, geen bureau-eindklant.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--muted)]">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--line)]" aria-hidden />
                Vacature van de werkgever zelf
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--line)]" aria-hidden />
                Manager zoeken bij dat bedrijf
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--line)]" aria-hidden />
                Kandidaat voorstellen voor vast
              </li>
            </ul>
            <p className="mt-6 text-[0.75rem] leading-relaxed text-[var(--muted)]">
              Nog in ontwikkeling. Eerst contracting — daar zit de knip tussen bureau en eindklant.
            </p>
            <p className="mt-4 text-sm font-semibold text-[var(--muted)]">Binnenkort beschikbaar</p>
          </article>

          <article
            className="desk-card desk-card--live animate-fade-in rounded-[10px] border border-[var(--accent)]/35 bg-[var(--surface)] p-6 shadow-[var(--shadow)] md:p-7"
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <p
                className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--accent)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                Contracting
              </p>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Beschikbaar
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight md:text-2xl" style={{ fontFamily: "var(--display)" }}>
              Interim & ZZP
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Tijdelijke opdrachten. Soms plaatst de eindklant zelf. Soms een bureau — dan moet je
              eerst weten wie de echte klant is, anders zoek je de manager bij het wervingsbureau.
            </p>

            <p className="mt-5 text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">Wat erin zit</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {LANES.map((l) => (
                <li key={l.name} className="rounded-md border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{l.name}</p>
                  <p className="text-[0.72rem] leading-snug text-[var(--muted)]">{l.what}</p>
                </li>
              ))}
            </ul>

            <Link
              href="/radar"
              className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-[var(--accent)] bg-gradient-to-b from-[var(--accent-bright)] to-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-[0_2px_10px_-3px_rgba(0,121,193,0.55)] hover:from-[#1a9adb] hover:to-[#006eaf] hover:text-white hover:no-underline"
            >
              Open contracting
            </Link>
          </article>
        </div>

        <section className="mt-12 max-w-3xl animate-fade-in" style={{ animationDelay: "140ms" }}>
          <p
            className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Contracting · hoe het werkt
          </p>
          <h3 className="mt-2 text-lg font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
            Van opdracht naar het juiste gesprek
          </h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[0.7rem] font-bold text-[var(--accent)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {s.n}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--ink)]">{s.title}</span>
                  <span className="mt-0.5 block text-[0.8rem] leading-relaxed text-[var(--muted)]">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto max-w-[1100px] px-5 pb-8 md:px-8">
        <a
          href="https://blablabuild.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[0.7rem] text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline"
        >
          <span>Gebouwd door</span>
          <BlablaLogo className="h-4 w-4" />
          <span className="font-semibold text-[var(--ink)]">blablabuild</span>
        </a>
      </footer>
    </div>
  );
}
