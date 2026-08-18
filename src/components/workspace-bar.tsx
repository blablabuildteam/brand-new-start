"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/", id: "radar", label: "Radar" },
  { href: "/regie", id: "voorstel", label: "Voorstel" },
  { href: "/instellingen", id: "instellingen", label: "Instellingen" },
] as const;

const SUB: Record<(typeof LINKS)[number]["id"], string> = {
  radar: "Radar · contracting",
  voorstel: "Voorstel",
  instellingen: "Instellingen",
};

export function WorkspaceBar({ current }: { current: (typeof LINKS)[number]["id"] }) {
  const [name, setName] = useState("Regie");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { name?: string } | null) => {
        if (j?.name) setName(j.name);
      })
      .catch(() => null);
  }, []);

  return (
    <header className="z-40 shrink-0 border-b border-[var(--line)]/80 bg-[var(--surface)]/95">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3.5 md:px-8">
        <div>
          <p
            className="text-base font-semibold tracking-tight text-[var(--ink)] md:text-lg"
            style={{ fontFamily: "var(--display)" }}
          >
            {name}
          </p>
          <p className="text-[0.72rem] text-[var(--muted)]">{SUB[current]}</p>
        </div>
        <nav className="flex items-center gap-4 text-xs font-semibold">
          {LINKS.filter((l) => l.id !== current).map((l) => (
            <Link key={l.id} href={l.href} className="text-[var(--muted)] no-underline hover:text-[var(--accent)] hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
