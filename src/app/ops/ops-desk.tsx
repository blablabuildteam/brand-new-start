"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { ActivityEvent, ActivityLevel } from "@/lib/activity-log";
import type { UsageOverview } from "@/lib/usage-overview";

const KIND_NL: Record<string, string> = {
  "lead.confirm": "Lead bevestigd",
  "lead.reject": "Lead afgewezen",
  "lead.reopen": "Lead heropend",
  "lead.ai": "AI-guess",
  "hm.search": "HM zoeken",
  "hm.contact": "HM contact",
  "crm.stage": "CRM stage",
  "radar.dismiss": "Opening weggezet",
  "radar.reject-company": "Geen eindklant",
  "company.park": "Niet interessant",
  "company.unpark": "Weer interessant",
  "sync.run": "Sync",
  "api.error": "API-fout",
  "client.error": "UI-fout",
  "auth.login": "Login",
  "auth.login_failed": "Login mislukt",
  "agreement.sign": "Overeenkomst getekend",
};

const LEVELS: { id: ActivityLevel | "all"; label: string }[] = [
  { id: "all", label: "Alles" },
  { id: "error", label: "Fouten" },
  { id: "warn", label: "Warn" },
  { id: "info", label: "Info" },
];

type Tab = "usage" | "activity";

function kindLabel(kind: string) {
  return KIND_NL[kind] || kind;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}u`;
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function levelTone(level: string) {
  if (level === "error") return "text-red-700 bg-red-50 border-red-200";
  if (level === "warn") return "text-amber-800 bg-amber-50 border-amber-200";
  return "text-[var(--muted)] bg-[var(--surface-2)] border-[var(--line)]";
}

function actorShort(email: string | null) {
  if (!email) return "systeem";
  const local = email.split("@")[0] || email;
  return local.length > 18 ? `${local.slice(0, 16)}…` : local;
}

function minsLabel(n: number) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}u ${m}m` : `${h}u`;
}

