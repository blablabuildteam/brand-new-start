import { AGENCY_WATCHLIST, matchAgency, type Agency } from "@/lib/agency";
import {
  extractVacancyFacts,
  guessEndClient,
  leadStatusFromGuess,
  type ClientGuess,
  type VacancyFacts,
} from "@/lib/end-client";
import { detectRoleLabel } from "@/lib/niche";
import { listSignals, patchSignalRaw } from "@/lib/store";

export type LeadStatus = "suggest" | "review" | "weak" | "confirmed" | "rejected";

export type AgencyLead = {
  id: string;
  demo: boolean;
  employment: "contract";
  title: string;
  roleLabel: string;
  agency: { id: string; name: string };
  recruiter: { name: string | null; title: string | null; url: string | null };
  facts: VacancyFacts;
  guess: ClientGuess | null;
  status: LeadStatus;
  confirmedClient: string | null;
  evidenceUrl: string | null;
  summary: string;
  signalId?: string;
};

type Review = {
  status: "confirmed" | "rejected";
  clientName?: string;
};

const g = globalThis as unknown as { __bnsLeadReviews?: Map<string, Review> };

function reviews() {
  if (!g.__bnsLeadReviews) g.__bnsLeadReviews = new Map();
  return g.__bnsLeadReviews;
}

function applyReview(lead: AgencyLead): AgencyLead {
  const r = reviews().get(lead.id);
  if (!r) return lead;
  return {
    ...lead,
    status: r.status,
    confirmedClient: r.status === "confirmed" ? r.clientName || lead.guess?.name || null : null,
  };
}

function buildLead(opts: {
  id: string;
  demo: boolean;
  title: string;
  text: string;
  agency: Agency;
  recruiter: AgencyLead["recruiter"];
  evidenceUrl?: string | null;
  signalId?: string;
  storedReview?: Review | null;
}): AgencyLead {
  const facts = extractVacancyFacts(`${opts.title}\n${opts.text}`);
  const guess = guessEndClient({ title: opts.title, text: opts.text });
  const auto = leadStatusFromGuess(guess);
  const stored = opts.storedReview;
  return {
    id: opts.id,
    demo: opts.demo,
    employment: "contract",
    title: opts.title,
    roleLabel: detectRoleLabel(`${opts.title} ${opts.text}`),
    agency: { id: opts.agency.id, name: opts.agency.name },
    recruiter: opts.recruiter,
    facts,
    guess,
    status: stored?.status || auto,
    confirmedClient: stored?.status === "confirmed" ? stored.clientName || guess?.name || null : null,
    evidenceUrl: opts.evidenceUrl || null,
    summary: opts.text.replace(/\s+/g, " ").trim().slice(0, 280),
    signalId: opts.signalId,
  };
}

function demoLeads(): AgencyLead[] {
  const vibe = AGENCY_WATCHLIST[0]!;
  const s3 = AGENCY_WATCHLIST[1]!;
  const moove = AGENCY_WATCHLIST[2]!;
  const elev = AGENCY_WATCHLIST[3]!;
  return [
    buildLead({
      id: "demo_vibe_de",
      demo: true,
      agency: vibe,
      recruiter: { name: "Lisa Hendriks", title: "Principal Recruiter", url: null },
      title: "Data Engineer (ZZP)",
      text:
        "Voor een opdrachtgever zoeken we een Data Engineer. Standplaats Amsterdam Zuidas, 36 uur. Start 1 oktober, duur 6 maanden. Stack: Azure Data Factory, Databricks, Python. Het gaat om een grote Nederlandse bank op de Zuidas met een Azure-dataplatform.",
    }),
    buildLead({
      id: "demo_s3_sm",
      demo: true,
      agency: s3,
      recruiter: { name: "Sanne Bakker", title: "Recruiter", url: null },
      title: "Scrum Master SAFe",
      text:
        "Interim Scrum Master voor een agile release train. Opdrachtgever is Gemeente Amsterdam. SAFe, Jira, 32-36 uur, looptijd 4 maanden. Start per direct. Standplaats Amsterdam.",
    }),
    buildLead({
      id: "demo_moove_ba",
      demo: true,
      agency: moove,
      recruiter: { name: "Thomas Kuipers", title: "Managing Partner", url: null },
      title: "Business Analist schade",
      text:
        "Business analist voor processen in schade. Gevestigd in Utrecht bij een schadeverzekeraar. BPMN, Jira, 6 maanden, 36 uur. Start half oktober. Contract / ZZP.",
    }),
    buildLead({
      id: "demo_elev_pe",
      demo: true,
      agency: elev,
      recruiter: { name: "Noor El Idrissi", title: "Recruiter IT", url: null },
      title: "Platform Engineer Kubernetes",
      text:
        "Platform Engineer met Kubernetes en Terraform. Remote NL, 40 uur, duur 3 maanden. Geen eindklant genoemd, alleen ‘grote corporate in de Randstad’. Contract.",
    }),
  ].map(applyReview);
}

