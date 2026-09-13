"use client";

import { useEffect, useState } from "react";

/** Abstract opportunity field — no product chrome, no named sources. */
export function HomeSignalField() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1800);
    return () => window.clearInterval(id);
  }, []);

  const nodes = [
    { x: 18, y: 28, s: 0.72, delay: 0 },
    { x: 42, y: 18, s: 0.91, delay: 0.4 },
    { x: 68, y: 32, s: 0.64, delay: 0.8 },
    { x: 28, y: 58, s: 0.83, delay: 1.1 },
    { x: 55, y: 62, s: 0.77, delay: 0.2 },
    { x: 78, y: 52, s: 0.88, delay: 0.6 },
    { x: 48, y: 42, s: 0.96, delay: 1.4 },
  ];

  const active = tick % nodes.length;

  return (
    <div className="home-field" aria-hidden>
      <div className="home-field__glow" />
      <div className="home-field__scan" />
      <div className="home-field__ring home-field__ring--a" />
      <div className="home-field__ring home-field__ring--b" />
      <div className="home-field__ring home-field__ring--c" />

      <svg className="home-field__links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M18 28 L42 18 L68 32 M42 18 L48 42 L28 58 M48 42 L55 62 L78 52 M68 32 L78 52"
          fill="none"
          stroke="rgba(235,242,18,0.18)"
          strokeWidth="0.35"
          className="home-field__path"
        />
      </svg>

      {nodes.map((n, i) => (
        <span
          key={i}
          className={`home-field__node ${i === active ? "is-hot" : ""}`}
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            animationDelay: `${n.delay}s`,
            ["--s" as string]: String(n.s),
          }}
        >
          <span className="home-field__dot" />
          <span className="home-field__score">{Math.round(n.s * 100)}</span>
        </span>
      ))}

      <div className="home-field__readout">
        <span className="home-field__label">signal</span>
        <span className="home-field__value" key={active}>
          {Math.round(nodes[active]!.s * 100)}
        </span>
      </div>
    </div>
  );
}
