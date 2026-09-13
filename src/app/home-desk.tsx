"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeSignalField } from "@/components/home-signal-field";
import { SiteNav } from "@/components/site-nav";

const BEATS = [
  {
    k: "01",
    title: "Spot",
    text: "Kansen verschijnen zodra ze relevant zijn — niet wanneer je eindeloos zoekt.",
  },
  {
    k: "02",
    title: "Waarde",
    text: "Elke kans krijgt gewicht. Sterk genoeg om nu te handelen, of later te volgen.",
  },
  {
    k: "03",
    title: "Ontgrendel",
    text: "De opdrachtgever achter het signaal komt in beeld. Jij bevestigt — daarna de juiste deur.",
  },
  {
    k: "04",
    title: "Plaats",
    text: "Van manager tot kandidaat: het pad naar contact is klaargezet. Jij houdt de knop.",
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
    <div className="desk-home desk-home--veil min-h-dvh">
      <SiteNav name={name} email={email} veil />

      <section className="home-hero">
        <div className="home-hero__atmosphere" aria-hidden />
        <div className="home-hero__grain" aria-hidden />

        <div className="home-hero__inner">
          <div className="home-hero__copy">
            <p className="home-hero__brand home-reveal">{name}</p>
            <h1 className="home-hero__headline home-reveal home-reveal--2">
              Kansen zien vóór de rest.
            </h1>
            <p className="home-hero__lede home-reveal home-reveal--3">
              Spotten. Op waarde schatten. De opdrachtgever ontgrendelen. Plaatsing bijna
              vanzelf — jij houdt de regie.
            </p>
            <div className="home-hero__cta home-reveal home-reveal--4">
              {email ? (
                <Link href={deskHref} className="nav-link home-btn home-btn--signal">
                  Open de desk
                </Link>
              ) : (
                <Link href={loginHref} className="nav-link home-btn home-btn--signal">
                  Toegang
                </Link>
              )}
              <a href="#lijn" className="nav-link home-btn home-btn--ghost">
                De lijn
              </a>
            </div>
          </div>

          <div className="home-hero__field home-reveal home-reveal--3">
            <HomeSignalField />
          </div>
        </div>
      </section>

      <main>
        <section id="lijn" className="home-line scroll-mt-24">
          <div className="home-line__head">
            <p className="home-kicker">De lijn</p>
            <h2 className="home-line__title">Van signaal naar plaatsing.</h2>
            <p className="home-line__sub">
              Geen open markt. Een korte keten die eindigt bij het juiste gesprek.
            </p>
          </div>

          <ol className="home-beats">
            {BEATS.map((b, i) => (
              <li key={b.k} className={`home-beat home-reveal home-reveal--${i + 1}`}>
                <span className="home-beat__k" style={{ fontFamily: "var(--mono)" }}>
                  {b.k}
                </span>
                <div className="home-beat__body">
                  <h3 className="home-beat__title">{b.title}</h3>
                  <p className="home-beat__text">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-close">
          <div className="home-close__panel">
            <p className="home-kicker">Alleen voor wie erbij hoort</p>
            <h2 className="home-close__title">De rest blijft stil.</h2>
            <p className="home-close__text">
              Geen publieke marketplace. Een desk die sneller ziet wat telt — en je tot aan het
              gesprek brengt.
            </p>
            <div className="home-close__cta">
              {email ? (
                <Link href={deskHref} className="nav-link home-btn home-btn--signal">
                  Naar de workspace
                </Link>
              ) : (
                <Link href={loginHref} className="nav-link home-btn home-btn--signal">
                  Inloggen
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="home-foot">
        <a
          href="https://blablabuild.com"
          target="_blank"
          rel="noopener noreferrer"
          className="home-foot__link"
        >
          <BlablaLogo className="h-4 w-4" />
          <span>blablabuild</span>
        </a>
      </footer>
    </div>
  );
}
