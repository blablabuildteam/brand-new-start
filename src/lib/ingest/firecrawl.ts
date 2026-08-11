import { matchesRole, matchesContract, detectRoleLabel } from "@/lib/niche";
import { ingestSignal } from "@/lib/store";
import { INGEST_POLICY } from "@/lib/costs";
import { enabledPlatforms, type PlatformTarget } from "@/lib/platforms";
import { recordSync, type SyncHit } from "@/lib/sync-log";

/**
 * Firecrawl = open web (careers pages). Not for LinkedIn.
 */

export async function scrapeCareersWithFirecrawl(
  urls: string[],
  meta?: { companyByUrl?: Map<string, PlatformTarget> }
) {
  const key = process.env.FIRECRAWL_API_KEY;
  const capped = urls.slice(0, INGEST_POLICY.careersMaxUrlsPerRun);

  if (!key) {
    const run = await recordSync({
      channel: "firecrawl-careers",
      label: "Careers / platforms",
      mode: "stub-no-key",
      detail: "FIRECRAWL_API_KEY nog leeg",
      fetched: 0,
      kept: 0,
      searched: capped.map((url) => {
        const p = meta?.companyByUrl?.get(url);
        return p ? `${p.company} · careers` : url;
      }),
      hits: capped.map((url) => ({
        company: meta?.companyByUrl?.get(url)?.company || guessCompanyFromUrl(url),
        title: "nog niet gescraped",
        url,
        kept: false,
      })),
    });
    return {
      mode: "stub-no-key" as const,
      fetched: 0,
      kept: 0,
      detail: "FIRECRAWL_API_KEY nog leeg — zet key in .env.local",
      urls: capped,
      run,
    };
  }

  let kept = 0;
  let fetched = 0;
  const errors: string[] = [];
  const hits: SyncHit[] = [];

  for (const url of capped) {
    const platform = meta?.companyByUrl?.get(url);
    const company = platform?.company || guessCompanyFromUrl(url);
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        hits.push({ company, title: `HTTP ${res.status}`, url, kept: false });
        continue;
      }

      const data = (await res.json()) as {
        success?: boolean;
        data?: { markdown?: string; metadata?: { title?: string } };
      };
      const md = data.data?.markdown || "";
      if (!md) {
        hits.push({ company, title: "lege pagina", url, kept: false });
        continue;
      }
      fetched += 1;

      if (!matchesRole(md)) {
        hits.push({ company, title: "geen BNS-rol match", url, kept: false });
        continue;
      }
      if (!matchesContract(md)) {
        hits.push({ company, title: "geen contract/ZZP in tekst", url, kept: false });
        continue;
      }

      const title =
        data.data?.metadata?.title || `${detectRoleLabel(md)} — ${company} careers`;

      const result = await ingestSignal({
        source: "job-type",
        company,
        title: title.slice(0, 180),
        summary: md.slice(0, 320),
        evidenceUrl: url,
        employmentHint: "contract",
        sector: platform?.sector,
        raw: { firecrawl: true, channel: "firecrawl-careers", platformId: platform?.id, url },
      });
      const ok = Boolean(result.ok);
      if (ok) kept += 1;
      hits.push({ company, title: title.slice(0, 80), url, kept: ok });
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : "error"}`);
      hits.push({ company, title: "error", url, kept: false });
    }
  }

  const run = await recordSync({
    channel: "firecrawl-careers",
    label: "Careers / platforms",
    mode: "firecrawl",
    detail: `urls=${capped.length}`,
    fetched,
    kept,
    searched: capped.map((url) => {
      const p = meta?.companyByUrl?.get(url);
      return p ? `${p.company} · careers` : url;
    }),
    hits,
  });

  return {
    mode: "firecrawl" as const,
    fetched,
    kept,
    detail: `urls=${capped.length}`,
    urls: capped,
    errors: errors.slice(0, 5),
    run,
  };
}

export async function syncPlatformCareers() {
  const platforms = enabledPlatforms();
  const companyByUrl = new Map(platforms.map((p) => [p.careersUrl, p]));
  const urls = platforms.map((p) => p.careersUrl);
  const result = await scrapeCareersWithFirecrawl(urls, { companyByUrl });
  return { ...result, platforms: platforms.length };
}

function guessCompanyFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const name = parts.length >= 2 ? parts[parts.length - 2]! : host;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Careers";
  }
}
