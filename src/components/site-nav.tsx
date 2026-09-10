"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegieWordmark } from "@/components/regie-mark";

export function SiteNav({
  name = "Regie",
  email,
}: {
  name?: string;
  email?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/90 text-[var(--ink)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="nav-link shrink-0" aria-label={`${name} home`}>
          <RegieWordmark name={name} />
        </Link>
        <nav className="hidden items-center gap-7 text-[0.9rem] font-medium text-[var(--muted)] md:flex">
          <a href="#product" className="nav-link hover:text-[var(--ink)]">
            Product
          </a>
          <Link href="/radar" className="nav-link hover:text-[var(--ink)]">
            Contracting
          </Link>
          <span className="cursor-default text-[var(--line)]" title="Binnenkort">
            Permanent
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden max-w-[12rem] truncate text-[0.72rem] text-[var(--muted)] sm:block" style={{ fontFamily: "var(--mono)" }}>
              {email}
            </span>
          ) : null}
          {email ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
            >
              Uitloggen
            </button>
          ) : (
            <Link href="/login" className="nav-link btn-ink rounded-full px-3.5 py-1.5 text-xs font-semibold">
              Inloggen
            </Link>
          )}
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--ink)] md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-[var(--line)] px-5 py-3 md:hidden">
          <a href="#product" className="nav-link block py-2 text-sm text-[var(--ink)]" onClick={() => setOpen(false)}>
            Product
          </a>
          <Link href="/radar" className="nav-link block py-2 text-sm text-[var(--ink)]" onClick={() => setOpen(false)}>
            Contracting
          </Link>
          <span className="block py-2 text-sm text-[var(--muted)]">Permanent · binnenkort</span>
        </nav>
      ) : null}
    </header>
  );
}
