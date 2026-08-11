"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <main className="mx-auto min-h-dvh max-w-[900px] px-5 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.06em] text-[var(--muted)]">Kosten · MVP</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--display)" }}>
            Wat kost deze stap?
          </h1>
        </div>
        <Link href="/" className="text-sm font-medium text-[var(--accent)]">
          ← Terug naar radar
        </Link>
      </div>

      {!data ? (
        <p className="text-sm text-[var(--muted)]">Laden…</p>
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Nu live</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                €{data.monthly.liveNow.low}–{data.monthly.liveNow.high}
                <span className="text-sm font-normal text-[var(--muted)]">/m</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{data.monthly.liveNow.note}</p>
            </div>
            <div className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]/25 p-4">
              <p className="text-[0.65rem] uppercase tracking-wide text-[var(--accent)]">+ Firecrawl</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                €{data.monthly.withFirecrawl.low}–{data.monthly.withFirecrawl.high}
                <span className="text-sm font-normal text-[var(--muted)]">/m</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{data.monthly.withFirecrawl.note}</p>
            </div>
          </section>

          <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
              <p
                className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                Verdienste
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                ROI op uurtarief-marge
              </h2>
            </div>

            <div className="grid gap-0 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-[var(--line)]/80 px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
                <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Marge per plaatsing</p>
                <p
                  className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--ink)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  €{data.roi.marginPerPlacement.mid.toLocaleString("nl-NL")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  midden · range €{data.roi.marginPerPlacement.low.toLocaleString("nl-NL")}–€
                  {data.roi.marginPerPlacement.high.toLocaleString("nl-NL")}
                </p>
                <p
                  className="mt-3 rounded bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-[var(--muted)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  (klant − ZZP) × {data.roi.hoursPerWeek}u × weken
                </p>
              </div>

              <div className="flex flex-col justify-center gap-3 bg-[var(--accent-soft)]/35 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-wide text-[var(--accent)]">Break-even</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                    {data.roi.breakEvenPlacementsAtMidMargin}
                    <span className="ml-1.5 text-sm font-normal text-[var(--muted)]">plaatsing/jaar</span>
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  Worst-case stack ≈ €{data.roi.annualCost.high.toLocaleString("nl-NL")}/jaar. Eén extra interim
                  dekt de signal-kosten typisch al.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-[var(--line)]/80 bg-[var(--line)]/80 sm:grid-cols-4">
              {[
                {
                  label: "Klant €/u",
                  value: `€${data.roi.clientRatePerHour.low}–${data.roi.clientRatePerHour.high}`,
                },
                {
                  label: "ZZP €/u",
                  value: `€${data.roi.contractorRatePerHour.low}–${data.roi.contractorRatePerHour.high}`,
                },
                {
                  label: "Marge/uur",
                  value: `€${data.roi.marginPerHour.low}–${data.roi.marginPerHour.high}`,
                },
                {
                  label: "Opdracht",
                  value: `${data.roi.hoursPerWeek}u × ${data.roi.weeksPerPlacement.low}–${data.roi.weeksPerPlacement.high}w`,
                },
              ].map((cell) => (
                <div key={cell.label} className="bg-[var(--surface)] px-3 py-3 sm:px-4">
                  <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">{cell.label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>

            <ul className="space-y-1.5 border-t border-[var(--line)]/80 px-4 py-3 text-xs leading-relaxed text-[var(--muted)] sm:px-5">
              {data.roi.narrative.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]/70" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Bronnen</h2>
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
            Firecrawl zit als één post in de kosten (careers-watchlist + Freelancer.nl). Zet{" "}
            <code className="text-[var(--ink)]">FIRECRAWL_API_KEY</code> in{" "}
            <code className="text-[var(--ink)]">.env.local</code>, herstart{" "}
            <code className="text-[var(--ink)]">npm run dev</code>, sync daarna via Meer → Careers of Sync
            alles.
          </p>

          <p className="mt-4 text-sm">
            <Link href="/methode" className="font-medium text-[var(--accent)]">
              Methode & queries (wat zoeken we, wat kost een sync) →
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
  );
}
