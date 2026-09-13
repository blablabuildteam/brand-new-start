"use client";

import Link from "next/link";
import {
  ScoutWordmark,
  type ScoutLockup,
  type ScoutWordFont,
} from "@/components/scout-mark";

const LOCKUPS: { id: ScoutLockup; label: string; note: string }[] = [
  { id: "stack", label: "Stack", note: "RECRUITMENT klein · Scout groot — strakst voor nav" },
  { id: "scout", label: "Scout only", note: "Kort & sharp — productnaam als merk" },
  { id: "pair", label: "Pair", note: "Twee regels, zelfde gewicht" },
  { id: "slash", label: "Slash", note: "Recruitment / Scout op één regel" },
  { id: "flat", label: "Flat", note: "Oude één-regel — vaak te druk" },
];

const FONTS: { id: ScoutWordFont; label: string }[] = [
  { id: "sora", label: "Sora" },
  { id: "syne", label: "Syne" },
  { id: "bricolage", label: "Bricolage" },
  { id: "outfit", label: "Outfit" },
  { id: "manrope", label: "Manrope" },
  { id: "dm", label: "DM Sans" },
  { id: "fraunces", label: "Fraunces" },
  { id: "instrument", label: "Instrument" },
];

const PICKS: { lockup: ScoutLockup; font: ScoutWordFont; label: string }[] = [
  { lockup: "stack", font: "sora", label: "A · Stack + Sora" },
  { lockup: "stack", font: "syne", label: "B · Stack + Syne" },
  { lockup: "stack", font: "bricolage", label: "C · Stack + Bricolage" },
  { lockup: "scout", font: "syne", label: "D · Scout + Syne" },
  { lockup: "scout", font: "sora", label: "E · Scout + Sora" },
  { lockup: "pair", font: "sora", label: "F · Pair + Sora" },
  { lockup: "pair", font: "fraunces", label: "G · Pair + Fraunces" },
  { lockup: "slash", font: "dm", label: "H · Slash + DM Sans" },
  { lockup: "slash", font: "manrope", label: "I · Slash + Manrope" },
  { lockup: "stack", font: "instrument", label: "J · Stack + Instrument" },
  { lockup: "scout", font: "bricolage", label: "K · Scout + Bricolage" },
  { lockup: "stack", font: "outfit", label: "L · Stack + Outfit" },
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
              style={{ fontFamily: "Sora, var(--scout-sans)", fontWeight: 650 }}
            >
              Wordmark lockups
            </h1>
            <p className="mt-2 max-w-[52ch] text-sm text-[var(--scout-muted)]">
              Radar blijft. Hier testen we hoe de naam ernaast zit — structuur eerst, font daarna.
              Zeg een letter (A–L) of combo.
            </p>
          </div>
          <Link href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </Link>
        </div>

        <section className="mb-12">
          <p className="scout-eyebrow mb-4">Favorites — navbar mock</p>
          <div className="flex flex-col gap-3">
            {PICKS.map((p) => (
              <div
                key={p.label}
                className="flex h-[3.4rem] items-center justify-between rounded-full border border-[var(--scout-line)] bg-[rgba(255,252,246,0.96)] px-4"
              >
                <ScoutWordmark tone="light" lockup={p.lockup} font={p.font} />
                <span className="shrink-0 text-[0.7rem] text-[var(--scout-muted)]">{p.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <p className="scout-eyebrow mb-4">Lockup styles (Sora)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {LOCKUPS.map((l) => (
              <article
                key={l.id}
                className="rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_55%,var(--scout-paper))] p-5"
              >
                <div className="flex min-h-[3.5rem] items-center">
                  <ScoutWordmark tone="light" lockup={l.id} font="sora" />
                </div>
                <p
                  className="mt-4 text-sm font-semibold text-[var(--scout-ink)]"
                  style={{ fontFamily: "Sora, sans-serif" }}
                >
                  {l.label}
                </p>
                <p className="mt-1 text-xs text-[var(--scout-muted)]">{l.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <p className="scout-eyebrow mb-4">Stack × alle fonts</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FONTS.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_55%,var(--scout-paper))] px-4 py-4"
              >
                <ScoutWordmark tone="light" lockup="stack" font={f.id} />
                <span className="text-xs text-[var(--scout-muted)]">{f.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
