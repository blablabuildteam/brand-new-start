import { eq } from "drizzle-orm";
import type { Company, RadarEntry, Signal } from "@/lib/db/schema";
import { companies, radarEntries, signals } from "@/lib/db/schema";
import { getDb, hasDatabase } from "@/lib/db/client";
import { fingerprintOf, scoreSignals } from "@/lib/score";
import { detectRoleLabel, matchesContract, matchesRole, matchesTender } from "@/lib/niche";
import { orgContextFromSignals } from "@/lib/org-context";
import { buildApproach, companyLinkedinFromSignals } from "@/lib/approach";
import { huntSettings } from "@/lib/hunt";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Dedup-key voor “dezelfde opening” — titel eerst (URL’s verschillen vaak per board). */
export function openingKeyOf(signal: Signal): string {
  const title = signal.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(freelancer\)|\(freelance\)|freelancer|freelance|zzp/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (title.length >= 10) return `title:${title}`;
  const url = (signal.evidenceUrl || "").split("?")[0].trim().toLowerCase();
  if (url.length > 12) return `url:${url}`;
  return `fp:${signal.fingerprint}`;
}

/** Board-placeholders / UI-rommel — geen echte opdrachtgevers. */
export function isPlaceholderCompany(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "freelance.nl" ||
    n === "freelance.nl opdrachtgever" ||
    n.startsWith("freelance.nl ") ||
    n === "via freelance.nl" ||
    n === "indeed" ||
    n === "linkedin"
  );
}

export function isJunkJobTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 8 || t.length > 160) return true;
  return /sorteer|relevantie|filter|cookie|inloggen|registreer|bekijk alle|pagina \d|nieuwste opdrachten|oudste opdrachten|\\\\/.test(
    t
  );
}

type OpeningBundle = {
  key: string;
  primary: Signal;
  signals: Signal[];
  siblingOpenings: number;
};

/**
 * Eén bundle per unieke vacature-opening bij een bedrijf.
 * Company-brede signalen (pulse/tender/…) hangen aan elke opening mee.
 */
export function buildOpeningBundles(companySignals: Signal[]): OpeningBundle[] {
  const usable = companySignals.filter(
    (s) => s.source !== "hm-post" && !isJunkJobTitle(s.title)
  );
  const jobs = usable.filter((s) => s.source === "job-type");
  const shared = usable.filter((s) => s.source !== "job-type");

  if (!jobs.length) {
    if (!usable.length) return [];
    const sorted = [...usable].sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime());
    return [
      {
        key: "company",
        primary: sorted[0]!,
        signals: sorted,
        siblingOpenings: 0,
      },
    ];
  }

  const byKey = new Map<string, Signal[]>();
  for (const j of jobs) {
    const key = openingKeyOf(j);
    const list = byKey.get(key) || [];
    list.push(j);
    byKey.set(key, list);
  }

  const openings = [...byKey.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime());
    return { key, primary: sorted[0]!, jobSignals: sorted };
  });
  openings.sort((a, b) => b.primary.seenAt.getTime() - a.primary.seenAt.getTime());

  const siblingOpenings = Math.max(0, openings.length - 1);

  return openings.map((o) => ({
    key: o.key,
    primary: o.primary,
    signals: [...o.jobSignals, ...shared].sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime()),
    siblingOpenings,
  }));
}

type MemoryDb = {
  companies: Map<string, Company>;
  signals: Map<string, Signal>;
  radar: Map<string, RadarEntry>;
};

const globalForStore = globalThis as unknown as { __bnsStore?: MemoryDb };

function mem(): MemoryDb {
  if (!globalForStore.__bnsStore) {
    globalForStore.__bnsStore = {
      companies: new Map(),
      signals: new Map(),
      radar: new Map(),
    };
  }
  return globalForStore.__bnsStore;
}

function companyIdFor(name: string) {
  return `co_${slugify(name)}`;
}

export type IngestInput = {
  source: string;
  company: string;
  title: string;
  summary: string;
  evidenceUrl?: string | null;
  employmentHint?: string | null;
  sector?: string;
  seenAt?: Date;
  raw?: Record<string, unknown>;
};

