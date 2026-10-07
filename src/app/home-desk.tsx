"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeOpportunityStage } from "@/components/home-opportunity-stage";
import { ScoutWordmark } from "@/components/scout-mark";
import { SiteNav } from "@/components/site-nav";
import { WaitlistForm } from "@/components/waitlist-form";
import { PRODUCT } from "@/lib/product-brand";

const STEPS = [
  {
    n: "01",
    title: "Jobboards",
    text: "Vacatures die de eindklant zelf uitzet. LinkedIn, Indeed en Freelance.nl. Geen bureau ertussen.",
  },
  {
    n: "02",
    title: "Recruiter feed",
    text: "Posts van kantoren die je volgt. De opdrachtgever, ook als de naam niet in de post staat.",
  },
  {
    n: "03",
    title: "Kansen",
    text: "Eindklant bevestigd. Dan de hiring manager, het mailadres en het telefoonnummer.",
  },
  {
    n: "04",
    title: "Bericht",
    text: "Manager, mail/tel en bericht klaar. Jij verstuurt.",
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

  const deskHref = "/radar";

  return (
    <div className="desk-home desk-home--scout min-h-dvh">
      <SiteNav name={PRODUCT.name} email={email} scout />

      <section className="scout-hero">
        <div className="scout-hero__inner scout-hero__inner--radar">
          <div className="scout-hero__canvas home-reveal">
            <div className="scout-hero__stage">
              <HomeOpportunityStage />
            </div>
          </div>
          <div className="scout-hero__aside home-reveal home-reveal--2">
            <h1>Nooit meer handmatig zoeken naar opdrachtkansen bij bedrijven.</h1>
            <p>
              Onze Scout weet precies wanneer er een bepaalde personeelsbehoefte is en signaleert deze
              automatisch op basis van een groot aantal signalen.
            </p>
          </div>
        </div>
      </section>

      <main>
        <section id="werk" className="scout-path scroll-mt-28">
          <div className="scout-path__intro">
            <p className="scout-path__kicker">De desk</p>
            <h2>Van sein naar gesprek</h2>
            <p>
              Scout ziet dat een bedrijf iemand nodig heeft. Jij ziet de eindklant, de manager en de
              tekst.
            </p>
          </div>
          <ol>
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="scout-path__n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
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
            <p className="scout-soon-block__text">Ook vaste functies. Zelfde bureau, andere opdracht.</p>
          </div>
        </section>

        <section className="scout-invite" aria-labelledby="invite-title">
          <div className="scout-invite__inner scout-invite__inner--split">
            <div className="scout-invite__copy">
              <p className="scout-eyebrow scout-eyebrow--on-dark">Alleen op uitnodiging</p>
              <h2 id="invite-title" className="scout-invite__title">
                Voor bureaus die de opdracht niet missen.
              </h2>
              <p className="scout-invite__text">
                Geen marketplace. Wel de eindklant, eerder dan de rest.
              </p>
              {email ? (
                <div className="scout-invite__cta">
                  <Link href={deskHref} className="scout-btn scout-btn--signal">
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
        <div className="scout-foot__inner scout-foot__inner--apollo">
          <div className="scout-foot__brand">
            <ScoutWordmark tone="ink" lockup="scout" font="manrope" />
          </div>
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
