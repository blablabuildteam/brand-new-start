"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegieWordmark } from "@/components/regie-mark";
import { ScoutWordmark } from "@/components/scout-mark";

export function SiteNav({
  name = "Recruitment Scout",
  email,
  veil = false,
  scout = false,
}: {
  name?: string;
  email?: string | null;
  veil?: boolean;
  scout?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  if (scout) {
    return (
      <header className="scout-nav pt-[env(safe-area-inset-top)]">
        <div className="scout-nav__bar">
          <Link href="/" className="scout-nav__brand" aria-label={`${name} home`}>
            <ScoutWordmark name={name} tone="light" />
          </Link>

          <nav className="scout-nav__actions" aria-label="Primary">
            <a href="#werk" className="scout-nav__link">
              Hoe het werkt
            </a>
            {email ? (
              <>
                <Link href="/radar" className="scout-nav__btn scout-nav__btn--solid">
                  Desk
                </Link>
                <button type="button" onClick={() => void logout()} className="scout-nav__btn scout-nav__btn--ghost">
                  Uitloggen
                </button>
              </>
            ) : (
              <Link href="/login?next=%2Fradar" className="scout-nav__btn scout-nav__btn--solid">
                Inloggen
              </Link>
            )}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md pt-[env(safe-area-inset-top)] ${
        veil
          ? "border-[var(--veil-line)] bg-[color-mix(in_srgb,var(--veil-bg)_82%,transparent)] text-[var(--veil-ink)]"
          : "border-[var(--line)] bg-[var(--surface)]/90 text-[var(--ink)]"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="nav-link shrink-0" aria-label={`${name} home`}>
          <RegieWordmark name={name} dark={veil} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {email ? (
            <>
              <Link
                href="/radar"
                className={`nav-link hidden rounded-full border px-3.5 py-1.5 text-xs font-semibold sm:inline-flex ${
                  veil
                    ? "border-[var(--veil-line)] text-[var(--veil-ink)]"
                    : "border-[var(--line)] text-[var(--ink)]"
                }`}
              >
                Desk
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                  veil
                    ? "border-[var(--veil-line)] bg-transparent text-[var(--veil-ink)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                }`}
              >
                Uitloggen
              </button>
            </>
          ) : (
            <Link
              href="/login?next=%2Fradar"
              className={`nav-link rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                veil ? "bg-[var(--signal)] text-[var(--ink)]" : "btn-ink"
              }`}
            >
              Inloggen
            </Link>
          )}

          <button
            type="button"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border text-xs font-semibold md:hidden ${
              veil
                ? "border-[var(--veil-line)] text-[var(--veil-ink)]"
                : "border-[var(--line)] text-[var(--ink)]"
            }`}
            aria-expanded={open}
            aria-label={open ? "Menu sluiten" : "Menu openen"}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className={`border-t px-5 py-3 md:hidden ${
            veil ? "border-[var(--veil-line)]" : "border-[var(--line)]"
          }`}
        >
          {email ? (
            <Link
              href="/radar"
              className={`nav-link block py-2 text-sm ${veil ? "text-[var(--veil-ink)]" : "text-[var(--ink)]"}`}
              onClick={() => setOpen(false)}
            >
              Desk
            </Link>
          ) : (
            <Link
              href="/login?next=%2Fradar"
              className={`nav-link block py-2 text-sm ${veil ? "text-[var(--veil-ink)]" : "text-[var(--ink)]"}`}
              onClick={() => setOpen(false)}
            >
              Inloggen
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
