"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type Alert = {
  id: string;
  at: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
};

const KIND_NL: Record<string, string> = {
  confirm: "Bevestigen",
  hm: "Manager",
  hot: "Kans",
  info: "Info",
  sync: "Sync",
  watchlist: "Watchlist",
};

function kindLabel(kind: string) {
  return KIND_NL[kind] || kind;
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} u geleden`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} d geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function priority(a: Alert) {
  if (a.kind === "watchlist") return 0;
  if (a.kind === "confirm") return 1;
  if (a.kind === "hm") return 2;
  if (a.kind === "hot") return 3;
  if (a.kind === "info") return 4;
  if (a.kind === "sync") return 5;
  return 6;
}

export default function AlertsDesk() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "watchlist" | "sync">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/alerts");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const j = (await res.json()) as { alerts?: Alert[] };
    setAlerts(j.alerts || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const dp = priority(a) - priority(b);
        if (dp !== 0) return dp;
        return b.at.localeCompare(a.at);
      }),
    [alerts]
  );

  const visible = useMemo(() => {
    if (filter === "unread") return sorted.filter((a) => !a.read);
    if (filter === "watchlist") return sorted.filter((a) => a.kind === "watchlist");
    if (filter === "sync") return sorted.filter((a) => a.kind === "sync");
    return sorted;
  }, [sorted, filter]);

  const unread = alerts.filter((a) => !a.read).length;

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

  async function markOne(id: string) {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.ok) {
      const j = (await res.json()) as { alerts?: Alert[] };
      if (j.alerts) setAlerts(j.alerts);
    }
  }

  return (
    <AppShell current="alerts" title="Meldingen" subtitle="Sync, watchlist en acties" fill>
      <div className="ws-shell">
        <section className="radar-scroll-pane min-h-0 flex-1">
          <div className="radar-scroll-pane__head">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "Alles"],
                  ["unread", "Ongelezen"],
                  ["watchlist", "Watchlist"],
                  ["sync", "Sync"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`ws-chip ${filter === id ? "ws-chip--on" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  {id === "unread" && unread ? ` · ${unread}` : ""}
                </button>
              ))}
            </div>
            {unread ? (
              <button type="button" className="btn-ghost btn-tool" onClick={() => void markAll()}>
                Alles gelezen
              </button>
            ) : null}
          </div>
          <div className="radar-scroll-pane__body !px-0">
            {loading ? (
              <p className="px-5 py-4 text-sm text-[var(--muted)]">Laden…</p>
            ) : !visible.length ? (
              <p className="ws-empty m-4">
                {filter === "all"
                  ? "Nog geen meldingen. Sync of watchlist-wijzigingen verschijnen hier."
                  : "Niets in deze filter."}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {visible.map((a) => (
                  <li key={a.id} className={`px-5 py-3.5 ${a.read ? "opacity-70" : ""}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {kindLabel(a.kind)}
                        <span className="ml-2 font-normal normal-case tracking-normal">
                          {timeAgo(a.at)}
                        </span>
                      </p>
                      {!a.read ? (
                        <button
                          type="button"
                          className="text-[0.72rem] font-semibold text-[var(--accent)]"
                          onClick={() => void markOne(a.id)}
                        >
                          Gelezen
                        </button>
                      ) : null}
                    </div>
                    {a.href ? (
                      <Link
                        href={a.href}
                        className="mt-1 block no-underline"
                        onClick={() => {
                          if (!a.read) void markOne(a.id);
                        }}
                      >
                        <p className="text-[0.95rem] font-semibold text-[var(--ink)]">{a.title}</p>
                        <p className="mt-0.5 text-[0.8rem] leading-snug text-[var(--muted)]">{a.body}</p>
                      </Link>
                    ) : (
                      <>
                        <p className="mt-1 text-[0.95rem] font-semibold text-[var(--ink)]">{a.title}</p>
                        <p className="mt-0.5 text-[0.8rem] leading-snug text-[var(--muted)]">{a.body}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
