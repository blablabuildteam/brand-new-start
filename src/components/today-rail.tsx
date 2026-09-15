"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Compact next-action chip — never steals the topbar. */
export function TodayRail() {
  const [n, setN] = useState(0);
  const [href, setHref] = useState("/kansen");

  useEffect(() => {
    fetch("/api/crm")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { actionQueue?: { nextHref: string }[] } | null) => {
        const q = j?.actionQueue || [];
        setN(q.length);
        if (q[0]?.nextHref) setHref(q[0].nextHref);
      })
      .catch(() => null);
  }, []);

  return (
    <Link
      href={href}
      className="today-rail nav-link hidden shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 no-underline xl:inline-flex"
      title={n ? `${n} open acties` : "Geen open actie"}
    >
      {n ? (
        <span
          className="inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--signal)] px-1 text-[0.6rem] font-bold leading-4 text-[var(--ink)]"
          style={{ fontFamily: "var(--mono)" }}
        >
          {n}
        </span>
      ) : null}
      <span className="text-[0.72rem] font-semibold text-[var(--ink)]/80">
        {n ? "Acties" : "Acties"}
      </span>
    </Link>
  );
}