/** Infer provenance channel — never silently call live market hits "seed". */
export function resolveChannel(
  input: Pick<IngestInput, "source" | "evidenceUrl" | "raw">,
  existingChannel?: string | null
): string {
  const fromRaw = input.raw?.channel;
  if (typeof fromRaw === "string" && fromRaw) return fromRaw;

  const url = (input.evidenceUrl || "").toLowerCase();
  if (url.includes("linkedin.com/jobs") || url.includes("linkedin.com/jobs/view")) {
    return "linkedin-jobs";
  }
  if (url.includes("indeed.") || url.includes("nl.indeed.")) return "indeed";
  if (url.includes("freelance.nl")) return "freelance-nl";
  if (url.includes("tenderned.nl")) return "tenderned";

  if (existingChannel && existingChannel !== "seed") return existingChannel;

  if (input.source === "tender") return "tenderned";
  if (input.source === "pulse") return "pulse";
  if (input.raw?.market) return "linkedin-jobs";
  if (input.raw?.firecrawl) return "firecrawl-careers";
  if (input.raw?.seed || input.raw?.demo) return "seed";

  if (existingChannel === "seed") return "seed";
  return existingChannel || "seed";
}

function nicheOk(input: IngestInput) {
  const blob = `${input.title} ${input.summary}`;
  const isTender = input.source === "tender";
  const isPulse = input.source === "pulse";

  if (isTender && !matchesTender(blob) && !matchesRole(blob)) {
    return { ok: false as const, reason: "outside-niche" };
  }
  if (!isTender && !isPulse && !matchesRole(blob)) {
    return { ok: false as const, reason: "outside-niche" };
  }

  // Contract/ZZP/interim is verplicht voor market-hits (pulse/tender uitgezonderd)
  if (!isTender && !isPulse && huntSettings().requireContract && !isContractish(input, blob)) {
    return { ok: false as const, reason: "no-contract-zzp" };
  }

  return { ok: true as const, blob };
}

/** Hard gate: alleen contracting / ZZP / interim (niet vaste dienstverband-postings). */
export function isContractish(
  input: Pick<IngestInput, "employmentHint" | "raw">,
  blob: string
): boolean {
  const hint = (input.employmentHint || "").toLowerCase();
  if (/contract|interim|zzp|freelance|tijdelijk|temp/.test(hint)) return true;
  const emp =
    typeof input.raw?.employmentType === "string"
      ? String(input.raw.employmentType)
      : "";
  if (/contract|interim|zzp|freelance|tijdelijk|temp/i.test(emp)) return true;
  return matchesContract(blob);
}

async function ensureCompanyPg(name: string, sector?: string): Promise<Company> {
  const db = getDb();
  const id = companyIdFor(name);
  const existing = await db.query.companies.findFirst({ where: eq(companies.id, id) });
  if (existing) return existing;
  const row: Company = {
    id,
    name,
    slug: slugify(name),
    sector: sector || null,
    createdAt: new Date(),
  };
  await db.insert(companies).values(row).onConflictDoNothing();
  return (await db.query.companies.findFirst({ where: eq(companies.id, id) })) || row;
}

function ensureCompanyMem(store: MemoryDb, name: string, sector?: string): Company {
  const id = companyIdFor(name);
  const existing = store.companies.get(id);
  if (existing) return existing;
  const row: Company = {
    id,
    name,
    slug: slugify(name),
    sector: sector || null,
    createdAt: new Date(),
  };
  store.companies.set(id, row);
  return row;
}

