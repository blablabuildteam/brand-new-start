"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

const ROWS = [
  { co: "NN Group", role: "Business Analyst", score: 72 },
  { co: "Rabobank", role: "Scrum Master", score: 68 },
  { co: "Booking.com", role: "Platform Engineer", score: 64 },
] as const;

const NAV = ["Radar", "Bureaus", "Voorstel"] as const;

export function HeroRadar() {
  const root = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 72, y: 28 });
  const [active, setActive] = useState(0);
  const [nav, setNav] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % ROWS.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [paused]);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }

  return (
    <div
      ref={root}
      onMouseMove={onMove}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="hero-radar relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]"
    >
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-200"
        style={{
          background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(235,242,18,0.28), transparent 55%)`,
        }}
      />

      <div className="relative flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/80 px-3.5 py-2.5 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="ml-2 text-[0.65rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          Radar
        </span>
      </div>

      <div className="relative grid grid-cols-[7.5rem_1fr]">
        <div className="space-y-1 border-r border-[var(--line)] p-3">
          {NAV.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => setNav(i)}
              className={`block w-full rounded-lg px-2 py-1.5 text-left text-[0.68rem] transition ${
                nav === i
                  ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="space-y-2 p-3">
          {ROWS.map((row, i) => {
            const on = active === i;
            return (
              <button
                key={row.co}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition duration-300 ${
                  on
                    ? "translate-x-0.5 border-[var(--accent)]/25 bg-[var(--accent-soft)] shadow-[var(--shadow)]"
                    : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]/20"
                }`}
              >
                <div>
                  <p className="text-[0.72rem] font-semibold text-[var(--ink)]">{row.co}</p>
                  <p className="text-[0.62rem] text-[var(--muted)]">{row.role}</p>
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold transition ${
                    on ? "bg-[var(--signal)] text-[var(--ink)]" : "bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {row.score}
                </span>
              </button>
            );
          })}
          <p className="px-1 pt-1 text-[0.62rem] text-[var(--muted)]">
            Beweeg over de rijen · de score volgt mee
          </p>
        </div>
      </div>
    </div>
  );
}
