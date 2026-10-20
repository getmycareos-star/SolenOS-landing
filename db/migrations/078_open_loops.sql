-- ==========================================================
-- Open Loop Manager — Schema for tracking unresolved care threads
-- ==========================================================
-- Stores open loops that require follow-up: unanswered questions,
-- pending decisions, monitoring items, and topics to revisit.

CREATE TABLE IF NOT EXISTS open_loops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'reconnected', 'archived')),
    priority INTEGER NOT NULL DEFAULT 1,
    source_event_id UUID REFERENCES care_events(id),
    resolved_by_event_id UUID REFERENCES care_events(id),
    resolution TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_open_loops_care_recipient ON open_loops(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_caregiver ON open_loops(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_status ON open_loops(status);
CREATE INDEX IF NOT EXISTS idx_open_loops_category ON open_loops(category);
CREATE INDEX IF NOT EXISTS idx_open_loops_created_at ON open_loops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_loops_updated_at ON open_loops(updated_at DESC);

-- Index for finding loops by caregiver and care recipient
CREATE INDEX IF NOT EXISTS idx_open_loops_caregiver_recipient ON open_loops(caregiver_id, care_recipient_id);

-- Index for finding open/unresolved loops
CREATE INDEX IF NOT EXISTS idx_open_loops_unresolved ON open_loops(status) 
    WHERE status IN ('open', 'reconnected');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_open_loops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_open_loops_updated_at
BEFORE UPDATE ON open_loops
FOR EACH ROW
EXECUTE FUNCTION update_open_loops_updated_at();
