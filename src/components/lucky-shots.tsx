"use client";

import { useEffect, useState } from "react";
import type { LuckyShot } from "@/lib/store";

type Payload = {
  shots: LuckyShot[];
  tracked: number;
  trackingSince: string | null;
  rules: { luckyDays: number; watchDays: number; activeDays: number };
  firstLuckyAt: string | null;
};

function dateNl(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/**
 * Vaste rollen die al lang openstaan — apart van de gewone Jobboards-radar.
 * Laadt bij mount zodat de dichtgeklapte balk al de telling toont.
 */
export function LuckyShotsFold({ className = "" }: { className?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/radar/lucky", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Payload) => !cancelled && setData(j))
      .catch(() => !cancelled && setErr(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const lucky = data?.shots.filter((s) => s.status === "lucky") || [];
  const watch = data?.shots.filter((s) => s.status === "watch") || [];
  const hasHit = lucky.length > 0;
  const meta = !data
    ? "laden…"
    : hasHit
      ? `${lucky.length} rol${lucky.length === 1 ? "" : "len"} 3+ mnd open`
      : watch.length
        ? `${watch.length} in de gaten`
        : data.tracked
          ? `${data.tracked} gevolgd`
          : "nog leeg";

  return (
    <details className={`ws-fold lucky-fold ${hasHit ? "lucky-fold--hit" : ""} ${className}`}>
      <summary>
        <span className="lucky-fold__title">
          <span className="lucky-fold__mark" aria-hidden>
            ★
          </span>
          Lucky shots
        </span>
        <span className={`lucky-fold__badge${hasHit ? " lucky-fold__badge--hit" : ""}`}>{meta}</span>
      </summary>
      <div className="ws-fold__body">
        <p className="lucky-fold__lead">
          <strong>Speciale catch:</strong> een interne vacature die al ~3 maanden openstaat, staat vaak open voor
          een interim-oplossing. We bewaren vaste rollen stil (geen extra kosten) en tellen reposts van dezelfde
          titel als één rol.
        </p>
        {err ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Kon lucky shots niet laden.</p>
        ) : !data ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Laden…</p>
        ) : (
          <>
            {lucky.length ? (
              <ShotList title={`${data.rules.luckyDays}+ dagen open`} shots={lucky} />
            ) : (
              <p className="mt-2.5 text-[0.8rem] text-[var(--ink)]">
                Nog geen rol {data.rules.luckyDays}+ dagen open.
                {data.firstLuckyAt && data.trackingSince ? (
                  <span className="text-[var(--muted)]">
                    {" "}
                    We volgen {data.tracked} vaste rollen sinds {dateNl(data.trackingSince)} — eerste lucky shots
                    rond {dateNl(data.firstLuckyAt)}.
                  </span>
                ) : null}
              </p>
            )}
            {watch.length ? (
              <ShotList title={`In de gaten · ${data.rules.watchDays}+ dagen of opnieuw geplaatst`} shots={watch} />
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

function ShotList({ title, shots }: { title: string; shots: LuckyShot[] }) {
  return (
    <div className="mt-3">
      <p className="ws-label">{title}</p>
      <ul className="lucky-list">
        {shots.slice(0, 25).map((s) => (
          <li key={s.key}>
            <span className="lucky-list__age" data-lucky={s.status}>
              {s.ageDays}d
            </span>
            <span className="min-w-0">
              <span className="lucky-list__title">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </span>
              <span className="lucky-list__sub">
                {s.company} · sinds {dateNl(s.firstSeen)}
                {s.posts > 1 ? ` · ${s.posts}× geplaatst` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
