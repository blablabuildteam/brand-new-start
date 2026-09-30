import { aiJsonCompletion, hasAiKey } from "@/lib/ai-client";
import { isAgencyName, looksLikeIntermediary } from "@/lib/agency";
import type { ClientGuess, Evidence, EvidenceOrigin } from "@/lib/end-client";
import { hasWeb, makeBudget, multiSearch } from "@/lib/research/web";
import type { SearchHit } from "@/lib/research/types";

/**
 * Recruiter-feed speurder: wie is de opdrachtgever achter een anonieme post?
 *
 * Werkt zoals een goede recruiter met ChatGPT: lees de post, gebruik
 * marktkennis, zoek de opdracht één keer terug op internet (andere bureaus
 * plaatsen dezelfde opdracht vaak mét naam) en leg per aanwijzing uit waarom.
 * Eén Claude-call, maximaal twee zoekopdrachten.
 *
 * De zekerheid komt niet van het model zelf: elke aanwijzing wordt nagetrokken
 * (staat het citaat echt in de post, noemt de webhit echt de naam) en het
 * plafond hangt af van wat er bewezen is.
 */

export type FeedMemory = {
  client: string;
  title: string;
  recruiter: string | null;
  sameRecruiter: boolean;
  summary: string;
};

export type FeedVerdict =
  | { kind: "client"; guess: ClientGuess; model: string; detail: string }
  | { kind: "not-assignment"; reason: string; model: string }
  | { kind: "unknown"; detail: string; model: string; check?: string };

const CAP = {
  nameInPost: 96,
  web: 92,
  memory: 88,
  threePostClues: 74,
  twoPostClues: 68,
  knowledge: 60,
} as const;

/** Rules hints below this only anchor the model on a weak guess. */
const HINT_MIN = 70;

