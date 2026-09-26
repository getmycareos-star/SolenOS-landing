-- 052: Decision Memory entries durable storage
-- Preserve why care decisions existed — answer record questions from held evidence
-- Schema: what / when / who / context / evidence / alternatives / reason / outcome / status

CREATE TABLE IF NOT EXISTS decision_memory_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL,
    caregiver_id UUID NOT NULL,
    care_key TEXT NOT NULL,
    what TEXT NOT NULL,
    decision TEXT NOT NULL,
    when_recorded TIMESTAMPTZ NOT NULL,
    who JSONB DEFAULT '[]'::jsonb,
    context_situation_id TEXT,
    context_summary TEXT,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    alternatives JSONB DEFAULT '[]'::jsonb,
    reason TEXT,
    outcome TEXT,
    outcome_event_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT CHECK (status IN ('active', 'pending', 'changed', 'completed', 'reversed', 'uncertain', 'needs_review')),
    evidence_texts JSONB DEFAULT '[]'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL,
    content_tokens JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decision_memory_care_recipient ON decision_memory_entries(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_caregiver ON decision_memory_entries(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_care_key ON decision_memory_entries(care_key);
CREATE INDEX IF NOT EXISTS idx_decision_memory_situation ON decision_memory_entries(context_situation_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_recorded_at ON decision_memory_entries(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_memory_status ON decision_memory_entries(status);

-- RLS
ALTER TABLE decision_memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_memory_user_isolation ON decision_memory_entries
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);