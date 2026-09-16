import { isAgencyName } from "@/lib/agency";
import type { ResearchReport } from "@/lib/research/types";

export type Evidence = {
  label: string;
  quote?: string;
  weight: number;
};

export type ClientGuess = {
  name: string;
  confidence: number;
  evidence: Evidence[];
  alternatives: { name: string; confidence: number }[];
  /** How this guess was produced */
  source?: "rules" | "serp" | "ai" | "deep";
  /** Transparent research / scoring explanation */
  report?: ResearchReport;
};

export type VacancyFacts = {
  location: string | null;
  start: string | null;
  duration: string | null;
  hours: string | null;
  stack: string[];
};

type Client = {
  name: string;
  aliases: string[];
  sector: string;
  tags: string[];
  /**
   * Geographic anchors (city/province). Place-bound orgs (gemeente, haven, …)
   * must hit at least one home token for a tag-based match — otherwise
   * "gemeente + overheid" wrongly picks Amsterdam for a Zuid-Holland role.
   */
  home?: string[];
  /** If true (or name starts with Gemeente/…), home is required for tag matches. */
  placeBound?: boolean;
};

const CLIENTS: Client[] = [
  {
    name: "ABN AMRO",
    aliases: ["abn amro", "abn-amro", "abnamro"],
    sector: "bank",
    tags: ["bank", "amsterdam", "zuidas", "azure", "databricks", "data factory"],
    home: ["amsterdam", "noord-holland", "zuidas"],
  },
  {
    name: "ING",
    aliases: ["ing bank", "ing groep"],
    sector: "bank",
    tags: ["bank", "amsterdam", "cedar", "azure", "java"],
    home: ["amsterdam", "noord-holland"],
  },
  {
    name: "Rabobank",
    aliases: ["rabobank", "rabo"],
    sector: "bank",
    tags: ["bank", "utrecht", "food", "agri", "boeren"],
    home: ["utrecht"],
  },
  {
    name: "NN Group",
    aliases: ["nn group", "nationale nederlanden", "nationale-nederlanden"],
    sector: "verzeker",
    tags: ["verzeker", "den haag", "the hague", "insurance", "hyper automation"],
    home: ["den haag", "the hague", "zuid-holland"],
  },
  {
    name: "a.s.r.",
    aliases: ["a.s.r", "asr nederland", "asr"],
    sector: "verzeker",
    tags: ["verzeker", "utrecht", "schade", "insurance"],
    home: ["utrecht"],
  },
  {
    name: "Achmea",
    aliases: ["achmea"],
    sector: "verzeker",
    tags: ["verzeker", "zeist", "apeldoorn", "schade"],
    home: ["zeist", "apeldoorn", "utrecht"],
  },
  {
    name: "CCV",
    aliases: ["ccv group", "ccv nederland"],
    sector: "payments",
    tags: ["arnhem", "gelderland", "payments", "betalingsverkeer", "pos", ".net", "aws", "fintech"],
    home: ["arnhem", "gelderland"],
  },
  {
    name: "VGZ",
    aliases: ["coöperatie vgz", "cooperatie vgz"],
    sector: "verzeker",
    tags: ["arnhem", "gelderland", "verzeker", "zorg", "azure", ".net"],
    home: ["arnhem", "gelderland"],
  },
  {
    name: "Alliander",
    aliases: ["liander", "alliander n.v"],
    sector: "energie",
    tags: ["arnhem", "gelderland", "energie", "netbeheer", "azure"],
    home: ["arnhem", "gelderland"],
  },
  {
    name: "DELA",
    aliases: ["dela uitvaart"],
    sector: "verzeker",
    tags: ["eindhoven", "brabant", "uitvaart", "verzeker"],
    home: ["eindhoven", "brabant", "noord-brabant"],
  },
  {
    name: "Adyen",
    aliases: ["adyen"],
    sector: "fintech",
    tags: ["fintech", "amsterdam", "payments", "java", "adyen"],
    home: ["amsterdam", "noord-holland"],
  },
  {
    name: "Booking.com",
    aliases: ["booking.com", "booking"],
    sector: "ecom",
    tags: ["e-commerce", "ecommerce", "diemen", "genai", "java"],
    home: ["diemen", "amsterdam", "noord-holland"],
  },
  {
    name: "Gemeente Amsterdam",
    aliases: ["gemeente amsterdam", "city of amsterdam"],
    sector: "overheid",
    tags: ["overheid", "amsterdam", "safe", "gemeente"],
    home: ["amsterdam", "noord-holland"],
    placeBound: true,
  },
  {
    name: "Gemeente Rotterdam",
    aliases: ["gemeente rotterdam", "city of rotterdam"],
    sector: "overheid",
    tags: ["overheid", "rotterdam", "gemeente"],
    home: ["rotterdam", "zuid-holland"],
    placeBound: true,
  },
  {
    name: "Gemeente Den Haag",
    aliases: ["gemeente den haag", "gemeente 's-gravenhage", "city of the hague"],
    sector: "overheid",
    tags: ["overheid", "den haag", "the hague", "gemeente"],
    home: ["den haag", "the hague", "zuid-holland"],
    placeBound: true,
  },
  {
    name: "Belastingdienst",
    aliases: ["belastingdienst"],
    sector: "overheid",
    tags: ["overheid", "apeldoorn", "iv"],
    home: ["apeldoorn"],
  },
  {
    name: "Politie",
    aliases: ["politie nederland", "nationale politie"],
    sector: "overheid",
    tags: ["overheid", "politie", "iv"],
  },
  {
    name: "Havenbedrijf Rotterdam",
    aliases: ["port of rotterdam", "havenbedrijf rotterdam", "hb rdam"],
    sector: "haven",
    tags: ["rotterdam", "sap", "s/4hana", "asset life cycle", "alc", "port", "iot", "gis", "servicenow"],
    home: ["rotterdam", "zuid-holland"],
    placeBound: true,
  },
];

