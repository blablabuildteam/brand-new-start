"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { ScoutMark } from "@/components/scout-mark";
import { WaitlistForm } from "@/components/waitlist-form";

const WIRE = [
  { t: "09:12", src: "Recruiter-post", role: "Scrum Master · SAP-transformatie", where: "Rotterdam", hit: "Haven & logistiek", pct: 86 },
  { t: "09:31", src: "LinkedIn Jobs", role: "Senior Infrastructure Engineer", where: "Noord-Holland", hit: "Automotive · EU-hoofdkantoor", pct: 88 },
  { t: "10:04", src: "Recruiter-post", role: "GenAI Developer · Java / AWS", where: "Diemen", hit: "E-commerce · internationaal", pct: 91 },
  { t: "10:47", src: "Freelance.nl", role: "Functioneel Tester · Hypotheken", where: "Utrecht", hit: "Bank · retail", pct: 74 },
  { t: "11:20", src: "Recruiter-post", role: "Cloud Engineer · IAM & security", where: "Hybride", hit: "Zoekt nog…", pct: null },
] as const;

const STEPS = [
  { n: "1", title: "Lezen", text: "Jobboards en de posts van recruiters die je volgt. Elke ochtend, of als jij op sync drukt." },
  { n: "2", title: "Ontmaskeren", text: "“Voor een klant van mij…” — Scout zoekt de originele vacature en noemt de eindklant, met bewijs." },
  { n: "3", title: "Mensen", text: "De hiring manager bij die eindklant. Daarna werkmail en telefoon, alleen als jij erom vraagt." },
  { n: "4", title: "Bericht", text: "Een opening die over hun opdracht gaat, niet over jouw bureau. Jij verstuurt." },
] as const;

const SOURCES = ["LinkedIn Jobs", "Indeed", "Freelance.nl", "Recruiter-feeds", "Careers-pagina’s", "Vacature-archief"];

