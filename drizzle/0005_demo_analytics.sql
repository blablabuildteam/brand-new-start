-- Personalized demo analytics (per prospect slug)
CREATE TABLE IF NOT EXISTS demo_analytics (
  slug TEXT PRIMARY KEY,
  first_visit_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  visit_count INTEGER NOT NULL DEFAULT 0,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  clicked_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS demo_analytics_last_visit_idx ON demo_analytics (last_visit_at DESC);