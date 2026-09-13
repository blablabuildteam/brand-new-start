"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeOpportunityStage } from "@/components/home-opportunity-stage";
import { ScoutWordmark } from "@/components/scout-mark";
import { SiteNav } from "@/components/site-nav";
import { PRODUCT } from "@/lib/product-brand";

const BEATS = [
  {
    k: "01",
    title: "Spotten",
    text: "Nieuwe interim- en ZZP-opdrachten komen binnen zodra ze ertoe doen.",
  },
  {
    k: "02",
    title: "Wegen",
    text: "Elke kans krijgt een score. De opdrachtgever erachter zet je vast.",
  },
  {
    k: "03",
    title: "Plaatsen",
    text: "Manager, kandidaat en bericht staan klaar. Jij stuurt wanneer het past.",
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
        <div className="scout-hero__mesh" aria-hidden />
        <div className="scout-hero__grain" aria-hidden />

        <div className="scout-hero__inner">
          <div className="scout-hero__copy">
            <p className="scout-kicker home-reveal">{PRODUCT.category}</p>
            <h1 className="scout-brand home-reveal home-reveal--2">
              <span className="scout-brand__soft">Recruitment</span>
              <span className="scout-brand__hard">Scout</span>
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

          <div className="scout-hero__stage home-reveal home-reveal--3">
            <HomeOpportunityStage />
          </div>
        </div>
      </section>

      <main>
        <section id="werk" className="scout-work scroll-mt-28">
          <div className="scout-work__head">
            <p className="scout-eyebrow">Hoe het werkt</p>
            <h2 className="scout-work__title">Drie stappen. Klaar om te handelen.</h2>
          </div>

          <ol className="scout-beats">
            {BEATS.map((b, i) => (
              <li
                key={b.k}
                className={`scout-beat home-reveal home-reveal--${Math.min(i + 1, 4)}`}
                style={{ animationDelay: `${0.06 + i * 0.07}s` }}
              >
                <span className="scout-beat__k">{b.k}</span>
                <h3 className="scout-beat__title">{b.title}</h3>
                <p className="scout-beat__text">{b.text}</p>
              </li>
            ))}
          </ol>

          <p className="scout-soon-line home-reveal">
            <span>Coming soon</span>
            <strong>Permanent</strong>
            <em>— ook voor vaste rollen</em>
          </p>
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
          <Link href="/" className="scout-foot__logo" aria-label={`${PRODUCT.name} home`}>
            <ScoutWordmark name={PRODUCT.name} />
          </Link>
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