/** Map place tokens → province key for conflict checks. */
const PLACE_PROVINCE: Record<string, string> = {
  amsterdam: "noord-holland",
  zuidas: "noord-holland",
  diemen: "noord-holland",
  haarlem: "noord-holland",
  "noord-holland": "noord-holland",
  "noord holland": "noord-holland",
  rotterdam: "zuid-holland",
  "den haag": "zuid-holland",
  "the hague": "zuid-holland",
  delft: "zuid-holland",
  leiden: "zuid-holland",
  "zuid-holland": "zuid-holland",
  "zuid holland": "zuid-holland",
  utrecht: "utrecht",
  zeist: "utrecht",
  amersfoort: "utrecht",
  arnhem: "gelderland",
  nijmegen: "gelderland",
  apeldoorn: "gelderland",
  gelderland: "gelderland",
  eindhoven: "brabant",
  tilburg: "brabant",
  breda: "brabant",
  brabant: "brabant",
  "noord-brabant": "brabant",
};

const PLACE_TOKENS = Object.keys(PLACE_PROVINCE);

const STACK = [
  "Azure",
  "AWS",
  "GCP",
  "Databricks",
  "Snowflake",
  "Kubernetes",
  "Terraform",
  "Java",
  ".NET",
  "SAP",
  "Salesforce",
  "BPMN",
  "SAFe",
  "Scrum",
  "Power BI",
  "dbt",
  "Kafka",
  "Python",
  "TypeScript",
  "React",
];

function hay(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasWord(h: string, needle: string) {
  const n = needle.toLowerCase();
  if (n.length <= 3) return new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(h);
  return h.includes(n);
}

function placesInHay(h: string): string[] {
  return PLACE_TOKENS.filter((p) => hasWord(h, p));
}

function provincesOf(places: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of places) {
    const prov = PLACE_PROVINCE[p];
    if (prov) out.add(prov);
  }
  return out;
}

function isPlaceBound(c: Client) {
  if (c.placeBound) return true;
  return /^(gemeente|provincie|waterschap|havenbedrijf)\b/i.test(c.name);
}

