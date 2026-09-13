"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { HomePlacementTape } from "@/components/home-placement-tape";
import { SiteNav } from "@/components/site-nav";
import { PRODUCT } from "@/lib/product-brand";

const BEATS = [
  {
    k: "01",
    title: "Spot de opdracht",
    text: "Nieuwe interim- en ZZP-kansen komen binnen zodra ze ertoe doen — niet na uren zoeken.",
  },
  {
    k: "02",
    title: "Schat de waarde",
    text: "Elke kans krijgt gewicht. Wat nu telt, wat later mag, wat je laat liggen.",
  },
  {
    k: "03",
    title: "Vind de opdrachtgever",
    text: "Achter een bureau-signaal zit een eindklant. Die zet je vast vóór je iemand belandt.",
  },
  {
    k: "04",
    title: "Zet de plaatsing klaar",
    text: "Manager, kandidaat, bericht — het pad staat. Jij beslist wanneer het de deur uit gaat.",
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
        <div className="scout-hero__rule" aria-hidden />

        <div className="scout-hero__inner">
          <div className="scout-hero__copy">
            <p className="scout-eyebrow home-reveal">{PRODUCT.category}</p>
            <h1 className="scout-brand home-reveal home-reveal--2">{PRODUCT.name}</h1>
            <p className="scout-tagline home-reveal home-reveal--3">{PRODUCT.tagline}</p>
            <p className="scout-lede home-reveal home-reveal--3">{PRODUCT.lede}</p>
            <div className="scout-cta home-reveal home-reveal--4">
              {email ? (
                <Link href={deskHref} className="nav-link scout-btn scout-btn--ink">
                  Open de desk
                </Link>
              ) : (
                <Link href={loginHref} className="nav-link scout-btn scout-btn--ink">
                  Inloggen
                </Link>
              )}
              <a href="#werk" className="nav-link scout-btn scout-btn--line">
                Hoe Scout werkt
              </a>
            </div>
          </div>

          <div className="scout-hero__side home-reveal home-reveal--3">
            <HomePlacementTape />
          </div>
        </div>
      </section>

      <main>
        <section id="werk" className="scout-work scroll-mt-24">
          <div className="scout-work__head">
            <p className="scout-eyebrow">Recruitment, in één lijn</p>
            <h2 className="scout-work__title">Van openstaande opdracht naar geplaatste kandidaat.</h2>
            <p className="scout-work__sub">
              Geen marketplace. Een desk voor wie leeft van interim- en ZZP-plaatsingen.
            </p>
          </div>

          <ol className="scout-beats">
            {BEATS.map((b, i) => (
              <li key={b.k} className={`scout-beat home-reveal home-reveal--${Math.min(i + 1, 4)}`}>
                <span className="scout-beat__k">{b.k}</span>
                <div>
                  <h3 className="scout-beat__title">{b.title}</h3>
                  <p className="scout-beat__text">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="scout-close">
          <div className="scout-close__box">
            <p className="scout-eyebrow">Alleen op uitnodiging</p>
            <h2 className="scout-close__title">Voor recruiters die sneller willen plaatsen.</h2>
            <p className="scout-close__text">
              Scout is geen open platform. Wel een desk die contracting-kansen eerder zichtbaar
              maakt — tot aan het gesprek met manager of kandidaat.
            </p>
            <div className="scout-close__cta">
              {email ? (
                <Link href={deskHref} className="nav-link scout-btn scout-btn--ink">
                  Naar de workspace
                </Link>
              ) : (
                <Link href={loginHref} className="nav-link scout-btn scout-btn--ink">
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
            <span> · {PRODUCT.category}</span>
          </p>
          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="scout-foot__link"
          >
            <BlablaLogo className="h-4 w-4" />
            <span>blablabuild</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
