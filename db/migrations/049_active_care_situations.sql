-- 049: Active Care Situations durable storage
-- Living Care Record spine — Active Care Situation (ACS) persistence
-- Supports multi-contributor care realities, situation lifecycle, and progressive understanding

CREATE TABLE IF NOT EXISTS active_care_situations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL,
    caregiver_id UUID NOT NULL,
    situation_id TEXT UNIQUE NOT NULL,
    root_event_id TEXT,
    subject_label TEXT,
    theme TEXT CHECK (theme IN ('emotional_behavior', 'incident', 'care_change', 'mixed')),
    understanding_stage TEXT CHECK (understanding_stage IN ('gathering', 'forming', 'synthesizing')),
    lifecycle_status TEXT CHECK (lifecycle_status IN ('active', 'quiet', 'resolved', 'historical')),
    interaction_paused_at TIMESTAMPTZ,
    last_understanding_effect TEXT,
    last_understanding_delta TEXT,
    pattern_label TEXT,
    familiarity_baseline JSONB DEFAULT '[]'::jsonb,
    compound_signal TEXT,
    trajectory_by_domain JSONB DEFAULT '{}'::jsonb,
    cross_signal_correlations JSONB DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    open_questions JSONB DEFAULT '[]'::jsonb,
    asked_questions JSONB DEFAULT '[]'::jsonb,
    connection_note TEXT,
    synthesis TEXT,
    what_matters_now TEXT,
    continuity_hooks JSONB DEFAULT '[]'::jsonb,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_active_care_situations_care_recipient ON active_care_situations(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_active_care_situations_caregiver ON active_care_situations(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_active_care_situations_situation_id ON active_care_situations(situation_id);
CREATE INDEX IF NOT EXISTS idx_active_care_situations_updated_at ON active_care_situations(updated_at DESC);

-- RLS for user isolation (when using Supabase auth)
ALTER TABLE active_care_situations ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_care_situations_user_isolation ON active_care_situations
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);