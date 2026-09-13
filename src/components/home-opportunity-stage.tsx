"use client";

import { useEffect, useState } from "react";

const FINDS = [
  { role: "Interim CFO", where: "fintech · Amsterdam", score: 94 },
  { role: "ZZP Data Lead", where: "retail · remote", score: 88 },
  { role: "Interim CISO", where: "bank · Utrecht", score: 91 },
  { role: "Fractional CTO", where: "scale-up · NL", score: 86 },
];

/** Large scope that locks onto one clear opportunity — readable story. */
export function HomeOpportunityStage() {
  const [i, setI] = useState(0);
  const [locking, setLocking] = useState(true);

  useEffect(() => {
    const cycle = window.setInterval(() => {
      setLocking(false);
      window.setTimeout(() => {
        setI((n) => (n + 1) % FINDS.length);
        setLocking(true);
      }, 280);
    }, 3200);
    return () => window.clearInterval(cycle);
  }, []);

  const find = FINDS[i]!;

  return (
    <div className={`scope-stage ${locking ? "is-lock" : ""}`} aria-hidden>
      <div className="scope-stage__field">
        <div className="scope-stage__ring scope-stage__ring--outer" />
        <div className="scope-stage__ring scope-stage__ring--mid" />
        <div className="scope-stage__ring scope-stage__ring--inner" />
        <div className="scope-stage__sweep" />
        <div className="scope-stage__crosshair" />
        <div className="scope-stage__core" />
        <div className="scope-stage__ping" />
      </div>

      <div className="scope-stage__card" key={i}>
        <p className="scope-stage__label">Opdracht gespot</p>
        <p className="scope-stage__role">{find.role}</p>
        <div className="scope-stage__meta">
          <span>{find.where}</span>
          <span className="scope-stage__score">{find.score}</span>
        </div>
      </div>
    </div>
  );
}
