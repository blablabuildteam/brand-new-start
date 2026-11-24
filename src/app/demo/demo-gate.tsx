"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScoutMark } from "@/components/scout-mark";
import "../landing.css";

export default function DemoGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Dat wachtwoord klopt niet.");
      return;
    }
    router.replace("/leads");
    router.refresh();
  }

  return (
    <div className="lp lp-gate">
      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="Recruitment Scout home">
          <ScoutMark className="h-8 w-8" tone="cobalt" animated={false} />
          <span>Recruitment Scout</span>
        </Link>
      </header>

      <main className="lp-gate__main">
        <h1 className="lp-gate__title">
          Welkom bij de <em>demo</em>.
        </h1>
        <p className="lp-gate__lede">
          Je kijkt rond in een werkplek met voorbeelddata. Klik gerust overal op, er gaat niets naar buiten.
        </p>

        <form className="lp-gate__form" onSubmit={(e) => void onSubmit(e)}>
          <label htmlFor="demo-pw" className="lp-gate__label">
            Wachtwoord
          </label>
          <div className="lp-gate__row">
            <input
              id="demo-pw"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Staat in je uitnodiging"
            />
            <button type="submit" className="lp-btn lp-btn--primary" disabled={loading || !password}>
              {loading ? "Openen…" : "Open de demo"}
            </button>
          </div>
          {error ? <p className="lp-gate__error">{error}</p> : null}
        </form>

        <p className="lp-gate__foot">
          Geen wachtwoord? <Link href="/#toegang">Vraag toegang aan</Link>
        </p>
      </main>
    </div>
  );
}
