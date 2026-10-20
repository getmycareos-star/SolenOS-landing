-- 080: Problem Reports table for incident tracking
-- Stores user-reported issues including AI output problems, privacy concerns, and security incidents

CREATE TABLE IF NOT EXISTS problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_key TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'incorrect-fact',
        'missing-context',
        'misleading-interpretation',
        'unsupported-claim',
        'privacy-access-concern',
        'potentially-unsafe-output',
        'other'
    )),
    details TEXT,
    situation_id UUID,
    ai_content TEXT NOT NULL,
    raw_input_excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_problem_reports_care_key ON problem_reports(care_key);
CREATE INDEX IF NOT EXISTS idx_problem_reports_category ON problem_reports(category);
CREATE INDEX IF NOT EXISTS idx_problem_reports_created_at ON problem_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_reports_situation ON problem_reports(situation_id);

-- RLS
ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY problem_reports_user_isolation ON problem_reports
    FOR ALL USING (
        -- Allow access if the user is the caregiver associated with the care_key
        EXISTS (
            SELECT 1 FROM care_recipient_identities cri
            WHERE cri.care_key = problem_reports.care_key
            AND (cri.caregiver_id = auth.uid()::uuid OR cri.care_recipient_id = auth.uid()::uuid)
        )
        -- Or if the user is authenticated and matches the care recipient/caregiver in the report
        OR EXISTS (
            SELECT 1 FROM care_recipient_identities cri
            JOIN care_events ce ON ce.care_recipient_id = cri.care_recipient_id
            WHERE ce.id = problem_reports.situation_id
            AND (cri.caregiver_id = auth.uid()::uuid OR cri.care_recipient_id = auth.uid()::uuid)
        )
    );