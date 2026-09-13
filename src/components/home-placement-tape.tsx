"use client";

import { useEffect, useState } from "react";

const TICKS = [
  { a: "Opdracht gespot", b: "nieuw · vandaag" },
  { a: "Opdrachtgever bevestigd", b: "eindklant vast" },
  { a: "Hiring manager in beeld", b: "klaar om te benaderen" },
  { a: "Kandidaat gematcht", b: "bericht klaar" },
  { a: "Plaatsing in beweging", b: "jij houdt de knop" },
];

/** Quiet placement tape — recruitment language, no product chrome. */
export function HomePlacementTape() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % TICKS.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  const cur = TICKS[i]!;

  return (
    <div className="home-tape" aria-hidden>
      <div className="home-tape__rail">
        {TICKS.map((t, idx) => (
          <div key={t.a} className={`home-tape__row ${idx === i ? "is-on" : ""}`}>
            <span className="home-tape__dot" />
            <span className="home-tape__a">{t.a}</span>
            <span className="home-tape__b">{t.b}</span>
          </div>
        ))}
      </div>
      <div className="home-tape__focus" key={i}>
        <p className="home-tape__focus-a">{cur.a}</p>
        <p className="home-tape__focus-b">{cur.b}</p>
      </div>
    </div>
  );
}
