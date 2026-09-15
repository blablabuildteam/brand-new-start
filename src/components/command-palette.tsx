"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: "desk" | "action" | "kans" | "radar" | "lead";
};

import { DESK } from "@/lib/desk-labels";

const DESKS: Hit[] = [
  { id: "d-radar", title: DESK.direct.nav, subtitle: DESK.direct.subtitle, href: DESK.direct.href, kind: "desk" },
  { id: "d-leads", title: DESK.bureau.nav, subtitle: DESK.bureau.subtitle, href: DESK.bureau.href, kind: "desk" },
  { id: "d-kansen", title: DESK.kansen.nav, subtitle: "Pipeline · HM · volgende actie", href: DESK.kansen.href, kind: "desk" },
  { id: "d-regie", title: DESK.voorstel.nav, subtitle: "Bericht + shortlist klaarzetten", href: DESK.voorstel.href, kind: "desk" },
  { id: "d-set", title: "Instellingen", subtitle: "Rollen, kantoren, sync", href: "/instellingen", kind: "desk" },
];

const KIND_NL: Record<Hit["kind"], string> = {
  desk: "Desk",
  action: "Nu",
  kans: "Kans",
  radar: DESK.direct.nav,
  lead: DESK.bureau.nav,
};

function score(q: string, hit: Hit) {
  const n = q.toLowerCase().trim();
  if (!n) return hit.kind === "action" ? 3 : hit.kind === "desk" ? 2 : 1;
  const blob = `${hit.title} ${hit.subtitle}`.toLowerCase();
  if (hit.title.toLowerCase().startsWith(n)) return 8;
  if (blob.includes(n)) return 5;
  return 0;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [extra, setExtra] = useState<Hit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!typing && e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "1") router.push("/radar");
        if (e.key === "2") router.push("/leads");
        if (e.key === "3") router.push("/kansen");
        if (e.key === "4") router.push("/regie");
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("desk:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("desk:command", onOpen);
    };
  }, [router, open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCursor(0);
      return;
    }
    inputRef.current?.focus();
    fetch("/api/desk/index")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { actions?: Hit[]; kansen?: Hit[]; radar?: Hit[]; leads?: Hit[] } | null) => {
        if (!j) return;
        setExtra([...(j.actions || []), ...(j.kansen || []), ...(j.radar || []), ...(j.leads || [])]);
      })
      .catch(() => null);
  }, [open]);

  const results = useMemo(() => {
    const all = [...DESKS, ...extra];
    const ranked = all
      .map((h) => ({ h, s: score(q, h) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.h.title.localeCompare(b.h.title));
    const seen = new Set<string>();
    const out: Hit[] = [];
    for (const { h } of ranked) {
      const key = `${h.kind}:${h.href}:${h.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
      if (out.length >= 12) break;
    }
    return out;
  }, [q, extra]);

  useEffect(() => {
    setCursor(0);
  }, [q, results.length]);

  function go(hit: Hit) {
    setOpen(false);
    router.push(hit.href);
  }

  if (!open) return null;

  return (
    <div className="cmdk" role="dialog" aria-label="Zoek in de desk">
      <button type="button" className="cmdk__backdrop" aria-label="Sluiten" onClick={() => setOpen(false)} />
      <div className="cmdk__panel">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek eindklant, kans, kantoor of desk…"
          className="cmdk__input"
          aria-label="Zoeken"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(results.length - 1, c + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            }
            if (e.key === "Enter" && results[cursor]) {
              e.preventDefault();
              go(results[cursor]!);
            }
          }}
        />
        <ul className="cmdk__list">
          {!results.length ? (
            <li className="cmdk__empty">Niets gevonden. Probeer een bedrijfsnaam of rol.</li>
          ) : (
            results.map((h, i) => (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  type="button"
                  className={`cmdk__row ${i === cursor ? "cmdk__row--on" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h)}
                >
                  <span className="cmdk__kind">{KIND_NL[h.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--ink)]">{h.title}</span>
                    <span className="block truncate text-[0.72rem] text-[var(--muted)]">{h.subtitle}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="cmdk__foot">
          <kbd>⌘K</kbd> zoeken · <kbd>1</kbd>–<kbd>4</kbd> desks · <kbd>esc</kbd> sluiten
        </p>
      </div>
    </div>
  );
}
