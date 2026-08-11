import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import {
  MARKET_SEARCH_QUERIES,
  buildLinkedInJobSearchUrls,
} from "@/lib/ingest/market-jobs";
import { BOARD_QUERIES } from "@/lib/ingest/boards";
import { enabledPlatforms } from "@/lib/platforms";
import { INGEST_POLICY, SYNC_COST_PER_RUN } from "@/lib/costs";
import { ROLE_FAMILIES } from "@/lib/niche";

export const metadata = {
  title: "Methode & queries — Brand New Start Radar",
  description: "Welke zoekopdrachten draaien er, hoe filteren we, en wat kost een sync.",
};

export default function MethodePage() {
  const todayLinkedIn = buildLinkedInJobSearchUrls(INGEST_POLICY.syncMarketUrls);
  const platforms = enabledPlatforms();
  const day = new Date().getUTCDay();
  const boardRole = BOARD_QUERIES[day % BOARD_QUERIES.length]!;
  const indeedQuery = day % 2 === 0 ? `${boardRole} ZZP` : boardRole;

  const roleNames = [
    ...new Set([
      ...MARKET_SEARCH_QUERIES.map((q) => q.role),
      ...BOARD_QUERIES,
    ]),
  ].sort((a, b) => a.localeCompare(b, "nl"));

  return (
    <main className="mx-auto min-h-dvh max-w-[900px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Transparantie · live config
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--ink)] md:text-3xl" style={{ fontFamily: "var(--display)" }}>
            Hoe zoeken we?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Wat er draait, waarom er caps zijn, en wat een sync ongeveer kost.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <Link href="/" className="font-medium text-[var(--accent)]">
            ← Radar
          </Link>
          <Link href="/costs" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Kosten / ROI
          </Link>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            In het kort
          </h2>
        </div>
        <ul className="divide-y divide-[var(--line)]/80 text-sm">
          {[
            "We zoeken op LinkedIn, Indeed en Freelancer binnen BNS-rollen — zo breed mogelijk.",
            "Careers = Firecrawl op een vaste watchlist (geen heel internet).",
            "Interessant = BNS-rol én contract/ZZP/interim. Score rangschikt. Dubbele URL = refresh.",
            "Kosten = wat Apify/Firecrawl per scrape rekenen; filteren in de app is gratis.",
          ].map((t) => (
            <li key={t} className="flex gap-2 px-4 py-2.5 sm:px-5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              <span className="text-[var(--ink)]">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]/25 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
          Wat is “interessant”?
        </h2>
        <ol className="mt-3 space-y-2.5 text-sm text-[var(--ink)]">
          <li>
            <strong>1. Binnen de BNS-rollen</strong> — titel/tekst moet matchen (Scrum Master, Agile
            Coach, BA, DevOps, …). Anders: weg.
          </li>
          <li>
            <strong>2. Contract / ZZP / interim is verplicht</strong> — vaste dienstverband-postings
            komen niet op de radar. Zoeken we ook actief op (LinkedIn contract-filter + keywords).
          </li>
          <li>
            <strong>3. Score rangschikt</strong> — hot / warm / volgen binnen die contracting-hits.
          </li>
        </ol>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Kortom: niche + contracting. Geen vaste banen. Prioriteit = score.
        </p>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            BNS-rollen (zoektermen)
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Deze titels gebruiken we op LinkedIn / Indeed / Freelancer. Varianten (bijv. Scrummaster)
            zitten in dezelfde zoekronde.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 py-3 sm:px-5">
          {roleNames.map((r) => (
            <span
              key={r}
              className="rounded bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink)]"
            >
              {r}
            </span>
          ))}
        </div>
        <p className="border-t border-[var(--line)]/80 px-4 py-2.5 text-xs text-[var(--muted)] sm:px-5">
          Niche-filter (of iets op de radar mag): {ROLE_FAMILIES.map((f) => f.label).join(" · ")}
        </p>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Wat betekenen die kosten?
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Je betaalt Apify/Firecrawl per scrape — niet per “goede hit”. Filteren is gratis in de
            app.
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)]/80 px-4 text-sm sm:px-5">
          {SYNC_COST_PER_RUN.meaning.map((m) => (
            <li key={m} className="py-2.5 text-[var(--ink)]">
              {m}
            </li>
          ))}
        </ul>
        <div className="grid gap-px border-t border-[var(--line)]/80 bg-[var(--line)]/80 sm:grid-cols-3">
          {[
            {
              label: "LinkedIn-zoek-URL’s",
              value: `tot ${INGEST_POLICY.syncMarketUrls}`,
              note: `~${INGEST_POLICY.syncMarketJobs} jobs · ruim over de niche`,
            },
            {
              label: "Indeed + Freelancer",
              value: `~${INGEST_POLICY.syncIndeedMax} / ${INGEST_POLICY.syncFreelanceQueries}`,
              note: "hits · queries per sync",
            },
            {
              label: "Careers-pagina’s",
              value: `tot ${INGEST_POLICY.careersMaxUrlsPerRun}`,
              note: `${platforms.length} op de watchlist`,
            },
          ].map((c) => (
            <div key={c.label} className="bg-[var(--surface)] px-4 py-3">
              <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">{c.label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                {c.value}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{c.note}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-px border-t border-[var(--line)]/80 bg-[var(--line)]/80 sm:grid-cols-2">
          {Object.entries(SYNC_COST_PER_RUN.actions).map(([key, a]) => (
            <div key={key} className="bg-[var(--surface)] px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[var(--ink)]">{a.label}</p>
                <p className="tabular-nums text-sm font-bold" style={{ fontFamily: "var(--mono)" }}>
                  €{a.eur.low.toFixed(2)}–{a.eur.high.toFixed(2)}
                </p>
              </div>
              <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                {a.tool} · per sync · {a.what}
              </p>
            </div>
          ))}
        </div>
        <p className="border-t border-[var(--line)]/80 px-4 py-2.5 text-xs text-[var(--muted)] sm:px-5">
          {SYNC_COST_PER_RUN.disclaimer} Bij 1×/dag Sync alles ≈ €20–135/m alleen scrapers (ruw).
          Maandbeeld:{" "}
          <Link href="/costs" className="text-[var(--accent)]">
            Kosten / ROI
          </Link>
          .
        </p>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--accent)]/25 bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            LinkedIn vandaag ({todayLinkedIn.length} URL’s)
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Cap staat nu ruim ({INGEST_POLICY.syncMarketUrls}) zodat we binnen de BNS-rollen zoveel
            mogelijk kunnen vullen. Volgorde roteert licht per dag.
          </p>
        </div>
        <ul className="max-h-52 divide-y divide-[var(--line)]/70 overflow-y-auto text-sm">
          {todayLinkedIn.map((s) => (
            <li key={s.url} className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5">
              <span className="font-medium text-[var(--ink)]">{s.query}</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-[var(--accent)] no-underline hover:underline"
              >
                open →
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Indeed + Freelancer.nl — wat betekent “rotatie”?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
            Indeed krijgt <strong>één hoofdquery per sync</strong>, niet alle rollen tegelijk (kosten).
            Welke rol dat is, wisselt per dag — vandaag:{" "}
            <strong style={{ fontFamily: "var(--mono)" }}>{indeedQuery}</strong>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Freelancer.nl: tot {INGEST_POLICY.syncFreelanceQueries} zoekpagina’s uit dezelfde
            rollenlijst, via Firecrawl. LinkedIn blijft de hoofdboon; deze boards vullen ZZP/interim-gaten.
          </p>
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Careers-watchlist ({platforms.length})
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
            Dit is <strong>geen scrape van heel NL</strong>. Het is een vaste lijst bedrijven die wij
            (met BNS) willen volgen — careers-URL in{" "}
            <code className="text-[0.75rem]">src/lib/platforms.ts</code>. Nu {platforms.length}{" "}
            enabled; Firecrawl opent die pagina’s en zoekt BNS-rollen in de tekst.
          </p>
        </div>
        <ul className="grid gap-0 sm:grid-cols-2">
          {platforms.map((p) => (
            <li
              key={p.id}
              className="flex items-baseline justify-between gap-2 border-b border-[var(--line)]/70 px-4 py-2 text-sm sm:px-5"
            >
              <span>
                <strong>{p.company}</strong>
                {p.sector ? <span className="text-[var(--muted)]"> · {p.sector}</span> : null}
              </span>
              <a
                href={p.careersUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-[var(--accent)] no-underline hover:underline"
              >
                careers →
              </a>
            </li>
          ))}
        </ul>
      </section>

      <a
        href="https://blablabuild.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline"
      >
        Tool gebouwd door <BlablaLogo className="h-4 w-4" />
        <span className="font-semibold text-[var(--ink)]">blablabuild</span>
      </a>
    </main>
  );
}
