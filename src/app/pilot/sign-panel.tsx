"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BnsSignature } from "@/lib/agreement";

function dateNl(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

/** Handtekeningblok van Brand New Start: tekenen, getekend, of inloggen om te tekenen. */
export function BnsSignPanel({
  signature,
  current,
  version,
  viewer,
}: {
  signature: BnsSignature | null;
  current: boolean;
  version: string;
  viewer: "bns" | "admin" | "anon";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, accept, version }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Tekenen mislukt");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tekenen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Handtekening van Brand New Start intrekken? Dan moet BNS opnieuw tekenen.")) return;
    setBusy(true);
    await fetch("/api/agreement", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  if (signature && current) {
    return (
      <div className="sign-block sign-block--done">
        <p className="sign-block__state">✓ Getekend</p>
        <p className="sign-block__who">
          {signature.name} · {signature.title}
        </p>
        <p className="sign-block__meta">
          {dateNl(signature.signedAt)} · online akkoord via {signature.email}
        </p>
        {viewer === "admin" ? (
          <button type="button" className="sign-block__revoke print:hidden" disabled={busy} onClick={() => void revoke()}>
            Intrekken
          </button>
        ) : null}
      </div>
    );
  }

  const stale = signature && !current;

  return (
    <div className="sign-block sign-block--open">
      <p className="sign-block__state sign-block__state--open">Nog te tekenen</p>
      {stale ? (
        <p className="sign-block__meta">
          Eerder getekend op {dateNl(signature.signedAt)}, maar de overeenkomst is daarna gewijzigd.
        </p>
      ) : null}
      {viewer === "bns" ? (
        <div className="sign-form print:hidden">
          <label>
            <span>Naam</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label>
            <span>Functie</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. directeur" />
          </label>
          <label className="sign-form__accept">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>Ik heb deze overeenkomst gelezen en ga namens Brand New Start akkoord.</span>
          </label>
          <button
            type="button"
            className="btn-ink btn-tool"
            disabled={busy || !accept || name.trim().length < 3 || title.trim().length < 2}
            onClick={() => void sign()}
          >
            {busy ? "Bezig…" : "Teken namens Brand New Start"}
          </button>
          {error ? <p className="sign-form__err">{error}</p> : null}
        </div>
      ) : viewer === "admin" ? (
        <p className="sign-block__meta print:hidden">
          Wacht op Brand New Start. Zij tekenen hier na inloggen met hun eigen account.
        </p>
      ) : (
        <p className="sign-block__meta print:hidden">
          <Link href="/login?next=/pilot" className="font-semibold text-[var(--ink)] underline underline-offset-2">
            Log in
          </Link>{" "}
          met het Brand New Start-account om online te tekenen.
        </p>
      )}
    </div>
  );
}
