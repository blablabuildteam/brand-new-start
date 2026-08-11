import { matchesContract, matchesRole, matchesTender, detectRoleLabel } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";

/**
 * TenderNed ingest stub.
 * When TENDERNED_USER + TENDERNED_PASS are set, call the public API.
 * Until then we accept POSTed publications for testing and skip live fetch.
 */
export async function ingestFromTenderNed(): Promise<{ fetched: number; kept: number; mode: string }> {
  const user = process.env.TENDERNED_USER;
  const pass = process.env.TENDERNED_PASS;

  if (!user || !pass) {
    return { fetched: 0, kept: 0, mode: "stub-no-credentials" };
  }

  // Publicaties endpoint (basic auth). Size capped for MVP.
  const url =
    "https://www.tenderned.nl/papi/tenderned-publications-v2/publicaties?size=50&sort=publicatiedatum,desc";

  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`TenderNed HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{
      id?: string | number;
      aanbestedingNaam?: string;
      opdrachtgeverNaam?: string;
      publicatieDatum?: string;
      publicatieType?: string;
      link?: string;
    }>;
  };

  const items = data.content || [];
  let kept = 0;
  for (const item of items) {
    const title = item.aanbestedingNaam || "";
    const company = item.opdrachtgeverNaam || "Onbekend";
    const blob = `${title} ${item.publicatieType || ""}`;
    if (!matchesTender(blob) && !matchesRole(blob)) continue;

    const result = await ingestSignal({
      source: "tender",
      company,
      title: title.slice(0, 180) || "TenderNed publicatie",
      summary: `TenderNed ${item.publicatieType || "publicatie"} · ${detectRoleLabel(blob)} niche`,
      evidenceUrl: item.link || "https://www.tenderned.nl/",
      seenAt: item.publicatieDatum ? new Date(item.publicatieDatum) : new Date(),
      raw: item as unknown as Record<string, unknown>,
    });
    if (result.ok) kept += 1;
  }

  return { fetched: items.length, kept, mode: "live" };
}

/** Accept a job-board style payload (from Apify / manual / future cron). */
export async function ingestJobPayload(jobs: Array<{
  company: string;
  title: string;
  description?: string;
  url?: string;
  employmentType?: string;
}>) {
  let kept = 0;
  let skipped = 0;
  for (const job of jobs) {
    const blob = `${job.title} ${job.description || ""} ${job.employmentType || ""}`;
    if (!matchesRole(blob)) {
      skipped += 1;
      continue;
    }
    const contractish =
      matchesContract(blob) || /contract|interim|zzp|temp/i.test(job.employmentType || "");
    if (!contractish) {
      skipped += 1;
      continue;
    }
    const result = await ingestSignal({
      source: "job-type",
      company: job.company,
      title: job.title,
      summary: (job.description || job.title).slice(0, 280),
      evidenceUrl: job.url,
      employmentHint: "contract",
      raw: job as unknown as Record<string, unknown>,
    });
    if (result.ok) kept += 1;
    else skipped += 1;
  }
  return { kept, skipped };
}
