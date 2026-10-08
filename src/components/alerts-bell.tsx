"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Sync-digest alerts die ouder zijn dan dit worden stilletjes doorgestreept — ze zijn geen actie meer. */
const SYNC_STALE_H = 18;

function isSync(a: Alert) {
  return a.kind === "sync";
}

/** Actionable eerst; sync-digests zijn nieuws. */
function priority(a: Alert) {
  if (a.kind === "watchlist") return 0;
  if (a.kind === "confirm") return 1;
  if (a.kind === "hm") return 2;
  if (a.kind === "info") return 3;
  if (a.kind === "sync") return 4;
  return 5;
}

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showSync, setShowSync] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const dp = priority(a) - priority(b);
        if (dp !== 0) return dp;
        return b.at.localeCompare(a.at);
      }),
    [alerts]
  );

  const watchlist = sorted.filter((a) => a.kind === "watchlist");
  const actionable = sorted.filter((a) => !isSync(a) && a.kind !== "watchlist");
  const syncs = sorted.filter(isSync);
  const unreadSyncs = syncs.filter((a) => !a.read).length;
  const unreadWatch = watchlist.filter((a) => !a.read).length;
  /**
   * De badge telt alle ongelezen alerts; oude sync-digests worden door de
   * sweep-effect hieronder stilletjes op gelezen gezet, dus deze teller zakt
   * vanzelf terug naar de echt-nieuwe + actionable.
   */
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

  /** Stilletjes oude sync-digests opruimen zodat de bel niet dagen op 20+ staat. */
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current || !alerts.length) return;
    const cutoff = Date.now() - SYNC_STALE_H * 3600_000;
    const stale = alerts.filter(
      (a) => !a.read && isSync(a) && new Date(a.at).getTime() < cutoff
    );
    if (!stale.length) return;
    sweptRef.current = true;
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: stale.map((a) => a.id) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { alerts?: Alert[] } | null) => {
        if (j?.alerts) setAlerts(j.alerts);
      })
      .catch(() => null);
  }, [alerts]);

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

  async function markSyncRead() {
    const ids = syncs.filter((a) => !a.read).map((a) => a.id);
    if (!ids.length) return;
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      const j = (await res.json()) as { alerts?: Alert[] };
      if (j.alerts) setAlerts(j.alerts);
    }
  }

  function renderAlert(a: Alert) {
    return (
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
    );
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
            <Link
              href="/alerts"
              className="ws-label no-underline hover:text-[var(--ink)]"
              onClick={() => setOpen(false)}
            >
              Meldingen
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/alerts"
                className="text-[0.7rem] font-semibold text-[var(--muted)] no-underline hover:text-[var(--ink)]"
                onClick={() => setOpen(false)}
              >
                Alles
              </Link>
              {unread ? (
                <button
                  type="button"
                  className="text-[0.7rem] font-semibold text-[var(--accent)]"
                  onClick={() => void markAll()}
                >
                  Gelezen
                </button>
              ) : null}
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {!alerts.length ? (
              <li className="px-3 py-4 text-sm text-[var(--muted)]">Nog geen alerts. Bevestig een kans of draai extract.</li>
            ) : (
              <>
                {watchlist.length ? (
                  <li className="border-b border-[var(--line)]/70 px-3 py-2.5">
                    <Link href="/alerts?filter=watchlist" className="block no-underline" onClick={() => setOpen(false)}>
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        Watchlist · {watchlist.length}
                        {unreadWatch ? ` · ${unreadWatch} nieuw` : ""}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                        {watchlist[0]?.title}
                        {watchlist.length > 1 ? ` · +${watchlist.length - 1} meer` : ""}
                      </p>
                    </Link>
                  </li>
                ) : null}
                {actionable.slice(0, 8).map(renderAlert)}
                {syncs.length ? (
                  <li className="flex items-center gap-2 border-b border-[var(--line)]/70 bg-[var(--surface-2)]/50 px-3 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                      onClick={() => setShowSync((v) => !v)}
                      aria-expanded={showSync}
                    >
                      <span className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Sync-digests · {syncs.length}
                        {unreadSyncs ? ` · ${unreadSyncs} nieuw` : ""}
                      </span>
                      <span className="text-[0.7rem] text-[var(--muted)]" aria-hidden>
                        {showSync ? "▴" : "▾"}
                      </span>
                    </button>
                    {unreadSyncs ? (
                      <button
                        type="button"
                        className="shrink-0 text-[0.7rem] font-semibold text-[var(--accent)] hover:underline"
                        onClick={() => void markSyncRead()}
                      >
                        Markeer gelezen
                      </button>
                    ) : null}
                  </li>
                ) : null}
                {showSync ? syncs.slice(0, 10).map(renderAlert) : null}
                {!actionable.length && !syncs.length ? (
                  <li className="px-3 py-4 text-sm text-[var(--muted)]">Niets dat je aandacht vraagt.</li>
                ) : null}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
