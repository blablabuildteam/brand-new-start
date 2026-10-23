import type { ReactNode } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";

export const metadata = {
  title: "De afspraak — Brand New Start × blablabuild",
  description:
    "Commercieel model: 30% / 70% van de marge op nieuwe opdrachten via de tool, 20% op elke verlenging, kosten naar rato, maandelijks gefactureerd.",
};

const SHARE_FIRST = 0.3;
const SHARE_EXTENSION = 0.2;
const COST_SHARE = SHARE_FIRST;

const EX = {
  marginPerHour: 20,
  hoursPerWeek: 36,
  costsPerMonth: 100,
};
const hoursPerMonth = Math.round((EX.hoursPerWeek * 52) / 12);
const marginPerMonth = EX.marginPerHour * hoursPerMonth;

function eur(n: number) {
  return `€${Math.round(n).toLocaleString("nl-NL")}`;
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

const MONO = { fontFamily: "var(--mono)" } as const;
const DISPLAY = { fontFamily: "var(--display)" } as const;

function Section({
  kicker,
  title,
  lead,
  children,
}: {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
        {kicker ? (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]" style={MONO}>
            {kicker}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-base font-semibold" style={DISPLAY}>
          {title}
        </h2>
        {lead ? <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Split({ label, ours, theirs, note }: { label: string; ours: number; theirs: number; note: string }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-[var(--line)] px-3 py-2.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">blablabuild</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums" style={MONO}>
            {eur(ours)}
          </p>
        </div>
        <div className="rounded border border-[var(--line)] px-3 py-2.5">
          <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">Brand New Start</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums" style={MONO}>
            {eur(theirs)}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}

const OPEN_POINTS: { t: string; q: string; advice: string }[] = [
  {
    t: "Wat is “de marge” precies",
    q: "Klanttarief min ZZP-tarief per gefactureerd uur, of gaan er nog kosten van BNS af?",
    advice:
      "Klanttarief − ZZP-inkooptarief × gefactureerde uren, excl. btw. Geen overhead, sales-tijd of fee van een tussenpartij eraf — dat maakt de maandafrekening controleerbaar.",
  },
  {
    t: "Wanneer telt een deal als “via de tool”",
    q: "Hoe voorkomen we discussie over klanten die BNS al kende?",
    advice:
      "Bij start een lijst bestaande klanten en lopende pipeline; die tellen niet. Een deal telt als de kans in de Desk stond en in Kansen op Gecontacteerd → Gewonnen is gezet. Melden binnen 10 werkdagen na akkoord van de klant.",
  },
  {
    t: "Verlenging vs. nieuwe opdracht",
    q: "Is een tweede rol bij dezelfde klant 30%, 20% of niets? En een vervanger op dezelfde rol?",
    advice:
      "Zelfde klant, zelfde kandidaat, zelfde of vervolgrol = verlenging (20%). Vervanger op dezelfde opdracht = loopt door op 20%. Nieuwe rol bij die klant met een andere kandidaat = 20% (de klant kwam via de tool); een nieuwe klant via een nieuw signaal = weer 30%.",
  },
  {
    t: "Hoe lang loopt “alle verlengingen”",
    q: "Geen einddatum, of een maximum?",
    advice:
      "Expliciet opschrijven: zolang die kandidaat bij die klant werkt, zonder maximum — ook na het einde van de samenwerking. Wil BNS een cap, dan liever in jaren (bijv. 3) dan in aantal verlengingen.",
  },
  {
    t: "Wanbetaling van de klant",
    q: "Delen we het debiteurenrisico?",
    advice:
      "Ja, naar rato: ons aandeel is verschuldigd over wat BNS aan de klant factureert; betaalt de klant niet, dan crediteren we ons deel van die maand.",
  },
  {
    t: "Inzage voor de maandfactuur",
    q: "Waarop baseren we het bedrag?",
    advice:
      "BNS stuurt per lopende plaatsing per maand: uren, klanttarief, ZZP-tarief (of de factuurregels). Eén overzicht per maand is genoeg.",
  },
  {
    t: "Welke kosten delen we",
    q: "Wat valt onder “kosten naar rato”?",
    advice:
      "Wel: Apify, AI-research, Lusha/contactdata, hosting en database — wat op de Kosten-pagina staat. Niet: ontwikkeltijd van blablabuild (onze investering) en recruitertijd van BNS. Nieuwe betaalde tool of > €250/maand extra: eerst samen akkoord.",
  },
  {
    t: "Kostenverdeling in verlengmaanden",
    q: "Blijft het 30/70, of zakt ons deel mee naar 20%?",
    advice: "Simpel houden: kosten altijd 30/70, los van wat er die maand loopt.",
  },
  {
    t: "Vaste plaatsingen en overname",
    q: "Een lucky shot (vaste rol) of de klant neemt de ZZP’er over — delen we die fee ook?",
    advice:
      "Ja, zelfde verdeling: 30% van de werving- & selectie- of overnamefee als die rol/klant via de tool kwam. Lucky shots zijn juist daarvoor gebouwd.",
  },
  {
    t: "Betaaltermijn en btw",
    q: "Wanneer factureren we en hoe snel wordt er betaald?",
    advice:
      "Factuur in de eerste week van de maand over de vorige maand, betaaltermijn 14 dagen na ontvangst van de klantbetaling. Alle bedragen excl. btw.",
  },
  {
    t: "Stoppen",
    q: "Wat gebeurt er met lopende deals als we uit elkaar gaan?",
    advice:
      "30 dagen opzegtermijn. Lopende plaatsingen en hun verlengingen blijven gedeeld; kosten stoppen na de wind-down. Geen omweg via een andere BV of label (non-circumventie).",
  },
];

export default function SamenwerkingPage() {
  const firstOurs = marginPerMonth * SHARE_FIRST;
  const extOurs = marginPerMonth * SHARE_EXTENSION;
  const costOurs = EX.costsPerMonth * COST_SHARE;

  return (
    <main className="mx-auto min-h-dvh max-w-[820px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]" style={MONO}>
            Commercieel model · deelbaar met BNS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--ink)] md:text-3xl" style={DISPLAY}>
            De afspraak
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Brand New Start × blablabuild. Hoe we de marge delen op opdrachten die via de tool
            binnenkomen, wie welke kosten draagt, en hoe we elke maand afrekenen.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="font-medium text-[var(--accent)]">
            ← Desk
          </Link>
          <Link href="/kansen" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Kansen
          </Link>
          <Link href="/kosten" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Kosten
          </Link>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]/40 px-4 py-4 sm:px-5">
        <p className="text-sm leading-relaxed text-[var(--ink)]">
          <strong>In één zin:</strong> op elke nieuwe opdracht via de tool krijgt blablabuild{" "}
          {pct(SHARE_FIRST)} van de marge en Brand New Start {pct(1 - SHARE_FIRST)}; op elke
          verlenging {pct(SHARE_EXTENSION)} / {pct(1 - SHARE_EXTENSION)}. De kosten van de tool delen
          we in dezelfde verhouding ({pct(COST_SHARE)} / {pct(1 - COST_SHARE)}), en we rekenen elke
          maand af.
        </p>
      </section>

      <ul className="mb-8 grid gap-2 sm:grid-cols-2">
        {[
          {
            k: `${pct(SHARE_FIRST)} / ${pct(1 - SHARE_FIRST)}`,
            t: "Nieuwe opdracht",
            d: "Van de marge op een opdracht die via de tool is binnengekomen: blablabuild / BNS, zolang de eerste opdrachtperiode loopt.",
          },
          {
            k: `${pct(SHARE_EXTENSION)} / ${pct(1 - SHARE_EXTENSION)}`,
            t: "Elke verlenging",
            d: "Wordt de opdracht verlengd, dan gaat ons deel naar 20% — op álle verlengingen van die opdracht.",
          },
          {
            k: `${pct(COST_SHARE)} / ${pct(1 - COST_SHARE)}`,
            t: "Kosten naar rato",
            d: "Wij investeren mee: gebruikskosten van de tool (scraping, AI, contactdata, hosting) delen we in dezelfde verhouding.",
          },
          {
            k: "Maandelijks",
            t: "Afrekenen",
            d: "Eén factuur per maand over de marge van die maand, met de kostenverrekening erop. Valt een opdracht weg, dan stopt het vanzelf.",
          },
        ].map((item) => (
          <li key={item.t} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
            <p className="text-xl font-bold tabular-nums text-[var(--ink)]" style={MONO}>
              {item.k}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{item.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.d}</p>
          </li>
        ))}
      </ul>

      <Section
        kicker="Rekenvoorbeeld"
        title="Eén plaatsing, per maand"
        lead={`Stel: €${EX.marginPerHour}/uur marge (klanttarief − ZZP-tarief), ${EX.hoursPerWeek} uur per week ≈ ${hoursPerMonth} uur per maand. Bedragen excl. btw.`}
      >
        <div className="divide-y divide-[var(--line)]/80 text-sm">
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Marge per maand</p>
            <p className="mt-2 rounded bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]" style={MONO}>
              €{EX.marginPerHour}/u × {hoursPerMonth} u ={" "}
              <strong className="text-[var(--ink)]">{eur(marginPerMonth)}</strong> marge voor die maand
            </p>
          </div>
          <Split
            label={`Eerste opdrachtperiode · ${pct(SHARE_FIRST)} / ${pct(1 - SHARE_FIRST)}`}
            ours={firstOurs}
            theirs={marginPerMonth - firstOurs}
            note={`${pct(SHARE_FIRST)} van ${eur(marginPerMonth)} — elke maand dat de opdracht loopt.`}
          />
          <Split
            label={`Na verlenging · ${pct(SHARE_EXTENSION)} / ${pct(1 - SHARE_EXTENSION)}`}
            ours={extOurs}
            theirs={marginPerMonth - extOurs}
            note={`${pct(SHARE_EXTENSION)} van ${eur(marginPerMonth)} — ook bij de tweede, derde, … verlenging.`}
          />
          <Split
            label={`Toolkosten · ${pct(COST_SHARE)} / ${pct(1 - COST_SHARE)}`}
            ours={costOurs}
            theirs={EX.costsPerMonth - costOurs}
            note={`Voorbeeld met ${eur(EX.costsPerMonth)} kosten in een maand. Echte bedragen staan op de Kosten-pagina.`}
          />
          <div className="bg-[var(--accent-soft)]/30 px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Maandfactuur</p>
            <p className="mt-1.5 text-sm text-[var(--ink)]">
              In een maand met één lopende eerste opdracht factureert blablabuild{" "}
              <strong style={MONO}>{eur(firstOurs)}</strong> marge-aandeel. De kosten verrekenen we op
              dezelfde factuur: wie de rekeningen voorschiet, krijgt het deel van de ander terug. In een
              maand zónder deal is er alleen die kostenverrekening.
            </p>
          </div>
        </div>
      </Section>

      <Section kicker="In de praktijk" title="Hoe een maand loopt">
        <ol className="space-y-2.5 px-4 py-4 text-sm text-[var(--ink)] sm:px-5">
          {[
            <>
              Kans uit de tool benaderd? Zet hem in{" "}
              <Link href="/kansen" className="font-medium underline underline-offset-2">
                Kansen
              </Link>{" "}
              op <strong>Gecontacteerd</strong>. Getekend? <strong>Gewonnen</strong>, met marge per
              uur, uren en looptijd. Dat is meteen de registratie dat de deal via de tool kwam.
            </>,
            <>Eind van de maand stuurt BNS per lopende plaatsing de gefactureerde uren en tarieven.</>,
            <>
              blablabuild factureert {pct(SHARE_FIRST)} (eerste periode) of {pct(SHARE_EXTENSION)}{" "}
              (verlenging) van die marge, met de kostenverrekening {pct(COST_SHARE)} / {pct(1 - COST_SHARE)}.
            </>,
            <>Wordt een opdracht verlengd, dan zetten we in Kansen een notitie en loopt hij door op {pct(SHARE_EXTENSION)}.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]"
                style={MONO}
              >
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        kicker="Nog vast te leggen"
        title="Wat we nog expliciet moeten afspreken"
        lead="De kern staat. Dit zijn de punten waar later discussie over kan ontstaan — per punt ons voorstel."
      >
        <div className="divide-y divide-[var(--line)]/80 text-sm">
          {OPEN_POINTS.map((p, i) => (
            <div key={p.t} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-4 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  <span className="mr-1.5 tabular-nums text-[var(--muted)]" style={MONO}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.t}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{p.q}</p>
              </div>
              <p className="leading-relaxed text-[var(--ink)]">
                <span
                  className="mr-1.5 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--muted)]"
                  style={MONO}
                >
                  Voorstel
                </span>
                {p.advice}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Blijft zoals het was" title="Tool, data en klantrelatie">
        <ul className="space-y-2 px-4 py-4 text-sm text-[var(--ink)] sm:px-5">
          {[
            "De tool en de data erin (signalen, scores, gevonden opdrachtgevers en managers) zijn van blablabuild.",
            "BNS benadert, sluit en onderhoudt de klant en de kandidaat. Die relatie is van BNS.",
            "Bestaande klanten en pipeline van BNS bij de start vallen erbuiten.",
            "BNS mag andere tools blijven gebruiken; geen non-compete op het recruitmentwerk.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--green)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="mb-6 text-xs leading-relaxed text-[var(--muted)]">
        Deze pagina vat de afspraak samen. Wat getekend wordt, staat in de{" "}
        <Link href="/pilot" className="text-[var(--ink)] underline underline-offset-2">
          overeenkomst
        </Link>
        ; bij verschil gaat die voor. Bedragen in de voorbeelden zijn indicatief.
      </p>

      <a
        href="https://blablabuild.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline"
      >
        <BlablaLogo className="h-4 w-4" />
        <span className="font-semibold text-[var(--ink)]">blablabuild</span>
        <span>× Brand New Start</span>
      </a>
    </main>
  );
}