async function recomputeRadarPg(companyId: string) {
  const db = getDb();
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) return;
  const companySignals = await db.query.signals.findMany({
    where: eq(signals.companyId, companyId),
  });
  if (!companySignals.length) return;

  const bundles = buildOpeningBundles(companySignals);
  for (const bundle of bundles) {
    const scored = scoreSignals(bundle.signals, {
      primary: bundle.primary,
      siblingOpenings: bundle.siblingOpenings,
    });
    const id =
      bundle.key === "company"
        ? `rad_${companyId}_${slugify(scored.roleLabel)}`
        : `rad_${companyId}_${bundle.primary.fingerprint}`;
    const row: RadarEntry = {
      id,
      companyId,
      roleLabel: scored.roleLabel,
      status: scored.status,
      kans: scored.kans,
      hiringManager: null,
      angle: scored.angle,
      sources: scored.sources,
      factors: scored.factors,
      updatedAt: new Date(),
    };
    await db
      .insert(radarEntries)
      .values(row)
      .onConflictDoUpdate({
        target: radarEntries.id,
        set: {
          status: row.status,
          kans: row.kans,
          angle: row.angle,
          sources: row.sources,
          factors: row.factors,
          roleLabel: row.roleLabel,
          updatedAt: row.updatedAt,
        },
      });
  }
}

function recomputeRadarMem(store: MemoryDb, companyId: string) {
  const company = store.companies.get(companyId);
  if (!company) return;
  const companySignals = [...store.signals.values()].filter((s) => s.companyId === companyId);
  if (!companySignals.length) return;

  // Drop oude company-bundel rijen voor deze company
  for (const id of [...store.radar.keys()]) {
    if (id.startsWith(`rad_${companyId}_`)) store.radar.delete(id);
  }

  for (const bundle of buildOpeningBundles(companySignals)) {
    const scored = scoreSignals(bundle.signals, {
      primary: bundle.primary,
      siblingOpenings: bundle.siblingOpenings,
    });
    const id =
      bundle.key === "company"
        ? `rad_${companyId}_${slugify(scored.roleLabel)}`
        : `rad_${companyId}_${bundle.primary.fingerprint}`;
    store.radar.set(id, {
      id,
      companyId,
      roleLabel: scored.roleLabel,
      status: scored.status,
      kans: scored.kans,
      hiringManager: null,
      angle: scored.angle,
      sources: scored.sources,
      factors: scored.factors,
      updatedAt: new Date(),
    });
  }
}

export async function ingestSignal(input: IngestInput): Promise<{
  ok: boolean;
  reason?: string;
  signal?: Signal;
  created?: boolean;
}> {
  const gate = nicheOk(input);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const blob = gate.blob;

  if (hasDatabase()) {
    const db = getDb();
    const company = await ensureCompanyPg(input.company, input.sector);
    const seenAt = input.seenAt || new Date();
    const fp = fingerprintOf({
      source: input.source,
      company: input.company,
      title: input.title,
      evidenceUrl: input.evidenceUrl,
    });

    const existing = await db.query.signals.findFirst({
      where: eq(signals.fingerprint, fp),
    });

    if (existing) {
      const prevRaw = (existing.raw && typeof existing.raw === "object" ? existing.raw : {}) as Record<
        string,
        unknown
      >;
      const channel = resolveChannel(
        { ...input, evidenceUrl: input.evidenceUrl ?? existing.evidenceUrl },
        typeof prevRaw.channel === "string" ? prevRaw.channel : null
      );
      const updated: Signal = {
        ...existing,
        seenAt,
        summary: input.summary,
        evidenceUrl: input.evidenceUrl ?? existing.evidenceUrl,
        employmentHint: input.employmentHint ?? existing.employmentHint,
        raw: { ...prevRaw, ...(input.raw || {}), channel },
      };
      await db
        .update(signals)
        .set({
          seenAt: updated.seenAt,
          summary: updated.summary,
          evidenceUrl: updated.evidenceUrl,
          employmentHint: updated.employmentHint,
          raw: updated.raw,
        })
        .where(eq(signals.id, existing.id));
      await recomputeRadarPg(company.id);
      return { ok: true, signal: updated, created: false };
    }

    const employment = input.employmentHint || (matchesContract(blob) ? "contract" : "unknown");
    const channel = resolveChannel(input, null);
    const signal: Signal = {
      id: `sig_${fp}`,
      companyId: company.id,
      source: input.source,
      title: input.title,
      roleLabel: detectRoleLabel(blob),
      summary: input.summary,
      evidenceUrl: input.evidenceUrl || null,
      employmentHint: employment,
      raw: { ...(input.raw || {}), channel },
      seenAt,
      firstSeenAt: seenAt,
      fingerprint: fp,
    };
    await db.insert(signals).values(signal);
    await recomputeRadarPg(company.id);
    return { ok: true, signal, created: true };
  }

  const store = mem();
  const company = ensureCompanyMem(store, input.company, input.sector);
  const seenAt = input.seenAt || new Date();
  const fp = fingerprintOf({
    source: input.source,
    company: input.company,
    title: input.title,
    evidenceUrl: input.evidenceUrl,
  });

  const existing = [...store.signals.values()].find((s) => s.fingerprint === fp);
  if (existing) {
    const prevRaw = (existing.raw && typeof existing.raw === "object" ? existing.raw : {}) as Record<
      string,
      unknown
    >;
    const channel = resolveChannel(
      { ...input, evidenceUrl: input.evidenceUrl ?? existing.evidenceUrl },
      typeof prevRaw.channel === "string" ? prevRaw.channel : null
    );
    const updated: Signal = {
      ...existing,
      seenAt,
      summary: input.summary,
      evidenceUrl: input.evidenceUrl ?? existing.evidenceUrl,
      employmentHint: input.employmentHint ?? existing.employmentHint,
      raw: { ...prevRaw, ...(input.raw || {}), channel },
    };
    store.signals.set(existing.id, updated);
    recomputeRadarMem(store, company.id);
    return { ok: true, signal: updated, created: false };
  }

  const employment = input.employmentHint || (matchesContract(blob) ? "contract" : "unknown");
  const channel = resolveChannel(input, null);
  const signal: Signal = {
    id: `sig_${fp}`,
    companyId: company.id,
    source: input.source,
    title: input.title,
    roleLabel: detectRoleLabel(blob),
    summary: input.summary,
    evidenceUrl: input.evidenceUrl || null,
    employmentHint: employment,
    raw: { ...(input.raw || {}), channel },
    seenAt,
    firstSeenAt: seenAt,
    fingerprint: fp,
  };
  store.signals.set(signal.id, signal);
  recomputeRadarMem(store, company.id);
  return { ok: true, signal, created: true };
}

