"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Alert = {
  id: string;
  at: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
};

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const unread = alerts.filter((a) => !a.read).length;

  function load() {
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { alerts?: Alert[] } | null) => {
        if (j?.alerts) setAlerts(j.alerts);
      })
      .catch(() => null);
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, []);

  async function markAll() {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      const j = (await res.json()) as { alerts?: Alert[] };
      if (j.alerts) setAlerts(j.alerts);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-ghost btn-tool relative !min-h-9 !px-2.5"
        aria-label="Alerts"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        Alerts
        {unread ? (
          <span
            className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--signal)] px-1 text-[0.62rem] font-bold text-[var(--ink)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
            <p className="ws-label">Meldingen</p>
            {unread ? (
              <button type="button" className="text-[0.7rem] font-semibold text-[var(--accent)]" onClick={() => void markAll()}>
                Alles gelezen
              </button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {!alerts.length ? (
              <li className="px-3 py-4 text-sm text-[var(--muted)]">Nog geen alerts. Bevestig een kans of draai extract.</li>
            ) : (
              alerts.slice(0, 12).map((a) => (
                <li key={a.id} className={`border-b border-[var(--line)]/70 px-3 py-2.5 ${a.read ? "opacity-70" : ""}`}>
                  {a.href ? (
                    <Link href={a.href} className="block no-underline" onClick={() => setOpen(false)}>
                      <p className="text-sm font-semibold text-[var(--ink)]">{a.title}</p>
                      <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">{a.body}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-[var(--ink)]">{a.title}</p>
                      <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">{a.body}</p>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
