"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { ScoutBrandText, ScoutMark } from "@/components/scout-mark";
import { WaitlistForm } from "@/components/waitlist-form";
import "./landing.css";

/** Uit de pilot, stand november 2026. */
const PILOT = [
  { n: "301", label: "Gelezen", text: "posts van recruiters, van zes bureaus" },
  { n: "172", label: "Voorgesteld", text: "keer een eindklant uit een vage post" },
  { n: "60", label: "Sterk", text: "daarvan met 80% zekerheid of meer" },
  { n: "54", label: "Op jobboards", text: "openingen bij 45 eindklanten" },
] as const;

const STEPS = [
  {
    title: "Meelezen",
    text: "Jobboards en de posts van recruiters die je volgt. Elke ochtend, of wanneer jij op sync drukt.",
    ui: "28 nieuwe posts",
  },
  {
    title: "De klant vinden",
    text: "Bij “voor een klant van mij” zoekt Scout de originele vacature op en noemt de eindklant, met het bewijs erbij.",
    ui: "Netbeheerder, 90%",
  },
  {
    title: "De juiste persoon",
    text: "De hiring manager bij die eindklant. Mail en telefoon haal je pas op als je ze echt nodig hebt.",
    ui: "Teamlead Data",
  },
  {
    title: "Een goed eerste bericht",
    text: "Over hun opdracht, niet over jouw bureau. Jij past aan en verstuurt.",
    ui: "Bericht klaar",
  },
] as const;

const FINDS = [
  {
    said: "Voor een directe eindklant in Arnhem zoek ik een ervaren Senior Java/Kotlin Developer.",
    date: "28 sep",
    who: "Uitvoeringsorganisatie van het Rijk",
    pct: 90,
    site: "bijoranje.nl",
    proof: "Zelfde opdracht, zelfde regio",
  },
  {
    said: "Voor een toonaangevende overheidsorganisatie ben ik op zoek naar een Solution Architect.",
    date: "25 aug",
    who: "Provincie in Zuid-Nederland",
    pct: 90,
    site: "freep.nl",
    proof: "Zelfde rol, stack en regio",
  },
  {
    said: "Gezocht: Data Engineer Snowflake / Matillion (detachering).",
    date: "25 mrt",
    who: "Netbeheerder in Arnhem",
    pct: 90,
    site: "inhuurdesk.nl",
    proof: "Noemt de opdrachtgever bij naam",
  },
  {
    said: "Voor een directe eindklant in Arnhem ben ik op zoek naar een freelance Platform Engineer.",
    date: "23 sep",
    who: null,
    pct: 40,
    site: null,
    proof: "Alleen algemene woorden. Scout noemt geen naam en laat het aan jou.",
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
          <ScoutMark className="h-8 w-8" tone="cobalt" animated={false} />
          <ScoutBrandText />
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
            Hun klant, <em>jouw</em> opdracht.
          </h1>
          <p className="lp-hero__lede lp-in lp-in--2">
            Andere bureaus posten “een klant van mij zoekt…”. Scout zoekt uit wie die klant is en zet de hiring
            manager voor je klaar. Zo bied je zelf aan, rechtstreeks bij de eindklant.
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

        <figure className="lp-shot" aria-label="Eén vondst uit de pilot, van post tot hiring manager">
          <div className="lp-shot__post lp-in lp-in--2">
            <div className="lp-shot__by">
              <span className="lp-shot__avatar" aria-hidden>
                R
              </span>
              <span>
                <strong>Recruiter bij een IT-bureau</strong>
                <em>LinkedIn, 25 mrt</em>
              </span>
            </div>
            <p>
              Gezocht: Data Engineer <mark>Snowflake / Matillion</mark> (detachering). Locatie Arnhem.
            </p>
          </div>

          <div className="lp-shot__scout lp-in lp-in--3">
            <div className="lp-shot__head">
              <span className="lp-shot__tag">
                <ScoutMark className="h-4 w-4" tone="cobalt" animated={false} /> Scout
              </span>
              <span className="lp-shot__pct">90% zeker</span>
            </div>
            <p className="lp-shot__who">Netbeheerder in Arnhem</p>
            <p className="lp-shot__proof">
              <span className="lp-chip">inhuurdesk.nl</span>
              Noemt de opdrachtgever bij naam
            </p>
            <div className="lp-shot__hm">
              <span className="lp-shot__hm-avatar" aria-hidden />
              <span className="lp-shot__hm-text">
                <span className="lp-blur" aria-hidden>
                  Eva Noordman
                </span>
                <em>Teamlead Data Platform</em>
              </span>
              <span className="lp-shot__btns" aria-hidden>
                <span>Mail</span>
                <span>Bel</span>
              </span>
            </div>
          </div>
          <figcaption>Echte post uit de pilot. Klant vervangen door sector, manager onherkenbaar gemaakt.</figcaption>
        </figure>
      </section>

      <main>
        <section className="lp-pilot" aria-label="Resultaten uit de pilot">
          <div className="lp-pilot__inner">
            <p className="lp-pilot__intro">Uit de pilot met een Nederlands IT-bureau, posts van het afgelopen jaar.</p>
            <dl className="lp-pilot__grid">
              {PILOT.map((p) => (
                <div key={p.label} className="lp-pilot__card">
                  <dt>
                    <span className="lp-pilot__label">{p.label}</span>
                    <span className="lp-pilot__n">{p.n}</span>
                  </dt>
                  <dd>{p.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-case__head">
            <h2 className="lp-h2">
              Het bureau zegt “een klant”.
              <br />
              Scout zegt <em>wie</em>.
            </h2>
            <p className="lp-case__note">
              Echte posts uit de pilot. Scout zoekt de opdracht elders online terug en laat zien waar. Zonder bewijs
              geen naam.
            </p>
          </div>
          <ul className="lp-finds">
            {FINDS.map((f) => (
              <li key={f.said} className={`lp-find ${f.who ? "" : "lp-find--open"}`}>
                <div className="lp-find__post">
                  <p className="lp-find__meta">Recruiter-post, {f.date}</p>
                  <blockquote>“{f.said}”</blockquote>
                </div>
                <div className="lp-find__answer">
                  <p className="lp-find__who">
                    {f.who ?? "Nog geen naam"}
                    <span>{f.pct}%</span>
                  </p>
                  <p className="lp-find__proof">
                    {f.site ? <span className="lp-chip">{f.site}</span> : null}
                    {f.proof}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="lp-finds__foot">Namen van eindklanten zijn hier vervangen door hun sector.</p>
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
                  <span className="lp-steps__ui">{s.ui}</span>
                </li>
              ))}
            </ol>
            <p className="lp-sources">
              Scout leest mee op LinkedIn Jobs, Indeed, Freelance.nl, careers-pagina’s en de posts van recruiters die
              jij volgt.
            </p>
          </div>
        </section>

        <section id="toegang" className="lp-section lp-access scroll-mt-10">
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
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-brand lp-brand--small">
          <ScoutMark className="h-5 w-5" tone="cobalt" animated={false} />
          <ScoutBrandText />
        </span>
        <a href="https://blablabuild.com" target="_blank" rel="noopener noreferrer" className="lp-foot__by">
          gemaakt door <BlablaLogo className="h-4 w-4" /> blablabuild
        </a>
      </footer>
    </div>
  );
}
