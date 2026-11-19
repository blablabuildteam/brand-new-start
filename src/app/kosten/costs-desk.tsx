"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { COST_PART_NL, eurFormat, eurMid, eurRange, type CostPart } from "@/lib/costs";
import type { DailyCosts } from "@/lib/costs-daily";
import type { CostsPayload } from "@/lib/costs-overview";

type Range = { low: number; high: number };

const CHECKS: { id: string; label: string; perMonth: number }[] = [
  { id: "1w", label: "1× per week", perMonth: 4.3 },
  { id: "2w", label: "2× per week", perMonth: 8.7 },
  { id: "2d", label: "Elke 2 dagen", perMonth: 15 },
  { id: "1d", label: "Dagelijks", perMonth: 30 },
];

function mul(r: Range, n: number): Range {
  return { low: r.low * n, high: r.high * n };
}
function add(...rs: Range[]): Range {
  return rs.reduce((a, r) => ({ low: a.low + r.low, high: a.high + r.high }), { low: 0, high: 0 });
}
function eur(n: number) {
  return `€${eurFormat(Math.round(n * 100) / 100)}`;
}
function eurWhole(n: number) {
  return `€${Math.round(n).toLocaleString("nl-NL")}`;
}

type Inputs = {
  recruiters: number;
  check: string;
  postsPerRecruiter: number;
  confirmedPerMonth: number;
  boardRuns: number;
};

/** Hoe vaak elk profiel nu per maand wordt opgehaald (runs × profielen per run ÷ recruiters). */
function currentChecks(data: CostsPayload) {
  const { feedRuns30, profilesPerRun, recruiters } = data.model;
  return recruiters ? Math.round(((feedRuns30 * profilesPerRun) / recruiters) * 10) / 10 : 0;
}

function monthly(data: CostsPayload, i: Inputs) {
  const u = data.model.unit;
  const checks =
    i.check === "now" ? currentChecks(data) : (CHECKS.find((c) => c.id === i.check)?.perMonth ?? 15);
  const feed = mul(u.perRecruiterCheck, i.recruiters * checks);
  const aiRaw = mul(u.aiPerPost, i.recruiters * i.postsPerRecruiter);
  const aiCap = data.model.aiDailyCap * 30;
  const ai = { low: Math.min(aiRaw.low, aiCap), high: Math.min(aiRaw.high, aiCap) };
  const hm = mul(add(u.hmSearch, u.lusha), i.confirmedPerMonth);
  const perBoardRun = data.model.boardRuns30
    ? mul(data.model.boardEur30, 1 / data.model.boardRuns30)
    : { low: 1, high: 1.6 };
  const boards = mul(perBoardRun, i.boardRuns);
  const platform = data.platform.eur;
  const total = add(feed, ai, hm, boards, platform);
  return { feed, ai, aiCapped: aiRaw.high > aiCap, hm, boards, platform, total };
}

