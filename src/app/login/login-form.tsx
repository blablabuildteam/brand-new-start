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
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="mx-auto flex h-14 max-w-[1120px] items-center px-5 md:px-8">
        <RegieWordmark />
      </header>
      <main className="grid min-h-[calc(100dvh-3.5rem)] place-items-center px-5 pb-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]"
        >
          <h1 className="text-[2rem] tracking-tight text-[var(--accent)]" style={{ fontFamily: "var(--display)" }}>
            Inloggen
          </h1>
          <p className="mt-2 mb-6 text-sm leading-relaxed text-[var(--muted)]">
            Daarna kies je permanent of contracting.
          </p>

          <label className="mb-3 block text-sm font-medium">
            E-mail
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
            />
          </label>

          <label className="mb-4 block text-sm font-medium">
            Wachtwoord
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
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
            className="btn-ink w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
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
