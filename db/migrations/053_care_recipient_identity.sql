-- 053: Care Recipient Identity durable storage
-- Ask-once display name for care recipient — never silent medical identity inference
-- Product SoT: docs/02-product/solenos-mvp-identity-naming.md

CREATE TABLE IF NOT EXISTS care_recipient_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL UNIQUE,
    caregiver_id UUID NOT NULL,
    care_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    relationship TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_care_recipient ON care_recipient_identities(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_caregiver ON care_recipient_identities(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_care_key ON care_recipient_identities(care_key);

-- RLS
ALTER TABLE care_recipient_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_recipient_identity_user_isolation ON care_recipient_identities
    FOR ALL USING (caregiver_id = auth.uid()::uuid OR care_recipient_id = auth.uid()::uuid);