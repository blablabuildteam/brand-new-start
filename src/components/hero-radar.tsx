"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

const ROWS = [
  { co: "NN Group", role: "Business Analyst", score: 72 },
  { co: "Rabobank", role: "Scrum Master", score: 68 },
  { co: "Booking.com", role: "Platform Engineer", score: 64 },
] as const;

const NAV: { id: number; label: string; icon: "radar" | "bureaus" | "voorstel" }[] = [
  { id: 0, label: "Radar", icon: "radar" },
  { id: 1, label: "Bureaus", icon: "bureaus" },
  { id: 2, label: "Voorstel", icon: "voorstel" },
];

function NavIcon({ kind, on }: { kind: "radar" | "bureaus" | "voorstel"; on: boolean }) {
  const stroke = on ? "var(--accent)" : "currentColor";
  if (kind === "radar") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke={stroke} strokeWidth="1.3" />
        <path d="M8 8 L13 4" stroke={on ? "#ebf212" : stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "bureaus") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 13V5.5L8 3l5 2.5V13" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 13V8h4v5" stroke={stroke} strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4.5h10v8H5.5L3 14.5V4.5Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 7.5h4M6 10h3" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function HeroRadar() {
  const root = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 72, y: 28 });
  const [active, setActive] = useState(0);
  const [nav, setNav] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || nav !== 0) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % ROWS.length), 2200);
    return () => window.clearInterval(t);
  }, [paused, nav]);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }

  const title = NAV[nav]?.label ?? "Radar";

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
          background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(235,242,18,0.22), transparent 55%)`,
        }}
      />

      <div className="relative flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/80 px-3.5 py-2.5 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--line)]" />
        <span className="ml-2 text-[0.65rem] font-medium text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          {title}
        </span>
      </div>

      <div className="relative grid min-h-[220px] grid-cols-[8rem_1fr]">
        <div className="space-y-1 border-r border-[var(--line)] p-3">
          {NAV.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => setNav(l.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.7rem] transition ${
                nav === l.id
                  ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              }`}
            >
              <NavIcon kind={l.icon} on={nav === l.id} />
              {l.label}
            </button>
          ))}
        </div>

        <div className="p-3">
          {nav === 0 ? (
            <div className="space-y-2">
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
                        ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] shadow-[var(--shadow)]"
                        : "border-[var(--line)] bg-[var(--surface-2)]"
                    }`}
                  >
                    <div>
                      <p className="text-[0.72rem] font-semibold text-[var(--ink)]">{row.co}</p>
                      <p className="text-[0.62rem] text-[var(--muted)]">{row.role}</p>
                    </div>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold ${
                        on ? "bg-[var(--signal)] text-[var(--ink)]" : "bg-[var(--surface)] text-[var(--muted)]"
                      }`}
                      style={{ fontFamily: "var(--mono)" }}
                    >
                      {row.score}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {nav === 1 ? (
            <div className="flex h-full flex-col justify-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.68rem] font-semibold text-[var(--ink)]">
                  Bureau
                </span>
                <span className="text-[var(--muted)]">→</span>
                <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1.5 text-[0.68rem] font-semibold text-[var(--accent)]">
                  Eindklant
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-[72%] rounded-full bg-[var(--line)]/80" />
                <div className="h-2 w-[48%] rounded-full bg-[var(--line)]/55" />
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-[var(--signal)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--ink)]">
                    Review
                  </span>
                  <span className="text-[0.62rem] text-[var(--muted)]">Bewijs eerst, dan manager</span>
                </div>
              </div>
            </div>
          ) : null}

          {nav === 2 ? (
            <div className="flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--muted)]">Concept</p>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-[88%] rounded-full bg-[var(--line)]" />
                <div className="h-2 w-[70%] rounded-full bg-[var(--line)]/70" />
                <div className="h-2 w-[76%] rounded-full bg-[var(--line)]/55" />
                <div className="h-2 w-[42%] rounded-full bg-[var(--line)]/40" />
              </div>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-[0.62rem] text-[var(--muted)]">Jij verstuurt</span>
                <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[0.62rem] font-semibold text-white">
                  Klaar
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
