/** End-client Intelligence — shared types. */

export type ResearchDepth = "quick" | "standard" | "deep";

/** Live step from the research agent — streamed to the desk while a run is open. */
export type ResearchProgress = {
  step: string;
  label: string;
  detail?: string;
  pct: number;
  etaSec: number;
};

/** Source reliability tiers (1 = official, 4 = unverified chatter). */
export type SourceTier = 1 | 2 | 3 | 4;

export type ResearchSource = {
  title: string;
  url?: string;
  snippet?: string;
  tier?: SourceTier;
  /** Set when the page body was fetched, not just the SERP snippet. */
  scraped?: boolean;
  /** Our own earlier vacancy/signal instead of the open web. */
  internal?: boolean;
};

export type EvidenceStrength = "high" | "medium" | "low";

export type CandidateEvidence = {
  claim: string;
  strength: EvidenceStrength;
  source?: string;
  /** Which scoring rule this maps to, when the model tagged it. */
  factor?: ScoreFactorId;
};

export type ScoreFactorId =
  | "stack_match"
  | "cloud_match"
  | "city_match"
  | "sector_match"
  | "recruiter_history"
  | "project_match"
  | "timeline_match"
  | "hybrid_match"
  | "multi_hire"
  | "modernization"
  | "explicit_name"
  | "cloud_mismatch"
  | "city_mismatch"
  | "sector_mismatch"
  | "stack_mismatch"
  | "timeline_conflict"
  | "office_mismatch"
  | "no_public_trace";

export type ScoreLine = {
  factor: ScoreFactorId;
  label: string;
  points: number;
  note?: string;
};

export type ResearchCandidate = {
  name: string;
  confidence: number;
  why: string;
  whyLower?: string;
  evidence: CandidateEvidence[];
  counterEvidence: string[];
  /** Deterministic breakdown so the number is auditable. */
  score?: {
    raw: number;
    lines: ScoreLine[];
  };
  /** Model's own estimate before deterministic normalisation. */
  modelConfidence?: number;
};

export type ResearchReport = {
  method: "rules" | "ai" | "deep";
  depth?: ResearchDepth;
  confidenceBand: "very_high" | "high" | "medium" | "low" | "very_low";
  hypothesis: string;
  why: string;
  ranking: ResearchCandidate[];
  counterEvidence: string[];
  timeline: string[];
  sources: ResearchSource[];
  scoringNotes: string;
  signalsSummary?: string;
  /** What the agent still wants to verify (iterative reasoning trail). */
  openQuestions?: string[];
  /** Audit trail of what the agent actually did. */
  trace?: {
    rounds: number;
    queries: string[];
    searches: number;
    scrapes: number;
    internalMatches: number;
  };
};

export type JobSignals = {
  job_title?: string | null;
  seniority?: string | null;
  technology: string[];
  cloud: string[];
  location: { region?: string | null; city?: string | null };
  industry?: string | null;
  hours_per_week?: string | number | null;
  remote_policy?: string | null;
  office_days?: string | number | null;
  start_date?: string | null;
  interview_period?: string | null;
  end_date?: string | null;
  extension?: string | null;
  team_size_signal?: string | null;
  project_signals: string[];
  language_requirements: string[];
  recruiter?: string | null;
  agency?: string | null;
  hard_signals: string[];
  /** Job/reference code, e.g. "12785" or "BBBH222439". */
  reference_code?: string | null;
  /** Client name left behind in a code, title, URL, e-mail or project name. */
  client_name_leak?: string | null;
  search_queries: string[];
};

export type SearchHit = {
  title: string;
  url: string;
  description: string;
  tier: SourceTier;
  scraped?: boolean;
  /** Full page text when scraped. */
  body?: string;
};
