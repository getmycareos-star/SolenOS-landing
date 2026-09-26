-- 054: Care Events durable storage (Event-sourced)
-- Event store for CareEvents — rebuild invariant for CareContext, ACS, CRS
-- Supports event-sourced projections and audit trail

CREATE TABLE IF NOT EXISTS care_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL,
    caregiver_id UUID NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    situation_id TEXT,
    source TEXT CHECK (source IN ('note', 'question', 'observation', 'document', 'correction', 'decision', 'outcome', 'memory_correction')),
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id TEXT,
    causation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for event sourcing patterns
CREATE INDEX IF NOT EXISTS idx_care_events_care_recipient ON care_events(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_events_caregiver ON care_events(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_events_situation ON care_events(situation_id);
CREATE INDEX IF NOT EXISTS idx_care_events_event_id ON care_events(event_id);
CREATE INDEX IF NOT EXISTS idx_care_events_correlation ON care_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_care_events_type_created ON care_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_care_events_created_at ON care_events(created_at);

-- RLS
ALTER TABLE care_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_events_user_isolation ON care_events
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);