"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlablaLogo } from "@/components/blabla-logo";
import { SiteNav } from "@/components/site-nav";

const STEPS = [
  {
    n: "01",
    title: "Signaal",
    text: "Opdrachten via LinkedIn, Indeed, Freelance.nl — of via bureaus op je watchlist.",
  },
  {
    n: "02",
    title: "Eindklant",
    text: "Zelf geplaatst: het bedrijf ís de klant. Bureau: eerst de echte organisatie bevestigen.",
  },
  {
    n: "03",
    title: "Manager",
    text: "Drie namen bij díe organisatie. Mail en telefoon via Lusha alleen als jij klikt.",
  },
  {
    n: "04",
    title: "Voorstel",
    text: "Het bericht staat klaar. Jij verstuurt — niks gaat automatisch de deur uit.",
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
    <div className="desk-home min-h-dvh bg-[#f4f6f8]">
      <SiteNav name={name} email={email} />

      <section className="relative overflow-hidden bg-[#0b1c30] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 88% -20%, rgba(0,121,193,0.5), transparent 52%), radial-gradient(ellipse 45% 55% at -5% 110%, rgba(206,255,0,0.09), transparent 48%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative mx-auto grid max-w-[1120px] items-end gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p
              className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-white/45"
              style={{ fontFamily: "var(--mono)" }}
            >
              Recruitment software
            </p>
            <h1
              className="mt-3 max-w-xl text-[2.25rem] font-bold leading-[1.06] tracking-tight md:text-[3.15rem]"
              style={{ fontFamily: "var(--display)" }}
            >
              De desk voor wie de eindklant wil bereiken.
            </h1>
            <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-white/62">
              Permanent is werving & selectie. Contracting is interim en ZZP — inclusief de route via
              bureaus, zodat je niet bij het verkeerde bedrijf belt.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#product"
                className="nav-link inline-flex items-center rounded-md bg-[#0079c1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a8fd4] hover:text-white"
              >
                Kies je vak
              </a>
              <Link
                href="/radar"
                className="nav-link inline-flex items-center rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/90 hover:border-white/40 hover:text-white"
              >
                Direct naar contracting
              </Link>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-xl border border-white/12 bg-[#081221] shadow-[0_32px_80px_-28px_rgba(0,0,0,0.65)]">
              <div className="flex items-center gap-1.5 border-b border-white/8 px-3.5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="ml-2 text-[0.65rem] text-white/35" style={{ fontFamily: "var(--mono)" }}>
                  Radar · contracting
                </span>
              </div>
              <div className="grid grid-cols-[7.5rem_1fr]">
                <div className="space-y-1 border-r border-white/8 p-3">
                  {["Radar", "Bureaus", "Voorstel"].map((l, i) => (
                    <div
                      key={l}
                      className={`rounded px-2 py-1.5 text-[0.68rem] ${
                        i === 0 ? "bg-white/10 font-semibold text-white" : "text-white/40"
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <div className="space-y-2 p-3">
                  {[
                    ["Rabobank", "Scrum Master", "82"],
                    ["Booking.com", "Platform engineer", "71"],
                    ["ING", "Business analist", "64"],
                  ].map(([co, role, score]) => (
                    <div key={co} className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-2">
                      <div>
                        <p className="text-[0.72rem] font-semibold text-white/90">{co}</p>
                        <p className="text-[0.62rem] text-white/40">{role}</p>
                      </div>
                      <span className="text-[0.68rem] font-semibold text-[#CEFF00]" style={{ fontFamily: "var(--mono)" }}>
                        {score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main id="product" className="mx-auto max-w-[1120px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <article className="desk-card desk-card--soon rounded-xl border border-[var(--line)] bg-white p-7 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                Permanent
              </p>
              <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Binnenkort
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
              Werving & selectie
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Vaste functies. De organisatie op de vacature ís de werkgever. Je zoekt de hiring
              manager daar, en doet een voorstel voor een vast contract.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[var(--muted)]">
              {["Vacature van de werkgever zelf", "Manager zoeken bij dat bedrijf", "Kandidaat voorstellen voor vast"].map(
                (t) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--line)]" aria-hidden />
                    {t}
                  </li>
                )
              )}
            </ul>
            <p className="mt-8 text-sm font-semibold text-[var(--muted)]">Nog in ontwikkeling</p>
          </article>

          <article className="desk-card desk-card--live rounded-xl border border-[var(--accent)]/30 bg-white p-7 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--accent)]" style={{ fontFamily: "var(--mono)" }}>
                Contracting
              </p>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Live
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
              Interim & ZZP
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Tijdelijke opdrachten. Soms plaatst de eindklant zelf. Soms een bureau — dan eerst de
              echte klant, anders zoek je de manager bij het wervingsbureau.
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {LANES.map((l) => (
                <li key={l.name} className="rounded-lg border border-[var(--line)]/80 bg-[var(--surface-2)] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[var(--ink)]">{l.name}</p>
                  <p className="text-[0.72rem] leading-snug text-[var(--muted)]">{l.what}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/radar"
              className="nav-link mt-7 inline-flex w-full items-center justify-center rounded-md bg-[#0b1c30] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123049] hover:text-white"
            >
              Open de workspace
            </Link>
          </article>
        </div>

        <section className="mt-16 border-t border-[var(--line)] pt-12">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            Hoe contracting werkt
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
            Van opdracht naar het juiste gesprek
          </h3>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="text-[0.7rem] font-semibold text-[var(--accent)]" style={{ fontFamily: "var(--mono)" }}>
                  {s.n}
                </span>
                <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{s.title}</p>
                <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--muted)]">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-white">
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
