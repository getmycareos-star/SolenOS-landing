-- 051: Care Contexts durable storage
-- Longitudinal understanding of a family's care journey
-- Timeline, changes, uncertainties, prioritized actions, state of care, patterns

CREATE TABLE IF NOT EXISTS care_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL,
    caregiver_id UUID NOT NULL,
    identity JSONB,
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    recent_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
    uncertainties JSONB DEFAULT '[]'::jsonb,
    prioritized_actions JSONB DEFAULT '[]'::jsonb,
    state_of_care JSONB,
    caregiver_load JSONB,
    patterns JSONB DEFAULT '[]'::jsonb,
    oml JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_care_contexts_care_recipient ON care_contexts(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_contexts_caregiver ON care_contexts(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_contexts_updated_at ON care_contexts(updated_at DESC);

-- RLS
ALTER TABLE care_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_contexts_user_isolation ON care_contexts
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);