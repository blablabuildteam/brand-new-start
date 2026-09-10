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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--header)] text-white">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="nav-link shrink-0" aria-label={`${name} home`}>
          <RegieWordmark name={name} dark />
        </Link>
        <nav className="hidden items-center gap-7 text-[0.82rem] font-medium md:flex">
          <a href="#product" className="nav-link text-white/85 hover:text-white">
            Product
          </a>
          <Link href="/radar" className="nav-link text-white/85 hover:text-white">
            Contracting
          </Link>
          <span className="cursor-default text-white/35" title="Binnenkort">
            Permanent
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden max-w-[12rem] truncate text-[0.72rem] text-white/50 sm:block" style={{ fontFamily: "var(--mono)" }}>
              {email}
            </span>
          ) : null}
          {email ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10"
            >
              Uitloggen
            </button>
          ) : (
            <Link
              href="/login"
              className="nav-link rounded-md bg-[#0079c1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a8fd4] hover:text-white"
            >
              Inloggen
            </Link>
          )}
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 text-xs font-semibold text-white/80 md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/10 px-5 py-3 md:hidden">
          <a href="#product" className="nav-link block py-2 text-sm text-white/75" onClick={() => setOpen(false)}>
            Product
          </a>
          <Link href="/radar" className="nav-link block py-2 text-sm text-white/75" onClick={() => setOpen(false)}>
            Contracting
          </Link>
          <span className="block py-2 text-sm text-white/30">Permanent · binnenkort</span>
        </nav>
      ) : null}
    </header>
  );
}
