"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegieMark } from "@/components/regie-mark";

export type AppNavId = "radar" | "leads" | "voorstel" | "instellingen";

const PRIMARY: { href: string; id: AppNavId; label: string; hint: string }[] = [
  { href: "/radar", id: "radar", label: "Radar", hint: "Opdrachten" },
  { href: "/leads", id: "leads", label: "Bureaus", hint: "Eindklant" },
  { href: "/regie", id: "voorstel", label: "Voorstel", hint: "Bericht" },
];

type ShellUser = { email: string; role?: string };

export function AppShell({
  current,
  title,
  subtitle,
  toolbar,
  children,
  fill = false,
}: {
  current?: AppNavId;
  title?: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  fill?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("Regie");
  const [user, setUser] = useState<ShellUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { name?: string; user?: ShellUser } | null) => {
        if (j?.name) setName(j.name);
        if (j?.user) setUser(j.user);
      })
      .catch(() => null);
  }, []);

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/login");
  }

  const nav = (
    <>
      <Link href="/" className="nav-link flex items-center gap-2.5 px-1 py-0.5" onClick={() => setOpen(false)}>
        <span className="rounded-lg bg-white/[0.08] p-0.5">
          <RegieMark className="h-8 w-8" />
        </span>
        <span>
          <span className="block text-[0.95rem] font-semibold tracking-tight text-white" style={{ fontFamily: "var(--display)" }}>
            {name}
          </span>
          <span className="block text-[0.65rem] text-white/40">Contracting</span>
        </span>
      </Link>

      <p className="mt-8 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/35">
        Workspace
      </p>
      <nav className="mt-2 flex flex-col gap-0.5">
        {PRIMARY.map((l) => {
          const on = current === l.id;
          return (
            <Link
              key={l.id}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`nav-link flex items-center justify-between rounded-md px-2.5 py-2 text-[0.84rem] ${
                on
                  ? "bg-white/10 font-semibold text-white shadow-[inset_2px_0_0_0_#CEFF00]"
                  : "font-medium text-white/65 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {l.label}
              <span className={`text-[0.65rem] font-normal ${on ? "text-white/50" : "text-white/30"}`}>
                {l.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="mt-7 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/35">
        Desk
      </p>
      <nav className="mt-2 flex flex-col gap-0.5">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="nav-link rounded-md px-2.5 py-2 text-[0.84rem] font-medium text-white/65 hover:bg-white/[0.06] hover:text-white"
        >
          Vak kiezen
        </Link>
        <Link
          href="/instellingen"
          onClick={() => setOpen(false)}
          className={`nav-link rounded-md px-2.5 py-2 text-[0.84rem] ${
            current === "instellingen"
              ? "bg-white/10 font-semibold text-white shadow-[inset_2px_0_0_0_#CEFF00]"
              : "font-medium text-white/65 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Instellingen
        </Link>
      </nav>

      <div className="mt-auto border-t border-white/10 pt-3">
        <Link
          href="/methode"
          className="nav-link block rounded-md px-2.5 py-1.5 text-[0.75rem] text-white/40 hover:bg-white/[0.06] hover:text-white/80"
        >
          Methode
        </Link>
        <Link
          href="/costs"
          className="nav-link block rounded-md px-2.5 py-1.5 text-[0.75rem] text-white/40 hover:bg-white/[0.06] hover:text-white/80"
        >
          Kosten
        </Link>
        {user?.email ? (
          <p className="mt-2 truncate px-2.5 text-[0.65rem] text-white/35" style={{ fontFamily: "var(--mono)" }}>
            {user.email}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-[0.75rem] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white/80"
        >
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <div className={`app-root ${fill ? "flex h-dvh overflow-hidden" : "flex min-h-dvh"}`}>
      <aside className="app-sidebar hidden w-[232px] shrink-0 flex-col overflow-y-auto bg-[#0b1c30] px-3 py-4 md:flex">
        {nav}
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#0b1c30]/50 md:hidden"
          aria-label="Menu sluiten"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col bg-[#0b1c30] px-3 py-4 transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>

      <div className={`flex min-w-0 flex-1 flex-col ${fill ? "min-h-0" : ""}`}>
        <header className="app-topbar z-30 flex h-12 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 md:px-6">
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--ink)] md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
          <div className="min-w-0 flex-1">
            {title ? <p className="truncate text-sm font-semibold text-[var(--ink)]">{title}</p> : null}
            {subtitle ? <p className="truncate text-[0.7rem] text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          {toolbar}
        </header>
        <div className={`min-w-0 flex-1 ${fill ? "flex min-h-0 flex-col overflow-hidden" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
