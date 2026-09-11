"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegieMark } from "@/components/regie-mark";

export type AppNavId = "radar" | "leads" | "kansen" | "voorstel" | "instellingen";

const PRIMARY: { href: string; id: AppNavId; label: string; icon: "radar" | "bureaus" | "kansen" | "voorstel" }[] = [
  { href: "/radar", id: "radar", label: "Radar", icon: "radar" },
  { href: "/leads", id: "leads", label: "Bureaus", icon: "bureaus" },
  { href: "/kansen", id: "kansen", label: "Kansen", icon: "kansen" },
  { href: "/regie", id: "voorstel", label: "Voorstel", icon: "voorstel" },
];

type ShellUser = { email: string; role?: string };

function SideIcon({ kind, on }: { kind: "radar" | "bureaus" | "kansen" | "voorstel" | "settings"; on: boolean }) {
  const stroke = on ? "var(--accent)" : "currentColor";
  if (kind === "radar") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
        <circle cx="8" cy="8" r="5.5" stroke={stroke} strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2" stroke={stroke} strokeWidth="1.3" />
        <path d="M8 8 L13 4" stroke={on ? "#ebf212" : stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "bureaus") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
        <path d="M3 13V5.5L8 3l5 2.5V13" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 13V8h4v5" stroke={stroke} strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "kansen") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
        <path d="M3 12.5V5l5-2.5L13 5v7.5l-5 2.5L3 12.5Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 5v10" stroke={on ? "#ebf212" : stroke} strokeWidth="1.3" />
      </svg>
    );
  }
  if (kind === "voorstel") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
        <path d="M3 4.5h10v8H5.5L3 14.5V4.5Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 7.5h4M6 10h3" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="2.2" stroke={stroke} strokeWidth="1.4" />
      <path
        d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.85.85M11.05 11.05l.85.85M11.9 4.1l-.85.85M4.95 11.05l-.85.85"
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function navClass(on: boolean) {
  return `nav-link flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-2.5 text-[0.9rem] transition ${
    on
      ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
      : "font-medium text-[var(--ink)]/75 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
  }`;
}

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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  const nav = (
    <>
      <Link
        href="/"
        className="nav-link flex items-center gap-2.5 px-1 py-0.5 text-[var(--ink)]"
        onClick={() => setOpen(false)}
      >
        <RegieMark className="h-8 w-8" />
        <span className="min-w-0">
          <span
            className="block truncate text-[1.15rem] tracking-tight text-[var(--ink)]"
            style={{ fontFamily: "var(--display)" }}
          >
            {name}
          </span>
          <span className="block text-[0.7rem] text-[var(--muted)]">Contracting</span>
        </span>
      </Link>

      <p className="mt-8 px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        Workspace
      </p>
      <nav className="mt-2 flex flex-col gap-0.5">
        {PRIMARY.map((l) => (
          <Link key={l.id} href={l.href} onClick={() => setOpen(false)} className={navClass(current === l.id)}>
            <SideIcon kind={l.icon} on={current === l.id} />
            {l.label}
          </Link>
        ))}
      </nav>

      <p className="mt-7 px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        Overig
      </p>
      <nav className="mt-2 flex flex-col gap-0.5">
        <Link
          href="/instellingen"
          onClick={() => setOpen(false)}
          className={navClass(current === "instellingen")}
        >
          <SideIcon kind="settings" on={current === "instellingen"} />
          Instellingen
        </Link>
      </nav>

      <div className="mt-auto border-t border-[var(--line)] pt-3">
        <Link
          href="/methode"
          className="nav-link block rounded-[var(--radius)] px-2.5 py-2 text-[0.8rem] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          onClick={() => setOpen(false)}
        >
          Methode
        </Link>
        <Link
          href="/costs"
          className="nav-link block rounded-[var(--radius)] px-2.5 py-2 text-[0.8rem] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          onClick={() => setOpen(false)}
        >
          Kosten
        </Link>
        {user?.email ? (
          <p className="mt-2 truncate px-2.5 text-[0.7rem] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            {user.email}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 w-full rounded-[var(--radius)] px-2.5 py-2 text-left text-[0.8rem] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <div className={`app-root ${fill ? "flex h-dvh overflow-hidden" : "flex min-h-dvh"}`}>
      <aside className="app-sidebar hidden w-[220px] shrink-0 flex-col overflow-y-auto px-3 py-4 md:flex">
        {nav}
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[var(--ink)]/30 md:hidden"
          aria-label="Menu sluiten"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>

      <div className={`flex min-w-0 flex-1 flex-col ${fill ? "min-h-0" : ""}`}>
        <header className="app-topbar z-30 flex min-h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-5 pt-[env(safe-area-inset-top)] pb-0 sm:gap-3 md:px-7 md:pt-0">
          <div className="flex min-h-12 w-full items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] text-[var(--ink)] md:hidden"
            aria-expanded={open}
            aria-label={open ? "Menu sluiten" : "Menu openen"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              {open ? (
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            {title ? (
              <p className="truncate text-[1.05rem] leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--display)" }}>
                {title}
              </p>
            ) : null}
            {subtitle ? (
              <p className="hidden truncate text-[0.7rem] text-[var(--muted)] sm:block">{subtitle}</p>
            ) : null}
          </div>
          {toolbar ? <div className="app-topbar__tools shrink-0">{toolbar}</div> : null}
          </div>
        </header>
        <div
          className={`app-body min-w-0 flex-1 ${
            fill ? "flex min-h-0 flex-col overflow-hidden md:!pb-0" : "md:!pb-0"
          }`}
        >
          {children}
        </div>

        <nav
          className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--line)] md:hidden"
          aria-label="Workspace"
        >
          {PRIMARY.map((l) => {
            const on = current === l.id;
            return (
              <Link
                key={l.id}
                href={l.href}
                className={`nav-link flex flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[0.62rem] font-semibold leading-tight no-underline transition touch-manipulation ${
                  on ? "text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                <SideIcon kind={l.icon} on={on} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
