-- Single User Journey — end-to-end MVP continuity loop validation log.
CREATE TABLE IF NOT EXISTS single_user_journey_log (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  interaction_index INTEGER NOT NULL,
  continuity_proven BOOLEAN NOT NULL DEFAULT FALSE,
  journey_valid BOOLEAN NOT NULL DEFAULT FALSE,
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  failure_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE single_user_journey_log IS 'Single User Journey — proves 2 messy inputs produce state + change continuity.';
