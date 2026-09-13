"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegieWordmark } from "@/components/regie-mark";

export function SiteNav({
  name = "Scout",
  email,
  veil = false,
  scout = false,
}: {
  name?: string;
  email?: string | null;
  /** @deprecated dark veil variant */
  veil?: boolean;
  /** Light editorial homepage */
  scout?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md pt-[env(safe-area-inset-top)] ${
        scout
          ? "border-[var(--scout-line)] bg-[color-mix(in_srgb,var(--scout-paper)_90%,transparent)] text-[var(--scout-ink)]"
          : veil
            ? "border-[var(--veil-line)] bg-[color-mix(in_srgb,var(--veil-bg)_82%,transparent)] text-[var(--veil-ink)]"
            : "border-[var(--line)] bg-[var(--surface)]/90 text-[var(--ink)]"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="nav-link shrink-0" aria-label={`${name} home`}>
          <RegieWordmark name={name} dark={veil && !scout} />
        </Link>
        <nav
          className={`hidden items-center gap-7 text-[0.9rem] font-medium md:flex ${
            scout ? "text-[var(--scout-muted)]" : veil ? "text-[var(--veil-muted)]" : "text-[var(--muted)]"
          }`}
        >
          <a
            href={scout ? "#werk" : "#lijn"}
            className={`nav-link ${
              scout
                ? "hover:text-[var(--scout-ink)]"
                : veil
                  ? "hover:text-[var(--veil-ink)]"
                  : "hover:text-[var(--ink)]"
            }`}
          >
            {scout ? "Hoe het werkt" : "De lijn"}
          </a>
          {email ? (
            <Link
              href="/radar"
              className={`nav-link ${
                scout
                  ? "hover:text-[var(--scout-ink)]"
                  : veil
                    ? "hover:text-[var(--veil-ink)]"
                    : "hover:text-[var(--ink)]"
              }`}
            >
              Desk
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          {email ? (
            <span
              className={`hidden max-w-[12rem] truncate text-[0.72rem] sm:block ${
                scout ? "text-[var(--scout-muted)]" : veil ? "text-[var(--veil-muted)]" : "text-[var(--muted)]"
              }`}
              style={{ fontFamily: "var(--mono)" }}
            >
              {email}
            </span>
          ) : null}
          {email ? (
            <button
              type="button"
              onClick={() => void logout()}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                scout
                  ? "border-[var(--scout-line)] bg-transparent text-[var(--scout-ink)] hover:bg-black/[0.03]"
                  : veil
                    ? "border-[var(--veil-line)] bg-transparent text-[var(--veil-ink)] hover:bg-white/5"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Uitloggen
            </button>
          ) : (
            <Link
              href="/login?next=%2Fradar"
              className={`nav-link rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                scout
                  ? "bg-[var(--scout-ink)] text-[var(--scout-paper)]"
                  : veil
                    ? "bg-[var(--signal)] text-[var(--ink)]"
                    : "btn-ink"
              }`}
            >
              Inloggen
            </Link>
          )}
          <button
            type="button"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border text-xs font-semibold md:hidden ${
              scout
                ? "border-[var(--scout-line)] text-[var(--scout-ink)]"
                : veil
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
            scout ? "border-[var(--scout-line)]" : veil ? "border-[var(--veil-line)]" : "border-[var(--line)]"
          }`}
        >
          <a
            href={scout ? "#werk" : "#lijn"}
            className={`nav-link block py-2 text-sm ${
              scout ? "text-[var(--scout-ink)]" : veil ? "text-[var(--veil-ink)]" : "text-[var(--ink)]"
            }`}
            onClick={() => setOpen(false)}
          >
            {scout ? "Hoe het werkt" : "De lijn"}
          </a>
          {email ? (
            <Link
              href="/radar"
              className={`nav-link block py-2 text-sm ${
                scout ? "text-[var(--scout-ink)]" : veil ? "text-[var(--veil-ink)]" : "text-[var(--ink)]"
              }`}
              onClick={() => setOpen(false)}
            >
              Desk
            </Link>
          ) : (
            <Link
              href="/login?next=%2Fradar"
              className={`nav-link block py-2 text-sm ${
                scout ? "text-[var(--scout-ink)]" : veil ? "text-[var(--veil-ink)]" : "text-[var(--ink)]"
              }`}
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
