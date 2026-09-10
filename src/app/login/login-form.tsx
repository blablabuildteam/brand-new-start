"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BlablaLogo } from "@/components/blabla-logo";
import { RegieWordmark } from "@/components/regie-mark";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Login mislukt");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[#0b1c30]">
      <header className="mx-auto flex h-16 max-w-[1120px] items-center px-5 md:px-8">
        <RegieWordmark dark />
      </header>
      <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-5 pb-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[400px] rounded-xl border border-white/10 bg-white p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]"
        >
          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
            Recruitment-desk
          </p>
          <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--display)" }}>
            Inloggen
          </h1>
          <p className="mt-2 mb-6 text-sm leading-relaxed text-[var(--muted)]">
            Werving & selectie en contracting. Na inloggen kies je je vak.
          </p>

          <label className="mb-3 block text-sm font-medium">
            E-mail
            <input
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
            />
          </label>

          <label className="mb-4 block text-sm font-medium">
            Wachtwoord
            <input
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#0b1c30] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123049] disabled:opacity-60"
          >
            {loading ? "Bezig…" : "Naar de desk"}
          </button>

          <a
            href="https://blablabuild.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 text-[0.7rem] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
          >
            <BlablaLogo className="h-4 w-4" />
            <span>Gebouwd door blablabuild</span>
          </a>
        </form>
      </main>
    </div>
  );
}
