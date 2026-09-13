"use client";

import { useEffect, useState } from "react";

const TICKS = [
  { a: "Opdracht gespot", b: "nieuw" },
  { a: "Opdrachtgever vast", b: "eindklant" },
  { a: "Manager in beeld", b: "benaderen" },
  { a: "Kandidaat klaar", b: "bericht" },
  { a: "Plaatsing loopt", b: "jij stuurt" },
];

const NODES = [
  { x: 16, y: 22, label: "82" },
  { x: 48, y: 14, label: "91" },
  { x: 78, y: 28, label: "74" },
  { x: 28, y: 55, label: "88" },
  { x: 62, y: 58, label: "95" },
  { x: 84, y: 68, label: "79" },
];

/** Animated opportunity field — cool motion, no method spoilers. */
export function HomeOpportunityStage() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % TICKS.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  const cur = TICKS[i]!;
  const hot = i % NODES.length;

  return (
    <div className="opp-stage" aria-hidden>
      <div className="opp-stage__glow" />
      <div className="opp-stage__scan" />
      <div className="opp-stage__ring opp-stage__ring--a" />
      <div className="opp-stage__ring opp-stage__ring--b" />
      <div className="opp-stage__ring opp-stage__ring--c" />

      <svg className="opp-stage__links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          className="opp-stage__path"
          d="M16 22 L48 14 L78 28 M48 14 L62 58 L28 55 M62 58 L84 68 M28 55 L16 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
        />
      </svg>

      {NODES.map((n, idx) => (
        <span
          key={n.label}
          className={`opp-stage__node ${idx === hot ? "is-hot" : ""}`}
          style={{ left: `${n.x}%`, top: `${n.y}%`, animationDelay: `${idx * 0.25}s` }}
        >
          <span className="opp-stage__dot" />
          <span className="opp-stage__score">{n.label}</span>
        </span>
      ))}

      <div className="opp-stage__ticker" key={i}>
        <span className="opp-stage__ticker-a">{cur.a}</span>
        <span className="opp-stage__ticker-b">{cur.b}</span>
      </div>
    </div>
  );
}