function reviewFromRaw(raw: Record<string, unknown> | null | undefined): Review | null {
  const v = raw?.leadReview;
  if (!v || typeof v !== "object") return null;
  const o = v as { status?: string; clientName?: string };
  if (o.status === "confirmed" || o.status === "rejected") {
    return { status: o.status, clientName: typeof o.clientName === "string" ? o.clientName : undefined };
  }
  return null;
}

export async function listAgencyLeads(): Promise<{
  watchlist: { id: string; name: string; recruiters: string[] }[];
  live: AgencyLead[];
  demo: AgencyLead[];
}> {
  const rows = await listSignals(400);
  const live: AgencyLead[] = [];
  for (const s of rows) {
    const agency = matchAgency(s.company?.name);
    if (!agency) continue;
    const raw = (s.raw && typeof s.raw === "object" ? s.raw : {}) as Record<string, unknown>;
    const text = [s.summary, typeof raw.description === "string" ? raw.description : ""].join("\n");
    const poster =
      (typeof raw.jobPosterName === "string" && raw.jobPosterName) ||
      (typeof raw.contactName === "string" && raw.contactName) ||
      null;
    live.push(
      buildLead({
        id: s.id,
        demo: false,
        title: s.title,
        text,
        agency,
        recruiter: {
          name: poster,
          title: typeof raw.jobPosterTitle === "string" ? raw.jobPosterTitle : null,
          url: typeof raw.jobPosterProfileUrl === "string" ? raw.jobPosterProfileUrl : null,
        },
        evidenceUrl: s.evidenceUrl,
        signalId: s.id,
        storedReview: reviewFromRaw(raw),
      })
    );
  }
  live.sort((a, b) => {
    const rank = { review: 0, suggest: 1, weak: 2, confirmed: 3, rejected: 4 };
    return rank[a.status] - rank[b.status];
  });
  return {
    watchlist: AGENCY_WATCHLIST.map((a) => ({
      id: a.id,
      name: a.name,
      recruiters: a.recruiters.map((r) => r.name),
    })),
    live,
    demo: demoLeads(),
  };
}

export async function reviewLead(
  id: string,
  action: "confirmed" | "rejected",
  clientName?: string
): Promise<AgencyLead | null> {
  const data = await listAgencyLeads();
  const lead = [...data.live, ...data.demo].find((l) => l.id === id);
  if (!lead) return null;
  const next: Review = {
    status: action,
    clientName: action === "confirmed" ? clientName || lead.guess?.name : undefined,
  };
  reviews().set(id, next);
  if (lead.signalId) {
    await patchSignalRaw(lead.signalId, {
      leadReview: { ...next, at: new Date().toISOString() },
    });
  }
  return applyReview({
    ...lead,
    status: action,
    confirmedClient: next.clientName || lead.guess?.name || null,
  });
}
