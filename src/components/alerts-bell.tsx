"use client";

import { useEffect, useRef, useState } from "react";
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
  const box = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div className="relative" ref={box}>
      <button
        type="button"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
        aria-label={unread ? `${unread} alerts` : "Alerts"}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2.2L3.2 10.8h9.6L11.5 8.2V6A3.5 3.5 0 0 0 8 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread ? (
          <span
            className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--signal)] px-1 text-[0.58rem] font-bold leading-4 text-[var(--ink)]"
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
