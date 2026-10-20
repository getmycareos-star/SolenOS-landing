-- ==========================================================
// Care Attention Layer — Schema for tracking what deserves caregiver attention
// ==========================================================
// Stores attention items that help caregivers understand what deserves their attention
// based on evidence, change, uncertainty, unresolved continuity, timing, and user-defined importance

CREATE TABLE IF NOT EXISTS care_attention (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    
    -- Attention Reason (why this deserves attention)
    attention_reason TEXT NOT NULL,
    
    -- Attention State (system-determined, separate from user importance)
    attention_state TEXT NOT NULL CHECK (attention_state IN (
        'NEEDS_ATTENTION',
        'AWAITING_CONFIRMATION', 
        'PROFESSIONAL_FOLLOW_UP',
        'CAN_WAIT',
        'RESOLVED',
        'INFORMATIONAL',
        'UNKNOWN'
    )),
    
    -- User Importance (separate dimension from attention state)
    user_importance TEXT NOT NULL CHECK (user_importance IN (
        'IMPORTANT',
        'INFORMATIONAL',
        'LOW_PRIORITY'
    )),
    
    -- Current status of the underlying issue
    current_status TEXT,
    
    -- What remains unknown/uncertain
    uncertainty TEXT[] NOT NULL DEFAULT '{}',
    
    -- Supporting evidence (references to canonical care events)
    evidence UUID[] NOT NULL DEFAULT '{}',
    
    -- Related canonical objects (foreign keys to respective tables)
    care_context_id UUID REFERENCES care_contexts(id),
    related_change_id UUID REFERENCES care_events(id), -- Simplified reference
    open_loop_id UUID REFERENCES open_loops(id),
    appointment_id UUID REFERENCES care_events(id),
    responsibility_id UUID, -- Would reference responsibilities table if it existed
    observation_id UUID REFERENCES care_events(id),
    medication_id UUID, -- Would reference medications table
    decision_id UUID, -- Would reference decision_memory table
    outcome_id UUID, -- Would reference outcome_measurement table
    professional_interaction_id UUID REFERENCES care_events(id),
    
    -- Provenance and source information
    source TEXT NOT NULL CHECK (source IN (
        'ai_generated',
        'user_marked', 
        'system_detected'
    )) DEFAULT 'system_detected',
    provenance JSONB DEFAULT '{}'::jsonb,
    
    -- Priority level (higher = more urgent)
    priority INTEGER NOT NULL DEFAULT 1,
    
    -- Dependencies that affect this attention item
    dependencies UUID[] NOT NULL DEFAULT '{}',
    
    -- Resolution state
    resolution_state TEXT NOT NULL CHECK (resolution_state IN (
        'UNRESOLVED',
        'RESOLVED_BY_EVIDENCE',
        'RESOLVED_BY_USER',
        'REOPENED'
    )) DEFAULT 'UNRESOLVED',
    
    -- Dates
    effective_date TIMESTAMPTZ,
    review_date TIMESTAMPTZ,
    
    -- States
    confirmation_state TEXT NOT NULL CHECK (confirmation_state IN (
        'CONFIRMED',
        'UNCONFIRMED',
        'CONFLICTING'
    )) DEFAULT 'UNCONFIRMED',
    
    professional_followup_state TEXT NOT NULL CHECK (professional_followup_state IN (
        'NONE',
        'PENDING',
        'SCHEDULED',
        'COMPLETED'
    )) DEFAULT 'NONE',
    
    -- Versioning for tracking changes
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_care_attention_care_recipient ON care_attention(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_attention_caregiver ON care_attention(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_attention_attention_state ON care_attention(attention_state);
CREATE INDEX IF NOT EXISTS idx_care_attention_user_importance ON care_attention(user_importance);
CREATE INDEX IF NOT EXISTS idx_care_attention_priority ON care_attention(priority);
CREATE INDEX IF NOT EXISTS idx_care_attention_resolution_state ON care_attention(resolution_state);
CREATE INDEX IF NOT EXISTS idx_care_attention_confirmation_state ON care_attention(confirmation_state);
CREATE INDEX IF NOT EXISTS idx_care_attention_professional_followup_state ON care_attention(professional_followup_state);
CREATE INDEX IF NOT EXISTS idx_care_attention_created_at ON care_attention(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_attention_updated_at ON care_attention(updated_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_care_attention_recipient_state ON care_attention(care_recipient_id, attention_state);
CREATE INDEX IF NOT EXISTS idx_care_attention_recipient_priority ON care_attention(care_recipient_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_care_attention_needs_attention ON care_attention(care_recipient_id, attention_state) 
    WHERE attention_state = 'NEEDS_ATTENTION';
CREATE INDEX IF NOT EXISTS idx_care_attention_awaiting_confirmation ON care_attention(care_recipient_id, attention_state) 
    WHERE attention_state = 'AWAITING_CONFIRMATION';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_care_attention_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_care_attention_updated_at
BEFORE UPDATE ON care_attention
FOR EACH ROW
EXECUTE FUNCTION update_care_attention_updated_at();

-- Audit table for tracking changes to attention items
CREATE TABLE IF NOT EXISTS care_attention_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attention_id UUID NOT NULL REFERENCES care_attention(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    changes JSONB NOT NULL, -- Stores the diff of what changed
    reason TEXT,
    version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_attention_audit_attention ON care_attention_audit(attention_id);
CREATE INDEX IF NOT EXISTS idx_care_attention_audit_changed_at ON care_attention_audit(changed_at DESC);