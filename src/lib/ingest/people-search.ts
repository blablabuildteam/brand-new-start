import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { hmSearchPlan, rankHmCandidates, type HmCandidate } from "@/lib/hm-hunt";
import { linkedinCompanyQuery, linkedinCompanySlug } from "@/lib/approach";
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
    titleFromUnknown(item.headline) ||
    titleFromUnknown(item.currentPosition) ||
    titleFromUnknown(item.jobTitle) ||
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

  const slug = linkedinCompanySlug(input.companyLinkedinUrl);
  const companyQ = linkedinCompanyQuery(input.company);
  const companyUrl = slug ? `https://www.linkedin.com/company/${slug}` : null;
  const searchQuery = companyUrl ? plan.keywords : `${plan.keywords} "${companyQ}"`;

  const actorInput: Record<string, unknown> = {
    profileScraperMode: "Short",
    searchQuery,
    maxItems: INGEST_POLICY.hmSearchMax,
    takePages: 1,
    locations: ["Netherlands"],
  };
  if (companyUrl) actorInput.currentCompanies = [companyUrl];
  if (plan.mode === "title") actorInput.currentJobTitles = [plan.keywords];

  const { items } = await runApifyActor<Record<string, unknown>>(PEOPLE_ACTOR, actorInput, {
    waitSecs: 90,
  });

  const parsed = items
    .map((item) => ({
      name: personName(item) || "",
      title: personTitle(item),
      url: personUrl(item),
      headline: typeof item.headline === "string" ? item.headline : null,
    }))
    .filter((p) => p.name);

  return {
    people: rankHmCandidates(parsed, plan),
    plan,
    fetched: items.length,
    detail: `actor=${PEOPLE_ACTOR} q=${searchQuery}`,
  };
}
