"use client";

import {
  CONCEPT_MARKS,
  type ConceptId,
} from "@/components/scout-logo-concepts";

type WordStyle =
  | "stack-sans"
  | "stack-serif"
  | "solo-display"
  | "slash-condensed"
  | "badge-inline"
  | "editorial"
  | "mono-tag"
  | "heavy-one"
  | "type-only";

type Concept = {
  letter: string;
  id: ConceptId;
  name: string;
  vibe: string;
  word: WordStyle;
};

const CONCEPTS: Concept[] = [
  {
    letter: "A",
    id: "radar",
    name: "Radar",
    vibe: "Huidige mark — baseline om tegen af te zetten",
    word: "stack-sans",
  },
  {
    letter: "B",
    id: "monogram",
    name: "Monogram RS",
    vibe: "Lettermerk zoals bureau-identiteit — geen icoon-cliché",
    word: "slash-condensed",
  },
  {
    letter: "C",
    id: "scope",
    name: "Scope",
    vibe: "Optisch vizier — gericht zoeken, scherp",
    word: "solo-display",
  },
  {
    letter: "D",
    id: "ping",
    name: "Ping",
    vibe: "Alleen ringen, geen tile — luchtig en modern",
    word: "stack-sans",
  },
  {
    letter: "E",
    id: "compass",
    name: "Compass",
    vibe: "Richting / navigatie — ronder, vriendelijker",
    word: "editorial",
  },
  {
    letter: "F",
    id: "signal",
    name: "Signal",
    vibe: "Signaalsterkte — tech/product zonder radar",
    word: "mono-tag",
  },
  {
    letter: "G",
    id: "route",
    name: "Route S",
    vibe: "Pad naar een hit — trail op donkere tile",
    word: "heavy-one",
  },
  {
    letter: "H",
    id: "stamp",
    name: "Stamp",
    vibe: "Zegel / seal — merk als stempel, geen app-icoon",
    word: "badge-inline",
  },
  {
    letter: "I",
    id: "lenses",
    name: "Lenses",
    vibe: "Verrekijker — letterlijk scouting",
    word: "stack-serif",
  },
  {
    letter: "J",
    id: "grid",
    name: "Grid hit",
    vibe: "Kaartcel die oplicht — desk / pipeline feel",
    word: "slash-condensed",
  },
  {
    letter: "K",
    id: "needle",
    name: "Needle",
    vibe: "Noordpijl / find — simpel silhouet",
    word: "solo-display",
  },
  {
    letter: "L",
    id: "ink",
    name: "Ink disc",
    vibe: "Zwarte schijf — sterker contrast in nav",
    word: "stack-sans",
  },
  {
    letter: "M",
    id: "pennant",
    name: "Pennant",
    vibe: "Vlag / claim — agency-achtig",
    word: "editorial",
  },
  {
    letter: "N",
    id: "diamond",
    name: "Diamond",
    vibe: "Kans als gem — geometrisch, premium",
    word: "heavy-one",
  },
  {
    letter: "O",
    id: "type",
    name: "Type only",
    vibe: "Geen mark — alleen typografie als logo",
    word: "type-only",
  },
];

function Wordmark({ style }: { style: WordStyle }) {
  if (style === "stack-sans") {
    return (
      <span className="lc-word lc-word--stack" style={{ fontFamily: "Sora, sans-serif" }}>
        <span className="lc-word__k">Recruitment</span>
        <span className="lc-word__h">Scout</span>
      </span>
    );
  }
  if (style === "stack-serif") {
    return (
      <span className="lc-word lc-word--stack" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
        <span className="lc-word__k lc-word__k--serif">Recruitment</span>
        <span className="lc-word__h lc-word__h--serif">Scout</span>
      </span>
    );
  }
  if (style === "solo-display") {
    return (
      <span className="lc-word lc-word--solo" style={{ fontFamily: "Syne, sans-serif" }}>
        Scout
      </span>
    );
  }
  if (style === "slash-condensed") {
    return (
      <span className="lc-word lc-word--slash" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
        RECRUITMENT <i>/</i> SCOUT
      </span>
    );
  }
  if (style === "badge-inline") {
    return (
      <span className="lc-word lc-word--badge" style={{ fontFamily: "Manrope, sans-serif" }}>
        Recruitment Scout
      </span>
    );
  }
  if (style === "editorial") {
    return (
      <span className="lc-word lc-word--edit" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
        <em>Recruitment</em>
        <strong>Scout</strong>
      </span>
    );
  }
  if (style === "mono-tag") {
    return (
      <span className="lc-word lc-word--mono" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
        scout<span>·</span>desk
      </span>
    );
  }
  if (style === "heavy-one") {
    return (
      <span className="lc-word lc-word--heavy" style={{ fontFamily: "Archivo Black, sans-serif" }}>
        SCOUT
      </span>
    );
  }
  return (
    <span className="lc-word lc-word--typeonly">
      <span className="lc-word__type-a" style={{ fontFamily: "Syne, sans-serif" }}>
        Recruitment
      </span>
      <span className="lc-word__type-b" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
        Scout
      </span>
    </span>
  );
}

function ConceptLockup({ concept }: { concept: Concept }) {
  const Mark = concept.id === "type" ? null : CONCEPT_MARKS[concept.id];

  return (
    <span className={`lc-lockup ${concept.id === "type" ? "lc-lockup--type" : ""}`}>
      {Mark ? <span className="lc-lockup__mark">{Mark()}</span> : null}
      <Wordmark style={concept.word} />
    </span>
  );
}

export default function LogoPreviewPage() {
  return (
    <div className="desk-home desk-home--scout logo-lab min-h-dvh">
      <div className="logo-lab__inner">
        <header className="logo-lab__head">
          <div>
            <p className="scout-eyebrow">Logo lab · ronde 2</p>
            <h1 className="logo-lab__title">Echt andere merken</h1>
            <p className="logo-lab__lead">
              Geen font-wissel op dezelfde radar. Vijftien concepten met andere marks, silhouetten
              en typografie. Zeg een letter (A–O) als je er één wilt als site-logo.
            </p>
          </div>
          <a href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </a>
        </header>

        <section className="logo-lab__section">
          <p className="scout-eyebrow">Navbar mock · alle richtingen</p>
          <div className="logo-lab__nav-list">
            {CONCEPTS.map((c) => (
              <article key={c.letter} className="logo-lab__nav-row">
                <div className="logo-lab__pill">
                  <ConceptLockup concept={c} />
                </div>
                <div className="logo-lab__meta">
                  <span className="logo-lab__letter">{c.letter}</span>
                  <div>
                    <p className="logo-lab__name">{c.name}</p>
                    <p className="logo-lab__vibe">{c.vibe}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="logo-lab__section">
          <p className="scout-eyebrow">Grote tiles · mark op zichzelf</p>
          <div className="logo-lab__tiles">
            {CONCEPTS.filter((c) => c.id !== "type").map((c) => {
              const Mark = CONCEPT_MARKS[c.id as Exclude<ConceptId, "type">];
              return (
                <article key={c.letter} className="logo-lab__tile">
                  <div className="logo-lab__tile-mark">
                    <Mark />
                  </div>
                  <p className="logo-lab__tile-id">
                    {c.letter} · {c.name}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="logo-lab__section logo-lab__section--dark">
          <p className="scout-eyebrow scout-eyebrow--on-dark">Op donker · favicon / footer check</p>
          <div className="logo-lab__dark-row">
            {CONCEPTS.slice(0, 8).map((c) => (
              <div key={c.letter} className="logo-lab__dark-item">
                <ConceptLockup concept={c} />
                <span>{c.letter}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
