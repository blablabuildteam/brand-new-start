"use client";

import Link from "next/link";
import { LOGO_CONCEPTS } from "@/components/scout-logo-pro";

export default function LogoPreviewPage() {
  return (
    <div className="desk-home desk-home--scout logo-pro min-h-dvh">
      <div className="logo-pro__wash" aria-hidden />
      <div className="logo-pro__inner">
        <header className="logo-pro__head">
          <div>
            <p className="scout-eyebrow">Brand studio · ronde 3</p>
            <h1 className="logo-pro__title">Vierentwintig lockups</h1>
            <p className="logo-pro__lead">
              A–X: mastheads, zegels, tickets, sonar, woodtype, hairline luxury. Zeg een letter als die
              live moet.
            </p>
          </div>
          <Link href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </Link>
        </header>

        <div className="logo-pro__grid">
          {LOGO_CONCEPTS.map((c) => (
            <article key={c.letter} className="logo-pro__card">
              <div className="logo-pro__stage">
                <c.Logo className="logo-pro__svg" />
              </div>
              <div className="logo-pro__meta">
                <span className="logo-pro__letter">{c.letter}</span>
                <div>
                  <h2 className="logo-pro__name">{c.name}</h2>
                  <p className="logo-pro__vibe">{c.vibe}</p>
                </div>
              </div>
              <div className="logo-pro__mini" aria-hidden>
                <div className="logo-pro__mini-pill">
                  <c.Logo className="logo-pro__svg logo-pro__svg--mini" />
                </div>
                <span>navbar schaal</span>
              </div>
            </article>
          ))}
        </div>

        <section className="logo-pro__dark">
          <p className="scout-eyebrow scout-eyebrow--on-dark">Op ink · footer / dark UI</p>
          <div className="logo-pro__dark-grid">
            {LOGO_CONCEPTS.map((c) => (
              <div key={`d-${c.letter}`} className="logo-pro__dark-item">
                <c.Logo className="logo-pro__svg logo-pro__svg--on-dark" />
                <span>{c.letter}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
