import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { SourceLogo } from "@/components/source-logo";
import { buildLinkedInJobSearchUrls } from "@/lib/ingest/market-jobs";
import { enabledPlatforms } from "@/lib/platforms";
import { INGEST_POLICY, SYNC_COST_PER_RUN } from "@/lib/costs";
import { loadHuntSettings } from "@/lib/hunt";
import { SCORE_MAX, SCORE_METHOD } from "@/lib/score";

export const metadata = {
  title: "Methode & queries — Contracting radar",
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

export default async function MethodePage() {
  const hunt = await loadHuntSettings();
  const todayLinkedIn = buildLinkedInJobSearchUrls(INGEST_POLICY.syncMarketUrls);
  const platforms = enabledPlatforms();
  const indeedQueries = hunt.roles
    .slice(0, INGEST_POLICY.syncIndeedQueries)
    .map((role) => (hunt.requireContract ? `${role} ZZP` : role));
  const freelanceQueries = hunt.roles.slice(0, INGEST_POLICY.syncFreelanceQueries);

  const roleNames = [...new Set(hunt.roles)].sort((a, b) => a.localeCompare(b, "nl"));

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
            Geen automatische sync. LinkedIn, Indeed en Freelance.nl alleen handmatig — advies ~1×/
            {INGEST_POLICY.boardsCadenceDays} dagen.
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
            hunt.requireContract
              ? "Interessant = jouw rollen (Instellingen) én contract/ZZP/interim. Score rangschikt. Dubbele URL = refresh."
              : "Interessant = jouw rollen (Instellingen). Score rangschikt. Dubbele URL = refresh.",
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
            <strong>1. Binnen jouw rollen</strong> — titel/tekst moet matchen met het kader in{" "}
            <a href="/instellingen">Instellingen</a>. Anders: weg.
          </li>
          {hunt.requireContract ? (
            <li>
              <strong>2. Contract / ZZP / interim is verplicht</strong> — vaste dienstverband-postings
              komen niet op de radar.
            </li>
          ) : (
            <li>
              <strong>2. Contract-filter staat uit</strong> — ook vaste rollen mogen door, tot je het
              weer aanzet in Instellingen.
            </li>
          )}
          <li>
            <strong>3. Score rangschikt per opening</strong> — sterke / warme / volgen. Meerdere
            vacatures bij één klant = één rij in de lijst, alle openingen rechts met eigen score.
            De lijst toont de hoogste score van dat bedrijf.
          </li>
        </ol>
      </section>

      <section
        id="score"
        className="mb-6 scroll-mt-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]"
      >
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Hoe werkt de kans-score?
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Max {SCORE_MAX} · herschatting bij elke sync</p>
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>{SCORE_METHOD.intro}</p>
          <p className="text-[var(--muted)]">
            “Warme kans” is een <strong className="text-[var(--ink)]">scoreband</strong> (≥55), geen
            grafiek die automatisch omhoog loopt. De score kan ook lager worden (bijv. als “net op de
            radar”-punten wegzakken).
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)]/80 border-t border-[var(--line)]/80 text-sm">
          {SCORE_METHOD.bands.map((b) => (
            <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 sm:px-5">
              <span>
                <strong>{b.label}</strong>
                <span className="text-[var(--muted)]"> — {b.meaning}</span>
              </span>
              <span className="tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
                {b.id === "cold" ? `< ${SCORE_METHOD.bands[2]!.min}` : `≥ ${b.min}`}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">
            Factoren (punten stapelen)
          </p>
          <ul className="space-y-1.5 text-sm">
            {SCORE_METHOD.factors.map((f) => (
              <li key={f.when} className="flex justify-between gap-3">
                <span className="text-[var(--ink)]">{f.when}</span>
                <span className="shrink-0 tabular-nums text-[var(--green)]" style={{ fontFamily: "var(--mono)" }}>
                  {f.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Rollen (Instellingen)
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Dit kader staat in <a href="/instellingen">Instellingen</a>. Sync zoekt hierop.
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
          {hunt.requireContract ? "Alleen contract / ZZP / interim." : "Ook vaste rollen toegestaan."}{" "}
          {hunt.market}
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
            We bouwen LinkedIn-zoek-URL’s voor jouw rollen
            {hunt.requireContract ? (
              <>
                {" "}
                met <strong>contract/ZZP-filters</strong>
              </>
            ) : null}
            , draaien die via Apify, en halen tot ~{INGEST_POLICY.syncMarketJobs} jobs op (cap:{" "}
            {INGEST_POLICY.syncMarketUrls} zoek-URL’s per sync).
          </p>
          <p className="text-[var(--muted)]">
            Daarna in-app: alleen jouw rollen
            {hunt.requireContract ? " + contract/ZZP" : ""} houden · dedup op URL · score op de radar.
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
          <SourceHeading channel="indeed" title="Indeed NL" tool="Apify · aparte sync-run · alle rollen" />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-[var(--ink)] sm:px-5">
          <p>
            Indeed is een <strong>eigen sync-run</strong>. Per boards-sync draaien we{" "}
            <strong>alle ingestelde rollen</strong> (nu {indeedQueries.length} queries
            {hunt.requireContract ? ": rol + “ZZP”" : ""}), via Apify{" "}
            <code className="text-[0.75rem]">misceres/indeed-scraper</code>, land NL.
          </p>
          <p>
            <strong>Waarom niet elke dag?</strong> Alle rollen tegelijk is duurder/zwaarder dan één
            query. Daarom: <strong>volledige dekking per run</strong>, cadans ~1×/
            {INGEST_POLICY.boardsCadenceDays} dagen — aanvullen/updaten i.p.v. elke dag één rol te
            roteren. Dedup op URL: bestaande hits worden vernieuwd, nieuwe komen erbij.
          </p>
          <p className="text-[var(--muted)]">
            Cap: tot ~{INGEST_POLICY.syncIndeedMax} items over alle queries samen (~
            {Math.max(4, Math.ceil(INGEST_POLICY.syncIndeedMax / Math.max(1, indeedQueries.length)))}{" "}
            per rol). We bewaren titel, bedrijf, URL, locatie, plaatsingsdatum/aanmeldingen (als
            Apify die levert). Daarna filter op jouw rollen
            {hunt.requireContract ? " + contract" : ""} · score op de radar.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Handmatig via Sync & meer → Alleen Indeed. ≈ €{SYNC_COST_PER_RUN.actions.indeed.eur.low}–
            {SYNC_COST_PER_RUN.actions.indeed.eur.high} / run (los van Freelance.nl).
          </p>
        </div>
        <div className="border-t border-[var(--line)]/80 px-4 py-2.5 sm:px-5">
          <p className="mb-2 text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">
            Queries per boards-sync ({indeedQueries.length})
          </p>
          <ul className="max-h-52 divide-y divide-[var(--line)]/70 overflow-y-auto text-sm">
            {indeedQueries.map((q) => (
              <li key={q} className="flex items-center justify-between gap-3 py-1.5">
                <span className="font-medium text-[var(--ink)]" style={{ fontFamily: "var(--mono)" }}>
                  {q}
                </span>
                <a
                  href={`https://nl.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Netherlands`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-[var(--accent)] no-underline hover:underline"
                >
                  open →
                </a>
              </li>
            ))}
          </ul>
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
            Firecrawl. <strong>Eigen sync-ronde</strong>, los van Indeed. Advies: ~1×/
            {INGEST_POLICY.boardsCadenceDays} dagen. Tot {INGEST_POLICY.syncFreelanceQueries}{" "}
            zoekpagina’s per sync.
          </p>
          <p className="text-[var(--muted)]">
            Uit de markdown trekken we alleen echte opdracht-links (
            <code className="text-[0.75rem]">/opdracht/…</code>) mét opdrachtgever-naam. Tot{" "}
            {INGEST_POLICY.syncFreelanceDetails} opdracht-pagina’s extra voor contact/afdeling.
            Freelance.nl zelf is geen bedrijf op de radar.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Freelance.nl alleen ≈ €{SYNC_COST_PER_RUN.actions["freelance-nl"].eur.low}–
            {SYNC_COST_PER_RUN.actions["freelance-nl"].eur.high} / run (Firecrawl-credits).
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
            careers-URL en zoekt jouw rollen in de tekst. Cap: tot{" "}
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
