-- =========================================================
-- MEETINGS — Appointment and meeting management
-- =========================================================
-- Stores scheduled meetings (appointments) and their preparation state.
-- Follows the canonical entity model with references to persons.
-- =========================================================

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    meeting_type TEXT NOT NULL
        CHECK (meeting_type IN (
            ''medical'', ''legal'', ''financial'', ''care_coordination'', ''family'', ''other''
        )),
    status TEXT NOT NULL
        CHECK (status IN (
            ''scheduled'', ''completed'', ''cancelled'', ''proposed_meeting''
        )),
    source TEXT NOT NULL
        CHECK (source IN (
            ''manual'', ''calendar'', ''document_inferred''
        )),
    meeting_datetime TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    linked_events UUID[] DEFAULT ''{}''::uuid[],
    preparation_generated BOOLEAN NOT NULL DEFAULT FALSE,
    preparation_pack JSONB,
    requires_user_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    outcome JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    source_provenance TEXT NOT NULL DEFAULT ''user_input''
        CHECK (source_provenance IN (
            ''user_input'', ''document'', ''observation'', ''provider_note'', ''caregiver_report'', ''inferred'', ''assumed''
        )),
    provenance TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_care_recipient ON meetings(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_meetings_caregiver ON meetings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_datetime ON meetings(meeting_datetime);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(source);

-- RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY meetings_user_isolation ON meetings
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);
