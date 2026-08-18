import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { hmSearchPlan, rankHmCandidates, sameEmployer, type HmCandidate } from "@/lib/hm-hunt";
import { linkedinCompanyUrls } from "@/lib/approach";
import { INGEST_POLICY } from "@/lib/costs";

const PEOPLE_ACTOR =
  process.env.APIFY_PEOPLE_ACTOR || "harvestapi/linkedin-profile-search";

export type PeopleSearchInput = {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
  companyLinkedinUrl?: string | null;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length >= 2 ? s : null;
}

function personName(item: Record<string, unknown>): string | null {
  const full = typeof item.fullName === "string" ? item.fullName : typeof item.name === "string" ? item.name : "";
  if (full.trim().includes(" ")) return full.replace(/,.*/, "").trim();
  const first = typeof item.firstName === "string" ? item.firstName.trim() : "";
  const last = typeof item.lastName === "string" ? String(item.lastName).replace(/,.*/, "").trim() : "";
  if (first && last) return `${first} ${last}`;
  return null;
}

function titleFromUnknown(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  if (Array.isArray(v) && v[0]) return titleFromUnknown(v[0]);
  if (v && typeof v === "object") {
    const t = (v as { title?: unknown }).title;
    if (typeof t === "string" && t.trim()) return t.trim().slice(0, 120);
  }
  return null;
}

function personTitle(item: Record<string, unknown>): string | null {
  return (
    titleFromUnknown(item.currentPosition) ||
    titleFromUnknown(item.jobTitle) ||
    titleFromUnknown(item.headline) ||
    titleFromUnknown(item.experience)
  );
}

function personUrl(item: Record<string, unknown>): string | null {
  if (typeof item.linkedinUrl === "string" && item.linkedinUrl.includes("linkedin.com/in/")) {
    return item.linkedinUrl.split("?")[0];
  }
  if (typeof item.url === "string" && item.url.includes("linkedin.com/in/")) {
    return item.url.split("?")[0];
  }
  const id = typeof item.publicIdentifier === "string" ? item.publicIdentifier.trim() : "";
  if (id) return `https://www.linkedin.com/in/${encodeURIComponent(id)}`;
  return null;
}

function companyFromObject(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return str(v);
  if (Array.isArray(v)) return companyFromObject(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      str(o.companyName) ||
      str(o.company) ||
      (typeof o.company === "object" && o.company ? str((o.company as { name?: unknown }).name) : null)
    );
  }
  return null;
}

function personCurrentCompany(item: Record<string, unknown>, headline: string | null): string | null {
  const fromPos = companyFromObject(item.currentPosition) || companyFromObject(item.currentCompany);
  if (fromPos) return fromPos;
  const exp = item.experience;
  if (Array.isArray(exp)) {
    for (const row of exp) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const end = `${o.endDate || o.end || ""}`;
      if (/present|huidig|now|current/i.test(end) || !end) {
        const name = companyFromObject(o);
        if (name) return name;
      }
    }
  }
  if (headline) {
    const m = headline.match(/\s+(?:at|bij|@)\s+([^|•·\n]{2,80})$/i);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export async function searchHiringManagers(input: PeopleSearchInput): Promise<{
  people: HmCandidate[];
  plan: ReturnType<typeof hmSearchPlan>;
  fetched: number;
  detail: string;
}> {
  const plan = hmSearchPlan(input);
  if (!hasApifyToken()) {
    return { people: [], plan, fetched: 0, detail: "no-apify-token" };
  }

  const companyUrls = linkedinCompanyUrls(input.company, input.companyLinkedinUrl);
  if (!companyUrls.length) {
    return { people: [], plan, fetched: 0, detail: "no-company-linkedin" };
  }

  const actorInput: Record<string, unknown> = {
    profileScraperMode: "Short",
    searchQuery: plan.keywords,
    maxItems: INGEST_POLICY.hmSearchMax,
    takePages: 1,
    locations: ["Netherlands"],
    currentCompanies: companyUrls,
  };

  const { items } = await runApifyActor<Record<string, unknown>>(PEOPLE_ACTOR, actorInput, {
    waitSecs: 90,
  });

  const parsed = items
    .map((item) => {
      const headline = typeof item.headline === "string" ? item.headline : null;
      const company = personCurrentCompany(item, headline);
      const alumni = Boolean(
        headline && /\b(ex-|former|voorheen|previously|alumni)\b/i.test(headline)
      );
      const atCompany = Boolean(company && sameEmployer(company, input.company) && !alumni);
      return {
        name: personName(item) || "",
        title: personTitle(item),
        url: personUrl(item),
        headline,
        company,
        atCompany,
      };
    })
    .filter((p) => p.name);

  return {
    people: rankHmCandidates(parsed, plan, input.company),
    plan,
    fetched: items.length,
    detail: `actor=${PEOPLE_ACTOR} q=${plan.keywords} companies=${companyUrls.join(",")}`,
  };
}
