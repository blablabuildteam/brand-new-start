"use client";

import { useEffect, useRef, useState } from "react";

export type HideKind = "park" | "park-forever" | "not-client";

const PARK_DAYS = 90;

const OPTIONS: { kind: HideKind; title: string; body: string }[] = [
  {
    kind: "park",
    title: "Niet interessant · 3 maanden",
    body: "Weg uit feed en Jobboards. Sync slaat nieuwe vacatures over. Komt daarna vanzelf terug.",
  },
  {
    kind: "park-forever",
    title: "Niet interessant · altijd",
    body: "Tot je het terugzet in Instellingen → Jobboards.",
  },
  {
    kind: "not-client",
    title: "Geen eindklant",
    body: "Bureau of consultancy, geen opdrachtgever. Het filter leert dit.",
  },
];

export async function hideCompany(company: string, kind: HideKind, undo = false) {
  const res =
    kind === "not-client"
      ? await fetch("/api/radar/reject-company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, undo }),
        })
      : await fetch("/api/companies/park", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, days: kind === "park" ? PARK_DAYS : null, undo }),
        });
  if (!res.ok) throw new Error("Opslaan mislukt");
  const { cacheClear } = await import("@/lib/client-cache");
  cacheClear("radar");
  cacheClear("leads");
  cacheClear("crm");
}

export function hideLabel(kind: HideKind) {
  if (kind === "not-client") return "als geen eindklant gemarkeerd";
  if (kind === "park-forever") return "niet interessant (altijd)";
  return "niet interessant (3 mnd)";
}

/** Eén knop "Verberg bedrijf" met de keuzes erachter — i.p.v. losse links. */
export function CompanyHideMenu({
  company,
  allowNotClient = true,
  onHidden,
  align = "left",
}: {
  company: string;
  allowNotClient?: boolean;
  onHidden: (kind: HideKind) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<HideKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(kind: HideKind) {
    setBusy(kind);
    setError(null);
    try {
      await hideCompany(company, kind);
      setOpen(false);
      onHidden(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hide-menu" ref={ref}>
      <button
        type="button"
        className="hide-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 8s2.2-4.25 6-4.25S14 8 14 8s-2.2 4.25-6 4.25S2 8 2 8Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M3 13 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Verberg bedrijf
        <span className="hide-menu__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className={`hide-menu__pop hide-menu__pop--${align}`} role="menu" aria-label={`Verberg ${company}`}>
          <p className="hide-menu__head">{company}</p>
          {OPTIONS.filter((o) => allowNotClient || o.kind !== "not-client").map((o) => (
            <button
              key={o.kind}
              type="button"
              role="menuitem"
              className="hide-menu__item"
              disabled={Boolean(busy)}
              onClick={() => void pick(o.kind)}
            >
              <span className="hide-menu__t">{busy === o.kind ? "Bezig…" : o.title}</span>
              <span className="hide-menu__d">{o.body}</span>
            </button>
          ))}
          {error ? <p className="hide-menu__err">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Bevestiging na verbergen, met ongedaan maken. */
export function HiddenNote({
  company,
  kind,
  onUndo,
  onClose,
}: {
  company: string;
  kind: HideKind;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="hide-note" role="status">
      <span className="min-w-0 truncate">
        <strong>{company}</strong> {hideLabel(kind)}.
      </span>
      <button
        type="button"
        className="hide-note__undo"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void hideCompany(company, kind, true)
            .then(onUndo)
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "…" : "Ongedaan maken"}
      </button>
      <button type="button" className="hide-note__x" onClick={onClose} aria-label="Sluiten">
        ×
      </button>
    </div>
  );
}
