import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BlablaLogo } from "@/components/blabla-logo";
import { PRODUCT } from "@/lib/product-brand";

export const metadata = {
  title: `Hoe het werkt — ${PRODUCT.name}`,
  description: "Van een vage post van een ander bureau naar een gesprek met de hiring manager.",
};

const STEPS = [
  {
    t: "Recruiter feed",
    href: "/leads",
    d: "Scout leest posts van bureaus die je volgt: “een klant van mij zoekt…”. Geen naam, wel een opdracht.",
    you: "Jij klikt AI zoeken (of laat Scout dat doen bij verse posts).",
  },
  {
    t: "Eindklant met bewijs",
    href: "/leads",
    d: "Scout combineert stack, locatie, looptijd, eerdere posts van die recruiter en wat online staat — en noemt een eindklant met score en bronnen.",
    you: "Jij bevestigt of past de naam aan. Twijfel? Dan staat erbij wat je moet checken.",
  },
  {
    t: "Kansen",
    href: "/kansen",
    d: "Elke bevestigde opdracht wordt een kans met één volgende stap: hiring manager zoeken → mail/tel → bericht.",
    you: "Jij klikt de knop rechts in de rij; Scout doet het zoekwerk.",
  },
  {
    t: "Bericht",
    href: "/regie",
    d: "Een concept aan de hiring manager, op basis van de opdracht.",
    you: "Jij kopieert en verstuurt zelf. Er gaat nooit iets automatisch de deur uit.",
  },
] as const;

const SOURCES = [
  { t: "Recruiter-posts", d: "LinkedIn-posts van bureaus en recruiters die je volgt" },
  { t: "Jobboards", d: "Vacatures die eindklanten zelf plaatsen (Indeed, inhuurdesks, LinkedIn Jobs)" },
  { t: "Open web", d: "Werkenbij-pagina’s, nieuws en eerdere vacatures — om de eindklant te bevestigen" },
] as const;

export default function MethodePage() {
  return (
    <AppShell title="Hoe het werkt" subtitle="Van vage post naar hiring manager">
      <main className="ws-shell ws-shell--page">
        <section className="mb-6 max-w-2xl">
          <h2 className="text-[1.35rem] font-semibold leading-snug text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
            Andere bureaus posten de opdracht. Scout vertelt je voor wíe.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Elke dag zetten bureaus opdrachten online zonder klantnaam. Wie als eerste de hiring manager spreekt, maakt
            de meeste kans. Scout zoekt de eindklant, de manager en een eerste bericht — jij houdt de regie.
          </p>
        </section>

        <section className="mb-6 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
          <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
              In vier stappen
            </h2>
          </div>
          <ol className="divide-y divide-[var(--line)]/80 text-sm">
            {STEPS.map((row, i) => (
              <li key={row.t} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[0.7rem] font-bold text-[var(--surface)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <Link href={row.href} className="font-semibold text-[var(--ink)] no-underline hover:underline">
                    {row.t}
                  </Link>
                  <span className="mt-0.5 block text-[var(--ink)]/80">{row.d}</span>
                  <span className="mt-1 block text-[0.78rem] text-[var(--muted)]">
                    <strong className="font-semibold text-[var(--ink)]">Jij:</strong> {row.you}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-5">
            <h2 className="mb-2 text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
              Wat Scout leest
            </h2>
            <ul className="space-y-2 text-sm">
              {SOURCES.map((s) => (
                <li key={s.t}>
                  <strong className="text-[var(--ink)]">{s.t}</strong>
                  <span className="block text-[var(--muted)]">{s.d}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-5">
            <h2 className="mb-2 text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
              Wat jij in de hand houdt
            </h2>
            <ul className="space-y-2 text-sm text-[var(--ink)]/85">
              <li>Niets wordt automatisch verstuurd: elk bericht gaat via jou.</li>
              <li>Elke eindklant komt met score, bewijs en wat je nog moet checken.</li>
              <li>Een zoekactie kost centen, geen euro’s — en je ziet vooraf wat iets kost.</li>
              <li>Bronnen draaien alleen als jij of je beheerder ze aanzet.</li>
            </ul>
          </section>
        </div>

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
    </AppShell>
  );
}
