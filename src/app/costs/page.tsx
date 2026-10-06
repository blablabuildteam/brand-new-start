"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BlablaLogo } from "@/components/blabla-logo";

type CostsPayload = {
  monthly: {
    sources: { low: number; high: number };
    platform: { low: number; high: number };
    total: { low: number; high: number };
    liveNow: { low: number; high: number; note: string };
    withFirecrawl: { low: number; high: number; note: string };
  };
  sources: Array<{
    id: string;
    label: string;
    tool: string;
    cadence: string;
    eurPerMonth: { low: number; high: number };
    efficiency: string;
  }>;
  platform: Record<string, { low: number; high: number; note: string }>;
  perRun?: {
    disclaimer: string;
    actions: Record<
      string,
      { label: string; tool: string; eur: { low: number; high: number }; what: string }
    >;
  };
  roi: {
    clientRatePerHour: { low: number; high: number };
    contractorRatePerHour: { low: number; high: number };
    marginPerHour: { low: number; high: number };
    hoursPerWeek: number;
    weeksPerPlacement: { low: number; high: number };
    marginPerPlacement: { low: number; mid: number; high: number };
    annualCost: { low: number; high: number };
    breakEvenPlacementsAtMidMargin: number;
    formula: string;
    payoffExample: string;
    narrative: string[];
  };
};

export default function CostsPage() {
  const router = useRouter();
  const [data, setData] = useState<CostsPayload | null>(null);

  useEffect(() => {
    fetch("/api/costs")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((j) => j && setData(j));
  }, [router]);

  return (
    <AppShell current="instellingen" title="Kosten" subtitle="Per maand en per scrape">
    <main className="ws-shell ws-shell--page">

      {!data ? (
        <p className="text-sm text-[var(--muted)]">Laden…</p>
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Per maand · kerndrie</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                €{data.monthly.liveNow.low}–{data.monthly.liveNow.high}
                <span className="text-sm font-normal text-[var(--muted)]">/m</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{data.monthly.liveNow.note}</p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Per maand · met careers</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                €{data.monthly.withFirecrawl.low}–{data.monthly.withFirecrawl.high}
                <span className="text-sm font-normal text-[var(--muted)]">/m</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{data.monthly.withFirecrawl.note}</p>
            </div>
          </section>

          {data.perRun ? (
            <section className="mb-6">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Per scrape / actie</h2>
              <p className="mb-3 text-[0.78rem] text-[var(--muted)]">{data.perRun.disclaimer}</p>
              <ul className="space-y-2">
                {Object.entries(data.perRun.actions)
                  .filter(([id]) => !["boards", "all"].includes(id))
                  .map(([id, a]) => (
                    <li key={id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                      <div className="flex justify-between gap-3 text-sm">
                        <strong>{a.label}</strong>
                        <span className="shrink-0 tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                          {a.eur.low === 0 && a.eur.high === 0
                            ? "€0"
                            : `€${a.eur.low.toFixed(2).replace(".", ",")}–${a.eur.high.toFixed(2).replace(".", ",")}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {a.tool} · {a.what}
                      </p>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section className="mb-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Bronnen · per maand</h2>
            <ul className="space-y-2">
              {data.sources.map((s) => (
                <li key={s.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <strong>{s.label}</strong>
                    <span className="tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                      €{s.eurPerMonth.low}–{s.eurPerMonth.high}/m
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {s.tool} · {s.cadence} · {s.efficiency}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Platform</h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(data.platform).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3 border-b border-[var(--line)]/70 py-2">
                  <span>
                    {k} <span className="text-[var(--muted)]">— {v.note}</span>
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    €{v.low}–{v.high}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-sm text-[var(--muted)]">
            Geen auto-cron. LinkedIn, Indeed en Freelance.nl zijn <strong>aparte</strong> syncs (Sync
            & meer). Bedragen zijn schattingen op basis van ~1×/3 dagen — echte factuur = Apify +
            Firecrawl. Per-run bedragen: zie{" "}
            <Link href="/methode" className="text-[var(--accent)]">
              Hoe het werkt
            </Link>
            .
          </p>

          <p className="mt-4 text-sm">
            <Link href="/methode" className="font-medium text-[var(--accent)]">
              Hoe het werkt (bronnen & per-run) →
            </Link>
          </p>
          <p className="mt-2 text-sm">
            <Link href="/samenwerking" className="font-medium text-[var(--accent)]">
              Samenwerkingsvoorstel Brand New Start × blablabuild →
            </Link>
          </p>

          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline"
          >
            Tool gebouwd door <BlablaLogo className="h-4 w-4" />
            <span className="font-semibold text-[var(--ink)]">blablabuild</span>
          </a>
        </>
      )}
    </main>
    </AppShell>
  );
}
