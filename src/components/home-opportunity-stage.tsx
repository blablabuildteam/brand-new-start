"use client";

import { useEffect, useState } from "react";

const FINDS = [
  { role: "Interim CFO", where: "Fintech · Amsterdam", score: 94 },
  { role: "ZZP Data Lead", where: "Retail · Remote", score: 88 },
  { role: "Interim CISO", where: "Bank · Utrecht", score: 91 },
  { role: "Fractional CTO", where: "Scale-up · NL", score: 86 },
];

/** Lighter radar lock for the hero. */
export function HomeOpportunityStage() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % FINDS.length), 3400);
    return () => window.clearInterval(id);
  }, []);

  const find = FINDS[i]!;

  return (
    <div className="hero-radar hero-radar--lite" aria-hidden>
      <div className="hero-radar__disc">
        <div className="hero-radar__ring hero-radar__ring--1" />
        <div className="hero-radar__ring hero-radar__ring--2" />
        <div className="hero-radar__ring hero-radar__ring--3" />
        <div className="hero-radar__sweep" />
        <div className="hero-radar__core" />
        <div className="hero-radar__blip" key={i} />
      </div>

      <div className="hero-radar__find" key={`f-${i}`}>
        <span className="hero-radar__live">Live</span>
        <p className="hero-radar__role">{find.role}</p>
        <p className="hero-radar__where">{find.where}</p>
        <p className="hero-radar__score">
          <span className="hero-radar__score-band">Warm</span>
          <span className="hero-radar__score-value">
            <strong>{find.score}</strong>
            <span>/98</span>
          </span>
        </p>
      </div>
    </div>
  );
}
