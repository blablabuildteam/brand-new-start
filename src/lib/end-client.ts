import { isAgencyName } from "@/lib/agency";

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
    name: "Adyen",
    aliases: ["adyen"],
    sector: "fintech",
    tags: ["fintech", "amsterdam", "payments", "java", "adyen"],
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
    t.match(/\b(Amsterdam(?: Zuidas)?|Utrecht|Den Haag|Rotterdam|Eindhoven|Amersfoort|Zeist|Apeldoorn)\b/i)?.[0] ||
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

  for (const c of CLIENTS) {
    for (const alias of [c.name, ...c.aliases]) {
      if (alias.length < 3) continue;
      if (hasWord(h, alias) && !named) {
        add(c.name, { label: `Naam ${c.name} in de tekst`, weight: 86 });
      }
    }
    const hits = c.tags.filter((t) => hasWord(h, t));
    if (hits.length >= 2) {
      add(c.name, {
        label: `Profiel: ${hits.slice(0, 4).join(", ")}`,
        weight: Math.min(28 + hits.length * 10, 72),
      });
    }
  }

  const ranked = [...scored.values()]
    .map((s) => {
      const weights = s.evidence.map((e) => e.weight).sort((a, b) => b - a);
      const confidence = Math.min(95, weights[0]! + Math.floor((weights[1] || 0) * 0.15));
      return { name: s.name, confidence, evidence: s.evidence.sort((a, b) => b.weight - a.weight).slice(0, 4) };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const top = ranked[0];
  if (!top) return null;
  return {
    name: top.name,
    confidence: top.confidence,
    evidence: top.evidence,
    alternatives: ranked.slice(1, 3).map((r) => ({ name: r.name, confidence: r.confidence })),
  };
}

export function leadStatusFromGuess(guess: ClientGuess | null): "review" | "weak" | "suggest" {
  if (!guess) return "weak";
  if (guess.confidence >= 80) return "suggest";
  if (guess.confidence >= 45) return "review";
  return "weak";
}
