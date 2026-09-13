"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeOpportunityStage } from "@/components/home-opportunity-stage";
import { SiteNav } from "@/components/site-nav";
import { PRODUCT } from "@/lib/product-brand";

const BEATS = [
  {
    k: "01",
    title: "Spot",
    text: "Interim- en ZZP-kansen binnen zodra ze ertoe doen.",
  },
  {
    k: "02",
    title: "Wijs",
    text: "Elke kans gewogen. Opdrachtgever erachter vastgezet.",
  },
  {
    k: "03",
    title: "Plaats",
    text: "Manager, kandidaat, bericht — klaar om te versturen.",
  },
];

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

  const deskHref = "/radar";
  const loginHref = `/login?next=${encodeURIComponent(deskHref)}`;

  return (
    <div className="desk-home desk-home--scout min-h-dvh">
      <SiteNav name={PRODUCT.name} email={email} scout />

      <section className="scout-hero">
        <div className="scout-hero__wash" aria-hidden />
        <div className="scout-hero__grain" aria-hidden />

        <div className="scout-hero__inner">
          <div className="scout-hero__copy">
            <p className="scout-kicker home-reveal">{PRODUCT.category}</p>
            <h1 className="scout-brand home-reveal home-reveal--2">
              <span className="scout-brand__line">Recruitment</span>
              <span className="scout-brand__line scout-brand__line--accent">Scout</span>
            </h1>
            <p className="scout-tagline home-reveal home-reveal--3">{PRODUCT.tagline}</p>
            <div className="scout-cta home-reveal home-reveal--4">
              {email ? (
                <Link href={deskHref} className="scout-btn scout-btn--ink">
                  Open de desk
                </Link>
              ) : (
                <Link href={loginHref} className="scout-btn scout-btn--ink">
                  Inloggen
                </Link>
              )}
              <a href="#werk" className="scout-btn scout-btn--line">
                Hoe het werkt
              </a>
            </div>
          </div>

          <div className="scout-hero__side home-reveal home-reveal--3">
            <HomeOpportunityStage />
          </div>
        </div>
      </section>

      <main>
        <section id="werk" className="scout-work scroll-mt-24">
          <div className="scout-work__head">
            <h2 className="scout-work__title">Minder zoeken. Meer business.</h2>
          </div>

          <ol className="scout-beats">
            {BEATS.map((b, i) => (
              <li
                key={b.k}
                className={`scout-beat home-reveal home-reveal--${Math.min(i + 1, 4)}`}
                style={{ animationDelay: `${0.06 + i * 0.07}s` }}
              >
                <span className="scout-beat__k">{b.k}</span>
                <div>
                  <h3 className="scout-beat__title">{b.title}</h3>
                  <p className="scout-beat__text">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="scout-soon">
          <div className="scout-soon__card home-reveal">
            <span className="scout-soon__badge">Coming soon</span>
            <h2 className="scout-soon__title">Permanent</h2>
            <p className="scout-soon__text">Binnenkort ook voor vaste rollen.</p>
          </div>
        </section>

        <section className="scout-close">
          <div className="scout-close__box">
            <p className="scout-eyebrow">Alleen op uitnodiging</p>
            <h2 className="scout-close__title">Voor teams die geen kans laten liggen.</h2>
            <div className="scout-close__cta">
              {email ? (
                <Link href={deskHref} className="scout-btn scout-btn--ink">
                  Naar de workspace
                </Link>
              ) : (
                <Link href={loginHref} className="scout-btn scout-btn--ink">
                  Inloggen
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="scout-foot">
        <div className="scout-foot__inner">
          <p className="scout-foot__brand">
            <strong>{PRODUCT.name}</strong>
          </p>
          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="scout-foot__product"
          >
            <span className="scout-foot__by">A product by</span>
            <span className="scout-foot__bbb">
              <BlablaLogo className="h-4 w-4" />
              blablabuild
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}
