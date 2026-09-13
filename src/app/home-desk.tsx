"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeOpportunityStage } from "@/components/home-opportunity-stage";
import { ScoutBeatVisual } from "@/components/scout-beat-visual";
import { ScoutWordmark } from "@/components/scout-mark";
import { SiteNav } from "@/components/site-nav";
import { WaitlistForm } from "@/components/waitlist-form";
import { PRODUCT } from "@/lib/product-brand";

const BEATS = [
  {
    k: "01",
    kind: "spot" as const,
    title: "Spotten",
    text: "Nieuwe interim- en ZZP-opdrachten komen binnen zodra ze ertoe doen.",
  },
  {
    k: "02",
    kind: "weigh" as const,
    title: "Wegen",
    text: "Elke kans krijgt een score. De opdrachtgever erachter zet je vast.",
  },
  {
    k: "03",
    kind: "place" as const,
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
        <div className="scout-hero__grain" aria-hidden />

        <div className="scout-hero__inner">
          <div className="scout-hero__copy">
            <p className="scout-kicker home-reveal">{PRODUCT.category}</p>
            <h1 className="scout-brand home-reveal home-reveal--2">
              <span className="scout-brand__a">Recruitment</span>
              <span className="scout-brand__b">Scout</span>
            </h1>
            <p className="scout-tagline home-reveal home-reveal--3">{PRODUCT.tagline}</p>
            <div className="scout-cta home-reveal home-reveal--4">
              {email ? (
                <Link href={deskHref} className="scout-btn scout-btn--ink">
                  Open de desk
                </Link>
              ) : (
                <a href="#werk" className="scout-btn scout-btn--ink">
                  Hoe het werkt
                </a>
              )}
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
                <ScoutBeatVisual kind={b.kind} />
                <div className="scout-beat__body">
                  <span className="scout-beat__k">{b.k}</span>
                  <h3 className="scout-beat__title">{b.title}</h3>
                  <p className="scout-beat__text">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="scout-soon-block" aria-labelledby="soon-title">
          <div className="scout-soon-block__inner">
            <p className="scout-soon-block__badge">Coming soon</p>
            <h2 id="soon-title" className="scout-soon-block__title">
              Permanent
            </h2>
            <p className="scout-soon-block__text">Ook voor vaste rollen — zelfde desk, bredere pipeline.</p>
          </div>
        </section>

        <section className="scout-invite" aria-labelledby="invite-title">
          <div className="scout-invite__inner scout-invite__inner--split">
            <div className="scout-invite__copy">
              <p className="scout-eyebrow scout-eyebrow--on-dark">Alleen op uitnodiging</p>
              <h2 id="invite-title" className="scout-invite__title">
                Voor teams die geen kans laten liggen.
              </h2>
              <p className="scout-invite__text">
                Private desk voor recruitmentbureaus. Geen marketplace — wel opdrachtkansen spotten
                en opvolgen. Laat je gegevens achter; we melden ons als er plek is.
              </p>
              {email ? (
                <div className="scout-invite__cta">
                  <Link href={deskHref} className="scout-btn scout-btn--light">
                    Naar de workspace
                  </Link>
                </div>
              ) : null}
            </div>
            {!email ? (
              <div className="scout-invite__form">
                <p className="scout-invite__form-label">Wachtlijst</p>
                <WaitlistForm dark />
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="scout-foot">
        <div className="scout-foot__inner">
          <Link href="/" className="scout-foot__logo" aria-label={`${PRODUCT.name} home`}>
            <ScoutWordmark name={PRODUCT.name} tone="light" />
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
