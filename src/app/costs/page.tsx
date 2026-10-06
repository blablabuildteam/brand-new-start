"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BlablaLogo } from "@/components/blabla-logo";
import { eurRange } from "@/lib/costs";

type Range = { low: number; high: number };

type Action = { label: string; tool: string; eur: Range; what: string };

type CostsPayload = {
  monthly: {
    liveNow: Range & { note: string };
  };
  spent?: {
    monthLabel: string;
    count: number;
    eur: Range;
    lines: { label: string; count: number; eur: Range }[];
  };
  perRun?: {
    disclaimer: string;
    actions: Record<string, Action>;
  };
};

const CLICKS = [
  "market",
  "indeed",
  "freelance-nl",
  "recruiter-feeds",
  "hm-search",
  "lusha",
  "ai-research",
] as const;

function money(r: Range) {
  return eurRange(r);
}

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
    <AppShell current="kosten" title="Kosten" subtitle="Wat een klik kost · wat we deze maand draaiden">
      <main className="ws-shell ws-shell--page">
        {!data ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <>
            <section className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="ws-panel px-4 py-4">
                <p className="ws-label">Deze maand · schatting</p>
                <p className="mt-1 text-2xl tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                  {data.spent ? money(data.spent.eur) : "—"}
                </p>
                <p className="mt-1.5 text-[0.78rem] text-[var(--muted)]">
                  {data.spent?.count
                    ? `${data.spent.count} betaalde syncs in ${data.spent.monthLabel}. Geen factuur — Apify/Lusha/Firecrawl rekenen zelf af.`
                    : "Nog geen betaalde syncs deze maand."}
                </p>
              </div>
              <div className="ws-panel px-4 py-4">
                <p className="ws-label">Normaal tempo · per maand</p>
                <p className="mt-1 text-2xl tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                  {money(data.monthly.liveNow)}
                </p>
                <p className="mt-1.5 text-[0.78rem] text-[var(--muted)]">
                  Als je jobboards en recruiter-feeds ongeveer 1× per 2–3 dagen ophaalt. Max 1× per dag per bron.
                </p>
              </div>
            </section>

            {data.spent?.lines.length ? (
              <section className="mb-4 ws-panel px-4 py-3">
                <p className="ws-label">Waar zat het in</p>
                <ul className="mt-2 divide-y divide-[var(--line)]">
                  {data.spent.lines.map((line) => (
                    <li key={line.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-1.5 text-sm">
                      <span>
                        {line.label}{" "}
                        <span className="text-[var(--muted)]">× {line.count}</span>
                      </span>
                      <span className="tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                        {money(line.eur)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {data.perRun ? (
              <section className="mb-4">
                <h2 className="mb-1 text-sm text-[var(--ink)]">Wat een knop kost</h2>
                <p className="mb-3 text-[0.78rem] text-[var(--muted)]">
                  Staat ook achter de knop zelf. Tweede keer dezelfde dag haalt niets nieuws op.
                </p>
                <ul className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
                  {CLICKS.map((id) => {
                    const a = data.perRun!.actions[id];
                    if (!a) return null;
                    return (
                      <li
                        key={id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--ink)]">{a.label}</p>
                          <p className="text-[0.72rem] text-[var(--muted)]">{a.what}</p>
                        </div>
                        <p
                          className="shrink-0 text-sm tabular-nums text-[var(--ink)]"
                          style={{ fontFamily: "var(--mono)" }}
                        >
                          {money(a.eur)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <p className="text-[0.78rem] text-[var(--muted)]">
              Filteren in de app is gratis. Je betaalt providers voor het ophalen — ook voor wat we daarna weggooien.
              Meer uitleg:{" "}
              <Link href="/methode" className="text-[var(--ink)] underline underline-offset-2">
                Hoe het werkt
              </Link>
              .
            </p>

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
