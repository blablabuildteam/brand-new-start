"use client";

import Link from "next/link";
import { ScoutMark, ScoutWordmark, type ScoutMarkTone } from "@/components/scout-mark";

const VARIANTS: { tone: ScoutMarkTone; label: string; note: string }[] = [
  { tone: "light", label: "A · Light", note: "Cream tile — nu live op de site" },
  { tone: "sage", label: "B · Sage", note: "Zachte groene fill" },
  { tone: "outline", label: "C · Outline", note: "Alleen lijn, geen fill" },
  { tone: "ink", label: "D · Ink", note: "Donker — de eerdere zware versie" },
];

export default function LogoPreviewPage() {
  return (
    <div className="desk-home desk-home--scout min-h-dvh px-5 py-10 md:px-8">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="scout-eyebrow">Logo variants</p>
            <h1
              className="mt-2 text-[2rem] tracking-tight text-[var(--scout-ink)]"
              style={{ fontFamily: "Outfit, var(--scout-sans)", fontWeight: 650 }}
            >
              Recruitment Scout
            </h1>
          </div>
          <Link href="/" className="scout-nav__btn scout-nav__btn--ghost">
            ← Home
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <div
              key={v.tone}
              className="rounded-2xl border border-[var(--scout-line)] bg-[color-mix(in_srgb,white_45%,var(--scout-paper))] p-6"
            >
              <div className="flex items-center gap-4">
                <ScoutMark tone={v.tone} className="h-16 w-16" />
                <ScoutWordmark name="Recruitment Scout" tone={v.tone} />
              </div>
              <p
                className="mt-5 text-[0.95rem] font-semibold text-[var(--scout-ink)]"
                style={{ fontFamily: "Outfit, var(--scout-sans)" }}
              >
                {v.label}
              </p>
              <p className="mt-1 text-sm text-[var(--scout-muted)]">{v.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
