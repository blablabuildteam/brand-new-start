import { listSignals } from "@/lib/store";
import type { JobSignals } from "@/lib/research/types";

/**
 * Own vacancy memory. Bureaus anonymise inconsistently, so an older
 * job we already synced often leaks what the new one hides.
 */

export type RelatedJob = {
  id: string;
  title: string;
  company: string;
  summary: string;
  url?: string;
  seenAt: string;
  agencyish: boolean;
  overlap: {
    tech: string[];
    place: string[];
    phrases: string[];
    sameAgency: boolean;
    sameRecruiter: boolean;
    daysApart: number;
  };
  sameProjectProbability: number;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(list: (string | null | undefined)[]) {
  return list
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => norm(v.trim()))
    .filter((v) => v.length >= 3);
}

function overlapOf(needles: string[], hay: string) {
  const found: string[] = [];
  for (const n of needles) {
    if (hay.includes(n)) found.push(n);
  }
  return [...new Set(found)];
}

/**
 * Find earlier/other vacancies in our own store that plausibly belong to the
 * same programme. Temporal + agency + stack + phrase correlation.
 */
export async function findRelatedJobs(opts: {
  currentId?: string;
  agencyName: string;
  recruiterName?: string;
  signals: JobSignals | null;
  title: string;
  limit?: number;
}): Promise<RelatedJob[]> {
  let rows: Awaited<ReturnType<typeof listSignals>> = [];
  try {
    rows = await listSignals(400);
  } catch {
    return [];
  }
  if (!rows.length) return [];

  const s = opts.signals;
  const techNeedles = tokens([...(s?.technology || []), ...(s?.cloud || [])]);
  const placeNeedles = tokens([s?.location?.city, s?.location?.region]);
  const phraseNeedles = tokens([...(s?.project_signals || []), ...(s?.hard_signals || [])]).slice(0, 6);
  const agencyN = norm(opts.agencyName);
  const recruiterN = opts.recruiterName ? norm(opts.recruiterName) : "";
  const now = Date.now();

  const out: RelatedJob[] = [];

  for (const row of rows) {
    if (opts.currentId && row.id === opts.currentId) continue;
    const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
    const company = row.company?.name || "";
    const blob = norm(
      [row.title, row.summary, typeof raw.description === "string" ? raw.description : "", company].join(" ")
    );

    const sameAgency = agencyN.length > 2 && blob.includes(agencyN);
    const sameRecruiter =
      recruiterN.length > 4 &&
      (blob.includes(recruiterN) ||
        norm(typeof raw.recruiterName === "string" ? raw.recruiterName : "").includes(recruiterN));

    const tech = overlapOf(techNeedles, blob);
    const place = overlapOf(placeNeedles, blob);
    const phrases = overlapOf(phraseNeedles, blob);

    const seen = row.seenAt instanceof Date ? row.seenAt : new Date(String(row.seenAt));
    const daysApart = Math.max(0, Math.round((now - seen.getTime()) / 86_400_000));

    // Probability that this is the same programme / client
    let p = 0;
    if (sameAgency) p += 0.22;
    if (sameRecruiter) p += 0.2;
    p += Math.min(0.3, tech.length * 0.12);
    if (place.length) p += 0.16;
    p += Math.min(0.24, phrases.length * 0.12);
    if (daysApart <= 120) p += 0.08;
    else if (daysApart > 400) p -= 0.08;

    const strongEnough = (sameAgency || sameRecruiter) && (tech.length > 0 || place.length > 0 || phrases.length > 0);
    const richOverlap = tech.length >= 2 && (place.length > 0 || phrases.length > 0);
    if (!strongEnough && !richOverlap) continue;

    out.push({
      id: row.id,
      title: row.title,
      company,
      summary: (row.summary || "").replace(/\s+/g, " ").slice(0, 400),
      url: row.evidenceUrl || undefined,
      seenAt: seen.toISOString().slice(0, 10),
      agencyish: sameAgency,
      overlap: { tech, place, phrases, sameAgency, sameRecruiter, daysApart },
      sameProjectProbability: Math.max(0, Math.min(0.95, Number(p.toFixed(2)))),
    });
  }

  return out
    .sort((a, b) => b.sameProjectProbability - a.sameProjectProbability)
    .slice(0, opts.limit ?? 8);
}

export function relatedJobsBlock(jobs: RelatedJob[]): string {
  if (!jobs.length) return "(Geen gerelateerde vacatures in eigen desk-data gevonden.)";
  return jobs
    .map(
      (j, i) =>
        `[EIGEN ${i + 1}] ${j.title} — poster: ${j.company || "onbekend"} (gezien ${j.seenAt}, same_project_probability ${j.sameProjectProbability})
overlap: tech=${j.overlap.tech.join("/") || "-"} · plaats=${j.overlap.place.join("/") || "-"} · frases=${j.overlap.phrases.join("/") || "-"} · zelfde bureau=${j.overlap.sameAgency} · zelfde recruiter=${j.overlap.sameRecruiter}
${j.url ? `URL: ${j.url}\n` : ""}${j.summary}`
    )
    .join("\n\n");
}
