-- Admin activity / error audit (blablabuild ops)
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  level TEXT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  path TEXT,
  status INTEGER,
  detail JSONB
);

CREATE INDEX IF NOT EXISTS activity_events_at_idx ON activity_events(at DESC);
CREATE INDEX IF NOT EXISTS activity_events_level_idx ON activity_events(level);
CREATE INDEX IF NOT EXISTS activity_events_kind_idx ON activity_events(kind);
