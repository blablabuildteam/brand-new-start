"use client";

import { useMemo, useState } from "react";
import type { DemoDashboardRow } from "@/lib/demo-analytics";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtMins(seconds: number) {
  if (!seconds) return "0 min";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

const LABEL: Record<DemoDashboardRow["engagementLabel"], string> = {
  geen: "Nog niet geopend",
  kort: "Kort gekeken",
  actief: "Actief bezig",
  diep: "Echt gebruikt",
};

const TONE: Record<DemoDashboardRow["engagementLabel"], string> = {
  geen: "bg-[var(--surface-2)] text-[var(--muted)]",
  kort: "bg-[var(--surface-2)] text-[var(--ink)]",
  actief: "bg-[#e8f0ff] text-[#2340f0]",
  diep: "bg-[#e7f7ee] text-[#146c43]",
};

export function DemoAdminDesk({
  initial,
  error,
}: {
  initial: DemoDashboardRow[];
  error: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "opened" | "active">("all");
  const rows = useMemo(() => {
    if (filter === "opened") return initial.filter((r) => r.opened);
    if (filter === "active") return initial.filter((r) => r.engagementLabel === "actief" || r.engagementLabel === "diep");
    return initial;
  }, [filter, initial]);

  const opened = initial.filter((r) => r.opened).length;
  const active = initial.filter((r) => r.engagementLabel === "actief" || r.engagementLabel === "diep").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      {error ? (
        <p className="rounded-[var(--radius)] border border-[var(--warn)]/40 bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-[var(--line)] px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">Prospects</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{initial.length}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--line)] px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">Geopend</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{opened}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--line)] px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">Echt mee bezig</p>
          <p className="mt-1 text-2xl font-bold text-[#146c43]">{active}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Alles"],
            ["opened", "Geopend"],
            ["active", "Actief / diep"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn-tool ${filter === id ? "btn-ink" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--line)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-[0.68rem] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Prospect</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Bezoeken</th>
              <th className="px-3 py-2 font-semibold">Tijd</th>
              <th className="px-3 py-2 font-semibold">Kliks</th>
              <th className="px-3 py-2 font-semibold">Laatste</th>
              <th className="px-3 py-2 font-semibold">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-t border-[var(--line)]">
                <td className="px-3 py-3 align-top">
                  <p className="font-semibold text-[var(--ink)]">
                    {r.agencyName}
                    {r.contactFirstName ? (
                      <span className="font-normal text-[var(--muted)]"> · {r.contactFirstName}</span>
                    ) : null}
                  </p>
                  <p className="text-[0.75rem] text-[var(--muted)]">
                    {[r.niche, r.city].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[0.72rem] font-semibold ${TONE[r.engagementLabel]}`}>
                    {LABEL[r.engagementLabel]}
                  </span>
                  <p className="mt-1 text-[0.7rem] text-[var(--muted)]">
                    {r.opened ? `Eerste: ${fmtWhen(r.firstVisitAt)}` : "Nog geen bezoek"}
                  </p>
                </td>
                <td className="px-3 py-3 align-top tabular-nums">{r.visitCount}</td>
                <td className="px-3 py-3 align-top tabular-nums">{fmtMins(r.totalSeconds)}</td>
                <td className="px-3 py-3 align-top tabular-nums">{r.clickCount}</td>
                <td className="px-3 py-3 align-top text-[0.8rem] text-[var(--muted)]">{fmtWhen(r.lastVisitAt)}</td>
                <td className="px-3 py-3 align-top">
                  <a
                    href={`/demo/${r.slug}`}
                    className="text-[0.78rem] font-medium text-[var(--ink)] underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    /demo/{r.slug}
                  </a>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">
                  Geen demo&apos;s in deze filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-[0.75rem] text-[var(--muted)]">
        Prospects staan in <code className="text-[var(--ink)]">src/data/demo-prospects.json</code>. Logo&apos;s in{" "}
        <code className="text-[var(--ink)]">public/demo-logos/</code>. Score: bezoeken + tijd + aangeklikte kansen.
      </p>
    </div>
  );
}
