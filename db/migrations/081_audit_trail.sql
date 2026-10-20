-- 081: Audit Trail table for persistent audit logging
-- Stores immutable audit entries for tracking system changes and user actions

CREATE TABLE IF NOT EXISTS audit_trail (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    care_recipient_id UUID NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('caregiver', 'system', 'ai_engine', 'clinician')),
    actor_id UUID NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'merge', 'infer', 'correct')),
    target_entity_type TEXT NOT NULL,
    target_entity_id UUID NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT NOT NULL CHECK (reason IN (
        'explicit_user_input',
        'system_inference',
        'clarification_response',
        'pattern_update',
        'contradiction_resolution',
        'external_clinical_record',
        'carecontext_recompute'
    )),
    reason_detail TEXT,
    confidence_before DOUBLE PRECISION,
    confidence_after DOUBLE PRECISION,
    related_events UUID[] DEFAULT '{}',
    related_audit_id UUID,
    conflict_relationship TEXT CHECK (conflict_relationship IS NULL OR conflict_relationship IN ('correction', 'contradiction', 'refinement')),
    care_recipient_id_for_rls UUID NOT NULL, -- Duplicated for RLS policy
    
    -- Indexes for common queries
    CONSTRAINT chk_conflict_relationship CHECK (
        (conflict_relationship IS NULL) OR 
        (conflict_relationship IN ('correction', 'contradiction', 'refinement'))
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_care_recipient ON audit_trail(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_sequence ON audit_trail(sequence);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action_type ON audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_reason ON audit_trail(reason);
CREATE INDEX IF NOT EXISTS idx_audit_trail_target ON audit_trail(target_entity_type, target_entity_id);

-- RLS
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_trail_user_isolation ON audit_trail
    FOR ALL USING (care_recipient_id_for_rls = auth.uid()::uuid);