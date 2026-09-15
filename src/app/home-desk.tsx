"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomeOpportunityStage } from "@/components/home-opportunity-stage";
import { ScoutMark } from "@/components/scout-mark";
import { SiteNav } from "@/components/site-nav";
import { WaitlistForm } from "@/components/waitlist-form";
import { PRODUCT } from "@/lib/product-brand";

const FEATURES = [
  {
    title: "Direct",
    text: "Jobboard-radar: vacatures bij eindklanten, gescoord op versheid en signalen.",
    icon: "radar",
  },
  {
    title: "Via bureau",
    text: "Bureau-radar: recruiter-feeds in, eindklant bevestigen, daarna hiring manager.",
    icon: "bureaus",
  },
  {
    title: "Kansen",
    text: "Eén lijst met volgende actie — geen losse notities of spreadsheet.",
    icon: "kansen",
  },
  {
    title: "Voorstel",
    text: "Bericht klaarzetten voor manager of kandidaat. Jij stuurt zelf.",
    icon: "voorstel",
  },
] as const;

const FAQ = [
  {
    q: "Voor wie is Scout?",
    a: "Voor recruitmentbureaus die interim- en ZZP-opdrachten sneller willen spotten en opvolgen — zonder marketplace-ruis.",
  },
  {
    q: "Werkt sync automatisch?",
    a: "Nee. Je start syncs bewust (advies ~1× per dag). Zo houd je credits en focus onder controle.",
  },
  {
    q: "Vervangt dit ons CRM?",
    a: "Nee. Scout is de desk vóór plaatsing: jobboards, bureau-feeds, kansen en voorstel. Bench koppel je aan jullie echte kandidaten.",
  },
];

function FeatureIcon({ kind }: { kind: (typeof FEATURES)[number]["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 16 16", fill: "none" as const };
  if (kind === "radar") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 8 L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "bureaus") {
    return (
      <svg {...common} aria-hidden>
        <path d="M3 13V5.5L8 3l5 2.5V13" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 13V8h4v5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "kansen") {
    return (
      <svg {...common} aria-hidden>
        <path d="M3 12.5V5l5-2.5L13 5v7.5l-5 2.5L3 12.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 5v10" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M3 4.5h10v8H5.5L3 14.5V4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 7.5h4M6 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

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

      <section className="scout-hero scout-hero--center">
        <div className="scout-hero__inner scout-hero__inner--center">
          <p className="scout-kicker home-reveal">{PRODUCT.category}</p>
          <h1 className="scout-headline scout-headline--center home-reveal home-reveal--2">
            De AI-desk voor
            <span className="scout-headline__break">opdrachtkansen</span>
          </h1>
          <p className="scout-tagline scout-tagline--center home-reveal home-reveal--3">
            Spotten, wegen en plaatsen — van board-hit tot voorstel, zonder ruis.
          </p>
          <div className="scout-cta scout-cta--center home-reveal home-reveal--4">
            {email ? (
              <Link href={deskHref} className="scout-btn scout-btn--signal">
                Open de desk
              </Link>
            ) : (
              <>
                <Link href={loginHref} className="scout-btn scout-btn--signal">
                  Inloggen
                </Link>
                <a href="#werk" className="scout-btn scout-btn--ghost">
                  Hoe het werkt
                </a>
              </>
            )}
          </div>

          <div className="scout-hero__canvas home-reveal home-reveal--4">
            <div className="scout-hero__stage">
              <HomeOpportunityStage />
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="scout-proof">
          <p className="scout-proof__label">Gebouwd voor contracting-desks</p>
          <ul className="scout-proof__stats">
            <li>
              <strong>4</strong>
              <span>stappen tot voorstel</span>
            </li>
            <li>
              <strong>98</strong>
              <span>max. kans-score</span>
            </li>
            <li>
              <strong>1×</strong>
              <span>sync per dag (advies)</span>
            </li>
          </ul>
        </section>

        <section id="werk" className="scout-work scout-work--air scroll-mt-28">
          <div className="scout-work__head scout-work__head--center">
            <h2 className="scout-work__title scout-work__title--center">
              Alles wat je nodig hebt om kansen af te handelen
            </h2>
            <p className="scout-work__lead">
              Geen losse tools. Eén desk: Direct, Via bureau, Kansen en Voorstel.
            </p>
          </div>

          <ul className="scout-features">
            {FEATURES.map((f) => (
              <li key={f.title} className="scout-feature">
                <span className="scout-feature__icon">
                  <FeatureIcon kind={f.icon} />
                </span>
                <h3 className="scout-feature__title">{f.title}</h3>
                <p className="scout-feature__text">{f.text}</p>
              </li>
            ))}
          </ul>
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

        <section className="scout-faq" aria-labelledby="faq-title">
          <div className="scout-faq__inner">
            <h2 id="faq-title" className="scout-faq__title">
              Veelgestelde vragen
            </h2>
            <div className="scout-faq__list">
              {FAQ.map((item) => (
                <details key={item.q} className="scout-faq__item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
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
                en opvolgen.
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
            <ScoutMark className="h-14 w-14" tone="ink" animated={false} />
            <p className="scout-foot__name">{PRODUCT.name}</p>
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
