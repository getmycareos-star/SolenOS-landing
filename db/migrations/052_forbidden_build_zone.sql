-- Forbidden Build Zone — governance against out-of-scope feature surfaces.
-- Run: psql $DATABASE_URL -f db/migrations/052_forbidden_build_zone.sql

CREATE TABLE IF NOT EXISTS forbidden_build_zone_log (
  scan_id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  build_filter_passed BOOLEAN NOT NULL,
  output_violation_count INT NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE forbidden_build_zone_log IS
  'Build filter scans — blocks chat, dashboards, onboarding wizards, marketplaces.';