/** Vacancy province clashes with all of the client's home provinces. */
function geoConflict(vacancyHay: string, c: Client): boolean {
  if (!c.home?.length) return false;
  const vacPlaces = placesInHay(vacancyHay);
  if (!vacPlaces.length) return false;
  const vacProv = provincesOf(vacPlaces);
  const homeProv = provincesOf(c.home.map((x) => x.toLowerCase()));
  if (!vacProv.size || !homeProv.size) return false;
  for (const p of vacProv) {
    if (homeProv.has(p)) return false;
  }
  return true;
}

function homeHit(vacancyHay: string, c: Client): boolean {
  return (c.home || []).some((p) => hasWord(vacancyHay, p));
}

/** City (not province) from home must appear — "Zuid-Holland" ≠ Gemeente Rotterdam. */
function homeCityHit(vacancyHay: string, c: Client): boolean {
  for (const p of c.home || []) {
    const key = p.toLowerCase();
    const prov = PLACE_PROVINCE[key];
    // Skip pure province tokens
    if (prov && (key === prov || key === prov.replace(/-/g, " "))) continue;
    if (hasWord(vacancyHay, key)) return true;
  }
  return false;
}

export function extractVacancyFacts(text: string): VacancyFacts {
  const t = text.replace(/\s+/g, " ");
  const loc =
    t.match(
      /\b(Amsterdam(?: Zuidas)?|Utrecht|Den Haag|Rotterdam|Eindhoven|Amersfoort|Zeist|Apeldoorn|Arnhem|Nijmegen|Haarlem|Groningen|Tilburg|Breda|Zwolle|Gelderland|Noord-Holland|Zuid-Holland|Brabant|Limburg)\b/i
    )?.[0] ||
    t.match(/(?:standplaats|locatie|gevestigd in|kantoor in)\s*[:\-]?\s*([A-ZÁÉÍÓÚ][A-Za-zÀ-ÿ\-]{2,24}(?:\s+[A-ZÁÉÍÓÚ][A-Za-zÀ-ÿ\-]{2,24}){0,2})/)?.[1] ||
    null;
  const start =
    t.match(/(?:start|startdatum|ingang)\s*[:\-]?\s*([^\n.,]{3,40})/i)?.[1] ||
    t.match(/\b(1 oktober|per direct|asap|per \d{1,2} \w+)\b/i)?.[0] ||
    null;
  const duration =
    t.match(/(?:duur|looptijd|periode)\s*[:\-]?\s*([^\n.,]{3,40})/i)?.[1] ||
    t.match(/\b(\d{1,2}\s*(?:maanden|weken))\b/i)?.[0] ||
    null;
  const hours = t.match(/\b(\d{2}\s*uur(?:\s*p\/?w(?:eek)?)?)\b/i)?.[0] || null;
  const stack = STACK.filter((s) => hay(t).includes(s.toLowerCase()));
  return {
    location: loc?.trim().slice(0, 48) || null,
    start: start?.trim().slice(0, 48) || null,
    duration: duration?.trim().slice(0, 48) || null,
    hours: hours?.trim() || null,
    stack: stack.slice(0, 8),
  };
}

const GENERIC_ORG =
  /^(een|de|het|onze|hun|uw|opdrachtgever|eindklant|klant|client|cliënt|organisatie|bedrijf|partij)$/i;

function explicitClient(text: string): { name: string; quote: string } | null {
  const patterns = [
    /(?:eindklant|opdrachtgever|cli[eë]nt)\s*(?:is|:)\s*(?:de\s+|het\s+)?([A-ZÁÉÍÓÚ][\w.&'’\-]{2,40}(?:\s+[A-ZÁÉÍÓÚ][\w.&'’\-]{2,40}){0,3})/,
    /namens\s+(?:de\s+|het\s+)?([A-ZÁÉÍÓÚ][\w.&'’\-]{2,40}(?:\s+[A-ZÁÉÍÓÚ][\w.&'’\-]{2,40}){0,3})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const raw = m[1].replace(/[.,;:]+$/, "").trim();
    const first = raw.split(/\s+/)[0] || "";
    if (raw.length < 3 || GENERIC_ORG.test(first) || isAgencyName(raw)) continue;
    return { name: raw, quote: m[0].trim().slice(0, 120) };
  }
  return null;
}

