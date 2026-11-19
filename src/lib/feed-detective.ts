import { aiJsonCompletion, aiWebResearch, hasAiKey } from "@/lib/ai-client";
import { isAgencyName, looksLikeIntermediary } from "@/lib/agency";
import type { ClientContact, ClientGuess, Evidence, EvidenceOrigin } from "@/lib/end-client";
import { hasWeb, makeBudget, multiSearch, tierFor } from "@/lib/research/web";
import type { SearchHit } from "@/lib/research/types";

export { plainLinkedIn } from "@/lib/plain-text";

/**
 * Recruiter-feed speurder: wie is de opdrachtgever achter een anonieme post?
 *
 * Werkt zoals een goede recruiter met ChatGPT: lees de post, gebruik
 * marktkennis, zoek de opdracht één keer terug op internet (andere bureaus
 * plaatsen dezelfde opdracht vaak mét naam) en leg per aanwijzing uit waarom.
 * Eén Claude-call, maximaal drie zoekopdrachten, plus één controle-zoek als
 * de uitkomst in de twijfelzone valt.
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
  /** confirmed = door jou bevestigd; web = AI-vondst die online bewezen is. */
  proof: "confirmed" | "web";
};

/** Own vacancy sites per bureau/brand: they often carry the client or a client code. */
const AGENCY_SITES: Record<string, string> = {
  sthree: "computerfutures.com",
  "computer futures": "computerfutures.com",
  "vibe group": "vibegroup.com",
  spilberg: "spilberg.com",
  tergos: "tergos.com",
  eswelt: "eswelt.com",
  "visser & van baars": "visservanbaars.com",
  "the next moove": "thenextmoove.nl",
  "elevation partners": "elevationpartners.nl",
};

export function agencySites(names: (string | null | undefined)[]) {
  const out = new Set<string>();
  for (const n of names) {
    const site = n ? AGENCY_SITES[n.toLowerCase().trim()] : undefined;
    if (site) out.add(site);
  }
  return [...out];
}

export type FeedVerdict =
  | { kind: "client"; guess: ClientGuess; model: string; detail: string }
  | { kind: "not-assignment"; reason: string; model: string }
  | { kind: "unknown"; detail: string; model: string; check?: string };

const CAP = {
  nameInPost: 96,
  web: 92,
  memory: 88,
  // Below "Sterk voorstel" (80): one recruiter often serves several clients.
  memoryWeb: 78,
  threePostClues: 74,
  twoPostClues: 68,
  knowledge: 60,
} as const;

/** Rules hints below this only anchor the model on a weak guess. */
const HINT_MIN = 70;