/** Quotes that fit hundreds of organisations prove nothing. */
const GENERIC_QUOTE =
  /^(?:(?:grote|large|groot|internationale?|nederlandse|dutch|hybride|hybrid|remote|enterprise|enterpriseomgeving|organisatie|organization|azure|aws|gcp|cloud|java|\.net|c#|python|kubernetes|scrum|agile|devops|amsterdam|rotterdam|utrecht|den haag|eindhoven|freelance|zzp|en|of|and|or|\/|,|-)\s*)+$/i;

function fold(s: string) {
  return s
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** LinkedIn-posts gebruiken 𝗯𝗼𝗹𝗱-unicode, emoji en hashtags; weg ermee vóór zoeken. */
export function cleanPost(text: string) {
  return text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\S+@\S+\.\S+/g, " ")
    .replace(/#\w+/g, " ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Posts komen vaak dubbel binnen (samenvatting + beschrijving). */
function dedupeHalves(text: string) {
  const t = text.trim();
  const probe = t.slice(0, 80);
  const again = probe.length >= 40 ? t.indexOf(probe, 40) : -1;
  return again > 0 ? t.slice(0, again).trim() : t;
}

const GENERIC_SENTENCE =
  /\b(interesse|stuur (me|mij|een)|bericht|dm|cv|beschikbaar|reageer|solliciteer|ken je iemand|wat breng je mee|wat vragen wij|wat bieden wij|je bent|jij bent|hi netwerk|beste netwerk|hallo netwerk|please|contact|get in touch|let me know|interested|uur per week|hours per week|ervaring (met|als|in)|experience (with|as|in)|years of|kennis van|knowledge of|beheersing|nederlandse taal|dutch)\b/i;

/** Words that describe the client's world — where a recruiter copies the client's own text. */
const CONTEXT_WORDS =
  /\b(platform|programma|program|programme|organisatie|organisation|organization|team|project|traject|transformatie|transformation|migratie|migration|omgeving|sector|branche|klant|client|company|bedrijf|werkt aan|working on|miljoen|million|gebruikers|users|klanten|customers|landelijk|internationale?|scheepvaart|haven|zorg|bank|verzeker|overheid|gemeente|energie|netbeheer|retail|e-commerce|logistiek|telecom)\b/gi;

/**
 * De zin die deze opdracht het meest uniek maakt. Recruiters kopiëren die
 * meestal uit de klantvacature — letterlijk terugzoeken vindt vaak het origineel.
 */
export function fingerprintSentence(text: string): string | null {
  const parts = cleanPost(dedupeHalves(text))
    .split(/[.!?\n•*|;:]+|\s[-–—]\s/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => {
      const words = s.split(" ").length;
      return words >= 7 && words <= 30 && !GENERIC_SENTENCE.test(s);
    });
  if (!parts.length) return null;
  const score = (s: string) => {
    const words = s.split(" ");
    const caps = words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).length;
    // Mostly-capitalised lines are name tags or stack lists, not a description.
    if (caps / words.length > 0.5) return -1;
    const context = (s.match(CONTEXT_WORDS) || []).length;
    const long = words.filter((w) => w.length >= 10).length;
    return context * 3 + Math.min(caps, 3) + long * 0.5 + Math.min(words.length, 16) * 0.15;
  };
  const best = [...parts].sort((a, b) => score(b) - score(a))[0]!;
  return best.split(" ").slice(0, 12).join(" ");
}

function roleQuery(opts: { title: string; stack: string[]; city: string | null }) {
  const role = cleanPost(opts.title)
    .replace(/^.*?—\s*/, "")
    .replace(/\b(freelance|zzp|gezocht|vacature|opdracht|hybride|remote|senior|medior|junior)\b/gi, " ")
    .replace(/[()[\]|/,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");
  const bits = [role, ...opts.stack.slice(0, 3), opts.city || ""].filter(Boolean);
  if (bits.join(" ").length < 12) return null;
  return `${bits.join(" ")} opdracht opdrachtgever`;
}

const NOT_USEFUL_URL = /linkedin\.com\/(posts|feed|in\/)|\/hashtag\//i;

export function hitMentions(hit: SearchHit, name: string) {
  const hay = ` ${fold(`${hit.title} ${hit.description} ${hit.url}`)} `;
  const n = fold(name);
  if (!n) return false;
  if (n.length <= 3) {
    if (hay.includes(` ${n} `)) return true;
    // werkenbijns.nl, careers.ing.com: short names show up in the host.
    try {
      const host = new URL(hit.url).hostname.replace(/^www\./, "").split(".");
      return host.some((part) => part === n || part === `werkenbij${n}` || part === `werkenbij-${n}`);
    } catch {
      return false;
    }
  }
  if (hay.includes(` ${n} `) || hay.includes(n.replace(/ /g, ""))) return true;
  const core = n.split(" ").filter((w) => w.length >= 4 && !/^(gemeente|provincie|bank|groep|group|nederland|holding)$/.test(w));
  return core.length > 0 && core.every((w) => hay.includes(w));
}

function memoryBlock(memory: FeedMemory[]) {
  if (!memory.length) return "(nog geen bevestigde klanten voor dit bureau)";
  return memory
    .map(
      (m, i) =>
        `[G${i + 1}] ${m.client} — ${m.title}${m.sameRecruiter ? " (zelfde recruiter)" : ""}\n${m.summary.slice(0, 220)}`
    )
    .join("\n");
}

function webBlock(hits: SearchHit[]) {
  if (!hits.length) return "(niets gevonden)";
  return hits
    .map((h, i) => `[W${i + 1}] ${h.title}\n${h.url}\n${h.description}`)
    .join("\n\n");
}

const SYSTEM = `Je bent een senior IT-recruiter in Nederland. Je raadt welke eindklant (opdrachtgever) achter een LinkedIn-post van een bureau zit.
Het bureau en andere bemiddelaars/detacheerders zijn NOOIT de eindklant.

Stap 1 — Is dit een echte opdracht/vacature voor een klant? is_assignment=false ALLEEN bij: eigen personeel werven voor het bureau (recruiter, accountmanager, consultant bij het bureau), felicitaties, promotie, event, marktupdate, kandidaat-promotie ("beschikbaar: developer X").
Een korte, vage of afgebroken post die een rol voor een klant zoekt is wél een opdracht (is_assignment=true, client mag null zijn).
Stap 2 — Zo ja: welke organisatie? Gebruik alles:
- letterlijke naam, afkorting, programmanaam, systeemnaam, gebouw, plaats, sector, schaal ("miljoenen klanten"), jargon
- je kennis van de Nederlandse markt (wie zit waar, wie gebruikt welk platform, welke programma's lopen waar)
- [W] zoekresultaten: dezelfde opdracht bij een ander bureau of op de site van de klant noemt vaak de naam
- [G] eerder bevestigde klanten van dit bureau: recruiters werken vaak jaren voor dezelfde paar klanten
Noem alleen een echte organisatienaam, nooit "een grote bank" of "een overheidsorganisatie".
Iets wat bij honderden organisaties past (Azure, Java, "grote organisatie", hybride, een grote stad) is geen aanwijzing — noem het niet.
Als het echt niet te zeggen is: client null — liever eerlijk dan een gok.

confidence: 85+ alleen als de naam in de post, een [W]-resultaat of een [G]-klant staat. Alleen marktkennis: max 65.

Elke aanwijzing ("clue"):
- quote: kort en LETTERLIJK overgenomen uit de post of uit een [W]-resultaat
- source: "post", "W1".."W8", "G1".."G6", of "kennis" (eigen marktkennis, geen bron)
- why: één zin in gewone taal waarom dit naar die klant wijst

Antwoord in het Nederlands, kort. JSON:
{"is_assignment":boolean,"not_assignment_reason":string|null,"client":string|null,"confidence":0-100,"summary":string,"clues":[{"quote":string,"source":string,"why":string}],"alternatives":[{"name":string,"confidence":number,"why_lower":string}],"check":string}
summary = één zin: "X, omdat …". check = wat de recruiter kan navragen/checken om zeker te zijn. Max 4 clues, max 2 alternatives.`;

type RawClue = { quote?: string; source?: string; why?: string };
type RawVerdict = {
  is_assignment?: boolean;
  not_assignment_reason?: string | null;
  client?: string | null;
  confidence?: number;
  summary?: string;
  clues?: RawClue[];
  alternatives?: { name?: string; confidence?: number; why_lower?: string }[];
  check?: string;
};

function isRealName(name: string) {
  if (name.length < 2 || name.length > 70) return false;
  if (/^(onbekend|unknown|null|opdrachtgever|klant|eindklant|organisatie|bedrijf|een |de klant)/i.test(name)) return false;
  if (/\b(grote|large|internationale|nederlandse|organisatie in|bedrijf in)\b/i.test(name)) return false;
  return !isAgencyName(name) && !looksLikeIntermediary(name);
}

/** Naloop van het model: welke aanwijzingen zijn echt, en hoe hoog mag de score dan? */
export function calibrate(opts: {
  raw: RawVerdict;
  post: string;
  hits: SearchHit[];
  memory: FeedMemory[];
}): { name: string; confidence: number; evidence: Evidence[]; basis: string } | null {
  const name = (opts.raw.client || "").trim().replace(/\s+/g, " ");
  if (!isRealName(name)) return null;
  const post = fold(opts.post);
  const nameInPost = fold(name).length >= 3 && post.includes(fold(name));

  let webProof = false;
  let citedWebProof = false;
  let memoryProof = false;
  let postClues = 0;
  const evidence: Evidence[] = [];

  for (const c of (opts.raw.clues || []).slice(0, 4)) {
    const quote = (c.quote || "").trim().slice(0, 200);
    const why = (c.why || "").trim().slice(0, 200);
    if (!why) continue;
    const src = (c.source || "").trim().toUpperCase();
    let origin: EvidenceOrigin = "knowledge";
    let url: string | undefined;
    let weight = 40;

    const w = /^W(\d+)$/.exec(src);
    const g = /^G(\d+)$/.exec(src);
    if (w) {
      const hit = opts.hits[Number(w[1]) - 1];
      if (hit) {
        origin = "web";
        url = hit.url;
        if (hitMentions(hit, name)) {
          webProof = true;
          citedWebProof = true;
          weight = 88;
        } else weight = 55;
      }
    } else if (g) {
      const m = opts.memory[Number(g[1]) - 1];
      if (m) {
        origin = "memory";
        if (fold(m.client) === fold(name)) {
          memoryProof = true;
          weight = 80;
        } else weight = 45;
      }
    } else if (src === "POST" && quote.length >= 4 && post.includes(fold(quote))) {
      origin = "post";
      if (quote.split(/\s+/).length >= 3 && !GENERIC_QUOTE.test(quote)) {
        postClues += 1;
        weight = 65;
      } else weight = 35;
    } else if (/hint|regels|\(\d+%\)/i.test(`${src} ${quote}`)) {
      continue;
    }
    evidence.push({ label: why, quote: quote || undefined, weight, origin, url });
  }

  // The model sometimes forgets to cite a web hit that plainly names its pick.
  if (!webProof) {
    const idx = opts.hits.findIndex((h) => hitMentions(h, name));
    if (idx >= 0) {
      webProof = true;
      const hit = opts.hits[idx]!;
      evidence.push({
        label: `Online staat een vergelijkbare opdracht die ${name} noemt`,
        quote: hit.title.slice(0, 160),
        weight: 80,
        origin: "web",
        url: hit.url,
      });
    }
  }

  const cap = nameInPost
    ? CAP.nameInPost
    : webProof
      ? CAP.web
      : memoryProof
        ? CAP.memory
        : postClues >= 3
          ? CAP.threePostClues
          : postClues === 2
            ? CAP.twoPostClues
            : CAP.knowledge;
  const basis = nameInPost
    ? "naam staat in de post"
    : webProof
      ? "online teruggevonden"
      : memoryProof
        ? "eerder bevestigd bij dit bureau"
        : postClues >= 2
          ? `${postClues} specifieke aanwijzingen uit de post, naam niet nagetrokken`
          : "vooral marktkennis — niet nagetrokken";
  const modelConf = Number(opts.raw.confidence);
  // The model is shy about its own web find; a cited hit that names the client is strong.
  const floor = citedWebProof || nameInPost ? 78 : memoryProof ? 72 : 20;
  const confidence = Math.round(
    Math.min(cap, Math.max(floor, Number.isFinite(modelConf) ? modelConf : 50))
  );
  return { name, confidence, evidence: evidence.sort((a, b) => b.weight - a.weight), basis };
}

export async function identifyFeedClient(opts: {
  title: string;
  text: string;
  agencyName: string;
  recruiterName?: string;
  stack: string[];
  city: string | null;
  memory: FeedMemory[];
  rulesHint?: ClientGuess | null;
}): Promise<FeedVerdict> {
  if (!hasAiKey()) return { kind: "unknown", detail: "ANTHROPIC_API_KEY ontbreekt", model: "" };

  const body = dedupeHalves(opts.text);
  const titleIsLead = fold(body).startsWith(fold(opts.title.replace(/^.*?—\s*/, "")).slice(0, 40));
  const post = cleanPost(titleIsLead ? body : `${opts.title}\n\n${body}`).slice(0, 2400);

  let hits: SearchHit[] = [];
  if (hasWeb()) {
    const budget = makeBudget("standard");
    budget.maxSearches = 2;
    const fp = fingerprintSentence(opts.text);
    const queries = [fp ? `"${fp}"` : null, roleQuery({ title: opts.title, stack: opts.stack, city: opts.city })].filter(
      (q): q is string => Boolean(q)
    );
    hits = (await multiSearch(queries, budget, { perQuery: 5 }))
      .filter((h) => !NOT_USEFUL_URL.test(h.url))
      .slice(0, 8);
  }

  const hint =
    opts.rulesHint && opts.rulesHint.confidence >= HINT_MIN
      ? `Onze catalogus herkent mogelijk ${opts.rulesHint.name} — check dat zelf, geen bewijs op zich.`
      : "";

  const result = await aiJsonCompletion({
    system: SYSTEM,
    user: `Bureau: ${opts.agencyName}${opts.recruiterName ? ` · recruiter ${opts.recruiterName}` : ""}${hint ? `\n${hint}` : ""}

=== POST ===
${post}

=== [G] EERDER BEVESTIGD BIJ DIT BUREAU ===
${memoryBlock(opts.memory)}

=== [W] ZOEKRESULTATEN (zelfde opdracht elders?) ===
${webBlock(hits)}`,
    temperature: 0,
    maxTokens: 700,
  });

  const raw = result.json as RawVerdict | null;
  if (!raw) return { kind: "unknown", detail: result.detail, model: result.model };

  const reason = raw.not_assignment_reason || "";
  if (raw.is_assignment === false && !/afgebroken|onvolledig|incompleet|onvoldoende informatie|te kort/i.test(reason)) {
    return {
      kind: "not-assignment",
      reason: (raw.not_assignment_reason || "Geen opdracht voor een klant").slice(0, 160),
      model: result.model,
    };
  }

  const cal = calibrate({ raw, post, hits, memory: opts.memory });
  if (!cal) {
    return {
      kind: "unknown",
      detail: (raw.summary || "Geen opdrachtgever te herleiden uit de post of online").slice(0, 200),
      check: raw.check?.slice(0, 200),
      model: result.model,
    };
  }

  const alternatives = (raw.alternatives || [])
    .map((a) => ({
      name: (a.name || "").trim(),
      confidence: Math.round(Math.min(cal.confidence - 5, Number(a.confidence) || 0)),
    }))
    .filter((a) => isRealName(a.name) && a.confidence > 0 && fold(a.name) !== fold(cal.name))
    .slice(0, 2);

  return {
    kind: "client",
    model: result.model,
    detail: `${cal.name} · ${cal.confidence}% · ${cal.basis} · ${hits.length} webhits`,
    guess: {
      name: cal.name,
      confidence: cal.confidence,
      evidence: cal.evidence.length
        ? cal.evidence
        : [{ label: raw.summary?.slice(0, 200) || "Herleid uit de post", weight: cal.confidence, origin: "knowledge" }],
      alternatives,
      source: "ai",
      summary: `${(raw.summary || "").trim().slice(0, 220)}${raw.summary ? " " : ""}(${cal.basis})`.trim(),
      check: raw.check?.trim().slice(0, 200) || undefined,
    },
  };
}
