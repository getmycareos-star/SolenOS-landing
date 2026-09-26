-- 050: Care Reality States durable storage
-- Living Care Record spine — Care Reality State (CRS) persistence
-- Belief SoT for caregiver projection with progressive disclosure

CREATE TABLE IF NOT EXISTS care_reality_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL,
    caregiver_id UUID NOT NULL,
    care_recipient_label TEXT,
    situation_id TEXT,
    root_event_id TEXT,
    understanding_stage TEXT CHECK (understanding_stage IN ('gathering', 'forming', 'synthesizing')),
    disclosure_stage TEXT CHECK (disclosure_stage IN ('early', 'developing', 'orientable', 'synthesizing', 'orientation_rich')),
    current_understanding JSONB NOT NULL DEFAULT '[]'::jsonb,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    situation_summary TEXT,
    pattern_label TEXT,
    what_matters_now TEXT,
    open_uncertainties JSONB DEFAULT '[]'::jsonb,
    resolved_uncertainties JSONB DEFAULT '[]'::jsonb,
    what_changed_in_understanding TEXT,
    understanding_effect TEXT,
    response_evolution JSONB NOT NULL DEFAULT '{}'::jsonb,
    primary_screen_question TEXT,
    observation_count INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    continuity_hooks JSONB DEFAULT '[]'::jsonb,
    understanding_revisions JSONB DEFAULT '[]'::jsonb,
    care_domain_trajectories JSONB DEFAULT '{}'::jsonb,
    compound_signals JSONB DEFAULT '[]'::jsonb,
    change_classifications JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_care_reality_states_care_recipient ON care_reality_states(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_reality_states_caregiver ON care_reality_states(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_reality_states_situation ON care_reality_states(situation_id);
CREATE INDEX IF NOT EXISTS idx_care_reality_states_updated_at ON care_reality_states(updated_at DESC);

-- RLS
ALTER TABLE care_reality_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_reality_states_user_isolation ON care_reality_states
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);