export default function HomeDesk() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user?: { email?: string } } | null) => {
        if (j?.user?.email) setEmail(j.user.email);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="lp">
      <div className="lp-grain" aria-hidden />

      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="Recruitment Scout home">
          <ScoutMark className="h-7 w-7" tone="light" />
          <span>Recruitment Scout</span>
        </Link>
        <nav className="lp-nav__links" aria-label="Primary">
          <a href="#werk">Hoe het werkt</a>
          <Link href="/demo">Demo</Link>
          {email ? (
            <Link href="/radar" className="lp-btn lp-btn--ghost">
              Naar de desk
            </Link>
          ) : (
            <Link href="/login?next=%2Fradar" className="lp-btn lp-btn--ghost">
              Inloggen
            </Link>
          )}
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero__copy">
          <p className="lp-kicker lp-in">
            <span className="lp-dot" /> Interim &amp; ZZP · Nederland
          </p>
          <h1 className="lp-hero__title lp-in lp-in--2">
            De opdracht,
            <br />
            <em>vóór</em> de vacature.
          </h1>
          <p className="lp-hero__lede lp-in lp-in--3">
            Bureaus posten “een klant van mij zoekt…”. Scout leest mee, vindt wie die klant is en zet de
            hiring manager voor je klaar. Jij belt als eerste.
          </p>
          <div className="lp-hero__cta lp-in lp-in--4">
            <Link href="/demo" className="lp-btn lp-btn--signal">
              Bekijk de demo →
            </Link>
            <a href="#toegang" className="lp-btn lp-btn--line">
              Toegang aanvragen
            </a>
          </div>
        </div>

        <aside className="lp-wire lp-in lp-in--3" aria-label="Voorbeeld van binnenkomende signalen">
          <div className="lp-wire__head">
            <span>
              <span className="lp-dot lp-dot--live" /> Wire
            </span>
            <span>vandaag · voorbeeld</span>
          </div>
          <ol className="lp-wire__list">
            {WIRE.map((w, i) => (
              <li key={w.t} className="lp-wire__row" style={{ animationDelay: `${0.5 + i * 0.35}s` }}>
                <span className="lp-wire__t">{w.t}</span>
                <div className="lp-wire__body">
                  <p className="lp-wire__src">{w.src} · {w.where}</p>
                  <p className="lp-wire__role">{w.role}</p>
                  <p className={`lp-wire__hit ${w.pct ? "" : "is-pending"}`}>
                    <span className="lp-wire__redact" aria-hidden style={{ animationDelay: `${1.2 + i * 0.35}s` }} />
                    → {w.hit}
                  </p>
                </div>
                <span className={`lp-wire__pct ${w.pct ? "" : "is-pending"}`}>{w.pct ? `${w.pct}%` : "···"}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee__track">
          {[...SOURCES, ...SOURCES, ...SOURCES].map((s, i) => (
            <span key={i}>
              {s} <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <main>
        <section id="werk" className="lp-paper scroll-mt-10">
          <div className="lp-section">
            <div className="lp-section__head">
              <p className="lp-label">Hoe het werkt</p>
              <h2 className="lp-h2">
                Van een vage post naar <em>een naam</em> en een nummer.
              </h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="lp-steps__n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-case">
          <div className="lp-section lp-case__grid">
            <div>
              <p className="lp-label lp-label--dark">Wat er gebeurt</p>
              <h2 className="lp-h2 lp-h2--dark">
                Het bureau zegt <em>“een klant”</em>.<br />
                Scout zegt wie.
              </h2>
              <p className="lp-case__note">
                Bij twijfel zoekt Scout zelf de originele vacature online en leest die helemaal. Geen bewijs, geen
                naam — dan blijft het een vraag aan jou.
              </p>
            </div>
            <figure className="lp-post">
              <figcaption className="lp-post__by">
                <span className="lp-post__avatar" aria-hidden />
                <span>
                  <strong>Recruiter</strong> · IT-bureau
                  <br />
                  <em>2 uur geleden</em>
                </span>
              </figcaption>
              <blockquote>
                SPOED | Senior Infrastructure Engineer | Regio Noord-Holland. Voor{" "}
                <mark className="lp-post__mark">een internationale organisatie</mark> zoek ik per direct iemand met
                Windows Server, VMware, Citrix en Active Directory. 40 uur, start z.s.m.
              </blockquote>
              <div className="lp-post__answer">
                <p className="lp-post__answer-l">Scout</p>
                <p className="lp-post__answer-v">
                  Automotive · Europees hoofdkantoor <span>88%</span>
                </p>
                <p className="lp-post__answer-s">Originele vacature gevonden · stack + regio matchen · 2 managers</p>
              </div>
            </figure>
          </div>
        </section>

        <section id="toegang" className="lp-paper scroll-mt-10">
          <div className="lp-section lp-access">
            <div>
              <p className="lp-label">Toegang</p>
              <h2 className="lp-h2">
                Voor bureaus die de opdracht <em>niet missen</em>.
              </h2>
              <p className="lp-access__text">
                Geen marketplace en geen kandidatenbank. Een desk voor een handvol bureaus die eerder bij de
                eindklant willen zijn dan de rest.
              </p>
              <div className="lp-access__cta">
                {email ? (
                  <Link href="/radar" className="lp-btn lp-btn--ink">
                    Naar de desk →
                  </Link>
                ) : (
                  <Link href="/demo" className="lp-btn lp-btn--ink">
                    Heb je een demo-wachtwoord? →
                  </Link>
                )}
              </div>
            </div>
            {!email ? (
              <div className="lp-access__form">
                <p className="lp-label lp-label--dark">Wachtlijst</p>
                <WaitlistForm dark />
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-brand lp-brand--small">
          <ScoutMark className="h-5 w-5" tone="light" animated={false} />
          <span>Recruitment Scout</span>
        </span>
        <a href="https://blablabuild.com" target="_blank" rel="noopener noreferrer" className="lp-foot__by">
          een product van <BlablaLogo className="h-4 w-4" /> blablabuild
        </a>
      </footer>
    </div>
  );
}
