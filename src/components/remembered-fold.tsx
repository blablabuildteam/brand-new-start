"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * <details> die onthoudt of jij hem open of dicht hebt gezet.
 * Standaard dicht — anders springt een drukke pagina elke navigatie open.
 * Zet je hem één keer open: blijft open per bezoek via localStorage.
 *
 * We sturen de DOM direct aan via een ref zodat we geen setState in een effect
 * nodig hebben (en dus geen hydratatie-mismatch bij SSR).
 */
export function RememberedFold({
  storageKey,
  className,
  summary,
  children,
}: {
  storageKey: string;
  className?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const v = window.localStorage.getItem(`scout-fold:${storageKey}`);
      if (v === "1") el.open = true;
      else if (v === "0") el.open = false;
    } catch {
      /* localStorage kan geblokkeerd zijn */
    }
  }, [storageKey]);

  return (
    <details
      ref={ref}
      className={className}
      onToggle={(e) => {
        try {
          const isOpen = (e.currentTarget as HTMLDetailsElement).open;
          window.localStorage.setItem(`scout-fold:${storageKey}`, isOpen ? "1" : "0");
        } catch {
          /* niets te doen */
        }
      }}
    >
      {summary}
      {children}
    </details>
  );
}
