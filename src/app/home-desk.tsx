"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HeroRadar } from "@/components/hero-radar";
import { SiteNav } from "@/components/site-nav";

const STEPS = [
  {
    n: "1",
    title: "Kans",
    text: "Opdrachten via LinkedIn, Indeed, Freelance.nl — of via een bureau.",
  },
  {
    n: "2",
    title: "Eindklant",
    text: "Zelf geplaatst: dat bedrijf. Bureau: eerst bevestigen.",
  },
  {
    n: "3",
    title: "Manager",
    text: "Namen bij díe organisatie. Contact alleen als jij klikt.",
  },
  {
    n: "4",
    title: "Voorstel",
    text: "Bericht klaarzetten. Jij verstuurt — niets gaat automatisch.",
  },
];

const PRINCIPLES = [
  {
    title: "Alleen de eindklant",
    text: "Geen manager zoeken bij een bureau als de opdracht voor een bank of retailer is.",
  },
  {
    title: "Jij houdt de regie",
    text: "Sync, zoeken en versturen gebeurt op jouw klik. Geen auto-outreach.",
  },
  {
    title: "Bronnen samen",
    text: "Jobboards en watchlist-bureaus landen in één flow naar hetzelfde gesprek.",
  },
];

export default function HomeDesk() {
  const [name, setName] = useState("Regie");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { name?: string; user?: { email?: string } } | null) => {
        if (!j) return;
        if (j.name) setName(j.name);
        if (j.user?.email) setEmail(j.user.email);
      })
      .catch(() => null);
  }, []);

  const deskHref = "/radar";
  const loginHref = `/login?next=${encodeURIComponent(deskHref)}`;

  return (
    <div className="desk-home min-h-dvh">
      <SiteNav name={name} email={email} />

      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--surface)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 70% at 100% 0%, rgba(235,242,18,0.18), transparent 55%), radial-gradient(ellipse 40% 50% at 0% 100%, rgba(63,54,83,0.05), transparent 50%)",
          }}
        />

        <div className="relative mx-auto grid max-w-[1120px] items-center gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="reveal">
            <p
              className="text-[2.75rem] leading-none tracking-tight text-[var(--ink)] md:text-[3.75rem]"
              style={{ fontFamily: "var(--display)" }}
            >
              {name}
            </p>
            <h1 className="mt-4 max-w-xl text-[1.35rem] font-semibold leading-snug tracking-tight text-[var(--accent)] md:text-[1.6rem]">
              Van opdracht naar de juiste manager.
            </h1>
            <p className="mt-4 max-w-md text-[1.02rem] leading-relaxed text-[var(--muted)]">
              Interim- en ZZP-kansen ophalen, de eindklant vastzetten, en de hiring manager benaderen
              met een passend profiel — jij houdt de regie.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {email ? (
                <Link
                  href={deskHref}
                  className="nav-link btn-signal inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02]"
                >
                  Open de desk
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className="nav-link btn-signal inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02]"
                >
                  Inloggen
                </Link>
              )}
              <a
                href="#hoe"
                className="nav-link inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                Hoe het werkt
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {["LinkedIn", "Indeed", "Freelance.nl", "Bureaus"].map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 text-[0.72rem] font-medium text-[var(--muted)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="reveal reveal-delay-2 hidden lg:block">
            <HeroRadar />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1120px] px-5 py-14 md:px-8 md:py-16">
        <section id="hoe" className="scroll-mt-24">
          <h2
            className="text-[2rem] tracking-tight text-[var(--accent)] md:text-[2.35rem]"
            style={{ fontFamily: "var(--display)" }}
          >
            Hoe het werkt
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
            Eén lijn: kans → eindklant → manager → voorstel.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className={`reveal reveal-delay-${i + 1} rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]`}
              >
                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--signal)] px-2 text-[0.75rem] font-semibold text-[var(--ink)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {s.n}
                </span>
                <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{s.title}</p>
                <p className="mt-1 text-[0.85rem] leading-relaxed text-[var(--muted)]">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2
            className="text-[2rem] tracking-tight text-[var(--accent)] md:text-[2.35rem]"
            style={{ fontFamily: "var(--display)" }}
          >
            Beginselen
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <article
                key={p.title}
                className={`reveal reveal-delay-${i + 1} rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6`}
              >
                <p
                  className="text-[1.25rem] tracking-tight text-[var(--ink)]"
                  style={{ fontFamily: "var(--display)" }}
                >
                  {p.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-12">
          <h2
            className="text-[2rem] tracking-tight text-[var(--accent)] md:text-[2.35rem]"
            style={{ fontFamily: "var(--display)" }}
          >
            Klaar om te starten
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
            Contracting staat live. Log in om Radar, Bureaus, Kansen en Voorstel te openen.
          </p>
          <div className="mt-8">
            {email ? (
              <Link
                href={deskHref}
                className="nav-link btn-ink inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Naar de workspace
              </Link>
            ) : (
              <Link
                href={loginHref}
                className="nav-link btn-ink inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Inloggen op de desk
              </Link>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-5 md:px-8">
          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.7rem] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
          >
            <BlablaLogo className="h-4 w-4" />
            <span>Gebouwd door blablabuild</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
