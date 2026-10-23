import type { ReactNode } from "react";
import Link from "next/link";
import { BlablaLogo } from "@/components/blabla-logo";
import { PrintPilotButton } from "@/app/pilot/print-button";

export const metadata = {
  title: "Pilotovereenkomst — Brand New Start × blablabuild",
  description:
    "Afspraken over de Recruitment Scout-pilot: intellectueel eigendom, gebruik, gegevens, margedeling en vervolg.",
};

function Art({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-7 break-inside-avoid">
      <h2 className="text-[0.95rem] font-bold text-[var(--ink)]">
        <span className="tabular-nums text-[var(--muted)]">{n}.</span> {title}
      </h2>
      <div className="mt-2 space-y-2.5 text-[0.92rem] leading-relaxed text-[var(--ink)]">{children}</div>
    </section>
  );
}

export default function PilotPage() {
  return (
    <main className="pilot mx-auto min-h-dvh max-w-[760px] px-5 py-8 md:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p
            className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"
            style={{ fontFamily: "var(--mono)" }}
          >
            Overeenkomst · tekenen vóór de pilot
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--ink)] md:text-3xl">
            Pilotovereenkomst Recruitment Scout
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Dit is het stuk dat vastlegt: de tool en de data zijn van blablabuild, Brand New Start
            mag die gebruiken om te benaderen en te closen, de marge op opdrachten via de tool
            delen we 30/70 (20/80 bij verlenging), en de kosten delen we naar rato.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <Link href="/samenwerking" className="font-medium text-[var(--accent)]">
            ← De afspraak
          </Link>
          <PrintPilotButton />
        </div>
      </div>

      <p className="mb-6 hidden text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)] print:block">
        Pilotovereenkomst Recruitment Scout · Brand New Start × blablabuild
      </p>

      <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-5">
        <p className="text-sm leading-relaxed">
          <strong>Partijen</strong>
        </p>
        <ol className="mt-2 space-y-2 text-sm">
          <li>
            <strong>blablabuild</strong>, gevestigd te ______________, KvK ______________
            (hierna: <strong>Leverancier</strong>), ontwikkelaar van Recruitment Scout; en
          </li>
          <li>
            <strong>Brand New Start</strong>, gevestigd te ______________, KvK ______________
            (hierna: <strong>Bureau</strong>), gebruiker van de tool in de pilotfase.
          </li>
        </ol>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Startdatum pilot: ______________ · Einde (90 dagen): ______________
        </p>
      </section>

      <Art n="1" title="Wat dit is">
        <p>
          Leverancier geeft Bureau tijdens de pilot toegang tot Recruitment Scout (de Desk: Jobboards,
          Recruiter feed, Kansen, Bericht — hierna: de <strong>Tool</strong>), zodat Bureau
          opdrachtkansen kan signaleren en opvolgen.
        </p>
        <p>
          Dit is <strong>geen opdracht tot maatwerk</strong> en geen overdracht van de Tool. Bureau is
          gebruiker en praktijkpartner. Leverancier blijft eigenaar en bouwer van het product.
        </p>
        <p>
          De samenvatting van de afspraak (zelfde site, pagina De afspraak) is achtergrond. Bij
          strijd gaat deze overeenkomst voor.
        </p>
      </Art>

      <Art n="2" title="Hoe de Tool is gebouwd — en van wie die is">
        <p>
          De Tool is bedacht, gebouwd, gehost en onderhouden door Leverancier. Dat geldt voor code,
          ontwerp, architectuur, scoring, prompts, modellen, documentatie, merk, look-and-feel en
          alle latere versies. Ook als bij het bouwen hulpmiddelen zijn gebruikt (waaronder AI),
          blijft het resultaat van Leverancier.
        </p>
        <p>
          Bureau krijgt <strong>geen broncode</strong>, geen kopie om zelf te hosten, en geen recht
          om de Tool na te bouwen, te reverse-engineeren, door te verkopen of aan derden in licentie
          te geven.
        </p>
        <p>
          Inbreng van Bureau — feedback, wensen, vakkennis, wat wel en niet werkt op de desk —
          mag Leverancier vrij gebruiken om de Tool te verbeteren. Die inbreng maakt Bureau niet
          mede-eigenaar van de software. Wat Bureau wél houdt: de eigen manier van werven, en alles
          wat zij intern leren over hun proces.
        </p>
      </Art>

      <Art n="3" title="De data is van Leverancier">
        <p>
          Alles wat in de Tool staat of daaruit komt, is van Leverancier. Dat geldt voor signalen,
          vacatures, scores, research, gevonden opdrachtgevers, hiring managers, feeds, logs en
          afgeleide inzichten. Bureau heeft die data niet aangedragen en krijgt er geen eigendom
          op, ook niet door gebruik, bevestigen, notities of een gesloten deal.
        </p>
        <p>
          Bureau mag de output <strong>alleen gebruiken om organisaties te benaderen en een
          plaatsing te sluiten</strong> in de eigen praktijk, zolang de licentie loopt. Geen
          kopie van de dataset, geen export om elders te hergebruiken, geen doorgeven aan een
          ander bureau, geen eigen tool voeden met deze data.
        </p>
        <p>
          Een plaatsing die Bureau sluit, is hun deal met de klant. De onderliggende data en de
          Tool blijven van Leverancier. Correspondentie die Bureau zelf buiten de Tool voert
          (mail, bel), is hun communicatie — niet een overdracht van onze data.
        </p>
      </Art>

      <Art n="4" title="Licentie tijdens de pilot">
        <p>
          Leverancier verleent Bureau een niet-exclusieve, niet-overdraagbare licentie om de Tool
          en de data daarin te gebruiken om te signaleren, te benaderen en deals te sluiten, door
          de hieronder genoemde personen, gedurende de pilot. Niets anders.
        </p>
        <p className="text-[var(--muted)]">
          Gebruikers: _______________________________________________
        </p>
        <p>
          Accounts zijn persoonlijk. Geen doorzetten naar een ander bureau, geen white-label naar
          derden, geen scraping van de Tool zelf.
        </p>
      </Art>

      <Art n="5" title="Pilot — 90 dagen">
        <p>
          De pilot duurt 90 dagen vanaf de startdatum. Leverancier houdt de Tool redelijkerwijs
          beschikbaar en ontwikkelt door. Geen 24/7-SLA; storingen worden zo snel als praktisch
          hersteld.
        </p>
        <p>
          Bureau gebruikt de Tool in het echte werk, geeft tijdig feedback, en markeert
          radar-sourced outreach zoals in artikel 7.
        </p>
        <p>
          Uiterlijk in de laatste twee weken van de 90 dagen spreken partijen af of zij doorgaan
          (artikel 8), bijstellen, of stoppen (artikel 9).
        </p>
      </Art>

      <Art n="6" title="Margedeling en kosten naar rato">
        <p>
          Zodra Bureau een plaatsing sluit bij een organisatie die zij nog niet kenden, en die
          volgt uit de Tool, delen partijen de marge. Marge is klanttarief min ZZP-inkooptarief,
          maal de aan de klant gefactureerde uren, exclusief btw.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Eerste opdrachtperiode: 30% voor Leverancier, 70% voor Bureau;</li>
          <li>
            elke verlenging van díezelfde opdracht: 20% voor Leverancier, 80% voor Bureau, zonder
            maximum in aantal of duur.
          </li>
        </ul>
        <p>
          Gebruikskosten van de Tool (scraping, AI-research, contactdata, hosting en database)
          dragen partijen naar rato: 30% Leverancier, 70% Bureau. Ontwikkeltijd van Leverancier
          en tijd van Bureau tellen niet als kosten. Een nieuwe betaalde dienst of meer dan €250
          per maand extra kosten alleen na akkoord van beide partijen.
        </p>
        <p>
          Leverancier factureert maandelijks achteraf: het aandeel over de marge van die maand,
          met de verrekening van de kosten. Bureau levert daarvoor per lopende plaatsing de uren en
          tarieven aan. Betaalt de klant niet, dan vervalt het aandeel over dat bedrag naar rato.
        </p>
        <p>
          Geen margedeling als Bureau de organisatie al kende — bestaande klant of aantoonbare
          pipeline vóór het signaal. Bij start van de pilot levert Bureau een lijst bestaande
          klanten en open kansen; wat daarop staat, telt als gekend. Een organisatie die niet op
          die lijst stond, telt als nieuw.
        </p>
        <p>
          Bureau meldt een gesloten plaatsing binnen 10 werkdagen, met opdrachtgever, startdatum,
          tariefmarge en looptijd. Het aandeel over lopende plaatsingen en hun verlengingen, en
          openstaande kosten, blijven verschuldigd na einde van de pilot.
        </p>
      </Art>

      <Art n="7" title="Wanneer de margedeling geldt">
        <p>Een plaatsing telt als:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>het signaal in de Desk stond (Jobboards, Recruiter feed of Kansen);</li>
          <li>Bureau daarop heeft benaderd of de deal heeft gesloten (in Kansen: Gecontacteerd → Gewonnen); en</li>
          <li>de organisatie niet op de startlijst bestaande klanten/pipeline stond.</li>
        </ol>
        <p>
          Maandelijks een korte review. Twijfel over “al gekend” wordt tegen die startlijst
          gehouden. Verzwijgen van een nieuwe close via de Tool is een tekortkoming.
        </p>
      </Art>

      <Art n="8" title="Vervolg na de pilot">
        <p>Na 90 dagen zijn er drie normale uitkomsten:</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <strong>Doorgaan.</strong> Dezelfde margedeling blijft gelden. Schriftelijk bevestigen
            is genoeg.
          </li>
          <li>
            <strong>Bijstellen.</strong> Fee, scope of kosten wijzigen alleen schriftelijk.
          </li>
          <li>
            <strong>Stoppen.</strong> Zie artikel 9. Geen boete.
          </li>
        </ol>
        <p>
          Later samen verkopen aan andere bureaus is een optie, geen verplichting. Dat is een
          aparte afspraak. Bureau heeft geen aandeel in de Tool en geen veto op andere klanten van
          Leverancier, behalve de soft exclusivity van artikel 10 tijdens de pilot.
        </p>
      </Art>

      <Art n="9" title="Opzegging en exit">
        <p>
          Beide partijen mogen opzeggen met 30 dagen schriftelijke kennisgeving, ook tijdens de
          pilot. Bij einde: toegang stopt na de wind-down. Bureau krijgt geen export van de
          dataset, scores of research. Het aandeel over al gesloten opdrachten en al hun
          verlengingen blijft verschuldigd. Partijen omzeilen dit niet via een andere entiteit of
          label.
        </p>
        <p>
          Bureau mag daarna eigen tools bouwen of kopen. Dat geeft geen recht op code, prompts,
          scoring of kopie van Recruitment Scout.
        </p>
      </Art>

      <Art n="10" title="Soft exclusivity tijdens de pilot">
        <p>
          Tijdens de 90 dagen: Bureau werkt in hun IT-contracting-niche met deze Tool als
          scout-product; Leverancier verkoopt diezelfde niche-configuratie niet aan een directe
          concurrent van Bureau in Nederland.
        </p>
        <p>
          Bureau mag andere tools blijven gebruiken. Leverancier mag de Tool inzetten buiten die
          concurrentie-niche. Na de pilot vervalt deze exclusivity tenzij schriftelijk verlengd.
          Geen non-compete op het recruitmentwerk van Bureau.
        </p>
      </Art>

      <Art n="11" title="Geheimhouding">
        <p>
          Partijen houden elkaars niet-openbare informatie geheim: werkwijze, tarieven, klanten,
          kandidaatgegevens, en hoe de Tool intern werkt. Dit blijft 2 jaar na einde van kracht,
          voor persoonsgegevens zolang de wet dat eist.
        </p>
      </Art>

      <Art n="12" title="Gegevensbescherming">
        <p>
          Leverancier is verwerkingsverantwoordelijke voor de data in de Tool. Bureau verwerkt
          bij outreach alleen wat nodig is om te benaderen en te sluiten, onder deze licentie, en
          is zelf verantwoordelijk voor die correspondentie.
        </p>
        <p>
          Leverancier treft passende maatregelen. Hosting, scraping en AI-subprocessors horen bij
          het product.
        </p>
      </Art>

      <Art n="13" title="Aansprakelijkheid">
        <p>
          De Tool is een hulpmiddel. Bureau blijft verantwoordelijk voor outreach, compliance
          (inclusief LinkedIn-gebruik), plaatsingen en wat zij aan klanten belooft.
        </p>
        <p>
          Aansprakelijkheid van Leverancier is beperkt tot directe schade, tot maximaal het
          bedrag dat Bureau in de 12 maanden daarvoor aan Leverancier heeft betaald. Geen aansprakelijkheid voor misgelopen deals, indirecte schade of
          gevolgschade, behalve bij opzet of grove schuld.
        </p>
      </Art>

      <Art n="14" title="Overig">
        <p>
          Nederlands recht. Geschillen eerst in overleg, daarna de bevoegde rechter in het
          arrondissement van Leverancier. Wijzigingen alleen schriftelijk (e-mail volstaat). Als
          een bepaling nietig is, blijft de rest in stand.
        </p>
        <p className="text-[0.8rem] text-[var(--muted)]">
          Dit is een werkbare overeenkomst tussen twee partijen, geen advocatenstuk. Laat het
          kort toetsen als jullie dat willen; de bedoeling is helder te zijn vóór de pilot start.
        </p>
      </Art>

      <section className="mt-10 grid gap-8 sm:grid-cols-2 print:mt-8">
        {[
          { who: "blablabuild", role: "Leverancier" },
          { who: "Brand New Start", role: "Bureau" },
        ].map((p) => (
          <div key={p.who} className="border-t border-[var(--line)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{p.role}</p>
            <p className="mt-1 font-semibold">{p.who}</p>
            <p className="mt-6 text-sm text-[var(--muted)]">Naam / functie</p>
            <p className="mt-6 border-b border-[var(--line)] pb-1 text-sm">&nbsp;</p>
            <p className="mt-6 text-sm text-[var(--muted)]">Datum / handtekening</p>
            <p className="mt-8 border-b border-[var(--line)] pb-1">&nbsp;</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-xs text-[var(--muted)] print:mt-8">
        Versie voor de pilotfase. Behoort bij De afspraak Brand New Start × blablabuild.
      </p>

      <a
        href="https://blablabuild.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 text-xs text-[var(--muted)] no-underline print:hidden"
      >
        Van <BlablaLogo className="h-4 w-4" />
        <span className="font-semibold text-[var(--ink)]">blablabuild</span>
        <span>voor Brand New Start</span>
      </a>
    </main>
  );
}
