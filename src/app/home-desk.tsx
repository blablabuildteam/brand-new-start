"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { ScoutMark } from "@/components/scout-mark";
import { WaitlistForm } from "@/components/waitlist-form";
import "./landing.css";

const INBOX = [
  { from: "Recruiter-post, Den Haag", role: "Senior Rust Developer", hit: "Overheids-ICT-dienst", pct: 88 },
  { from: "Recruiter-post, Utrecht", role: "Freelance Cloud Platform Engineer", hit: "Spoorvervoerder", pct: 90 },
  { from: "Recruiter-post", role: "Full Stack Developer (.NET / Angular)", hit: "Financiële toezichthouder", pct: 90 },
  { from: "Recruiter-post, Arnhem", role: "Data Engineer (Snowflake, Matillion)", hit: "Netbeheerder", pct: 90 },
] as const;

/** Uit de pilot, stand november 2026. */
const PILOT = [
  { n: "301", text: "posts van recruiters gelezen, van zes bureaus" },
  { n: "172", text: "keer een eindklant voorgesteld" },
  { n: "60", text: "daarvan met 80% zekerheid of meer" },
  { n: "54", text: "openingen bij 45 eindklanten op de jobboards" },
] as const;

const FINDS = [
  {
    said: "Voor een directe eindklant in Arnhem zoek ik een ervaren Senior Java/Kotlin Developer.",
    who: "Uitvoeringsorganisatie van het Rijk",
    pct: 90,
    proof: "Dezelfde opdracht stond op bijoranje.nl.",
  },
  {
    said: "Voor een toonaangevende overheidsorganisatie ben ik op zoek naar een Solution Architect.",
    who: "Provincie in Zuid-Nederland",
    pct: 90,
    proof: "Zelfde rol, stack en regio op freep.nl.",
  },
  {
    said: "Gezocht: Data Engineer Snowflake / Matillion (detachering).",
    who: "Netbeheerder in Arnhem",
    pct: 90,
    proof: "Inhuurdesk.nl noemt de opdrachtgever bij naam.",
  },
  {
    said: "Voor een directe eindklant in Arnhem ben ik op zoek naar een freelance Platform Engineer.",
    who: null,
    pct: 40,
    proof: "Alleen algemene woorden. Scout noemt geen naam en laat het aan jou.",
  },
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

        <aside className="lp-inbox lp-in lp-in--2" aria-label="Wat Scout recent vond">
          <p className="lp-inbox__head">Recent gevonden</p>
          <ol className="lp-inbox__list">
            {INBOX.map((w, i) => (
              <li key={w.role} className="lp-inbox__row" style={{ animationDelay: `${0.35 + i * 0.2}s` }}>
                <div className="lp-inbox__main">
                  <p className="lp-inbox__role">{w.role}</p>
                  <p className="lp-inbox__from">{w.from}</p>
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
        <section className="lp-pilot" aria-label="Resultaten uit de pilot">
          <div className="lp-pilot__inner">
            <p className="lp-pilot__intro">
              Uit de pilot met een Nederlands IT-bureau, posts van het afgelopen jaar.
            </p>
            <dl className="lp-pilot__grid">
              {PILOT.map((p) => (
                <div key={p.text}>
                  <dt>{p.n}</dt>
                  <dd>{p.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

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

        <section className="lp-section">
          <div className="lp-case__head">
            <h2 className="lp-h2">
              Het bureau zegt “een klant”.
              <br />
              Scout zegt wie.
            </h2>
            <p className="lp-case__note">
              Echte posts uit de pilot. Scout zoekt de opdracht elders online terug en laat zien waar. Zonder bewijs
              geen naam.
            </p>
          </div>
          <ul className="lp-finds">
            {FINDS.map((f) => (
              <li key={f.said} className={`lp-find ${f.who ? "" : "lp-find--open"}`}>
                <blockquote>“{f.said}”</blockquote>
                <div className="lp-find__answer">
                  <p className="lp-find__who">
                    {f.who ?? "Nog geen naam"}
                    <span>{f.pct}%</span>
                  </p>
                  <p className="lp-find__proof">{f.proof}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="lp-finds__foot">Namen van eindklanten zijn hier vervangen door hun sector.</p>
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
