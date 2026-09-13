"use client";

import Link from "next/link";
import { ScoutMark, ScoutWordmark, type ScoutMarkTone } from "@/components/scout-mark";

const VARIANTS: { tone: ScoutMarkTone; label: string; note: string }[] = [
  { tone: "light", label: "A · Light", note: "Cream tile — nu live op de site" },
  { tone: "sage", label: "B · Sage", note: "Zachte groene fill" },
  { tone: "outline", label: "C · Outline", note: "Alleen lijn, geen fill" },
  { tone: "ink", label: "D · Ink", note: "Donker + mint" },
];

export default function LogoPreviewPage() {
  return (
    <div className="desk-home desk-home--scout min-h-dvh px-5 py-10 md:px-8">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="scout-eyebrow">Logo variants</p>
            <h1
              className="mt-2 text-[2rem] tracking-tight text-[var(--scout-ink)]"
              style={{ fontFamily: "Outfit, var(--scout-sans)", fontWeight: 650 }}
            >
              Kies een mark
            </h1>
            <p className="mt-2 max-w-[40ch] text-sm text-[var(--scout-muted)]">
              Vier live SVG-varianten met draaiende radar. Zeg welke je wilt — dan zetten we die vast.
            </p>
          </div>
          <Link href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <article
              key={v.tone}
              className="rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_55%,var(--scout-paper))] p-6"
            >
              <div className="flex min-h-[5.5rem] items-center gap-4">
                <ScoutMark tone={v.tone} className="h-16 w-16" />
                <ScoutWordmark name="Recruitment Scout" tone={v.tone} />
              </div>
              <p
                className="mt-5 text-[1rem] font-semibold text-[var(--scout-ink)]"
                style={{ fontFamily: "Outfit, var(--scout-sans)" }}
              >
                {v.label}
              </p>
              <p className="mt-1 text-sm text-[var(--scout-muted)]">{v.note}</p>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_40%,var(--scout-paper))] p-6">
          <p className="scout-eyebrow">In de navbar</p>
          <div className="mt-4 flex flex-col gap-4">
            {VARIANTS.map((v) => (
              <div
                key={`nav-${v.tone}`}
                className="flex h-14 items-center justify-between rounded-full border border-[var(--scout-line)] bg-[rgba(255,252,246,0.94)] px-4"
              >
                <ScoutWordmark name="Recruitment Scout" tone={v.tone} />
                <span className="text-xs text-[var(--scout-muted)]">{v.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
