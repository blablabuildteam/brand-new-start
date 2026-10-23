"use client";

import { useState } from "react";

export type HideKind = "park" | "park-forever" | "not-client";

const PARK_DAYS = 90;

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
  if (kind === "not-client") return "gemarkeerd als geen eindklant";
  if (kind === "park-forever") return "op de lijst ‘niet interessant’";
  return "3 maanden op ‘niet interessant’";
}

const EYE_OFF = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M2 8s2.2-4.25 6-4.25S14 8 14 8s-2.2 4.25-6 4.25S2 8 2 8Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M3 13 13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const NOT_CLIENT = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="3" y="2.5" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 5.5h3M5.5 8h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="m11.5 10.5 3 3m0-3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/** Twee losse knoppen: "Niet interessant" (eindklant, even niet) en "Geen eindklant" (bureau). */
export function CompanyHideMenu({
  company,
  allowNotClient = true,
  onHidden,
}: {
  company: string;
  allowNotClient?: boolean;
  onHidden: (kind: HideKind) => void;
}) {
  const [busy, setBusy] = useState<HideKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: HideKind) {
    setBusy(kind);
    setError(null);
    try {
      await hideCompany(company, kind);
      onHidden(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hide-actions">
      <button
        type="button"
        className="hide-btn"
        disabled={Boolean(busy)}
        data-tip="Wél een eindklant, nu even niet relevant. 3 maanden weg uit feed en Jobboards; staat op je bewaarde lijst in Instellingen."
        onClick={() => void pick("park")}
      >
        {EYE_OFF}
        {busy === "park" ? "Bezig…" : "Niet interessant"}
      </button>
      {allowNotClient ? (
        <button
          type="button"
          className="hide-btn"
          disabled={Boolean(busy)}
          data-tip="Dit is geen opdrachtgever maar een bureau of consultancy. Komt op de aparte lijst ‘geen eindklant’ en wordt nooit meer als eindklant getoond."
          onClick={() => void pick("not-client")}
        >
          {NOT_CLIENT}
          {busy === "not-client" ? "Bezig…" : "Geen eindklant"}
        </button>
      ) : null}
      {error ? <span className="hide-actions__err">{error}</span> : null}
    </div>
  );
}

/** Bevestiging na verbergen, met ongedaan maken (en bij "niet interessant": voorgoed). */
export function HiddenNote({
  company,
  kind: initialKind,
  onUndo,
  onClose,
}: {
  company: string;
  kind: HideKind;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [busy, setBusy] = useState(false);
  return (
    <div className="hide-note" role="status">
      <span className="min-w-0 truncate">
        <strong>{company}</strong> {hideLabel(kind)}.
      </span>
      {kind === "park" ? (
        <button
          type="button"
          className="hide-note__undo hide-note__alt"
          disabled={busy}
          title="Zonder einddatum op ‘niet interessant’ — terugzetten kan in Instellingen."
          onClick={() => {
            setBusy(true);
            void hideCompany(company, "park-forever")
              .then(() => setKind("park-forever"))
              .finally(() => setBusy(false));
          }}
        >
          Voorgoed
        </button>
      ) : null}
      <button
        type="button"
        className={`hide-note__undo${kind === "park" ? " hide-note__undo--next" : ""}`}
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
