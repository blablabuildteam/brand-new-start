"use client";

export function PrintPilotButton() {
  return (
    <button
      type="button"
      className="text-[var(--muted)] hover:text-[var(--ink)]"
      onClick={() => window.print()}
    >
      Print / pdf
    </button>
  );
}
