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
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[var(--header)] text-[#f3eee4]">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="nav-link shrink-0 text-[#f3eee4]" aria-label={`${name} home`}>
          <RegieWordmark name={name} dark />
        </Link>
        <nav className="hidden items-center gap-7 text-[0.84rem] font-medium md:flex">
          <a href="#product" className="nav-link text-[#f3eee4]/80 hover:text-[#f3eee4]">
            Product
          </a>
          <Link href="/radar" className="nav-link text-[#f3eee4]/80 hover:text-[#f3eee4]">
            Contracting
          </Link>
          <span className="cursor-default text-[#f3eee4]/35" title="Binnenkort">
            Permanent
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden max-w-[12rem] truncate text-[0.72rem] text-[#f3eee4]/50 sm:block" style={{ fontFamily: "var(--mono)" }}>
              {email}
            </span>
          ) : null}
          {email ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-[#f3eee4]/20 px-3 py-1.5 text-xs font-semibold text-[#f3eee4] hover:bg-white/10"
            >
              Uitloggen
            </button>
          ) : (
            <Link
              href="/login"
              className="nav-link btn-signal rounded-md px-3 py-1.5 text-xs font-semibold"
            >
              Inloggen
            </Link>
          )}
          <button
            type="button"
            className="rounded-md border border-[#f3eee4]/20 px-2 py-1 text-xs font-semibold text-[#f3eee4] md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/8 px-5 py-3 md:hidden">
          <a href="#product" className="nav-link block py-2 text-sm text-[#f3eee4]/80" onClick={() => setOpen(false)}>
            Product
          </a>
          <Link href="/radar" className="nav-link block py-2 text-sm text-[#f3eee4]/80" onClick={() => setOpen(false)}>
            Contracting
          </Link>
          <span className="block py-2 text-sm text-[#f3eee4]/35">Permanent · binnenkort</span>
        </nav>
      ) : null}
    </header>
  );
}