/**
 * Bouw radar uit signalen + score in-memory.
 * Eén rij per bedrijf; openingen (met eigen score) als nested array.
 */
export async function listRadar() {
  function buildCompanyRows(
    byCompany: Map<string, Signal[]>,
    coMap: Map<string, Company>
  ) {
    const rows = [];
    for (const [companyId, companySignals] of byCompany) {
      const company = coMap.get(companyId);
      if (!company || !companySignals.length) continue;
      if (isPlaceholderCompany(company.name)) continue;

      const bundles = buildOpeningBundles(companySignals);
      if (!bundles.length) continue;

      const openings = bundles.map((bundle) => {
        const scored = scoreSignals(bundle.signals, {
          primary: bundle.primary,
          siblingOpenings: bundle.siblingOpenings,
        });
        const org = orgContextFromSignals(bundle.signals);
        const approach = buildApproach({
          company: company.name,
          roleLabel: scored.roleLabel,
          openingTitle: bundle.primary.title,
          org,
          companyLinkedinUrl: companyLinkedinFromSignals(bundle.signals),
        });
        const id =
          bundle.key === "company"
            ? `rad_${companyId}_${slugify(scored.roleLabel)}`
            : `rad_${companyId}_${bundle.primary.fingerprint}`;
        return {
          id,
          roleLabel: scored.roleLabel,
          openingTitle: bundle.primary.title,
          status: scored.status,
          kans: scored.kans,
          angle: scored.angle,
          sources: scored.sources,
          factors: scored.factors,
          signals: bundle.signals,
          org,
          approach,
          hiringManager: org.hiringManager,
          updatedAt: bundle.signals[0]?.seenAt || new Date(),
        };
      });
      openings.sort((a, b) => b.kans - a.kans);

      const best = openings[0]!;
      const roleLabels = [...new Set(openings.map((o) => o.roleLabel))];
      rows.push({
        id: `rad_${companyId}`,
        companyId,
        roleLabel:
          openings.length === 1
            ? best.roleLabel
            : roleLabels.length <= 2
              ? roleLabels.join(" · ")
              : `${openings.length} rollen`,
        openingTitle:
          openings.length === 1
            ? best.openingTitle
            : openings.map((o) => o.openingTitle).join(" · "),
        openingsAtCompany: openings.length,
        openings,
        status: best.status,
        kans: best.kans,
        hiringManager: null as string | null,
        angle:
          openings.length === 1
            ? best.angle
            : `${openings.length} contract-mogelijkheden bij dit bedrijf — score per opening.`,
        sources: [...new Set(openings.flatMap((o) => o.sources))],
        factors: best.factors,
        updatedAt: openings.reduce(
          (max, o) => (o.updatedAt > max ? o.updatedAt : max),
          openings[0]!.updatedAt
        ),
        company,
        signals: openings.flatMap((o) => o.signals),
      });
    }
    return rows.sort(
      (a, b) => b.kans - a.kans || a.company.name.localeCompare(b.company.name, "nl")
    );
  }

  if (hasDatabase()) {
    const db = getDb();
    const [allSignals, cos] = await Promise.all([
      db.query.signals.findMany(),
      db.query.companies.findMany(),
    ]);
    const coMap = new Map(cos.map((c) => [c.id, c]));
    const byCompany = new Map<string, typeof allSignals>();
    for (const s of allSignals) {
      if (s.source === "hm-post") continue;
      const list = byCompany.get(s.companyId) || [];
      list.push(s);
      byCompany.set(s.companyId, list);
    }
    return buildCompanyRows(byCompany, coMap);
  }

  const store = mem();
  for (const companyId of new Set([...store.signals.values()].map((s) => s.companyId))) {
    recomputeRadarMem(store, companyId);
  }
  const coMap = store.companies;
  const byCompany = new Map<string, Signal[]>();
  for (const s of store.signals.values()) {
    if (s.source === "hm-post") continue;
    const list = byCompany.get(s.companyId) || [];
    list.push(s);
    byCompany.set(s.companyId, list);
  }
  return buildCompanyRows(byCompany, coMap);
}

