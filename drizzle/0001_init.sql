-- Brand New Start radar MVP (Vercel Postgres / Neon)
-- Apply when DATABASE_URL is connected; app currently uses in-memory store + seed.

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  role_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_url TEXT,
  employment_hint TEXT,
  raw JSONB,
  seen_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS signals_company_idx ON signals(company_id);
CREATE INDEX IF NOT EXISTS signals_seen_idx ON signals(seen_at);

CREATE TABLE IF NOT EXISTS radar_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  role_label TEXT NOT NULL,
  status TEXT NOT NULL,
  kans INTEGER NOT NULL,
  hiring_manager TEXT,
  angle TEXT,
  sources JSONB NOT NULL,
  factors JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (company_id, role_label)
);