function catalogMatch(name: string): Client | null {
  const h = hay(name);
  for (const c of CLIENTS) {
    if (hay(c.name) === h || c.aliases.some((a) => h === a || h.includes(a))) return c;
  }
  return null;
}

/**
 * Tag rarity from the catalog itself: "asset life cycle" identifies one client,
 * "azure" identifies half of them. Without this, generic stack words produced
 * confident nonsense.
 */
const TAG_RARITY: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const c of CLIENTS) {
    for (const t of new Set(c.tags)) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [tag, n] of counts) {
    // 1 client → 1.0 (distinctive), 2 → 0.7, 3 → 0.5, many → 0.3
    out.set(tag, n <= 1 ? 1 : n === 2 ? 0.7 : n === 3 ? 0.5 : 0.3);
  }
  return out;
})();

/** Bureau references often keep the client in the job code: "Booking — 12785 — SE2". */
function referencedClient(title: string): { client: Client; quote: string } | null {
  const head = title.split(/[—–|/]/)[0]?.trim();
  if (!head || head.length < 3 || head.length > 40) return null;
  if (isAgencyName(head)) return null;
  const cat = catalogMatch(head);
  if (!cat) return null;
  return { client: cat, quote: title.slice(0, 120) };
}

export function guessEndClient(opts: { title?: string; text: string }): ClientGuess | null {
  const blob = `${opts.title || ""}\n${opts.text}`;
  const h = hay(blob);
  const scored = new Map<string, { name: string; evidence: Evidence[] }>();

  function add(name: string, ev: Evidence) {
    if (isAgencyName(name)) return;
    const cur = scored.get(name) || { name, evidence: [] };
    cur.evidence.push(ev);
    scored.set(name, cur);
  }

  const named = explicitClient(blob);
  if (named) {
    const cat = catalogMatch(named.name);
    add(cat?.name || named.name, {
      label: "Vacature noemt de opdrachtgever",
      quote: named.quote,
      weight: 88,
    });
  }

  const referenced = referencedClient(opts.title || "");
  if (referenced) {
    add(referenced.client.name, {
      label: "Klantnaam in de opdrachtreferentie",
      quote: referenced.quote,
      weight: 84,
    });
  }

  for (const c of CLIENTS) {
    for (const alias of [c.name, ...c.aliases]) {
      if (alias.length < 3) continue;
      if (hasWord(h, alias) && !named) {
        // Explicit name in text still wins even across provinces (HQ vs standplaats).
        add(c.name, { label: `Naam ${c.name} in de tekst`, weight: 86 });
      }
    }

    const hits = c.tags.filter((t) => hasWord(h, t));
    if (hits.length < 2) continue;

    // Place-bound orgs (Gemeente X, Havenbedrijf, …): need the *city* in the text.
    // Province alone ("Zuid-Holland") must not unlock Rotterdam/Den Haag/Amsterdam.
    if (isPlaceBound(c) && !homeCityHit(h, c)) continue;

    // Soft geo block for everyone with home: Zuid-Holland vacancy ≠ Amsterdam HQ
    // unless the home city also appears (e.g. remote ABN with "Amsterdam" named).
    if (geoConflict(h, c) && !homeHit(h, c)) continue;

    // Weigh by rarity, not by count: two distinctive tags beat five generic ones.
    const rarity = hits.map((t) => TAG_RARITY.get(t) ?? 0.5);
    const mass = rarity.reduce((a, b) => a + b, 0);
    const distinctive = hits.filter((t) => (TAG_RARITY.get(t) ?? 0.5) >= 0.7);
    // No distinctive signal at all → a tag match is a hint, not a hypothesis.
    let ceiling = distinctive.length >= 2 ? 74 : distinctive.length === 1 ? 62 : 46;
    if (geoConflict(h, c)) ceiling = Math.min(ceiling, 38);
    const sorted = [...hits].sort((a, b) => (TAG_RARITY.get(b) ?? 0.5) - (TAG_RARITY.get(a) ?? 0.5));

    add(c.name, {
      label: `Profiel: ${sorted.slice(0, 4).join(", ")}`,
      quote: distinctive.length ? `Onderscheidend: ${distinctive.slice(0, 3).join(", ")}` : undefined,
      weight: Math.min(ceiling, Math.round(22 + mass * 22)),
    });
  }

  const ranked = [...scored.values()]
    .map((s) => {
      const weights = s.evidence.map((e) => e.weight).sort((a, b) => b - a);
      const confidence = Math.min(95, weights[0]! + Math.floor((weights[1] || 0) * 0.15));
      return { name: s.name, confidence, evidence: s.evidence.sort((a, b) => b.weight - a.weight).slice(0, 4) };
    })
    .sort((a, b) => b.confidence - a.confidence)
    // Near-ties mean the catalog cannot separate them; keep them as real alternatives.
    .slice(0, 4);

  const top = ranked[0];
  if (!top) return null;
  return {
    name: top.name,
    confidence: top.confidence,
    evidence: top.evidence,
    alternatives: ranked.slice(1, 4).map((r) => ({ name: r.name, confidence: r.confidence })),
    source: "rules",
  };
}

