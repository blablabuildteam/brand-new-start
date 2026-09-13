"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function WaitlistForm({ dark = false }: { dark?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"ok" | "already" | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company, note }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Er ging iets mis");
      return;
    }
    const data = (await res.json()) as { already?: boolean };
    setDone(data.already ? "already" : "ok");
  }

  if (done) {
    return (
      <div className={`waitlist-done ${dark ? "waitlist-done--dark" : ""}`}>
        <p className="waitlist-done__title">
          {done === "already" ? "Je staat al op de lijst." : "Je staat op de wachtlijst."}
        </p>
        <p className="waitlist-done__text">
          We nemen contact op zodra er ruimte is in de private desk.
        </p>
      </div>
    );
  }

  return (
    <form className={`waitlist ${dark ? "waitlist--dark" : ""}`} onSubmit={(e) => void onSubmit(e)}>
      <div className="waitlist__grid">
        <label className="waitlist__field">
          <span>Naam</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Je naam"
          />
        </label>
        <label className="waitlist__field">
          <span>E-mail</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="naam@bureau.nl"
          />
        </label>
        <label className="waitlist__field waitlist__field--wide">
          <span>Bureau / bedrijf</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            placeholder="Optioneel"
          />
        </label>
        <label className="waitlist__field waitlist__field--wide">
          <span>Kort bericht</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Waar zoek je de desk voor?"
          />
        </label>
      </div>

      {error ? <p className="waitlist__error">{error}</p> : null}

      <div className="waitlist__actions">
        <button type="submit" className="scout-btn scout-btn--light" disabled={loading}>
          {loading ? "Bezig…" : "Op de wachtlijst"}
        </button>
        <Link href="/login?next=%2Fradar" className="waitlist__login">
          Al toegang? Inloggen
        </Link>
      </div>
    </form>
  );
}
