"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlablaLogo } from "@/components/blabla-logo";
import { SiteNav } from "@/components/site-nav";

const STEPS = [
  {
    n: "01",
    title: "Kans",
    text: "Opdrachten komen binnen via LinkedIn, Indeed en Freelance.nl — of via bureaus op je watchlist.",
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
    title: "Benaderen",
    text: "Je gaat naar die manager met een geschikt profiel. Het bericht staat klaar — jij verstuurt.",
  },
];

const TRADES = [
  {
    id: "permanent",
    live: false,
    kicker: "Permanent",
    title: "Werving & selectie",
    lead: "Vaste functies. De organisatie op de vacature is de werkgever — daar zoek je de manager en doe je een voorstel.",
    points: [
      "Vacature komt van de werkgever zelf",
      "Hiring manager zoeken bij dat bedrijf",
      "Kandidaat voorstellen voor een vast contract",
    ],
  },
  {
    id: "contracting",
    live: true,
    kicker: "Contracting",
    title: "Interim & ZZP",
    lead: "Interim- en ZZP-kansen ophalen, de eindklant vastzetten, en de hiring manager benaderen met een passend profiel.",
    points: [
      "Kansen via LinkedIn, Indeed, Freelance.nl — of via bureaus op je watchlist",
      "Eindklant kennen: zelf geplaatst = het bedrijf; bureau = eerst bevestigen",
      "Daarna de manager van díe organisatie, met een voorstel klaar om te versturen",
    ],
  },
] as const;

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

      <section className="relative overflow-hidden bg-[var(--header)] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 88% -20%, rgba(0,121,193,0.42), transparent 52%)",
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
              Permanent is werving & selectie. Contracting haalt interim- en ZZP-kansen op — van
              jobboards én bureaus — en brengt je bij de hiring manager van de eindklant.
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
                      <span className="text-[0.68rem] font-semibold text-[#7ec8ee]" style={{ fontFamily: "var(--mono)" }}>
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

      <main className="mx-auto max-w-[1120px] px-5 py-12 md:px-8 md:py-16">
        <section id="product" className="scroll-mt-28">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            Product
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
            Kies je vak
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Twee trades, één desk. Permanent komt eraan. Contracting kun je nu openen.
          </p>

          <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-2">
            {TRADES.map((t) => (
              <article
                key={t.id}
                className={`desk-card rounded-xl border bg-white p-7 md:p-8 ${
                  t.live ? "desk-card--live border-[var(--accent)]/35" : "border-[var(--line)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`text-[0.65rem] uppercase tracking-[0.12em] ${
                      t.live ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    }`}
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    {t.kicker}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                      t.live
                        ? "border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {t.live ? "Live" : "Binnenkort"}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                  {t.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{t.lead}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {t.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-sm text-[var(--ink)]">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          t.live ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                        }`}
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                {t.live ? (
                  <Link
                    href="/radar"
                    className="nav-link mt-8 inline-flex w-full items-center justify-center rounded-md bg-[var(--header)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123049] hover:text-white"
                  >
                    Open contracting
                  </Link>
                ) : (
                  <p className="mt-8 rounded-md bg-[var(--surface-2)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--muted)]">
                    Nog niet beschikbaar
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--line)] pt-12">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            Hoe contracting werkt
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight" style={{ fontFamily: "var(--display)" }}>
            Van kans naar een gesprek met de manager
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
