import { hasApifyToken, runApifyActor } from "@/lib/apify";
import { hmSearchPlan, rankHmCandidates, sameEmployer, type HmCandidate, type HmSearchPlan } from "@/lib/hm-hunt";
import { linkedinCompanyUrls } from "@/lib/approach";
import { INGEST_POLICY } from "@/lib/costs";
import { hasAiKey, aiJsonCompletion } from "@/lib/ai-client";

const PEOPLE_ACTOR =
  process.env.APIFY_PEOPLE_ACTOR || "harvestapi/linkedin-profile-search";

export type PeopleSearchInput = {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  department?: string | null;
  sector?: string | null;
  companyLinkedinUrl?: string | null;
  namedPerson?: string | null;
  vacancyText?: string | null;
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
    titleFromUnknown(item.currentPositions) ||
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
  const fromPos =
    companyFromObject(item.currentPositions) ||
    companyFromObject(item.currentPosition) ||
    companyFromObject(item.currentCompany);
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

async function suggestHmTitles(opts: {
  company: string;
  roleLabel: string;
  openingTitle?: string;
  vacancyText?: string | null;
  overheid?: boolean;
}): Promise<string[] | null> {
  if (!hasAiKey()) return null;
  const blob = `${opts.openingTitle || ""}\n${(opts.vacancyText || "").slice(0, 1200)}`.trim();
  if (blob.length < 12) return null;
  const out = await aiJsonCompletion({
    system: `Je kiest LinkedIn-zoektitels voor de hiring manager van een NL IT-contract/ZZP-opdracht.
Geen persoonsnamen. Alleen functietitels die bij de EINDklant inhuur tekenen.
Geen recruiter/TA. Geen kaal "manager" of kaal "lead".
2 tot 4 titels, NL of EN zoals in NL IT gebruikelijk.`,
    user: `Bedrijf: ${opts.company}
Rol: ${opts.roleLabel}
${opts.overheid ? "Context: overheid/publiek.\n" : ""}Vacature:
${blob}

JSON: {"titles":["..."]}`,
    temperature: 0,
    maxTokens: 200,
  });
  if (!out.json || typeof out.json !== "object") return null;
  const titles = (out.json as { titles?: unknown }).titles;
  if (!Array.isArray(titles)) return null;
  const clean = titles
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^["']|["']$/g, "").trim())
    .filter((t) => t.length >= 4 && t.length <= 40)
    .filter((t) => !/^(manager|lead|head)$/i.test(t));
  return clean.length ? clean.slice(0, 4) : null;
}

export async function searchHiringManagers(input: PeopleSearchInput): Promise<{
  people: HmCandidate[];
  plan: HmSearchPlan;
  fetched: number;
  detail: string;
  /** Alleen gezet als de vacature een naam noemde en die persoon bij het bedrijf staat. */
  namedMatch: boolean;
}> {
  const named = (input.namedPerson || "").replace(/\s+/g, " ").trim() || null;
  const extraTitles = named
    ? null
    : await suggestHmTitles({
        company: input.company,
        roleLabel: input.roleLabel,
        openingTitle: input.openingTitle,
        vacancyText: input.vacancyText,
      });

  const primary = hmSearchPlan({
    ...input,
    namedPerson: named,
    extraTitles,
  });
  const titlesPlan = hmSearchPlan({
    ...input,
    namedPerson: null,
    extraTitles,
    department: named ? input.department : input.department,
    openingTitle: named ? undefined : input.openingTitle,
  });

  if (!hasApifyToken()) {
    return { people: [], plan: primary, fetched: 0, detail: "no-apify-token", namedMatch: false };
  }

  const companyUrls = linkedinCompanyUrls(input.company, input.companyLinkedinUrl);
  if (!companyUrls.length) {
    return { people: [], plan: primary, fetched: 0, detail: "no-company-linkedin", namedMatch: false };
  }

  async function runQuery(keywords: string) {
    const actorInput: Record<string, unknown> = {
      profileScraperMode: "Short",
      searchQuery: keywords,
      maxItems: INGEST_POLICY.hmSearchMax,
      takePages: 1,
      locations: ["Netherlands"],
      currentCompanies: companyUrls,
    };
    return runApifyActor<Record<string, unknown>>(PEOPLE_ACTOR, actorInput, {
      waitSecs: 90,
    });
  }

  function parseItems(items: Record<string, unknown>[]) {
    return items
      .map((item) => {
        const headline =
          typeof item.headline === "string"
            ? item.headline
            : typeof item.summary === "string"
              ? item.summary.slice(0, 240)
              : null;
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
  }

  const queries: { plan: HmSearchPlan; keywords: string }[] = [{ plan: primary, keywords: primary.keywords }];
  if (primary.mode === "person") {
    queries.push({ plan: titlesPlan, keywords: titlesPlan.keywords });
  } else if (primary.mode === "department") {
    const fallback = hmSearchPlan({
      company: input.company,
      roleLabel: input.roleLabel,
      openingTitle: undefined,
      department: null,
      sector: input.sector,
      extraTitles,
    });
    if (fallback.keywords !== primary.keywords) {
      queries.push({ plan: fallback, keywords: fallback.keywords });
    }
  }

  const merged: ReturnType<typeof parseItems> = [];
  let fetched = 0;
  let usedPlan = primary;
  for (const q of queries) {
    const { items } = await runQuery(q.keywords);
    fetched += items.length;
    const parsed = parseItems(items);
    merged.push(...parsed);
    if (!merged.length) usedPlan = q.plan;
    const rankedSoFar = rankHmCandidates(merged, primary.mode === "person" ? primary : q.plan, input.company);
    if (primary.mode !== "person" && rankedSoFar.length >= 3) {
      usedPlan = q.plan;
      break;
    }
  }

  const people = rankHmCandidates(merged, primary, input.company);
  const matched =
    named &&
    people.find(
      (p) =>
        p.name.toLowerCase() === named.toLowerCase() ||
        p.name.toLowerCase().startsWith(`${named.toLowerCase()} `) ||
        named.toLowerCase().startsWith(p.name.toLowerCase())
    );
  const namedMatch = Boolean(matched);

  return {
    people,
    plan: usedPlan,
    fetched,
    detail: `actor=${PEOPLE_ACTOR} q=${queries.map((q) => q.keywords).join(" | ")} companies=${companyUrls.join(",")}`,
    namedMatch,
  };
}

const RECRUITER_QUERY =
  'recruiter OR "talent acquisition" OR "account manager" OR consultant OR intercedent OR "delivery manager"';

/** Zoek recruiters / consultants bij een bureau (Instellingen). */
export async function searchAgencyRecruiters(input: {
  company: string;
  companyLinkedinUrl?: string | null;
}): Promise<{
  people: { name: string; title: string | null; url: string | null }[];
  fetched: number;
  detail: string;
}> {
  if (!hasApifyToken()) {
    return { people: [], fetched: 0, detail: "no-apify-token" };
  }

  const companyUrls = linkedinCompanyUrls(input.company, input.companyLinkedinUrl);
  if (!companyUrls.length) {
    return { people: [], fetched: 0, detail: "no-company-linkedin" };
  }

  const actorInput: Record<string, unknown> = {
    profileScraperMode: "Short",
    searchQuery: RECRUITER_QUERY,
    maxItems: Math.min(12, INGEST_POLICY.hmSearchMax + 4),
    takePages: 1,
    locations: ["Netherlands"],
    currentCompanies: companyUrls,
  };

  const { items } = await runApifyActor<Record<string, unknown>>(PEOPLE_ACTOR, actorInput, {
    waitSecs: 90,
  });

  const people = items
    .map((item) => {
      const headline =
        typeof item.headline === "string"
          ? item.headline
          : typeof item.summary === "string"
            ? item.summary.slice(0, 240)
            : null;
      const company = personCurrentCompany(item, headline);
      const alumni = Boolean(
        headline && /\b(ex-|former|voorheen|previously|alumni)\b/i.test(headline)
      );
      const atCompany = Boolean(company && sameEmployer(company, input.company) && !alumni);
      return {
        name: personName(item) || "",
        title: personTitle(item) || headline,
        url: personUrl(item),
        atCompany,
      };
    })
    .filter((p) => p.name && p.atCompany)
    .slice(0, 12)
    .map(({ name, title, url }) => ({ name, title, url }));

  return {
    people,
    fetched: items.length,
    detail: `agency-recruiters actor=${PEOPLE_ACTOR} companies=${companyUrls.join(",")}`,
  };
}
