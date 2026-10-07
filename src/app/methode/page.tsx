import { AppShell } from "@/components/app-shell";
import { BlablaLogo } from "@/components/blabla-logo";
import { PRODUCT } from "@/lib/product-brand";

export const metadata = {
  title: `Hoe het werkt — ${PRODUCT.name}`,
  description: "Korte werkwijze van de desk.",
};

const STEPS = [
  {
    t: "Jobboards",
    d: "Vacatures van de boards. Score helpt sorteren; jij klikt wat interessant is.",
  },
  {
    t: "Recruiter feed",
    d: "Posts van kantoren die je volgt. Jij bevestigt wie de opdrachtgever is.",
  },
  {
    t: "Kansen",
    d: "Bevestigde en warme kansen op één lijst — met de volgende stap per rij.",
  },
  {
    t: "Contact",
    d: "Manager, mail/tel en bericht klaarzetten. Jij stuurt zelf.",
  },
] as const;

export default function MethodePage() {
  return (
    <AppShell title="Hoe het werkt" subtitle="Korte werkwijze">
      <main className="ws-shell ws-shell--page">
        <p className="mb-6 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
          Sync haalt bronnen op (kost per run). Daarna werk je de desk af. Geen automatische sync.
        </p>

        <section className="mb-8 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
          <div className="border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--display)" }}>
              De desk
            </h2>
          </div>
          <ol className="divide-y divide-[var(--line)]/80 text-sm">
            {STEPS.map((row, i) => (
              <li key={row.t} className="flex gap-3 px-4 py-3 sm:px-5">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[0.7rem] font-bold text-[var(--accent)]"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {i + 1}
                </span>
                <span>
                  <strong className="text-[var(--ink)]">{row.t}</strong>
                  <span className="mt-0.5 block text-[var(--muted)]">{row.d}</span>
                </span>
              </li>
            ))}
          </ol>
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
    </AppShell>
  );
}
