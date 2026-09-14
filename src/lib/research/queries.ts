import type { JobSignals, ResearchDepth } from "@/lib/research/types";

/** Quote multi-word terms so search engines stop guessing homonyms. */
export function q(s: string | null | undefined) {
  const t = (s || "").trim();
  if (!t) return "";
  return /[\s.]/.test(t) ? `"${t.replace(/"/g, "")}"` : t;
}

function dedupe(list: string[], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const query = raw.replace(/\s+/g, " ").trim();
    if (query.length < 10) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= max) break;
  }
  return out;
}

/** Round 1: cast a wide but disciplined net around the vacancy's hard signals. */
export function discoveryQueries(opts: {
  agency: string;
  recruiter?: string;
  signals: JobSignals | null;
  depth: ResearchDepth;
}): string[] {
  const s = opts.signals;
  const tech = (s?.technology || []).slice(0, 3);
  const cloud = (s?.cloud || []).slice(0, 2);
  const city = s?.location?.city || "";
  const region = s?.location?.region || "";
  const place = city || region;
  const industry = s?.industry || "";
  const phrases = (s?.project_signals || []).slice(0, 3);
  const hard = (s?.hard_signals || []).slice(0, 3);
  const agencyQ = q(opts.agency);
  const recQ = q(opts.recruiter);

  // Distinctive programme / hard signals first — that is the anonymous product path.
  // Agency+stack searches are supporting evidence, not the main hunt.
  const list = [
    ...phrases.map((p) => [q(p), place, q(tech[0])].filter(Boolean).join(" ")),
    ...hard.map((h) => [q(h), place, q(tech[0])].filter(Boolean).join(" ")),
    phrases[0] && hard[0] ? [q(phrases[0]), q(hard[0]), place].filter(Boolean).join(" ") : "",
    place && phrases[0]
      ? [q(phrases[0]), place, "programma OR project OR modernisering OR SAP"].filter(Boolean).join(" ")
      : "",
    [agencyQ, q(tech[0]), cloud[0] || "", place, "vacature OR freelance OR ZZP"].filter(Boolean).join(" "),
    [agencyQ, tech.slice(0, 2).map(q).join(" "), place, "opdrachtgever OR eindklant OR interim"]
      .filter(Boolean)
      .join(" "),
    recQ ? [recQ, agencyQ, q(tech[0]), place].filter(Boolean).join(" ") : "",
    [agencyQ, place, industry, "2024 OR 2025 OR 2026"].filter(Boolean).join(" "),
    place && tech[0] ? `site:freelance.nl ${q(tech[0])} ${cloud[0] || ""} ${place}` : "",
    ...(s?.search_queries || []),
  ];

  return dedupe(list, opts.depth === "deep" ? 12 : opts.depth === "standard" ? 9 : 5);
}

/** Round 2: probe the companies that could plausibly own this programme. */
export function candidateQueries(opts: {
  candidate: string;
  signals: JobSignals | null;
  agency: string;
}): string[] {
  const s = opts.signals;
  const name = q(opts.candidate);
  const tech = (s?.technology || []).slice(0, 2).map(q).join(" ");
  const cloud = s?.cloud?.[0] || "";
  const place = s?.location?.city || s?.location?.region || "";
  const phrases = (s?.project_signals || []).slice(0, 2);

  return dedupe(
    [
      [name, tech, cloud, "vacature OR careers OR werken-bij"].filter(Boolean).join(" "),
      [name, cloud || tech, "migratie OR modernisering OR platform OR transformatie"].filter(Boolean).join(" "),
      ...phrases.map((p) => [name, q(p)].filter(Boolean).join(" ")),
      [name, q(opts.agency), "inhuur OR detachering OR freelance OR opdracht"].filter(Boolean).join(" "),
      place ? [name, place, "kantoor OR hoofdkantoor OR vestiging"].filter(Boolean).join(" ") : "",
    ],
    5
  );
}

/** Round 2b: actively try to break the hypothesis instead of confirming it. */
export function falsificationQueries(opts: {
  candidate: string;
  signals: JobSignals | null;
}): string[] {
  const s = opts.signals;
  const name = q(opts.candidate);
  const cloud = (s?.cloud || [])[0] || "";
  const rival = /aws/i.test(cloud) ? "Azure" : /azure/i.test(cloud) ? "AWS" : "Azure OR AWS OR GCP";

  return dedupe(
    [
      [name, rival, "cloud OR platform OR architectuur"].filter(Boolean).join(" "),
      [name, "tech stack OR engineering blog OR techradar"].filter(Boolean).join(" "),
      [name, "outsourcing OR managed services OR partner", "IT"].filter(Boolean).join(" "),
    ],
    3
  );
}
