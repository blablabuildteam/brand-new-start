"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BlablaLogo } from "@/components/blabla-logo";
import { SourceLogo } from "@/components/source-logo";
import { eurRange } from "@/lib/costs";
import type { SyncDeskAction, SyncDeskRecent, SyncDeskSource } from "@/lib/sync-desk";

type Range = { low: number; high: number };

type SyncPayload = {
  lockHours: number;
  disclaimer: string;
  sources: SyncDeskSource[];
  spent: {
    monthLabel: string;
    count: number;
    eur: Range;
    lines: { label: string; count: number; eur: Range }[];
  };
  recent: SyncDeskRecent[];
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} u geleden`;
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

function availableLabel(lockedUntil: string | null) {
  if (!lockedUntil) return null;
  const d = new Date(lockedUntil);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();
  const clock = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Weer beschikbaar om ${clock}`;
  if (isTomorrow) return `Weer beschikbaar morgen ${clock}`;
  return `Weer beschikbaar ${d.toLocaleString("nl-NL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function SyncDesk() {
  const router = useRouter();
  const [data, setData] = useState<SyncPayload | null>(null);
  const [busyId, setBusyId] = useState<SyncDeskAction | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sync");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const j = (await res.json()) as SyncPayload;
    setData(j);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSource(id: SyncDeskAction) {
    if (busyId) return;
    setBusyId(id);
    setNote(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        kept?: number;
        fetched?: number;
      };
      if (!res.ok) {
        setNote(j.message || j.error || "Sync mislukt. Probeer het later opnieuw.");
      } else {
        const kept = typeof j.kept === "number" ? j.kept : null;
        const fetched = typeof j.fetched === "number" ? j.fetched : null;
        setNote(
          kept != null && fetched != null
            ? `Klaar: ${kept} bewaard · ${fetched} opgehaald.`
            : "Sync klaar."
        );
      }
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Sync mislukt.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell current="sync" title="Sync" subtitle="Ophalen · wat het kost · wanneer weer">
      <main className="ws-shell ws-shell--page">
        {!data ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <>
            <section className="mb-5 ws-panel px-4 py-4">
              <p className="ws-label">Deze maand · schatting</p>
              <p
                className="mt-1 text-2xl tabular-nums text-[var(--ink)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                {eurRange(data.spent.eur)}
              </p>
              <p className="mt-1.5 text-[0.78rem] text-[var(--muted)]">
                {data.spent.count
                  ? `${data.spent.count} betaalde runs in ${data.spent.monthLabel}. Geen factuur — Apify/Firecrawl rekenen zelf af.`
                  : `Nog geen betaalde runs in ${data.spent.monthLabel}.`}
              </p>
              {data.spent.lines.length ? (
                <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {data.spent.lines.map((line) => (
                    <li
                      key={line.label}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-1.5 text-sm"
                    >
                      <span>
                        {line.label}{" "}
                        <span className="text-[var(--muted)]">× {line.count}</span>
                      </span>
                      <span
                        className="tabular-nums text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {eurRange(line.eur)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {note ? (
              <p className="mb-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)]">
                {note}
              </p>
            ) : null}

            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                Bronnen
              </h2>
              <p className="mb-3 text-[0.78rem] text-[var(--muted)]">
                Max 1× per bron per ~{data.lockHours} uur. Tweede klik haalt meestal niets nieuws en kost wel geld.
              </p>
              <ul className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
                {data.sources.map((s) => (
                  <SourceRow
                    key={s.id}
                    source={s}
                    busy={busyId === s.id}
                    disabled={Boolean(busyId)}
                    onRun={() => void runSource(s.id)}
                  />
                ))}
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                Recente runs
              </h2>
              {data.recent.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Nog geen sync-historie.</p>
              ) : (
                <ul className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
                  {data.recent.map((r) => (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-[var(--line)] px-4 py-2.5 text-sm last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto_auto]"
                    >
                      <span
                        className="text-[0.72rem] text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {timeAgo(r.at)}
                      </span>
                      <span className="truncate text-[var(--ink)]">{r.label}</span>
                      <span
                        className="text-[0.72rem] text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {r.fetched
                          ? `${r.kept} bewaard · ${r.fetched} opgehaald`
                          : "niets opgehaald"}
                      </span>
                      <span
                        className="text-right text-[0.72rem] tabular-nums text-[var(--muted)]"
                        style={{ fontFamily: "var(--mono)" }}
                      >
                        {r.costEur ? `≈ ${eurRange(r.costEur)}` : "€0"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[0.72rem] text-[var(--muted)]">{data.disclaimer}</p>

            <a
              href="https://blablabuild.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline"
            >
              Tool gebouwd door <BlablaLogo className="h-4 w-4" />
              <span className="text-[var(--ink)]">blablabuild</span>
            </a>
          </>
        )}
      </main>
    </AppShell>
  );
}

function SourceRow({
  source,
  busy,
  disabled,
  onRun,
}: {
  source: SyncDeskSource;
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  const again = availableLabel(source.lockedUntil);
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <SourceLogo channel={source.channel} size="sm" />
          <p className="text-sm font-semibold text-[var(--ink)]">{source.label}</p>
        </div>
        <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
          {source.lastAt ? (
            <>
              Laatst {timeAgo(source.lastAt)}
              {source.fetched != null
                ? ` · ${source.kept ?? 0} bewaard · ${source.fetched} opgehaald`
                : null}
            </>
          ) : (
            "Nog nooit opgehaald"
          )}
        </p>
        <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          ≈ {eurRange(source.costEur)} / run
        </p>
        {source.locked && again ? (
          <p className="mt-1 text-[0.72rem] text-[var(--warn)]">{again}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn-ink btn-tool shrink-0 self-start sm:self-center disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || source.locked}
        onClick={onRun}
      >
        {busy ? "Bezig…" : source.locked ? "Al opgehaald" : "Ophalen"}
      </button>
    </li>
  );
}
