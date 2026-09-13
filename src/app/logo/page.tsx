"use client";

import Link from "next/link";
import {
  ScoutMark,
  ScoutWordmark,
  type ScoutMarkTone,
  type ScoutWordFont,
} from "@/components/scout-mark";

const MARKS: { tone: ScoutMarkTone; label: string; note: string }[] = [
  { tone: "light", label: "A · Light", note: "Cream tile — nu live" },
  { tone: "sage", label: "B · Sage", note: "Zachte groene fill" },
  { tone: "outline", label: "C · Outline", note: "Alleen lijn" },
  { tone: "ink", label: "D · Ink", note: "Donker + mint" },
];

const FONTS: { id: ScoutWordFont; label: string; vibe: string }[] = [
  { id: "outfit", label: "Outfit", vibe: "Clean modern (nu live)" },
  { id: "syne", label: "Syne", vibe: "Bold geometric" },
  { id: "sora", label: "Sora", vibe: "Soft tech" },
  { id: "bricolage", label: "Bricolage", vibe: "Characterful grotesque" },
  { id: "fraunces", label: "Fraunces", vibe: "Editorial serif" },
  { id: "instrument", label: "Instrument Serif", vibe: "Light classic serif" },
];

export default function LogoPreviewPage() {
  return (
    <div className="desk-home desk-home--scout min-h-dvh px-5 py-10 md:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="scout-eyebrow">Logo lab</p>
            <h1
              className="mt-2 text-[2rem] tracking-tight text-[var(--scout-ink)]"
              style={{ fontFamily: "Outfit, var(--scout-sans)", fontWeight: 650 }}
            >
              Mark × font
            </h1>
            <p className="mt-2 max-w-[48ch] text-sm text-[var(--scout-muted)]">
              Zelfde radar-mark, andere lettertypes. Kies een combo — dan zetten we die vast op de
              site.
            </p>
          </div>
          <Link href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </Link>
        </div>

        <section className="mb-12">
          <p className="scout-eyebrow mb-4">1 · Marks</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {MARKS.map((v) => (
              <article
                key={v.tone}
                className="rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_55%,var(--scout-paper))] p-6"
              >
                <div className="flex min-h-[4.5rem] items-center gap-4">
                  <ScoutMark tone={v.tone} className="h-14 w-14" />
                  <ScoutWordmark name="Recruitment Scout" tone={v.tone} font="outfit" />
                </div>
                <p
                  className="mt-4 text-[0.95rem] font-semibold text-[var(--scout-ink)]"
                  style={{ fontFamily: "Outfit, var(--scout-sans)" }}
                >
                  {v.label}
                </p>
                <p className="mt-1 text-sm text-[var(--scout-muted)]">{v.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <p className="scout-eyebrow mb-4">2 · Fonts (op light mark)</p>
          <div className="grid gap-3">
            {FONTS.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_55%,var(--scout-paper))] px-5 py-4"
              >
                <ScoutWordmark name="Recruitment Scout" tone="light" font={f.id} />
                <div className="text-right">
                  <p
                    className="text-sm font-semibold text-[var(--scout-ink)]"
                    style={{ fontFamily: "Outfit, var(--scout-sans)" }}
                  >
                    {f.label}
                  </p>
                  <p className="text-xs text-[var(--scout-muted)]">{f.vibe}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="scout-eyebrow mb-4">3 · Navbar previews</p>
          <div className="flex flex-col gap-3">
            {(
              [
                ["light", "syne"],
                ["light", "sora"],
                ["sage", "bricolage"],
                ["outline", "fraunces"],
                ["ink", "outfit"],
                ["light", "instrument"],
              ] as const
            ).map(([tone, font]) => (
              <div
                key={`${tone}-${font}`}
                className="flex h-14 items-center justify-between rounded-full border border-[var(--scout-line)] bg-[rgba(255,252,246,0.94)] px-4"
              >
                <ScoutWordmark name="Recruitment Scout" tone={tone} font={font} />
                <span className="text-[0.7rem] text-[var(--scout-muted)]">
                  {tone} · {font}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
