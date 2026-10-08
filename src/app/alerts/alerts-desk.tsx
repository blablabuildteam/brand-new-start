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

type Bundle = {
  key: string;
  kind: string;
  label: string;
  items: Alert[];
  unread: number;
  newestAt: string;
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

function priority(kind: string) {
  if (kind === "watchlist") return 0;
  if (kind === "confirm") return 1;
  if (kind === "hm") return 2;
  if (kind === "hot") return 3;
  if (kind === "info") return 4;
  if (kind === "sync") return 5;
  return 6;
}

/** Bundel op kind; sync per kalenderdag. */
function bundleAlerts(alerts: Alert[]): Bundle[] {
  const map = new Map<string, Alert[]>();
  for (const a of alerts) {
    const day = a.at.slice(0, 10);
    const key = a.kind === "sync" ? `sync:${day}` : a.kind;
    const list = map.get(key) || [];
    list.push(a);
    map.set(key, list);
  }
  const out: Bundle[] = [];
  for (const [key, items] of map) {
    items.sort((a, b) => b.at.localeCompare(a.at));
    const kind = items[0]!.kind;
    const label =
      kind === "sync"
        ? `Sync · ${new Date(items[0]!.at).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
          })}`
        : kindLabel(kind);
    out.push({
      key,
      kind,
      label,
      items,
      unread: items.filter((i) => !i.read).length,
      newestAt: items[0]!.at,
    });
  }
  out.sort((a, b) => {
    const dp = priority(a.kind) - priority(b.kind);
    if (dp !== 0) return dp;
    return b.newestAt.localeCompare(a.newestAt);
  });
  return out;
}

export default function AlertsDesk() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "watchlist" | "sync">("all");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

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

  const filtered = useMemo(() => {
    if (filter === "unread") return alerts.filter((a) => !a.read);
    if (filter === "watchlist") return alerts.filter((a) => a.kind === "watchlist");
    if (filter === "sync") return alerts.filter((a) => a.kind === "sync");
    return alerts;
  }, [alerts, filter]);

  const bundles = useMemo(() => bundleAlerts(filtered), [filtered]);
  const unread = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    // Eerste bundel met ongelezen openen.
    const first = bundles.find((b) => b.unread > 0) || bundles[0];
    if (first) setOpenKeys(new Set([first.key]));
  }, [bundles.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function markIds(ids: string[]) {
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

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
            ) : !bundles.length ? (
              <p className="ws-empty m-4">
                {filter === "all"
                  ? "Nog geen meldingen. Sync of watchlist-wijzigingen verschijnen hier."
                  : "Niets in deze filter."}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {bundles.map((b) => {
                  const open = openKeys.has(b.key);
                  return (
                    <li key={b.key}>
                      <div className="flex items-center gap-2 px-5 py-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() => toggle(b.key)}
                          aria-expanded={open}
                        >
                          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {b.label}
                          </span>
                          <span
                            className="tabular-nums text-[0.72rem] text-[var(--muted)]"
                            style={{ fontFamily: "var(--mono)" }}
                          >
                            {b.items.length}
                            {b.unread ? ` · ${b.unread} nieuw` : ""}
                          </span>
                          <span className="ml-auto text-[0.7rem] text-[var(--muted)]" aria-hidden>
                            {open ? "▴" : "▾"}
                          </span>
                        </button>
                        {b.unread ? (
                          <button
                            type="button"
                            className="shrink-0 text-[0.72rem] font-semibold text-[var(--accent)]"
                            onClick={() =>
                              void markIds(b.items.filter((i) => !i.read).map((i) => i.id))
                            }
                          >
                            Gelezen
                          </button>
                        ) : null}
                      </div>
                      {open ? (
                        <ul className="border-t border-[var(--line)]/60 bg-[var(--surface-2)]/35">
                          {b.items.map((a) => (
                            <li
                              key={a.id}
                              className={`border-b border-[var(--line)]/50 px-5 py-2.5 last:border-b-0 ${
                                a.read ? "opacity-70" : ""
                              }`}
                            >
                              <p className="text-[0.68rem] text-[var(--muted)]">{timeAgo(a.at)}</p>
                              {a.href ? (
                                <Link
                                  href={a.href}
                                  className="mt-0.5 block no-underline"
                                  onClick={() => {
                                    if (!a.read) void markIds([a.id]);
                                  }}
                                >
                                  <p className="text-[0.9rem] font-semibold text-[var(--ink)]">{a.title}</p>
                                  <p className="mt-0.5 text-[0.78rem] leading-snug text-[var(--muted)]">
                                    {a.body}
                                  </p>
                                </Link>
                              ) : (
                                <>
                                  <p className="mt-0.5 text-[0.9rem] font-semibold text-[var(--ink)]">
                                    {a.title}
                                  </p>
                                  <p className="mt-0.5 text-[0.78rem] leading-snug text-[var(--muted)]">
                                    {a.body}
                                  </p>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