export async function getRadarDetail(id: string) {
  const rows = await listRadar();
  return rows.find((r) => r.id === id) || null;
}

export async function listSignals(limit = 40) {
  if (hasDatabase()) {
    const db = getDb();
    const rows = await db.query.signals.findMany();
    const cos = await db.query.companies.findMany();
    const coMap = new Map(cos.map((c) => [c.id, c]));
    return rows
      .filter((s) => s.source !== "hm-post")
      .sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s, company: coMap.get(s.companyId)! }));
  }

  const store = mem();
  return [...store.signals.values()]
    .filter((s) => s.source !== "hm-post")
    .sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime())
    .slice(0, limit)
    .map((s) => ({
      ...s,
      company: store.companies.get(s.companyId)!,
    }));
}

export async function stats(radarRows?: Awaited<ReturnType<typeof listRadar>>) {
  const radar = radarRows ?? (await listRadar());
  let signalCount = 0;
  if (hasDatabase()) {
    const db = getDb();
    const rows = await db.query.signals.findMany({
      columns: { id: true, source: true },
    });
    signalCount = rows.filter((s) => s.source !== "hm-post").length;
  } else {
    signalCount = [...mem().signals.values()].filter((s) => s.source !== "hm-post").length;
  }
  return {
    companies: radar.length,
    openings: radar.reduce((a, r) => a + (r.openingsAtCompany || r.openings?.length || 1), 0),
    hot: radar.filter((r) => r.status === "hot").length,
    warm: radar.filter((r) => r.status === "warm").length,
    signals: signalCount,
    niche: "Markt · contracting-ruimte volgens Instellingen",
    persistence: hasDatabase() ? "postgres" : "memory",
  };
}

export async function resetStore() {
  if (hasDatabase()) {
    const db = getDb();
    await db.delete(radarEntries);
    await db.delete(signals);
    await db.delete(companies);
    return stats();
  }
  globalForStore.__bnsStore = {
    companies: new Map(),
    signals: new Map(),
    radar: new Map(),
  };
  return stats();
}