export default function CostsDesk() {
  const router = useRouter();
  const [data, setData] = useState<CostsPayload | null>(null);
  const [inputs, setInputs] = useState<Inputs | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/costs", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login?next=/kosten");
        return;
      }
      const j = (await res.json()) as CostsPayload;
      setData(j);
      setInputs({
        recruiters: Math.max(1, j.model.recruiters),
        check: "now",
        postsPerRecruiter: Math.max(1, Math.round(j.model.postsPerRecruiter30 * 10) / 10),
        confirmedPerMonth: Math.max(1, j.model.confirmed30),
        boardRuns: Math.max(0, j.model.boardRuns30),
      });
    })();
  }, [router]);

  const calc = useMemo(() => (data && inputs ? monthly(data, inputs) : null), [data, inputs]);
  const ladder = useMemo(() => {
    if (!data || !inputs) return [];
    const base = Math.max(1, data.model.recruiters);
    return [...new Set([base, base * 2, base * 4, 100].map((n) => Math.round(n)))]
      .sort((a, b) => a - b)
      .map((n) => ({ n, m: monthly(data, { ...inputs, recruiters: n }) }));
  }, [data, inputs]);

  function set<K extends keyof Inputs>(k: K, v: Inputs[K]) {
    setInputs((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  return (
    <AppShell current="kosten" title="Kosten" subtitle="Wat het tot nu toe kostte · wat het kost bij meer recruiters">
      <main className="ws-shell ws-shell--page">
        {!data || !inputs || !calc ? (
          <p className="text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <>
            <section className="cost-kpis">
              <Kpi
                label="Tot nu toe"
                value={data.allTime.eur}
                sub={
                  data.since
                    ? `sinds ${new Date(data.since).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} · ${data.allTime.count} betaalde acties`
                    : "nog geen betaalde acties"
                }
              />
              <Kpi label={`Deze maand · ${data.month.label}`} value={data.month.eur} sub={`${data.month.count} betaalde acties`} />
              <Kpi
                label="Eind maand op dit tempo"
                value={data.month.forecast.eur}
                sub={`≈ ${eur(eurMid(data.month.forecast.perDay))}/dag · alleen syncs`}
              />
              <Kpi label="Vaste kosten / maand" value={data.platform.eur} sub="Vercel + database" />
            </section>

            <DailySection daily={data.daily} />

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <Breakdown title="Tot nu toe per onderdeel" lines={data.allTime.lines} />
              <Breakdown title="Laatste 30 dagen" lines={data.last30.lines} />
            </section>

            <section className="mt-8">
              <h2 className="cost-h">Rekensom · meer recruiters volgen</h2>
              <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-[var(--muted)]">
                Startwaarden zijn gemeten over de laatste 30 dagen. Schuif om te zien wat het per maand kost als
                jullie meer recruiters volgen of vaker ophalen.
              </p>

              <div className="cost-calc mt-4">
                <div className="cost-calc__inputs">
                  <label className="cost-field">
                    <span className="cost-field__l">
                      Recruiters gevolgd <strong>{inputs.recruiters}</strong>
                      <em>nu {data.model.recruiters}</em>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={200}
                      value={inputs.recruiters}
                      onChange={(e) => set("recruiters", Number(e.target.value))}
                    />
                  </label>
                  <label className="cost-field">
                    <span className="cost-field__l">Feeds ophalen</span>
                    <select value={inputs.check} onChange={(e) => set("check", e.target.value)}>
                      <option value="now">
                        Zoals nu · ±{currentChecks(data).toLocaleString("nl-NL")}× per maand per recruiter
                      </option>
                      {CHECKS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cost-field">
                    <span className="cost-field__l">
                      Vacature-posts per recruiter / maand
                      <em>gemeten {data.model.postsPerRecruiter30}</em>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={inputs.postsPerRecruiter}
                      onChange={(e) => set("postsPerRecruiter", Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                  <label className="cost-field">
                    <span className="cost-field__l">
                      Bevestigde kansen / maand
                      <em>gemeten {data.model.confirmed30}</em>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={inputs.confirmedPerMonth}
                      onChange={(e) => set("confirmedPerMonth", Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                  <label className="cost-field">
                    <span className="cost-field__l">
                      Jobboard-syncs / maand
                      <em>gemeten {data.model.boardRuns30}</em>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={inputs.boardRuns}
                      onChange={(e) => set("boardRuns", Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                </div>

                <div className="cost-calc__out">
                  <ul className="cost-lines">
                    <Line
                      label="Recruiter-feeds ophalen"
                      sub={`${eurRange(data.model.unit.perRecruiterCheck)} per profiel per keer`}
                      r={calc.feed}
                    />
                    <Line
                      label="AI eindklant per post"
                      sub={
                        calc.aiCapped
                          ? `plafond ${eur(data.model.aiDailyCap)}/dag geraakt — rest blijft handmatig`
                          : `${eurRange(data.model.unit.aiPerPost)} per post`
                      }
                      r={calc.ai}
                    />
                    <Line label="Manager zoeken + mail/tel" sub="per bevestigde kans" r={calc.hm} />
                    <Line label="Jobboards" sub="LinkedIn · Indeed · Freelance.nl" r={calc.boards} />
                    <Line label="Vaste kosten" sub="Vercel + database" r={calc.platform} />
                  </ul>
                  <div className="cost-total">
                    <span>Per maand</span>
                    <strong>ca. {eurWhole(eurMid(calc.total))}</strong>
                    <em>{eurRange({ low: Math.round(calc.total.low), high: Math.round(calc.total.high) })}</em>
                  </div>
                  <div className="cost-total cost-total--sub">
                    <span>Per jaar</span>
                    <strong>ca. {eurWhole(eurMid(calc.total) * 12)}</strong>
                    <em>
                      1 plaatsing ≈ {eurWhole(data.roi.marginPerPlacement)} marge — dekt{" "}
                      {Math.max(1, Math.round(data.roi.marginPerPlacement / Math.max(1, eurMid(calc.total))))} maanden
                      van deze kosten
                    </em>
                  </div>
                </div>
              </div>

              <table className="cost-ladder mt-4">
                <thead>
                  <tr>
                    <th>Recruiters</th>
                    <th>Feeds</th>
                    <th>AI</th>
                    <th>Totaal / maand</th>
                    <th>Per jaar</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map(({ n, m }) => (
                    <tr key={n} className={n === inputs.recruiters ? "is-on" : ""}>
                      <td>
                        <button type="button" onClick={() => set("recruiters", n)}>
                          {n}
                          {n === data.model.recruiters ? <em> · nu</em> : null}
                        </button>
                      </td>
                      <td>{eurWhole(eurMid(m.feed))}</td>
                      <td>
                        {eurWhole(eurMid(m.ai))}
                        {m.aiCapped ? <em> · plafond</em> : null}
                      </td>
                      <td>
                        <strong>{eurWhole(eurMid(m.total))}</strong>
                      </td>
                      <td>{eurWhole(eurMid(m.total) * 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <p className="mt-8 text-[0.72rem] leading-relaxed text-[var(--muted)]">
              {data.disclaimer} AI-tellingen zijn een ondergrens: een tweede run op dezelfde post telt één keer.
            </p>
          </>
        )}
      </main>
    </AppShell>
  );
}

const PARTS: CostPart[] = ["boards", "feed", "ai", "hm", "other"];

function dayLabel(day: string, long = false) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(
    "nl-NL",
    long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" }
  );
}

function DailySection({ daily }: { daily: DailyCosts }) {
  const [focus, setFocus] = useState<string | null>(null);
  const max = Math.max(0.5, ...daily.days.map((d) => d.total));
  const picked = daily.days.find((d) => d.day === focus) || [...daily.days].reverse().find((d) => d.total > 0) || null;
  const daySyncs = picked ? daily.syncs.filter((s) => sameDay(s.at, picked.day)) : [];

  return (
    <section className="mt-8">
      <h2 className="cost-h">Kosten per dag · laatste 30 dagen</h2>
      <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-[var(--muted)]">
        {daily.apify.measured
          ? "Apify-bedragen komen rechtstreeks uit Apify (echte run-kosten)."
          : `Apify nu geschat${daily.apify.error ? ` (${daily.apify.error})` : ""}.`}{" "}
        AI wordt gemeten{daily.ledgerSince ? ` sinds ${dayLabel(daily.ledgerSince)}` : " vanaf de eerstvolgende run"};
        daarvoor is het een schatting per uitgezochte post. Vaste kosten (Vercel, database) staan er niet in.
      </p>

      <div className="cost-daykpis mt-4">
        <div>
          <span>30 dagen</span>
          <strong>{eur(daily.total)}</strong>
        </div>
        <div>
          <span>Gemiddeld per dag</span>
          <strong>{eur(daily.avgPerDay)}</strong>
        </div>
        <div>
          <span>Per dag met syncs</span>
          <strong>{eur(daily.avgPerActiveDay)}</strong>
          <em>{daily.activeDays} dagen</em>
        </div>
        {daily.aiToday ? (
          <div>
            <span>AI vandaag (gemeten)</span>
            <strong>{eur(daily.aiToday.eur)}</strong>
            <em>
              {daily.aiToday.calls} calls · {daily.aiToday.webSearches} webzoeken
            </em>
          </div>
        ) : null}
      </div>

      <div className="cost-chart mt-4" role="img" aria-label="Staafgrafiek kosten per dag">
        <div className="cost-chart__y">
          <span>{eur(max)}</span>
          <span>{eur(max / 2)}</span>
          <span>€0</span>
        </div>
        <div className="cost-chart__bars" onMouseLeave={() => setFocus(null)}>
          {daily.days.map((d) => (
            <button
              key={d.day}
              type="button"
              className={`cost-chart__col${picked?.day === d.day ? " is-on" : ""}`}
              onMouseEnter={() => setFocus(d.day)}
              onFocus={() => setFocus(d.day)}
              onClick={() => setFocus(d.day)}
              title={`${dayLabel(d.day, true)} · ${eur(d.total)}`}
            >
              <span className="cost-chart__stack" style={{ height: `${(d.total / max) * 100}%` }}>
                {PARTS.filter((p) => d.parts[p] > 0).map((p) => (
                  <span
                    key={p}
                    className={`cost-chart__seg cost-chart__seg--${p}`}
                    style={{ flexGrow: d.parts[p] }}
                  />
                ))}
              </span>
              {!d.measured && d.total > 0 ? <i className="cost-chart__est" /> : null}
              <span className="cost-chart__x">{Number(d.day.slice(8))}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="cost-legend mt-2">
        {PARTS.map((p) => (
          <span key={p}>
            <i className={`cost-chart__seg--${p}`} /> {COST_PART_NL[p]}
          </span>
        ))}
        <span>
          <i className="cost-legend__est" /> geschat
        </span>
      </div>

      {picked ? (
        <div className="cost-dayinfo mt-3">
          <p>
            <strong>{dayLabel(picked.day, true)}</strong> · {eur(picked.total)}
            {picked.measured ? "" : " · deels geschat"}
          </p>
          <p className="text-[var(--muted)]">
            {PARTS.filter((p) => picked.parts[p] > 0)
              .map((p) => `${COST_PART_NL[p]} ${eur(picked.parts[p])}`)
              .join(" · ") || "Geen kosten"}
          </p>
          {daySyncs.length ? (
            <p className="text-[var(--muted)]">
              {daySyncs.map((s) => `${s.label} ${s.mode === "error" ? "mislukt" : eur(s.eur)}`).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="ws-panel px-4 py-3.5">
          <p className="ws-label">Gemiddeld per sync</p>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {daily.perSource.map((s) => (
              <li key={s.channel} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-1.5 text-sm">
                <span className="truncate">
                  {s.label}{" "}
                  <span className="text-[var(--muted)]">
                    × {s.runs}
                    {s.perKept != null ? ` · ${eur(s.perKept)} per bewaarde hit` : ""}
                  </span>
                </span>
                <span className="tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                  {eur(s.avg)}
                  <span className="text-[var(--muted)]">{s.measured ? "" : " ~"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.7rem] text-[var(--muted)]">~ = geschat, zonder ~ = gemeten in Apify.</p>
        </div>

        <div className="ws-panel px-4 py-3.5">
          <p className="ws-label">Per sync · nieuwste eerst</p>
          <table className="cost-syncs mt-2">
            <tbody>
              {daily.syncs.slice(0, 14).map((s) => (
                <tr key={s.id} className={s.mode === "error" ? "is-error" : ""}>
                  <td>
                    {new Date(s.at).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{s.label}</td>
                  <td>{s.mode === "error" ? "mislukt" : `${s.kept}/${s.fetched}`}</td>
                  <td>
                    {eur(s.eur)}
                    {s.measured || s.eur === 0 ? "" : " ~"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function sameDay(iso: string, day: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }) === day;
}

function Kpi({ label, value, sub }: { label: string; value: Range; sub: string }) {
  return (
    <div className="cost-kpi">
      <p className="ws-label">{label}</p>
      <p className="cost-kpi__v">{value.low || value.high ? `ca. €${eurFormat(eurMid(value))}` : "€0"}</p>
      <p className="cost-kpi__s">{sub}</p>
    </div>
  );
}

function Breakdown({ title, lines }: { title: string; lines: { label: string; count: number; eur: Range }[] }) {
  return (
    <div className="ws-panel px-4 py-3.5">
      <p className="ws-label">{title}</p>
      {lines.length ? (
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {lines.map((l) => (
            <li key={l.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-1.5 text-sm">
              <span className="truncate">
                {l.label} <span className="text-[var(--muted)]">× {l.count}</span>
              </span>
              <span className="tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                ca. €{eurFormat(eurMid(l.eur))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">Niets betaald in deze periode.</p>
      )}
    </div>
  );
}

function Line({ label, sub, r }: { label: string; sub: string; r: Range }) {
  return (
    <li>
      <span className="min-w-0">
        <span className="block text-[0.84rem] text-[var(--ink)]">{label}</span>
        <span className="block text-[0.7rem] text-[var(--muted)]">{sub}</span>
      </span>
      <span className="cost-lines__v">ca. €{eurFormat(Math.round(eurMid(r) * 100) / 100)}</span>
    </li>
  );
}
