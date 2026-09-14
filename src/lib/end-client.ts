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
  source?: "rules" | "ai" | "deep";
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
};

const CLIENTS: Client[] = [
  {
    name: "ABN AMRO",
    aliases: ["abn amro", "abn-amro", "abnamro"],
    sector: "bank",
    tags: ["bank", "amsterdam", "zuidas", "azure", "databricks", "data factory"],
  },
  {
    name: "ING",
    aliases: ["ing bank", "ing groep"],
    sector: "bank",
    tags: ["bank", "amsterdam", "cedar", "azure", "java"],
  },
  {
    name: "Rabobank",
    aliases: ["rabobank", "rabo"],
    sector: "bank",
    tags: ["bank", "utrecht", "food", "agri", "boeren"],
  },
  {
    name: "NN Group",
    aliases: ["nn group", "nationale nederlanden", "nationale-nederlanden"],
    sector: "verzeker",
    tags: ["verzeker", "den haag", "the hague", "insurance", "hyper automation"],
  },
  {
    name: "a.s.r.",
    aliases: ["a.s.r", "asr nederland", "asr"],
    sector: "verzeker",
    tags: ["verzeker", "utrecht", "schade", "insurance"],
  },
  {
    name: "Achmea",
    aliases: ["achmea"],
    sector: "verzeker",
    tags: ["verzeker", "zeist", "apeldoorn", "schade"],
  },
  {
    name: "CCV",
    aliases: ["ccv group", "ccv nederland"],
    sector: "payments",
    tags: ["arnhem", "gelderland", "payments", "betalingsverkeer", "pos", ".net", "aws", "fintech"],
  },
  {
    name: "VGZ",
    aliases: ["coöperatie vgz", "cooperatie vgz"],
    sector: "verzeker",
    tags: ["arnhem", "gelderland", "verzeker", "zorg", "azure", ".net"],
  },
  {
    name: "Alliander",
    aliases: ["liander", "alliander n.v"],
    sector: "energie",
    tags: ["arnhem", "gelderland", "energie", "netbeheer", "azure"],
  },
  {
    name: "DELA",
    aliases: ["dela uitvaart"],
    sector: "verzeker",
    tags: ["eindhoven", "brabant", "uitvaart", "verzeker"],
  },
  {
    name: "Adyen",
    aliases: ["adyen"],
    sector: "fintech",
    tags: ["fintech", "amsterdam", "payments", "java", "adyen"],
  },
  {
    name: "Booking.com",
    aliases: ["booking.com", "booking"],
    sector: "ecom",
    tags: ["e-commerce", "ecommerce", "diemen", "genai", "java"],
  },
  {
    name: "Gemeente Amsterdam",
    aliases: ["gemeente amsterdam", "city of amsterdam"],
    sector: "overheid",
    tags: ["overheid", "amsterdam", "safe", "gemeente"],
  },
  {
    name: "Belastingdienst",
    aliases: ["belastingdienst"],
    sector: "overheid",
    tags: ["overheid", "apeldoorn", "iv"],
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
  },
];

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
        add(c.name, { label: `Naam ${c.name} in de tekst`, weight: 86 });
      }
    }

    const hits = c.tags.filter((t) => hasWord(h, t));
    if (hits.length < 2) continue;

    // Weigh by rarity, not by count: two distinctive tags beat five generic ones.
    const rarity = hits.map((t) => TAG_RARITY.get(t) ?? 0.5);
    const mass = rarity.reduce((a, b) => a + b, 0);
    const distinctive = hits.filter((t) => (TAG_RARITY.get(t) ?? 0.5) >= 0.7);
    // No distinctive signal at all → a tag match is a hint, not a hypothesis.
    const ceiling = distinctive.length >= 2 ? 74 : distinctive.length === 1 ? 62 : 46;
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
