"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Action = { id: string; title: string; subtitle: string; href: string };

export function TodayRail() {
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    fetch("/api/crm")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { actionQueue?: { id: string; endClient: string; roleLabel: string; nextAction: string; nextHref: string }[] } | null) => {
        if (!j?.actionQueue) return;
        setActions(
          j.actionQueue.slice(0, 6).map((a) => ({
            id: a.id,
            title: a.endClient,
            subtitle: `${a.roleLabel} · ${a.nextAction}`,
            href: a.nextHref,
          }))
        );
      })
      .catch(() => null);
  }, []);

  if (!actions.length) {
    return (
      <Link
        href="/kansen"
        className="today-rail today-rail--empty nav-link hidden items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] px-2.5 py-1.5 no-underline sm:flex"
      >
        <span className="text-[0.72rem] font-semibold text-[var(--muted)]">Geen open actie</span>
      </Link>
    );
  }

  const first = actions[0]!;
  return (
    <Link
      href={first.href}
      className="today-rail nav-link hidden max-w-[16rem] items-center gap-2 rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-soft)]/70 px-2.5 py-1.5 no-underline hover:border-[var(--accent)]/40 sm:flex"
      title={actions.map((a) => `${a.title} — ${a.subtitle}`).join("\n")}
    >
      <span
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--signal)] px-1 text-[0.62rem] font-bold text-[var(--ink)]"
        style={{ fontFamily: "var(--mono)" }}
      >
        {actions.length}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.72rem] font-semibold text-[var(--ink)]">{first.title}</span>
        <span className="block truncate text-[0.65rem] text-[var(--muted)]">{first.subtitle}</span>
      </span>
    </Link>
  );
}