/** Quotes that fit hundreds of organisations prove nothing. */
const GENERIC_QUOTE =
  /^(?:(?:grote|large|groot|internationale?|nederlandse|dutch|hybride|hybrid|remote|enterprise|enterpriseomgeving|organisatie|organization|azure|aws|gcp|cloud|java|\.net|c#|python|kubernetes|scrum|agile|devops|amsterdam|rotterdam|utrecht|den haag|eindhoven|freelance|zzp|en|of|and|or|\/|,|-)\s*)+$/i;

/** Shorten at a word boundary so the desk never shows "dit profiel ex". */
export function clip(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

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

const ROLE_TERMS =
  /\b(sre|site reliability|scrum master|agile coach|product owner|business analy[sz]?[te]|informatie analist|functioneel beheerder|test(?:er| engineer| coördinator| coordinator)|pmo|project ?manager|programma ?manager|change manager|tech lead|architect|data (?:engineer|scientist|analist|analyst)|ai (?:engineer|specialist)|platform engineer|cloud (?:platform )?engineer|devops engineer|linux engineer|embedded (?:software )?engineer|security (?:engineer|officer)|iam engineer|(?:full[- ]?stack|front[- ]?end|back[- ]?end|java|\.net|c#|python|node\.js|react|typescript|outsystems|mobile|software) (?:developer|engineer)|elk stack engineer|observability|infra(?:structure|structuur)? (?:engineer|specialist|beheerder|architect)|system(?:s)? engineer|systeembeheerder|netwerk ?(?:engineer|beheerder)|network engineer|werkplek ?(?:engineer|specialist|beheerder)|citrix (?:engineer|specialist)|database (?:administrator|beheerder)|dba|consultant)\b/gi;

function roleCore(title: string) {
  const clean = cleanPost(title);
  const terms = [...new Set((clean.match(ROLE_TERMS) || []).map((t) => t.toLowerCase()))];
  if (terms.length) return terms.slice(0, 2).join(" ");
  return clean
    .replace(/^.*?—\s*/, "")
    .replace(/\b(freelance|zzp|gezocht|vacature|opdracht|hybride|remote|senior|medior|junior|interim|spoed|urgent|asap|regio|omgeving)\b/gi, " ")
    .replace(/[()[\]|/,!:*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

function roleQuery(opts: { title: string; stack: string[]; city: string | null }) {
  const bits = [roleCore(opts.title), ...opts.stack.slice(0, 3), opts.city || ""].filter(Boolean);
  if (bits.join(" ").length < 12) return null;
  return `${bits.join(" ")} opdracht opdrachtgever`;
}

/** Bureau-posts zijn vaak overgenomen van de werken-bij-pagina van de klant zelf. */
function originalVacancyQuery(opts: { title: string; stack: string[]; city: string | null }) {
  const role = roleCore(opts.title);
  if (role.length < 4) return null;
  const bits = [`"${role}"`, ...opts.stack.slice(0, 4), opts.city || ""].filter(Boolean);
  return `${bits.join(" ")} vacature werken bij`;
}

const GENERIC_ROLE_WORD =
  /^(engineer|developer|consultant|specialist|medewerker|expert|lead|gezocht|voor|een|and|the|netwerk|goedemiddag)$/;

/**
 * Same assignment, not just any page naming the client: the role must match
 * in the vacancy TITLE (not partner names buried in the body), and place/stack.
 * Prevents "Product Owner" → gebiedsontwikkeling-page that only mentions the org as partner.
 */
export function sameRole(hit: SearchHit, title: string, stack: string[], city: string | null) {
  const titleHay = ` ${fold(hit.title)} `;
  const words = fold(roleCore(title))
    .split(" ")
    .filter((w) => w.length >= 3 && !GENERIC_ROLE_WORD.test(w));
  if (!words.length) return false;
  // Alle rolwoorden moeten in de titel van de hit staan — niet alleen ergens in de body.
  if (!words.every((w) => titleHay.includes(` ${w} `))) return false;
  const hay = fold(`${hit.title} ${hit.description} ${hit.url}`);
  const cityHit = Boolean(city) && fold(city!).length >= 3 && hay.includes(fold(city!));
  const stackHit = stack.slice(0, 5).some((s) => fold(s).length >= 3 && hay.includes(fold(s)));
  // Titel-rol alleen is genoeg bij ≥2 woorden (bv. "product owner"); anders plaats of stack erbij.
  return words.length >= 2 || cityHit || stackHit;
}

const NOT_USEFUL_URL = /linkedin\.com\/(posts|feed|in\/)|\/hashtag\/|\/bitstream\/|repository\.|\.pdf(\?|$)/i;

const LISTING_HOST =
  /(indeed\.|glassdoor\.|jooble\.|nationalevacaturebank\.|werkzoeken\.|jobbird\.|monsterboard\.|careerjet\.|talent\.com|jobrapido\.|adzuna\.|whatjobs\.|jobleads\.|neuvoo\.|joblift\.)/i;
const LISTING_TITLE = /\b(vacatures?|jobs?|banen|opdrachten)\s+(in|voor|bij)\b|\b\d[\d.,]*\+?\s+(vacatures|jobs|banen|opdrachten)\b/i;

/**
 * Search-result and aggregator pages list dozens of employers at once; the
 * client's name on one proves nothing about this assignment.
 */
export function isListingPage(hit: SearchHit) {
  return LISTING_HOST.test(hit.url) || LISTING_TITLE.test(hit.title) || /[?&](q|query|keywords?)=/i.test(hit.url);
}

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

/**
 * Hard proof that this page is *about* the client as employer — not a partner
 * named in body copy. Title or careers-host only (description is too noisy).
 */
export function hitNamesClient(hit: SearchHit, name: string) {
  const n = fold(name);
  if (!n) return false;
  const titleHay = ` ${fold(hit.title)} `;
  const core = n
    .split(" ")
    .filter((w) => w.length >= 4 && !/^(gemeente|provincie|bank|groep|group|nederland|holding)$/.test(w));
  if (n.length <= 3) {
    if (titleHay.includes(` ${n} `)) return true;
  } else {
    if (titleHay.includes(` ${n} `) || titleHay.includes(n.replace(/ /g, ""))) return true;
    if (core.length > 0 && core.every((w) => titleHay.includes(w))) return true;
  }
  try {
    const host = new URL(hit.url).hostname.replace(/^www\./, "");
    const hostFold = fold(host.replace(/[.-]/g, " "));
    if (n.length <= 3) {
      return host.split(".").some((part) => {
        const p = fold(part);
        return p === n || p === `werkenbij${n}` || p.endsWith(n);
      });
    }
    if (hostFold.includes(n.replace(/ /g, ""))) return true;
    return core.length > 0 && core.every((w) => hostFold.includes(w));
  } catch {
    return false;
  }
}

function memoryBlock(memory: FeedMemory[]) {
  if (!memory.length) return "(nog geen bekende klanten voor dit bureau)";
  return memory
    .map(
      (m, i) =>
        `[G${i + 1}] ${m.client} — ${m.title}${m.sameRecruiter ? " (zelfde recruiter)" : ""} · ${
          m.proof === "confirmed" ? "bevestigd door de desk" : "online bewezen door eerdere zoektocht"
        }\n${m.summary.slice(0, 220)}`
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
- [G] bekende klanten van dit bureau: recruiters werken vaak jaren voor dezelfde paar klanten. Zelfde recruiter + zelfde soort rol/platform/plaats als een [G]-post is een sterke aanwijzing.
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

const WEB_SYSTEM = `${SYSTEM}

Je hebt nu een web_search-tool. Werk zoals een goede recruiter met ChatGPT:
1. Zoek de ORIGINELE vacature. Anonieme bureau-posts zijn vaak bijna letterlijk overgenomen van de werken-bij/careers-pagina van de klant. Zoek op de functietitel + de zeldzaamste combinatie van eisen uit de post (bv. "Citrix" + "ADFS" + "VMware" + "SQL Server") + regio of plaats. Laat bureaunamen weg. Probeer ook de Engelse/Nederlandse variant van de titel.
2. Staat er bij een echte werkgever een vacature met (bijna) dezelfde titel, eisen, uren en regio? Dan is dat de eindklant. Een vacaturesite of ander bureau dat de klant noemt telt ook.
3. Lees die vacature: staat er een contactpersoon, "je rapporteert aan", teamleider of hiring manager? Zet die in contacts. Zoek als het past nog één keer naar de afdelingsmanager (bv. "Manager IT Infrastructure <klant>").
Zonder resultaat: client null. Verzin geen namen.

Bij clues mag source ook de exacte URL zijn van het zoekresultaat waar het citaat uit komt.
Extra JSON-veld: "contacts":[{"name":string,"title":string|null,"url":string|null,"why":string}] — alleen echte personen die je in een bron zag, max 3. why = waar je die persoon zag ("genoemd in de vacature", "LinkedIn: Department Manager IT Infrastructure").`;

type RawContact = { name?: string; title?: string | null; url?: string | null; why?: string };

/** Claude cites search results by URL; calibrate() expects W-numbers. */
function citeByUrl(raw: RawVerdict, hits: SearchHit[]) {
  const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
  for (const c of raw.clues || []) {
    const src = (c.source || "").trim();
    if (!/^https?:\/\//i.test(src)) continue;
    const i = hits.findIndex((h) => norm(h.url) === norm(src));
    c.source = i >= 0 ? `W${i + 1}` : "kennis";
  }
}

function cleanContacts(list: RawContact[] | undefined, hits: SearchHit[], client?: string): ClientContact[] {
  const known = new Set(hits.map((h) => h.url));
  return (list || [])
    .map((c) => ({
      name: (c.name || "").replace(/\s+/g, " ").trim(),
      title: c.title ? clip(c.title, 90) : undefined,
      url: c.url && known.has(c.url) ? c.url : undefined,
      why: clip(c.why || "", 160),
    }))
    .filter(
      (c) =>
        /^[\p{L}'.-]+(?: [\p{L}'.-]+){1,4}$/u.test(c.name) &&
        c.name.length <= 60 &&
        !isAgencyName(c.name) &&
        (!client || fold(c.name) !== fold(client))
    )
    .slice(0, 3);
}

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
  /** When set, a web hit only proves the client if it is about the same kind of job. */
  role?: { title: string; stack: string[]; city: string | null };
}): { name: string; confidence: number; evidence: Evidence[]; basis: string; webProof: boolean } | null {
  const name = (opts.raw.client || "").trim().replace(/\s+/g, " ");
  if (!isRealName(name)) return null;
  const post = fold(opts.post);
  const nameInPost = fold(name).length >= 3 && post.includes(fold(name));

  // Hard web proof = client in title/host (not partner-in-body) + same role in title.
  const proves = (hit: SearchHit) =>
    !NOT_USEFUL_URL.test(hit.url) &&
    !isListingPage(hit) &&
    hitNamesClient(hit, name) &&
    (!opts.role || sameRole(hit, opts.role.title, opts.role.stack, opts.role.city));
  let webProof = false;
  let citedWebProof = false;
  let memoryProof = false;
  let memoryConfirmed = false;
  let postClues = 0;
  const evidence: Evidence[] = [];

  for (const c of (opts.raw.clues || []).slice(0, 4)) {
    const quote = clip(c.quote || "", 200);
    const why = clip(c.why || "", 200);
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
        if (proves(hit)) {
          webProof = true;
          citedWebProof = true;
          weight = 88;
        } else weight = 55;
      }
    } else if (g) {
      const m = opts.memory[Number(g[1]) - 1];
      if (m) {
        origin = m.proof === "confirmed" ? "memory" : "history";
        // An unconfirmed AI find only counts as proof for the same recruiter.
        if (fold(m.client) === fold(name) && (m.proof === "confirmed" || m.sameRecruiter)) {
          memoryProof = true;
          if (m.proof === "confirmed") memoryConfirmed = true;
          weight = m.proof === "confirmed" ? 80 : 72;
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
    const idx = opts.hits.findIndex(proves);
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
        ? memoryConfirmed
          ? CAP.memory
          : CAP.memoryWeb
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
        ? memoryConfirmed
          ? "eerder bevestigd bij dit bureau"
          : "zelfde recruiter werkt al aantoonbaar voor deze klant"
        : postClues >= 2
          ? `${postClues} specifieke aanwijzingen uit de post, naam niet nagetrokken`
          : "vooral marktkennis — niet nagetrokken";
  const modelConf = Number(opts.raw.confidence);
  // The model is shy about its own web find; a cited hit that names the client is strong.
  const floor = citedWebProof || nameInPost ? 78 : memoryProof ? 72 : 20;
  const confidence = Math.round(
    Math.min(cap, Math.max(floor, Number.isFinite(modelConf) ? modelConf : 50))
  );
  return { name, confidence, evidence: evidence.sort((a, b) => b.weight - a.weight), basis, webProof };
}

export async function identifyFeedClient(opts: {
  title: string;
  text: string;
  agencyName: string;
  recruiterName?: string;
  /** Niche brand the recruiter works under (Computer Futures, Spilberg, …). */
  brand?: string | null;
  stack: string[];
  city: string | null;
  memory: FeedMemory[];
  rulesHint?: ClientGuess | null;
  /** Claude mag zelf zoeken als de eerste ronde niets bewijst (standaard aan). */
  webSearch?: boolean;
  webSearchMax?: number;
}): Promise<FeedVerdict> {
  if (!hasAiKey()) return { kind: "unknown", detail: "ANTHROPIC_API_KEY ontbreekt", model: "" };

  const body = dedupeHalves(opts.text);
  const titleIsLead = fold(body).startsWith(fold(opts.title.replace(/^.*?—\s*/, "")).slice(0, 40));
  const post = cleanPost(titleIsLead ? body : `${opts.title}\n\n${body}`).slice(0, 2400);

  let hits: SearchHit[] = [];
  if (hasWeb()) {
    const budget = makeBudget("standard");
    budget.maxSearches = 3;
    const fp = fingerprintSentence(opts.text);
    const site = agencySites([opts.brand, opts.agencyName])[0];
    const role = roleCore(opts.title);
    const queries = [
      fp ? `"${fp}"` : null,
      roleQuery({ title: opts.title, stack: opts.stack, city: opts.city }),
      site && role.length >= 4
        ? `site:${site} ${role} ${opts.city || opts.stack[0] || ""}`.trim()
        : originalVacancyQuery({ title: opts.title, stack: opts.stack, city: opts.city }),
    ].filter((q): q is string => Boolean(q));
    hits = (await multiSearch(queries, budget, { perQuery: 5 }))
      .filter((h) => !NOT_USEFUL_URL.test(h.url))
      .slice(0, 8);
  }

  const hint =
    opts.rulesHint && opts.rulesHint.confidence >= HINT_MIN
      ? `Onze catalogus herkent mogelijk ${opts.rulesHint.name} — check dat zelf, geen bewijs op zich.`
      : "";

  const user = `Bureau: ${opts.agencyName}${opts.recruiterName ? ` · recruiter ${opts.recruiterName}` : ""}${hint ? `\n${hint}` : ""}

=== POST ===
${post}

=== [G] EERDER BEVESTIGD BIJ DIT BUREAU ===
${memoryBlock(opts.memory)}

=== [W] ZOEKRESULTATEN (zelfde opdracht elders?) ===
${webBlock(hits)}`;
  const roleInfo = { title: opts.title, stack: opts.stack, city: opts.city ?? null };

  const result = await aiJsonCompletion({ system: SYSTEM, user, temperature: 0, maxTokens: 700 });
  let raw = result.json as RawVerdict | null;
  let model = result.model;
  let route = `${hits.length} webhits`;
  let contacts: ClientContact[] = [];

  const notAssignment = (r: RawVerdict | null) =>
    r?.is_assignment === false &&
    !/afgebroken|onvolledig|incompleet|onvoldoende informatie|te kort/i.test(r.not_assignment_reason || "");

  if (raw && notAssignment(raw)) {
    return {
      kind: "not-assignment",
      reason: clip(raw.not_assignment_reason || "Geen opdracht voor een klant", 160),
      model,
    };
  }

  let calibrated = raw ? calibrate({ raw, post, hits, memory: opts.memory, role: roleInfo }) : null;

  // Niet bewezen? Laat Claude zelf doorzoeken, zoals ChatGPT: originele vacature, dan de manager.
  if (opts.webSearch !== false && !(calibrated && (calibrated.webProof || calibrated.confidence >= 85))) {
    const cal = calibrated;
    const web = await aiWebResearch({
      system: WEB_SYSTEM,
      user,
      maxSearches: opts.webSearchMax ?? 5,
      maxTokens: 1000,
      effort: "medium",
    });
    const webRaw = web.json as (RawVerdict & { contacts?: RawContact[] }) | null;
    if (webRaw && !notAssignment(webRaw)) {
      const allHits = [
        ...hits,
        ...web.sources
          .filter((s) => !hits.some((h) => h.url === s.url))
          .map((s) => ({ title: s.title, url: s.url, description: "", tier: tierFor(s.url) })),
      ];
      citeByUrl(webRaw, allHits);
      const second = calibrate({ raw: webRaw, post, hits: allHits, memory: opts.memory, role: roleInfo });
      const better =
        second &&
        (!cal ||
          (second.webProof && !cal.webProof) ||
          (fold(second.name) === fold(cal.name) ? second.confidence >= cal.confidence : second.confidence > cal.confidence + 5));
      if (better || (!raw && !second)) {
        raw = webRaw;
        calibrated = second;
        hits = allHits;
        model = web.model;
        contacts = cleanContacts(webRaw.contacts, allHits, second?.name);
      }
      route = `Claude zocht zelf ${web.searches.length}× · ${hits.length} bronnen${
        /fout/.test(web.detail) ? ` · ${web.detail}` : ""
      }`;
    } else if (!webRaw) {
      route = `${route} · zelf zoeken mislukt: ${web.detail}`;
    } else if (!raw && webRaw) {
      return {
        kind: "not-assignment",
        reason: clip(webRaw.not_assignment_reason || "Geen opdracht voor een klant", 160),
        model: web.model,
      };
    }
  }

  if (!raw) return { kind: "unknown", detail: result.detail, model };
  const verdict = raw;
  if (!calibrated) {
    return {
      kind: "unknown",
      detail: `${clip(verdict.summary || "Geen opdrachtgever te herleiden uit de post of online", 240)} (${route})`,
      check: verdict.check ? clip(verdict.check, 220) : undefined,
      model,
    };
  }
  const cal = calibrated;

  // Twijfelzone: één gerichte zoek naar "kandidaat + rol". Noemt een hit die
  // klant bij hetzelfde soort rol, dan is het nagetrokken; anders blijft het staan.
  if (!cal.webProof && cal.confidence >= 55 && cal.confidence < 85 && hasWeb()) {
    const budget = makeBudget("standard");
    budget.maxSearches = 1;
    const q = `"${cal.name}" ${roleCore(opts.title)} ${opts.city || ""} freelance opdracht`.replace(/\s+/g, " ").trim();
    const check = (await multiSearch([q], budget, { perQuery: 6 })).filter(
      (h) => !NOT_USEFUL_URL.test(h.url) && !isListingPage(h)
    );
    const hit = check.find(
      (h) => hitNamesClient(h, cal.name) && sameRole(h, opts.title, opts.stack, opts.city)
    );
    if (hit) {
      cal.confidence = Math.min(CAP.web, Math.max(cal.confidence + 12, 85));
      cal.basis = "nagetrokken: dezelfde soort opdracht staat online bij deze klant";
      cal.webProof = true;
      cal.evidence.unshift({
        label: `Controle-zoek: ${cal.name} heeft online dezelfde soort opdracht uitstaan`,
        quote: hit.title.slice(0, 160),
        weight: 85,
        origin: "web",
        url: hit.url,
      });
    } else {
      cal.basis = `${cal.basis}; controle-zoek vond geen bevestiging`;
    }
  }

  const alternatives = (verdict.alternatives || [])
    .map((a) => ({
      name: (a.name || "").trim(),
      confidence: Math.round(Math.min(cal.confidence - 5, Number(a.confidence) || 0)),
    }))
    .filter((a) => isRealName(a.name) && a.confidence > 0 && fold(a.name) !== fold(cal.name))
    .slice(0, 2);

  return {
    kind: "client",
    model,
    detail: `${cal.name} · ${cal.confidence}% · ${cal.basis} · ${route}`,
    guess: {
      name: cal.name,
      confidence: cal.confidence,
      evidence: cal.evidence.length
        ? cal.evidence
        : [{ label: verdict.summary ? clip(verdict.summary, 200) : "Herleid uit de post", weight: cal.confidence, origin: "knowledge" }],
      alternatives,
      source: "ai",
      summary: `${clip(verdict.summary || "", 320)}${verdict.summary ? " " : ""}(${cal.basis})`.trim(),
      check: verdict.check?.trim() ? clip(verdict.check, 220) : undefined,
      contacts: contacts.length ? contacts : undefined,
    },
  };
}
