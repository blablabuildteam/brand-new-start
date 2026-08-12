import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { SourceLogo } from "@/components/source-logo";
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
  description: "Per bron: wat we scrapen, hoe we filteren, en wat een sync kost.",
};

function SourceHeading({
  channel,
  title,
  tool,
}: {
  channel?: string;
  title: string;
  tool: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {channel ? <SourceLogo channel={channel} size="md" /> : null}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
          {title}
        </h2>
        <p className="text-[0.68rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          {tool}
        </p>
      </div>
    </div>
  );
}

export default function MethodePage() {
  const todayLinkedIn = buildLinkedInJobSearchUrls(INGEST_POLICY.syncMarketUrls);
  const platforms = enabledPlatforms();
  const day = new Date().getUTCDay();
  const boardRole = BOARD_QUERIES[day % BOARD_QUERIES.length]!;
  const indeedQuery = day % 2 === 0 ? `${boardRole} ZZP` : boardRole;
  const freelanceQueries = BOARD_QUERIES.slice(0, INGEST_POLICY.syncFreelanceQueries);

  const roleNames = [
    ...new Set([...MARKET_SEARCH_QUERIES.map((q) => q.role), ...BOARD_QUERIES]),
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
          <h1
            className="mt-1 text-2xl font-bold text-[var(--ink)] md:text-3xl"
            style={{ fontFamily: "var(--display)" }}
          >
            Hoe zoeken we?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Per bron wat we ophalen, hoe we filteren, en wat een sync ongeveer kost. Cron: 1×/dag
            06:00 UTC.
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
            "Elke bron draait apart: LinkedIn, Indeed, Freelance.nl (en optioneel careers).",
            "Interessant = BNS-rol én contract/ZZP/interim. Score rangschikt. Dubbele URL = refresh.",
            "Kosten = Apify/Firecrawl per scrape; filteren in de app is gratis.",
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
            komen niet op de radar.
          </li>
          <li>
            <strong>3. Score rangschikt</strong> — hot / warm / volgen binnen die contracting-hits.
          </li>
        </ol>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            BNS-rollen (zoektermen)
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Deze titels gebruiken we op LinkedIn / Indeed / Freelance.nl.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 py-3 sm:px-5">
          {roleNames.map((r) => (
            <span key={r} className="rounded bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink)]">
              {r}
            </span>
          ))}
        </div>
        <p className="border-t border-[var(--line)]/80 px-4 py-2.5 text-xs text-[var(--muted)] sm:px-5">
          Niche-filter: {ROLE_FAMILIES.map((f) => f.label).join(" · ")}
        </p>
      </section>

      {/* —— Per bron —— */}
      <h2
        className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
        style={{ fontFamily: "var(--mono)" }}
      >
        Per bron · wat scrapen we
      </h2>

      <section className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading channel="linkedin-jobs" title="LinkedIn Jobs" tool="Apify · hoofdboon" />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>
            We bouwen LinkedIn-zoek-URL’s voor BNS-rollen met <strong>contract/ZZP-filters</strong>,
            draaien die via Apify, en halen tot ~{INGEST_POLICY.syncMarketJobs} jobs op (cap:{" "}
            {INGEST_POLICY.syncMarketUrls} zoek-URL’s per sync).
          </p>
          <p className="text-[var(--muted)]">
            Daarna in-app: alleen niche + contractish houden · dedup op URL · score op de radar.
            Volgorde van queries roteert licht per dag.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Vandaag {todayLinkedIn.length} URL’s · ≈ €{SYNC_COST_PER_RUN.actions.market.eur.low}–
            {SYNC_COST_PER_RUN.actions.market.eur.high} / sync
          </p>
        </div>
        <ul className="max-h-44 divide-y divide-[var(--line)]/70 overflow-y-auto border-t border-[var(--line)]/80 text-sm">
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

      <section className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading channel="indeed" title="Indeed NL" tool="Apify · aparte sync-run" />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>
            Indeed krijgt <strong>één hoofdquery per sync</strong> (kosten), niet alle rollen tegelijk.
            Welke rol dat is, wisselt per dag — vandaag:{" "}
            <strong style={{ fontFamily: "var(--mono)" }}>{indeedQuery}</strong>.
          </p>
          <p className="text-[var(--muted)]">
            Apify-scraper (NL) haalt tot ~{INGEST_POLICY.syncIndeedMax} items. We houden titel,
            bedrijf, URL, soms plaatsingsdatum/aanmeldingen. Zelfde niche + contract-filter als
            LinkedIn.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Dit is <strong>niet</strong> hetzelfde als Freelance.nl — aparte bron, apart gelogd.
          </p>
        </div>
      </section>

      <section className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading channel="freelance-nl" title="Freelance.nl" tool="Firecrawl · aparte sync-run" />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>
            Freelance.nl is een SPA zonder nette jobs-API. We scrapen{" "}
            <strong>zoekpagina’s</strong> (
            <code className="text-[0.75rem]">freelance.nl/opdrachten?zoekwoord=…</code>) via
            Firecrawl (markdown), tot {INGEST_POLICY.syncFreelanceQueries} queries per sync.
          </p>
          <p className="text-[var(--muted)]">
            Uit de markdown trekken we regels die op BNS-rollen lijken; UI-rommel (sorteer/filter)
            gooien we weg. Hits krijgen kanaal <strong>freelance-nl</strong> — niet Indeed.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {freelanceQueries.map((q) => (
              <span
                key={q}
                className="rounded bg-[var(--surface-2)] px-2 py-1 text-[0.7rem] text-[var(--ink)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading
            channel="firecrawl-careers"
            title="Careers / platforms"
            tool="Firecrawl · watchlist (via Sync & meer)"
          />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>
            Geen scrape van heel NL. Vaste lijst bedrijven (
            <code className="text-[0.75rem]">platforms.ts</code>) — Firecrawl opent hun
            careers-URL en zoekt BNS-rollen in de tekst. Cap: tot{" "}
            {INGEST_POLICY.careersMaxUrlsPerRun} pagina’s / run · nu {platforms.length} enabled.
          </p>
        </div>
        <ul className="grid gap-0 border-t border-[var(--line)]/80 sm:grid-cols-2">
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

      <section className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading title="TenderNed" tool="Officiële API · stub tot credentials" />
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed text-[var(--muted)] sm:px-5">
          Awards/aanbestedingen als capaciteits-signaal (geen vacature-scrape). Staat klaar in code;
          live zodra API-credentials er zijn. Geen Apify/Firecrawl-kosten.
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <SourceHeading title="Team-pulse" tool="Eigen input · geen scraper" />
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed text-[var(--muted)] sm:px-5">
          Handmatige/team-meldingen (“ZZP besproken bij X”). Zwaar in de score, gratis. UI volgt
          later; API bestaat al.
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Wat betekenen die kosten?
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Je betaalt Apify/Firecrawl per scrape — niet per “goede hit”.
          </p>
        </div>
        <div className="grid gap-px bg-[var(--line)]/80 sm:grid-cols-2">
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
          {SYNC_COST_PER_RUN.disclaimer} Maandbeeld:{" "}
          <Link href="/costs" className="text-[var(--accent)]">
            Kosten / ROI
          </Link>
          .
        </p>
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
