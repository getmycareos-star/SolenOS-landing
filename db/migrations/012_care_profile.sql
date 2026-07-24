-- SolenOS Care Profile Layer — versioned caregiving inference identity graph persistence.

-- Run: psql $DATABASE_URL -f db/migrations/012_care_profile.sql



ALTER TABLE users

  ADD COLUMN IF NOT EXISTS care_profile_state JSONB;



COMMENT ON COLUMN users.care_profile_state IS

  'Versioned care profile inference graph — updated via inference signals and explicit user updates only; never reset on auth.';


