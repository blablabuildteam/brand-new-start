"use client";

import type { ReactNode } from "react";

/** Lichtrood kruisje in een vakje — wegzetten / verwijderen. */
export function DismissButton({
  onClick,
  disabled,
  title = "Verwijderen",
  className = "",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Optioneel label ernaast (bulk). */
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn-dismiss ${children ? "btn-dismiss--bulk" : ""} ${className}`}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {children}
    </button>
  );
}
