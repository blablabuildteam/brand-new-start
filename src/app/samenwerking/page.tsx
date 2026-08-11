import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { ROI_MODEL, mvpMonthlyTotal } from "@/lib/costs";

export const metadata = {
  title: "Samenwerkingsvoorstel — Brand New Start × blablabuild",
  description:
    "Verdienmodel: alleen fee op new business uit de radar, bestaande BNS-omzet blijft onaangeroerd.",
};

export default function SamenwerkingPage() {
  const midMargin = ROI_MODEL.marginPerPlacement({ marginPerHour: 20, weeks: 20 });
  const feePct = 0.2;
  const feePerDeal = Math.round(midMargin * feePct);
  const monthly = mvpMonthlyTotal();
  const stackHighYear = monthly.withFirecrawl.high * 12;

  return (
    <main className="mx-auto min-h-dvh max-w-[820px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Voorstel · deelbaar met BNS · niet-bindend
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--ink)] md:text-3xl" style={{ fontFamily: "var(--display)" }}>
            Samen optrekken op new business
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Brand New Start × blablabuild — de radar als motor voor extra interim-plaatsingen bij
            nieuwe organisaties, zonder invloed op jullie bestaande klanten. Deze pagina is te delen
            (geen login).
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

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)]/40 px-4 py-4 sm:px-5">
        <p className="text-sm leading-relaxed text-[var(--ink)]">
          <strong>In één zin:</strong> wij bouwen en draaien de radar; jullie houden 100% van jullie
          bestaande klanten en business. Alleen bij een <em>nieuwe organisatie</em> die aantoonbaar
          via de radar binnenkomt delen we de marge — 20% op de eerste opdracht, 10% bij verlenging.
          De klantrelatie blijft 100% bij Brand New Start.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Principes</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            {
              t: "Bestaande omzet onaangeroerd",
              d: "Geen fee op bestaande BNS-klanten — ook niet bij een nieuwe rol daar via de radar. Alleen écht nieuwe organisaties.",
            },
            {
              t: "Alleen attributed new business",
              d: "Fee alleen als het signaal via de radar naar outreach en deal is te herleiden.",
            },
            {
              t: "BNS blijft eigenaar",
              d: "Klanten, kandidaten en relaties blijven van Brand New Start. Tool-IP bij blablabuild (licentie).",
            },
            {
              t: "Schalen mag, verplicht niet",
              d: "Later samen naar andere bureaus / specialisaties — BNS verdient mee als jullie dat willen.",
            },
            {
              t: "Aligned prikkels",
              d: "Wij verdienen als de radar écht deals oplevert — kwaliteit boven volume.",
            },
          ].map((item) => (
            <li key={item.t} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{item.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <p
            className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Model A · aanbevolen
          </p>
          <h2 className="mt-0.5 text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Attributed New Placement Fee
          </h2>
        </div>

        <div className="divide-y divide-[var(--line)]/80 text-sm">
          {[
            ["Wat telt", "Interim-plaatsing vanuit radar-signaal (hot/warm → outreach → deal)."],
            ["Wat niet telt", "Bestaande BNS-klanten (ook een nieuwe rol daar via radar), opdrachten die al liepen, of leads zonder radar-link. Fee alleen bij écht nieuwe klant/organisatie via de radar."],
            [
              "Fee · eerste opdracht",
              "15–25% van de uurtarief-marge over de eerste opdrachtperiode (voorstel: 20%).",
            ],
            [
              "Fee · verlenging / doorloop",
              "Tail 10% op verlengingen of doorlopende weken van díe attributed opdracht, max 12–24 maanden na startdatum.",
            ],
            [
              "Wat de tail níet is",
              "Geen aandeel op andere rollen of andere klanten. Wel opnieuw volle fee als een níeuw radar-signaal tot een andere attributed (nieuwe) organisatie leidt.",
            ],
            [
              "Klantrelatie",
              "BNS houdt de klant tevreden en ‘owns’ de relatie. Tail beloont alleen het binnenbrengen — niet accountmanagement.",
            ],
            [
              "Toolkosten",
              "Apify / Firecrawl / hosting: 1:1 doorbelasten óf meenemen in de fee (expliciet kiezen).",
            ],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
              <p className="text-[var(--ink)]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Rekenvoorbeeld — zo lees je het
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Stel: de radar vindt een nieuwe interim-opdracht. BNS plaatst iemand. Wat verdient wie?
          </p>
        </div>

        <div className="space-y-0 divide-y divide-[var(--line)]/80 text-sm">
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">1. Wat is “de marge”?</p>
            <p className="mt-1.5 text-[var(--ink)]">
              Dat is wat BNS overhoudt op de opdracht: klant-uurtarief minus ZZP-uurtarief, × uren × weken.
            </p>
            <p
              className="mt-2 rounded bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]"
              style={{ fontFamily: "var(--mono)" }}
            >
              €20/u × 36u/week × 20 weken ={" "}
              <strong className="text-[var(--ink)]">€{midMargin.toLocaleString("nl-NL")}</strong> marge
              voor BNS op die opdracht
            </p>
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              2. Eerste opdracht — fee 20%
            </p>
            <p className="mt-1.5 text-[var(--ink)]">
              Omdat de radar deze opdracht heeft gesignaleerd, krijgt blablabuild 20% van die marge.
              BNS houdt de rest.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-[var(--line)] px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">blablabuild</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                  €{feePerDeal.toLocaleString("nl-NL")}
                </p>
                <p className="text-xs text-[var(--muted)]">20% van €{midMargin.toLocaleString("nl-NL")}</p>
              </div>
              <div className="rounded border border-[var(--line)] px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">BNS houdt</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                  €{(midMargin - feePerDeal).toLocaleString("nl-NL")}
                </p>
                <p className="text-xs text-[var(--muted)]">80% — plus de klantrelatie</p>
              </div>
            </div>
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              3. Opdracht wordt verlengd — tail 10%
            </p>
            <p className="mt-1.5 text-[var(--ink)]">
              Blijft dezelfde opdracht lopen (of wordt verlengd)? Dan geen 20% meer, maar een kleinere
              “bedank-fee” van 10% — omdat jullie die opdracht hebben binnengebracht. BNS blijft de
              relatie en tevredenheid doen.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-[var(--line)] px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">blablabuild (tail)</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                  €{Math.round(midMargin * 0.1).toLocaleString("nl-NL")}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  10% van weer ≈ €{midMargin.toLocaleString("nl-NL")} marge
                </p>
              </div>
              <div className="rounded border border-[var(--line)] px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-wide text-[var(--muted)]">BNS houdt</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--mono)" }}>
                  €{Math.round(midMargin * 0.9).toLocaleString("nl-NL")}
                </p>
                <p className="text-xs text-[var(--muted)]">90% bij verlenging</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--accent-soft)]/30 px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Kortom</p>
            <ul className="mt-1.5 space-y-1 text-sm text-[var(--ink)]">
              <li>Zonder radar → deze marge bestond voor BNS niet (of was lastiger te vinden).</li>
              <li>Met radar → BNS krijgt alsnog het grootste deel; jullie een stuk voor het signaal.</li>
              <li>
                Toolkosten (≈ €{stackHighYear.toLocaleString("nl-NL")}/jaar worst-case) zijn vaak al
                gedekt door <em>één</em> extra plaatsing.
              </li>
              <li>Bestaande opdrachten van BNS: daar betalen ze jullie niets over.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Attribution</h2>
        <ol className="space-y-2.5 text-sm text-[var(--ink)]">
          {[
            "Signaal markeren als “Outreach via radar”.",
            "Bij deal: vink “Radar-sourced” + koppeling aan radar-id.",
            "Twijfel → default = géén fee (beschermt de BNS-relatie).",
            "Maandelijks 15 min review: welke deals wel/niet attributed.",
          ].map((step, i) => (
            <li key={step} className="flex gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]"
                style={{ fontFamily: "var(--mono)" }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Exclusiviteit & “zelf bouwen”
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Kort houden — genoeg bescherming, geen zwaar contract.
          </p>
        </div>
        <div className="divide-y divide-[var(--line)]/80 text-sm">
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Exclusiviteit · twee kanten
            </p>
            <ul className="mt-2 space-y-1.5 text-[var(--ink)]">
              <li>
                <strong>Tijdens de pilot (90 dagen):</strong> soft exclusivity — BNS werkt voor hun
                niche (agile/SM/BA e.d.) met ons; wij verkopen diezelfde niche-config niet aan een
                directe concurrent van BNS in NL.
              </li>
              <li>
                <strong>Daarna:</strong> verlengen bij wederzijds akkoord, of stoppen. Geen eeuwige
                lock-in. Andere specialisaties / andere bureaus blijven open (tenzij we samen
                schalen).
              </li>
              <li>
                <strong>Niet exclusief:</strong> BNS mag andere tools blijven gebruiken. Wij mogen
                het product elders inzetten buiten hun concurrentie-niche tijdens de soft-periode.
              </li>
            </ul>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Als BNS het zelf wil bouwen
            </p>
            <ul className="mt-2 space-y-1.5 text-[var(--ink)]">
              <li>
                Mag — hun business, hun keuze. Code/IP van de tool blijft van blablabuild tenzij
                expliciet overgedragen (dat doen we niet standaard).
              </li>
              <li>
                Bij stop: nette exit (data-export van hun radar-hits, 30 dagen wind-down). Geen
                boete; open success-fees over al lopende attributed deals blijven verschuldigd.
              </li>
              <li>
                Praktisch risico voor ons: laag als we op success verdienen — geen lange prepaid
                lock. Ons “moat” is doorontwikkeling + niche-config, niet een verbod.
              </li>
            </ul>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Wat we wél even vastleggen (1 pagina)
            </p>
            <ul className="mt-2 space-y-1.5 text-[var(--ink)]">
              <li>Fee % (eerste + tail) + attribution + “bestaande pipeline buiten scope”</li>
              <li>Soft exclusivity niche + duur (pilot → review)</li>
              <li>IP bij blablabuild; BNS mag inzichten/processen vrij gebruiken</li>
              <li>Opzegtermijn 30 dagen; geen non-compete op hun recruitmentwerk</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Alternatieven</h2>
        <div className="overflow-hidden rounded-md border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/80 text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium sm:px-4">Model</th>
                <th className="px-3 py-2 font-medium sm:px-4">Wanneer</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-4">Kanttekening</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]/80 bg-[var(--surface)]">
              <tr>
                <td className="px-3 py-2.5 font-medium sm:px-4">A. Pure success</td>
                <td className="px-3 py-2.5 text-[var(--muted)] sm:px-4">Default — beste alignment</td>
                <td className="hidden px-3 py-2.5 text-[var(--muted)] sm:table-cell sm:px-4">
                  Cashflow voor blablabuild onzekerder
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium sm:px-4">B. Hybrid</td>
                <td className="px-3 py-2.5 text-[var(--muted)] sm:px-4">€150–300/m + 10–15% success</td>
                <td className="hidden px-3 py-2.5 text-[var(--muted)] sm:table-cell sm:px-4">
                  Fair als stack structureel doorloopt
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium sm:px-4">C. Retainer only</td>
                <td className="px-3 py-2.5 text-[var(--muted)] sm:px-4">Als success niet gewenst is</td>
                <td className="hidden px-3 py-2.5 text-[var(--muted)] sm:table-cell sm:px-4">
                  Voelt sneller als kostenpost
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Openen met A; na 3 maanden eventueel naar B als de stack structureel €50+/m kost.
        </p>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Pilot · 90 dagen
          </h2>
        </div>
        <ul className="space-y-2 px-4 py-4 text-sm text-[var(--ink)] sm:px-5">
          {[
            "Tool live voor het BNS-team.",
            "Success fee 20% op eerste attributed periode; tail 10% op verlengingen van díe opdracht (max 12–24 mnd).",
            "Optionele cap per deal zodat niemand schrikt.",
            "Na 90 dagen: # attributed deals, marge, fee, tevredenheid → verlengen of bijstellen.",
            "Schriftelijk: bestaande BNS-klanten en pipeline buiten scope.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--green)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
          <p
            className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Optie · later
          </p>
          <h2 className="mt-0.5 text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
            Samen verkopen aan andere bureaus
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Dezelfde radar, andere specialisatie (finance, tech, healthcare, …). BNS is pilot én
            optionele partner — geen verplichting.
          </p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm text-[var(--ink)] sm:px-5">
          <p>
            Als de radar bij BNS werkt, kunnen we hem productiseren voor andere recruitmentbureaus.
            BNS mag daarop meeverdienen — bijvoorbeeld als referentie, niche-adviseur of
            co-seller — <strong>alleen als jullie dat willen</strong>.
          </p>
          <ul className="space-y-2">
            {[
              {
                t: "Wat BNS inbrengt (optioneel)",
                d: "Praktijkkennis, referentie-case, warm intros naar bevriende bureaus.",
              },
              {
                t: "Wat blablabuild inbrengt",
                d: "Product, hosting, niche-config per bureau, sales van de software.",
              },
              {
                t: "Verdienste voor BNS",
                d: "Bijv. 10–20% van de software-omzet (SaaS/retainer) of een vaste referral per live bureau — nader af te spreken.",
              },
              {
                t: "Grenzen",
                d: "Geen claim op deals van die andere bureaus. BNS-eigen business blijft strikt gescheiden.",
              },
            ].map((row) => (
              <li key={row.t} className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {row.t}
                </span>
                <span className="text-[var(--ink)]">{row.d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Voor BNS</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--ink)]">
            <li>Geen vaste software-huur die pijn doet zonder resultaat</li>
            <li>Alleen betalen bij aantoonbaar extra resultaat</li>
            <li>Radar als new-business motor, niet als controle op de desk</li>
            <li>Optioneel meeverdienen als we naar andere bureaus schalen</li>
          </ul>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Voor blablabuild</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--ink)]">
            <li>Upside gekoppeld aan echte waarde</li>
            <li>Reden om de radar scherp te houden</li>
            <li>Pad naar product met BNS als pilot / partner (als zij willen)</li>
          </ul>
        </div>
      </section>

      <p className="mb-6 text-xs text-[var(--muted)]">
        Dit is een werkvoorstel ter bespreking — geen bindende overeenkomst. Cijfers zijn indicatief
        en volgen het ROI-model op de kostenkant.
      </p>

      <a
        href="https://blablabuild.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline"
      >
        Voorstel van <BlablaLogo className="h-4 w-4" />
        <span className="font-semibold text-[var(--ink)]">blablabuild</span>
        <span>voor Brand New Start</span>
      </a>
    </main>
  );
}
