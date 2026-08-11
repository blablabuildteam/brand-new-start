-- Sync run history (persist last syncs across restarts)
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL,
  label TEXT NOT NULL,
  mode TEXT NOT NULL,
  detail TEXT,
  fetched INTEGER NOT NULL,
  kept INTEGER NOT NULL,
  skipped INTEGER,
  searched JSONB,
  hits JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_runs_at_idx ON sync_runs(at DESC);