export function leadStatusFromGuess(guess: ClientGuess | null): "review" | "weak" | "suggest" {
  if (!guess) return "weak";
  if (guess.confidence >= 80) return "suggest";
  if (guess.confidence >= 45) return "review";
  return "weak";
}

/**
 * Gratis signaalextractie voor de eerste research-hit — geen LLM.
 * Genoeg om discovery-queries te sturen; deep mag later een LLM-extract doen.
 */
export function huntSignals(opts: { title?: string; text: string }): {
  project_signals: string[];
  hard_signals: string[];
  client_name_leak: string | null;
  technology: string[];
  cloud: string[];
  location: { city: string | null; region: string | null };
} {
  const blob = `${opts.title || ""}\n${opts.text}`;
  const h = hay(blob);
  const facts = extractVacancyFacts(blob);

  const project_signals: string[] = [];
  const hard_signals: string[] = [];
  for (const [tag, rarity] of TAG_RARITY) {
    if (rarity < 0.7 || !hasWord(h, tag)) continue;
    // Programme-achtige / multi-word tags eerst als project, rest als hard.
    if (/\s/.test(tag) || /^(alc|eam|cedar)$/i.test(tag)) project_signals.push(tag);
    else hard_signals.push(tag);
  }

  const named = explicitClient(blob);
  const referenced = referencedClient(opts.title || "");
  const leak = named?.name || referenced?.client.name || null;

  const cloud = facts.stack.filter((s) => /^(azure|aws|gcp)$/i.test(s));
  const technology = facts.stack.filter((s) => !/^(azure|aws|gcp)$/i.test(s));

  const cityRaw = facts.location;
  const city =
    cityRaw && !/holland|brabant|gelderland|limburg|utrecht|friesland|zeeland|drenthe|overijssel|flevoland|groningen/i.test(cityRaw)
      ? cityRaw
      : null;
  const region =
    cityRaw && /holland|brabant|gelderland|limburg|utrecht/i.test(cityRaw) ? cityRaw : null;

  return {
    project_signals: [...new Set(project_signals)].slice(0, 5),
    hard_signals: [...new Set(hard_signals)].slice(0, 5),
    client_name_leak: leak,
    technology: technology.slice(0, 6),
    cloud: cloud.slice(0, 3),
    location: { city, region },
  };
}

/** True wanneer er iets te jagen valt (anonieme kans met onderscheidend spoor). */
export function isHuntWorthy(opts: { title?: string; text: string; prior?: ClientGuess | null }): boolean {
  const prior = opts.prior ?? guessEndClient(opts);
  if (prior && prior.confidence >= 85) return false; // al binnen — geen betaalde jacht nodig
  const s = huntSignals(opts);
  if (s.client_name_leak) return false; // naamlek: gratis regels volstaan
  if (s.project_signals.length >= 1) return true;
  if (s.hard_signals.length >= 2 && (s.location.city || s.location.region)) return true;
  if (prior && prior.confidence >= 55 && prior.confidence < 85) return true;
  return false;
}
