"use client";

import { useEffect, useState } from "react";
import type { ResearchDepth, ResearchProgress } from "@/lib/research/types";

const DEPTH_NL: Record<ResearchDepth, string> = {
  quick: "Snel",
  standard: "Standaard",
  deep: "Deep",
};

function formatEta(sec: number) {
  if (sec <= 0) return "bijna klaar";
  if (sec < 55) return `nog ±${sec} sec`;
  const min = Math.max(1, Math.round(sec / 60));
  return min === 1 ? "nog ±1 min" : `nog ±${min} min`;
}

export function ResearchMeter({
  depth,
  progress,
}: {
  depth: ResearchDepth;
  progress: ResearchProgress;
}) {
  const [eta, setEta] = useState(progress.etaSec);

  useEffect(() => {
    setEta(progress.etaSec);
  }, [progress.etaSec, progress.step]);

  useEffect(() => {
    if (progress.pct >= 100) return;
    const t = window.setInterval(() => {
      setEta((v) => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [progress.step, progress.pct]);

  const late = eta === 0 && progress.pct < 100;
  const label = late ? "Duurt iets langer dan gedacht" : progress.label;

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)]/40 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ws-label !text-[var(--ink)]">
          {DEPTH_NL[depth]} research
        </p>
        <p className="shrink-0 text-[0.7rem] tabular-nums text-[var(--muted)]" style={{ fontFamily: "var(--mono)" }}>
          {progress.pct}% · {late ? "even geduld" : formatEta(eta)}
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
        aria-label={`${DEPTH_NL[depth]} research: ${label}`}
      >
        <div
          className={`sync-progress-fill is-running h-full rounded-full bg-[var(--accent)] ${
            progress.pct >= 100 ? "!bg-[var(--green)]" : ""
          }`}
          style={{ width: `${Math.max(6, Math.min(100, progress.pct))}%` }}
        />
      </div>
      <p className="mt-2 text-[0.78rem] leading-snug text-[var(--ink)]">
        {label}
        {progress.detail ? (
          <span className="text-[var(--muted)]"> · {progress.detail}</span>
        ) : null}
      </p>
    </div>
  );
}