export default function OpsDesk() {
  const [tab, setTab] = useState<Tab>("usage");
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [level, setLevel] = useState<ActivityLevel | "all">("all");
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await fetch("/api/ops/usage?days=90", { cache: "no-store" });
      if (!res.ok) {
        setUsageError(res.status === 403 ? "Geen toegang" : "Laden mislukt");
        setUsage(null);
        return;
      }
      setUsage((await res.json()) as UsageOverview);
    } catch {
      setUsageError("Laden mislukt");
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "300" });
      if (level !== "all") q.set("level", level);
      if (actor.trim()) q.set("actor", actor.trim());
      if (kind.trim()) q.set("kind", kind.trim());
      const res = await fetch(`/api/ops/activity?${q}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "Geen toegang" : "Laden mislukt");
        setEvents([]);
        return;
      }
      const data = (await res.json()) as { events?: ActivityEvent[] };
      setEvents(data.events || []);
    } catch {
      setError("Laden mislukt");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [level, actor, kind]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    void load();
  }, [load]);

  const kindOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.kind);
    return Array.from(set).sort();
  }, [events]);

  const actorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.actorEmail) set.add(e.actorEmail);
    return Array.from(set).sort();
  }, [events]);

  const activeDays = useMemo(
    () => (usage?.days || []).filter((d) => d.humanActions > 0 || d.presenceMin > 0).slice(0, 21),
    [usage]
  );

  return (
    <AppShell
      current="ops"
      title="Ops"
      subtitle="Gebruik & errors · alleen blablabuild"
      toolbar={
        <button
          type="button"
          onClick={() => {
            void loadUsage();
            void load();
          }}
          className="rounded-[var(--radius)] border border-[var(--line)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
        >
          Vernieuwen
        </button>
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-5 md:px-6">
        <p className="text-[0.8rem] leading-relaxed text-[var(--muted)]">
          Alleen voor blablabuild — niet zichtbaar voor recruiters. Gebruik (actieve dagen,
          sessies, frictie) en de ruwe activitylog.
        </p>

        <div className="mt-4 flex gap-1">
          {(
            [
              { id: "usage", label: "Gebruik" },
              { id: "activity", label: "Activity" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-[var(--radius)] border px-2.5 py-1 text-[0.72rem] font-medium transition ${
                tab === t.id
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "usage" ? (
          <div className="mt-5">
            {usageError ? (
              <p className="text-sm text-red-700">{usageError}</p>
            ) : usageLoading && !usage ? (
              <p className="text-sm text-[var(--muted)]">Laden…</p>
            ) : !usage ? (
              <p className="text-sm text-[var(--muted)]">Geen data.</p>
            ) : (
              <>
                <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Laatste menselijke activiteit
                  </p>
                  <p className="mt-1 text-[1.05rem] font-semibold text-[var(--ink)]">
                    {usage.lastHumanAt ? dateLabel(usage.lastHumanAt) : "Nog niet gezien"}
                  </p>
                  <p className="mt-0.5 text-[0.78rem] text-[var(--muted)]">
                    {usage.daysSinceLastHuman == null
                      ? "Geen desk-acties in dit venster."
                      : usage.daysSinceLastHuman === 0
                        ? "Vandaag nog actief."
                        : `${usage.daysSinceLastHuman} dag${usage.daysSinceLastHuman === 1 ? "" : "en"} geleden · ${usage.humanActiveDays} actieve dagen in ${usage.windowDays}d`}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { l: "Bevestigd", v: String(usage.totals.leadConfirmed) },
                    { l: "Afgewezen", v: String(usage.totals.leadRejected) },
                    { l: "HM-zoeken", v: String(usage.totals.hmSearches) },
                    { l: "Sessietijd", v: minsLabel(usage.totals.presenceMin) },
                    { l: "CRM-stages", v: String(usage.totals.crmStages) },
                    { l: "Geen eindklant", v: String(usage.totals.rejectedCompanies) },
                    { l: "UI-fouten", v: String(usage.totals.clientErrors) },
                    { l: "API-fouten", v: String(usage.totals.apiErrors) },
                  ].map((k) => (
                    <div
                      key={k.l}
                      className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                    >
                      <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">{k.l}</p>
                      <p
                        className="mt-0.5 text-[1.05rem] font-semibold tabular-nums text-[var(--ink)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {k.v}
                      </p>
                    </div>
                  ))}
                </div>

                {usage.actors.length ? (
                  <div className="mt-5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Wie
                    </h2>
                    <ul className="mt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {usage.actors.map((a) => (
                        <li key={a.email} className="flex items-baseline justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[0.88rem] font-medium text-[var(--ink)]">{a.email}</p>
                            <p className="text-[0.72rem] text-[var(--muted)]">
                              {a.role || "—"} · {a.activeDays} dagen · {a.actions} acties
                              {a.presenceMin ? ` · ${minsLabel(a.presenceMin)} online` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-[0.72rem] text-[var(--muted)]">
                            {a.lastAt ? timeLabel(a.lastAt) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeDays.length ? (
                  <div className="mt-5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Actieve dagen
                    </h2>
                    <ul className="mt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {activeDays.map((d) => (
                        <li key={d.day} className="flex items-baseline justify-between gap-3 py-2">
                          <span className="text-[0.85rem] text-[var(--ink)]">{dayLabel(d.day)}</span>
                          <span className="text-[0.72rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                            {d.humanActions ? `${d.humanActions} acties` : null}
                            {d.reviews ? ` · ${d.reviews} review` : null}
                            {d.hm ? ` · ${d.hm} hm` : null}
                            {d.syncManual ? ` · ${d.syncManual} sync` : null}
                            {d.presenceMin ? ` · ${minsLabel(d.presenceMin)}` : null}
                            {d.errors ? ` · ${d.errors} fout` : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {usage.recentSessions.length ? (
                  <div className="mt-5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Sessies (presence)
                    </h2>
                    <ul className="mt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {usage.recentSessions.slice(0, 12).map((s) => (
                        <li key={`${s.email}-${s.startedAt}`} className="py-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-[0.85rem] font-medium text-[var(--ink)]">
                              {actorShort(s.email)} · {minsLabel(s.minutes)}
                            </p>
                            <span className="shrink-0 text-[0.7rem] text-[var(--muted)]">
                              {timeLabel(s.lastAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                            {s.paths.join(" · ") || "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-[0.78rem] text-[var(--muted)]">
                    Nog geen presence-sessies — die starten vanaf deze release, zolang iemand
                    ingelogd de desk open heeft.
                  </p>
                )}

                {usage.friction.length ? (
                  <div className="mt-5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Moeilijkheden
                    </h2>
                    <ul className="mt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {usage.friction.map((f, i) => (
                        <li key={`${f.at}-${i}`} className="py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[0.68rem] text-[var(--muted)]">{timeLabel(f.at)}</span>
                            <span className="text-[0.68rem] text-[var(--muted)]">{kindLabel(f.kind)}</span>
                            {f.path ? (
                              <span className="text-[0.65rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                                {f.path}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[0.85rem] text-[var(--ink)]">{f.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-[0.78rem] text-[var(--muted)]">Geen recente UI-/API-fouten in dit venster.</p>
                )}

                <p className="mt-5 text-[0.7rem] leading-relaxed text-[var(--muted)]">{usage.note}</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap gap-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLevel(l.id)}
                    className={`rounded-[var(--radius)] border px-2.5 py-1 text-[0.72rem] font-medium transition ${
                      level === l.id
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-0.5 text-[0.65rem] text-[var(--muted)]">
                Actor
                <select
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[0.75rem] text-[var(--ink)]"
                >
                  <option value="">Iedereen</option>
                  {actorOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[0.65rem] text-[var(--muted)]">
                Soort
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[0.75rem] text-[var(--ink)]"
                >
                  <option value="">Alles</option>
                  {kindOptions.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel(k)}
                    </option>
                  ))}
                  {!kindOptions.includes("api.error") ? (
                    <option value="api.error">{kindLabel("api.error")}</option>
                  ) : null}
                  {!kindOptions.includes("client.error") ? (
                    <option value="client.error">{kindLabel("client.error")}</option>
                  ) : null}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-6 text-sm text-red-700">{error}</p>
            ) : loading && !events.length ? (
              <p className="mt-6 text-sm text-[var(--muted)]">Laden…</p>
            ) : !events.length ? (
              <p className="mt-6 text-sm text-[var(--muted)]">Nog geen events.</p>
            ) : (
              <ul className="mt-5 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {events.map((e) => {
                  const open = openId === e.id;
                  const hasDetail = Boolean(e.detail && Object.keys(e.detail).length);
                  return (
                    <li key={e.id} className="py-3">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : e.id)}
                        className="flex w-full items-start gap-3 text-left"
                        disabled={!hasDetail && e.level === "info"}
                      >
                        <span
                          className="w-[4.2rem] shrink-0 pt-0.5 text-[0.68rem] text-[var(--muted)]"
                          style={{ fontFamily: "var(--mono)" }}
                        >
                          {timeLabel(e.at)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ${levelTone(e.level)}`}
                            >
                              {e.level}
                            </span>
                            <span className="text-[0.68rem] text-[var(--muted)]">{kindLabel(e.kind)}</span>
                            <span className="text-[0.68rem] text-[var(--muted)]">·</span>
                            <span
                              className="truncate text-[0.68rem] text-[var(--muted)]"
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {actorShort(e.actorEmail)}
                            </span>
                            {e.status ? (
                              <span
                                className="text-[0.62rem] text-[var(--muted)]"
                                style={{ fontFamily: "var(--mono)" }}
                              >
                                {e.status}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[0.88rem] leading-snug text-[var(--ink)]">{e.summary}</p>
                          {e.path ? (
                            <p
                              className="mt-0.5 text-[0.65rem] text-[var(--muted)]"
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {e.path}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      {open && hasDetail ? (
                        <pre
                          className="mt-2 overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-[0.68rem] leading-relaxed text-[var(--ink)]/85"
                          style={{ fontFamily: "var(--mono)" }}
                        >
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
