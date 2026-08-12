"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { BlablaLogo } from "@/components/blabla-logo";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("recruiter@brandnewstart.nl");
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
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login mislukt");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <Image src="/assets/bns-logo.png" alt="Brand New Start" width={42} height={42} />
          <div>
            <p
              className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]"
              style={{ fontFamily: "var(--mono)" }}
            >
              Command Center
            </p>
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--display)" }}>
              Radar login
            </h1>
          </div>
        </div>

        <p className="mb-5 text-sm text-[var(--muted)]">
          MVP-radar voor de <strong className="text-[var(--ink)]">kernrollen van Brand New Start</strong>{" "}
          (Jeffrey’s specialisatie). Admin kan syncen; recruiter bekijkt de radar.
        </p>

        <label className="mb-3 block text-sm font-medium">
          E-mail
          <input
            className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
          />
        </label>

        <label className="mb-4 block text-sm font-medium">
          Wachtwoord
          <input
            className="mt-1 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="bns-demo"
          />
        </label>

        {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[var(--radius)] border border-[var(--accent)] bg-gradient-to-b from-[var(--accent-bright)] to-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_-3px_rgba(0,121,193,0.55)] disabled:opacity-60"
        >
          {loading ? "Bezig…" : "Naar radar"}
        </button>

        <p className="mt-4 text-center text-xs text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          Accounts: <code>recruiter@brandnewstart.nl</code> · <code>admin@blablabuild.com</code>
        </p>

        <a
          href="https://blablabuild.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-2 text-[0.7rem] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
        >
          <span>Tool gebouwd door</span>
          <BlablaLogo className="h-4 w-4" />
          <span className="font-semibold text-[var(--ink)]">blablabuild</span>
        </a>
      </form>
    </main>
  );
}
