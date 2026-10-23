"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { ActivityEvent, ActivityLevel } from "@/lib/activity-log";

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
};

const LEVELS: { id: ActivityLevel | "all"; label: string }[] = [
  { id: "all", label: "Alles" },
  { id: "error", label: "Fouten" },
  { id: "warn", label: "Warn" },
  { id: "info", label: "Info" },
];

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

export default function OpsDesk() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [level, setLevel] = useState<ActivityLevel | "all">("all");
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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

  return (
    <AppShell
      current="ops"
      title="Ops"
      subtitle="Activity & errors · alleen blablabuild"
      toolbar={
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-[var(--radius)] border border-[var(--line)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
        >
          Vernieuwen
        </button>
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-5 md:px-6">
        <p className="text-[0.8rem] leading-relaxed text-[var(--muted)]">
          Alleen voor blablabuild — niet zichtbaar voor recruiters. Desk-acties en API-/UI-fouten om
          bugs te reproduceren.
        </p>

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
      </div>
    </AppShell>
  );
}
