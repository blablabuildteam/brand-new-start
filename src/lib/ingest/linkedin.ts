import { detectFamily, detectRoleLabel, matchesRole, ROLE_FAMILIES } from "@/lib/niche";
import { huntRoles } from "@/lib/hunt";

export const JEFFREY_PROFILE = "https://www.linkedin.com/in/jeffrey-köhnke-88239270/";

const APIFY_ACTOR = process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-posts";

export type LinkedInPost = {
  text: string;
  url?: string;
  postedAt?: string | Date;
  raw?: Record<string, unknown>;
};

export type SpecialtyRole = {
  label: string;
  family: string;
  count: number;
};

export type SpecialtyProfile = {
  updatedAt: string;
  mode: string;
  detail?: string;
  scanned: number;
  vacancyPosts: number;
  roles: SpecialtyRole[];
  /** What we hunt on the market — not radar rows */
  huntSummary: string;
  samples: { role: string; snippet: string }[];
};

const globalSpecialty = globalThis as unknown as { __bnsSpecialty?: SpecialtyProfile };

/** Heuristic: BNS vacancy / "zoeken wij" post from Jeffrey */
export function isVacancyPost(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /urgent|zoeken wij|op zoek naar|looking for|vacature|we are (currently )?looking|voor een relatie/i.test(
      t
    ) ||
    (matchesRole(t) && /brand new start|bns|interim|zzp|contract/i.test(t))
  );
}

/**
 * Jeffrey's posts define WHAT we hunt — not WHO is hiring.
 * Never write these to the radar as market signals.
 */
export function learnSpecialtyFromPosts(
  posts: LinkedInPost[],
  meta: { mode: string; detail?: string }
): SpecialtyProfile {
  const counts = new Map<string, { label: string; family: string; count: number }>();
  const samples: { role: string; snippet: string }[] = [];
  let scanned = 0;
  let vacancyPosts = 0;

  for (const post of posts) {
    const text = (post.text || "").trim();
    if (!text) continue;
    scanned += 1;
    if (!isVacancyPost(text)) continue;
    vacancyPosts += 1;

    const label = detectRoleLabel(text);
    // Family from the role label itself (not whole post — posts often mix keywords)
    const familyId = detectFamily(label) || detectFamily(text);
    const family =
      ROLE_FAMILIES.find((f) => f.id === familyId)?.label || "Overig";

    const key = label.toLowerCase();
    const prev = counts.get(key);
    if (prev) prev.count += 1;
    else counts.set(key, { label, family, count: 1 });

    if (samples.length < 8) {
      samples.push({ role: label, snippet: text.slice(0, 160).replace(/\s+/g, " ") });
    }
  }

  const roles = [...counts.values()].sort((a, b) => b.count - a.count);
  const huntSummary = roles.length
    ? roles.map((r) => r.label).slice(0, 8).join(" · ")
    : ROLE_FAMILIES.map((f) => f.label).slice(0, 6).join(" · ");

  const profile: SpecialtyProfile = {
    updatedAt: new Date().toISOString(),
    mode: meta.mode,
    detail: meta.detail,
    scanned,
    vacancyPosts,
    roles,
    huntSummary,
    samples,
  };
  globalSpecialty.__bnsSpecialty = profile;
  return profile;
}

export function getSpecialty(): SpecialtyProfile {
  if (!globalSpecialty.__bnsSpecialty) {
    // Default from Instellingen until first Jeffrey sync
    globalSpecialty.__bnsSpecialty = {
      updatedAt: new Date().toISOString(),
      mode: "default",
      scanned: 0,
      vacancyPosts: 0,
      roles: huntRoles().map((label) => ({
        label,
        family: detectFamily(label) || "Overig",
        count: 0,
      })),
      huntSummary: huntRoles().join(" · "),
      samples: [],
    };
  }
  return globalSpecialty.__bnsSpecialty;
}

export async function fetchPostsViaApify(maxPosts = 40): Promise<{
  mode: "apify" | "fixture";
  posts: LinkedInPost[];
  detail?: string;
}> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { mode: "fixture", posts: fixtureJeffreyPosts(), detail: "no-apify-token" };
  }

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(APIFY_ACTOR)}/runs?waitForFinish=120`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUrls: [JEFFREY_PROFILE],
        maxPosts,
        postedLimit: "year",
      }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    throw new Error(`Apify run failed: ${runRes.status} ${errText.slice(0, 200)}`);
  }

  const run = (await runRes.json()) as {
    data?: { defaultDatasetId?: string };
  };
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) throw new Error("Apify run had no dataset");

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!itemsRes.ok) throw new Error(`Apify dataset fetch failed: ${itemsRes.status}`);

  const items = (await itemsRes.json()) as Array<Record<string, unknown>>;
  const posts = items
    .map((item) => normalizeApifyItem(item))
    .filter((p): p is LinkedInPost => Boolean(p?.text));

  return { mode: "apify", posts, detail: `actor=${APIFY_ACTOR} n=${posts.length}` };
}

function normalizeApifyItem(item: Record<string, unknown>): LinkedInPost | null {
  const text =
    (item.text as string) ||
    (item.content as string) ||
    (item.postText as string) ||
    (item.commentary as string) ||
    "";
  if (!text) return null;
  return {
    text,
    url: (item.url as string) || (item.postUrl as string) || undefined,
    postedAt: (item.postedAt as string) || (item.publishedAt as string) || undefined,
    raw: item,
  };
}

export function fixtureJeffreyPosts(): LinkedInPost[] {
  return [
    {
      text: `❗️URGENT❗️ Voor een relatie van BRAND NEW START zoeken wij per direct een Scrum Master die meerdere teams ondersteunt. Interim / ZZP.`,
      url: JEFFREY_PROFILE,
    },
    {
      text: `❗️URGENT❗️ Op zoek naar een ervaren Business Analist WTP — 12 maanden contract, invaren pensioenfondsen.`,
      url: JEFFREY_PROFILE,
    },
    {
      text: `Project Manager — procurement & contract management — 12-Month Contract.`,
      url: JEFFREY_PROFILE,
    },
    {
      text: `Sr. Node.js Developer met e-commerce ervaring. Interim mogelijk.`,
      url: JEFFREY_PROFILE,
    },
    {
      text: `Agile Coach gevraagd voor digitale transitie — ZZP.`,
      url: JEFFREY_PROFILE,
    },
  ];
}

/** Refresh specialty from Jeffrey — does NOT add radar rows. */
export async function syncJeffreySpecialty(maxPosts = 40) {
  const { mode, posts, detail } = await fetchPostsViaApify(maxPosts);
  const specialty = learnSpecialtyFromPosts(posts, { mode, detail });
  return { ...specialty, fetched: posts.length };
}
