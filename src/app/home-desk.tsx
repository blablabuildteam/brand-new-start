"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { ScoutMark } from "@/components/scout-mark";
import { WaitlistForm } from "@/components/waitlist-form";
import "./landing.css";

const INBOX = [
  { t: "09:12", from: "Recruiter-post, Rotterdam", role: "Scrum Master voor een SAP-transformatie", hit: "Haven en logistiek", pct: 86 },
  { t: "09:31", from: "LinkedIn Jobs, Noord-Holland", role: "Senior Infrastructure Engineer", hit: "Automotive, Europees hoofdkantoor", pct: 88 },
  { t: "10:04", from: "Recruiter-post, Diemen", role: "GenAI Developer (Java, AWS)", hit: "Internationale webwinkel", pct: 91 },
  { t: "10:47", from: "Freelance.nl, Utrecht", role: "Functioneel tester hypotheken", hit: "Retailbank", pct: 74 },
] as const;

const STEPS = [
  {
    title: "Meelezen",
    text: "Jobboards en de posts van recruiters die je volgt. Elke ochtend, of wanneer jij op sync drukt.",
  },
  {
    title: "De klant vinden",
    text: "Bij “voor een klant van mij” zoekt Scout de originele vacature op en noemt de eindklant, met het bewijs erbij.",
  },
  {
    title: "De juiste persoon",
    text: "De hiring manager bij die eindklant. Mail en telefoon haal je pas op als je ze echt nodig hebt.",
  },
  {
    title: "Een goed eerste bericht",
    text: "Over hun opdracht, niet over jouw bureau. Jij past aan en verstuurt.",
  },
] as const;

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
      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="Recruitment Scout home">
          <ScoutMark className="h-8 w-8" tone="pine" animated={false} />
          <span>Recruitment Scout</span>
        </Link>
        <nav className="lp-nav__links" aria-label="Primary">
          <a href="#werk">Hoe het werkt</a>
          <Link href="/demo">Demo</Link>
          <Link href={email ? "/radar" : "/login?next=%2Fradar"} className="lp-btn lp-btn--quiet">
            {email ? "Naar de desk" : "Inloggen"}
          </Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero__copy">
          <h1 className="lp-hero__title lp-in">
            Weet wie de klant is, <em>voordat</em> je concurrent belt.
          </h1>
          <p className="lp-hero__lede lp-in lp-in--2">
            Bureaus posten “een klant van mij zoekt…”. Scout leest mee, zoekt uit welke organisatie erachter zit en
            zet de hiring manager voor je klaar.
          </p>
          <div className="lp-hero__cta lp-in lp-in--3">
            <Link href="/demo" className="lp-btn lp-btn--primary">
              Bekijk de demo
            </Link>
            <a href="#toegang" className="lp-btn lp-btn--line">
              Toegang aanvragen
            </a>
          </div>
        </div>

        <aside className="lp-inbox lp-in lp-in--2" aria-label="Voorbeeld van wat Scout vanochtend vond">
          <p className="lp-inbox__head">Vanochtend gevonden</p>
          <ol className="lp-inbox__list">
            {INBOX.map((w, i) => (
              <li key={w.t} className="lp-inbox__row" style={{ animationDelay: `${0.35 + i * 0.2}s` }}>
                <div className="lp-inbox__main">
                  <p className="lp-inbox__role">{w.role}</p>
                  <p className="lp-inbox__from">
                    {w.t} — {w.from}
                  </p>
                </div>
                <p className="lp-inbox__hit">
                  {w.hit}
                  <span>{w.pct}%</span>
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <main>
        <section id="werk" className="lp-band scroll-mt-10">
          <div className="lp-section">
            <h2 className="lp-h2">Van een vage post naar een naam en een nummer.</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-steps__n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="lp-sources">
              Scout leest mee op LinkedIn Jobs, Indeed, Freelance.nl, careers-pagina’s en de posts van recruiters die
              jij volgt.
            </p>
          </div>
        </section>

        <section className="lp-section lp-case">
          <div>
            <h2 className="lp-h2">
              Het bureau zegt “een klant”.
              <br />
              Scout zegt wie.
            </h2>
            <p className="lp-case__note">
              Bij twijfel zoekt Scout de originele vacature online op en leest die helemaal. Is er geen bewijs, dan
              krijg je geen naam maar een vraag.
            </p>
          </div>
          <figure className="lp-post">
            <figcaption className="lp-post__by">
              <span className="lp-post__avatar" aria-hidden />
              <span>
                <strong>Recruiter bij een IT-bureau</strong>
                <br />
                <em>2 uur geleden</em>
              </span>
            </figcaption>
            <blockquote>
              Senior Infrastructure Engineer, regio Noord-Holland. Voor{" "}
              <mark className="lp-post__mark">een internationale organisatie</mark> zoek ik per direct iemand met
              Windows Server, VMware, Citrix en Active Directory. 40 uur, start zo snel mogelijk.
            </blockquote>
            <div className="lp-post__answer">
              <p className="lp-post__answer-v">
                Automotive, Europees hoofdkantoor
                <span>88% zeker</span>
              </p>
              <p className="lp-post__answer-s">
                Gevonden via de originele vacature. Stack en regio komen overeen, twee managers in beeld.
              </p>
            </div>
          </figure>
        </section>

        <section id="toegang" className="lp-band scroll-mt-10">
          <div className="lp-section lp-access">
            <div>
              <h2 className="lp-h2">Voor bureaus die eerder bij de eindklant willen zijn.</h2>
              <p className="lp-access__text">
                Geen marketplace en geen kandidatenbank. Een werkplek voor een klein aantal bureaus.
                {email ? null : " Laat je gegevens achter, dan nemen we contact op."}
              </p>
              <p className="lp-access__alt">
                {email ? (
                  <Link href="/radar">Naar de desk</Link>
                ) : (
                  <>
                    Kreeg je een demo-wachtwoord? <Link href="/demo">Open de demo</Link>
                  </>
                )}
              </p>
            </div>
            {!email ? (
              <div className="lp-access__form">
                <WaitlistForm />
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-brand lp-brand--small">
          <ScoutMark className="h-5 w-5" tone="pine" animated={false} />
          <span>Recruitment Scout</span>
        </span>
        <a href="https://blablabuild.com" target="_blank" rel="noopener noreferrer" className="lp-foot__by">
          gemaakt door <BlablaLogo className="h-4 w-4" /> blablabuild
        </a>
      </footer>
    </div>
  );
}
