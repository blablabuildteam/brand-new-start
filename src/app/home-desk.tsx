"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlablaLogo } from "@/components/blabla-logo";
import { HeroRadar } from "@/components/hero-radar";
import { SiteNav } from "@/components/site-nav";

const STEPS = [
  {
    n: "1",
    title: "Kans binnen",
    text: "Via LinkedIn, Indeed, Freelance.nl — of via een bureau op je watchlist.",
  },
  {
    n: "2",
    title: "Eindklant",
    text: "Zelf geplaatst: dat bedrijf. Bureau: eerst bevestigen wie de echte klant is.",
  },
  {
    n: "3",
    title: "Manager",
    text: "Drie namen bij díe organisatie. Mail of tel alleen als jij dat wilt.",
  },
  {
    n: "4",
    title: "Voorstel",
    text: "Bericht klaarzetten met een passend profiel. Jij verstuurt.",
  },
];

export default function HomeDesk() {
  const router = useRouter();
  const [name, setName] = useState("Regie");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login?next=/");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j: { name?: string; user?: { email?: string } } | null) => {
        if (j?.name) setName(j.name);
        if (j?.user?.email) setEmail(j.user.email);
      })
      .catch(() => null);
  }, [router]);

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
            <h1
              className="max-w-xl text-[2.6rem] leading-[1.05] tracking-tight text-[var(--accent)] md:text-[3.5rem]"
              style={{ fontFamily: "var(--display)" }}
            >
              Van opdracht naar de juiste manager.
            </h1>
            <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-[var(--muted)]">
              Vind interim- en ZZP-kansen, zet de eindklant vast, en benader de hiring manager met
              een passend profiel.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/radar"
                className="nav-link btn-signal inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02]"
              >
                Open contracting
              </Link>
              <a
                href="#vakken"
                className="nav-link inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                Bekijk de vakken
              </a>
            </div>
          </div>

          <div className="reveal reveal-delay-2 hidden lg:block">
            <HeroRadar />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1120px] px-5 py-14 md:px-8 md:py-16">
        <section id="vakken" className="scroll-mt-24">
          <h2
            className="text-[2rem] tracking-tight text-[var(--accent)] md:text-[2.35rem]"
            style={{ fontFamily: "var(--display)" }}
          >
            Kies je vak
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
            Contracting staat live. Permanent volgt eraan.
          </p>

          <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-2">
            <article className="desk-card reveal rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 md:p-8">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[1.65rem] tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                  Permanent
                </h3>
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Binnenkort
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Werving & selectie</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Vaste functies bij de werkgever op de vacature. Manager zoeken, kandidaat
                voorstellen.
              </p>
              <p className="mt-8 rounded-full bg-[var(--surface-2)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--muted)]">
                Nog niet beschikbaar
              </p>
            </article>

            <article className="desk-card desk-card--live reveal reveal-delay-1 rounded-2xl border border-[var(--accent)]/20 bg-[var(--surface)] p-7 md:p-8">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[1.65rem] tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                  Contracting
                </h3>
                <span className="rounded-full bg-[var(--signal)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--ink)]">
                  Live
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Interim & ZZP</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Kansen van jobboards en bureaus. Eerst de eindklant, dan de manager, dan het
                voorstel.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[var(--ink)]">
                {["LinkedIn, Indeed, Freelance.nl", "Bureaus → eindklant bevestigen", "Manager + voorstel"].map(
                  (t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                      {t}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/radar"
                className="nav-link btn-ink mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition hover:scale-[1.01]"
              >
                Open de workspace
              </Link>
            </article>
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--line)] pt-12">
          <h3
            className="text-[1.75rem] tracking-tight text-[var(--accent)]"
            style={{ fontFamily: "var(--display)" }}
          >
            Zo werkt contracting
          </h3>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`reveal reveal-delay-${i + 1}`}>
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
