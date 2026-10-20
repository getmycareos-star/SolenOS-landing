-- =========================================================
-- SOLENOS PERSON / CARE-ENTITY MODEL — CANONICAL ENTITY SCHEMA
-- =========================================================
-- This schema implements the foundational entity model required
-- for all downstream care reasoning. Every person, organization,
-- role, relationship, and alias is represented explicitly.
-- =========================================================

-- =========================================================
-- Core: Persons
-- =========================================================
-- Canonical person entity for care recipients, caregivers,
-- family members, providers, and all other care-relevant persons.

CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    stable_internal_id TEXT UNIQUE,
    display_name TEXT,
    legal_full_name TEXT,
    preferred_name TEXT,
    date_of_birth DATE,
    approximate_age INTEGER,
    sex_gender TEXT,
    contact_info JSONB DEFAULT '{}'::jsonb,
    address TEXT,
    demographic_context JSONB DEFAULT '{}'::jsonb,
    identity_confidence TEXT NOT NULL DEFAULT 'unknown'
        CHECK (identity_confidence IN ('certain', 'probable', 'possible', 'ambiguous', 'unknown')),
    identity_confidence_score REAL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived', 'merged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_persons_stable_internal_id ON persons(stable_internal_id);
CREATE INDEX IF NOT EXISTS idx_persons_display_name ON persons(display_name);
CREATE INDEX IF NOT EXISTS idx_persons_identity_confidence ON persons(identity_confidence);
CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status);
CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at DESC);

-- =========================================================
-- Person Aliases
-- =========================================================
-- First-class identity evidence. Original expressions preserved.
-- "Mom", "Mum", "Mary", "Aunty Mary", "Grandma" — each tracked.

CREATE TABLE IF NOT EXISTS person_aliases (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    alias_type TEXT NOT NULL
        CHECK (alias_type IN ('preferred', 'kinship', 'formal', 'informal', 'document', 'other')),
    context TEXT,
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_person_aliases_person_id ON person_aliases(person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_alias ON person_aliases(alias);
CREATE UNIQUE INDEX IF NOT EXISTS idx_person_aliases_unique ON person_aliases(person_id, alias, alias_type);

-- =========================================================
-- Organizations
-- =========================================================
-- Hospitals, clinics, pharmacies, home-health agencies, etc.

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    stable_internal_id TEXT UNIQUE,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL
        CHECK (organization_type IN (
            'hospital', 'clinic', 'pharmacy', 'home_health_agency',
            'hospice', 'senior_living_facility', 'rehabilitation_facility',
            'insurer', 'community_organization', 'care_management_organization'
        )),
    address TEXT,
    contact_info JSONB DEFAULT '{}'::jsonb,
    identifiers JSONB DEFAULT '{}'::jsonb,
    confidence TEXT NOT NULL DEFAULT 'unknown'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    confidence_score REAL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived', 'merged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_organizations_confidence ON organizations(confidence);

-- =========================================================
-- Organization Aliases
-- =========================================================

CREATE TABLE IF NOT EXISTS organization_aliases (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    context TEXT,
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_organization_aliases_org_id ON organization_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_aliases_alias ON organization_aliases(alias);

-- =========================================================
-- Role Assignments
-- =========================================================
-- A person may simultaneously hold multiple roles.
-- Example: daughter + primary caregiver + emergency contact + healthcare proxy

CREATE TABLE IF NOT EXISTS role_assignments (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    care_recipient_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    role_type TEXT NOT NULL,
    role_subtype TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived', 'merged')),
    evidence JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT,
    CONSTRAINT valid_role_type CHECK (
        role_type IN (
            'care_recipient', 'caregiver', 'family_member', 'provider',
            'organization', 'care_team', 'legal_representative',
            'emergency_contact', 'other_care_relevant_person', 'other_care_relevant_organization',
            'primary_caregiver', 'secondary_caregiver', 'professional_caregiver',
            'family_caregiver', 'care_coordinator', 'unpaid_family_caregiver',
            'physician', 'nurse', 'therapist', 'pharmacist', 'social_worker',
            'care_manager', 'specialist', 'facility_staff', 'other_professional',
            'healthcare_proxy', 'healthcare_power_of_attorney', 'legal_guardian',
            'authorized_representative', 'other_legal_role'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_person_id ON role_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_care_recipient ON role_assignments(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_type ON role_assignments(role_type);
CREATE INDEX IF NOT EXISTS idx_role_assignments_status ON role_assignments(status);
CREATE INDEX IF NOT EXISTS idx_role_assignments_effective_dates ON role_assignments(start_date, end_date);

-- =========================================================
-- Relationships (Person-to-Person Graph)
-- =========================================================
-- Directed edges with inverse relationships.
-- Example: Jane → mother of → David
--          David → son of → Jane

CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    person_a_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    person_b_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    inverse_relationship_type TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'a_to_b'
        CHECK (direction IN ('a_to_b', 'b_to_a')),
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    confidence_score REAL,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived', 'merged')),
    evidence JSONB DEFAULT '[]'::jsonb,
    perspective TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT,
    CONSTRAINT valid_relationship_type CHECK (
        relationship_type IN (
            'mother', 'father', 'daughter', 'son', 'spouse', 'partner',
            'sibling', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin',
            'friend', 'neighbour', 'guardian', 'dependent', 'other_family'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_relationships_person_a ON relationships(person_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person_b ON relationships(person_b_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(status);

-- =========================================================
-- Provider Affiliations
-- =========================================================
-- Provider ↔ Organization relationships.
-- Temporal validity — a provider can work at multiple organizations.

CREATE TABLE IF NOT EXISTS provider_affiliations (
    id TEXT PRIMARY KEY,
    provider_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    affiliation_type TEXT NOT NULL DEFAULT 'works_at'
        CHECK (affiliation_type IN ('works_at', 'affiliated_with', 'employed_by', 'contractor')),
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived', 'merged')),
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    evidence JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_affiliations_provider ON provider_affiliations(provider_person_id);
CREATE INDEX IF NOT EXISTS idx_provider_affiliations_org ON provider_affiliations(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_affiliations_status ON provider_affiliations(status);

-- =========================================================
-- Entity Matches (Resolution Candidates)
-- =========================================================
-- Tracks potential identity matches between entities.
-- Never forces an uncertain match.

CREATE TABLE IF NOT EXISTS entity_matches (
    id TEXT PRIMARY KEY,
    entity_a_id TEXT NOT NULL,
    entity_b_id TEXT NOT NULL,
    entity_type_a TEXT NOT NULL
        CHECK (entity_type_a IN ('person', 'organization')),
    entity_type_b TEXT NOT NULL
        CHECK (entity_type_b IN ('person', 'organization')),
    match_outcome TEXT NOT NULL
        CHECK (match_outcome IN (
            'CONFIRMED_MATCH', 'PROBABLE_MATCH', 'POSSIBLE_MATCH',
            'AMBIGUOUS', 'NEW_ENTITY', 'UNRESOLVED'
        )),
    confidence_score REAL,
    match_basis JSONB DEFAULT '[]'::jsonb,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_entity_matches_a ON entity_matches(entity_a_id);
CREATE INDEX IF NOT EXISTS idx_entity_matches_b ON entity_matches(entity_b_id);
CREATE INDEX IF NOT EXISTS idx_entity_matches_outcome ON entity_matches(match_outcome);
CREATE INDEX IF NOT EXISTS idx_entity_matches_resolved ON entity_matches(resolved);

-- =========================================================
-- Care Recipient Assignments
-- =========================================================
-- Explicit mapping between care records and care recipients.
-- Never inferred from name frequency.

CREATE TABLE IF NOT EXISTS care_recipient_assignments (
    id TEXT PRIMARY KEY,
    care_recipient_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    care_record_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by TEXT NOT NULL,
    is_authoritative BOOLEAN NOT NULL DEFAULT FALSE,
    evidence JSONB DEFAULT '[]'::jsonb,
    confidence TEXT NOT NULL DEFAULT 'low'
        CHECK (confidence IN ('high', 'medium', 'low', 'none')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT,
    UNIQUE(care_recipient_person_id, care_record_id)
);

CREATE INDEX IF NOT EXISTS idx_care_recipient_assignments_recipient ON care_recipient_assignments(care_recipient_person_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_assignments_care_record ON care_recipient_assignments(care_record_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_assignments_authoritative ON care_recipient_assignments(is_authoritative);

-- =========================================================
-- Document Subject Resolutions
-- =========================================================
-- Every imported document must resolve who it is about, who authored it,
-- who provided the information, and who uploaded it.
-- If subject identity is ambiguous: MARK IT AMBIGUOUS.

CREATE TABLE IF NOT EXISTS document_subject_resolutions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    care_recipient_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    author_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    provider_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    uploader_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    mentioned_person_ids JSONB DEFAULT '[]'::jsonb,
    mentioned_organization_ids JSONB DEFAULT '[]'::jsonb,
    subject_confidence TEXT NOT NULL DEFAULT 'unknown'
        CHECK (subject_confidence IN ('certain', 'probable', 'possible', 'ambiguous', 'unknown')),
    subject_confidence_score REAL,
    is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
    ambiguity_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'user_input'
        CHECK (source IN ('user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed')),
    provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_subject_resolutions_document ON document_subject_resolutions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_subject_resolutions_recipient ON document_subject_resolutions(care_recipient_person_id);
CREATE INDEX IF NOT EXISTS idx_document_subject_resolutions_ambiguous ON document_subject_resolutions(is_ambiguous);

-- =========================================================
-- Care Recipient Identity (backward compatibility view)
-- =========================================================
-- Maintained for backward compatibility with existing code.
-- New code should use the canonical persons + role_assignments tables.

CREATE TABLE IF NOT EXISTS care_recipient_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL,
    care_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    relationship TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_care_recipient ON care_recipient_identities(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_caregiver ON care_recipient_identities(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_recipient_identity_care_key ON care_recipient_identities(care_key);

-- =========================================================
-- Care Events (updated for canonical entity model)
-- =========================================================
-- Event-sourced care events with full entity attribution.

CREATE TABLE IF NOT EXISTS care_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_recipient_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    situation_id TEXT,
    source TEXT CHECK (source IN ('note', 'question', 'observation', 'document', 'correction', 'decision', 'outcome', 'memory_correction')),
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    observer_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    author_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    subject_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    document_subject_resolution_id TEXT REFERENCES document_subject_resolutions(id) ON DELETE SET NULL,
    correlation_id TEXT,
    causation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_events_care_recipient ON care_events(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_care_events_caregiver ON care_events(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_events_situation ON care_events(situation_id);
CREATE INDEX IF NOT EXISTS idx_care_events_event_id ON care_events(event_id);
CREATE INDEX IF NOT EXISTS idx_care_events_correlation ON care_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_care_events_type_created ON care_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_care_events_created_at ON care_events(created_at);
CREATE INDEX IF NOT EXISTS idx_care_events_observer ON care_events(observer_person_id);
CREATE INDEX IF NOT EXISTS idx_care_events_author ON care_events(author_person_id);
CREATE INDEX IF NOT EXISTS idx_care_events_subject ON care_events(subject_person_id);

-- =========================================================
-- Person Boundary Enforcement Audit Log
-- =========================================================
-- Logs any cross-person contamination attempts detected by the system.

CREATE TABLE IF NOT EXISTS person_boundary_audits (
    id TEXT PRIMARY KEY,
    care_recipient_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    event_id TEXT,
    violation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_person_boundary_audits_recipient ON person_boundary_audits(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_person_boundary_audits_resolved ON person_boundary_audits(resolved);

-- =========================================================
-- Sample Data (demonstration only — not for production)
-- =========================================================

INSERT OR IGNORE INTO persons (id, stable_internal_id, display_name, legal_full_name, preferred_name, identity_confidence, status, created_by, updated_by, source, provenance)
VALUES
    ('p_mom_001', 'mom_001', 'Mom', 'Mary Adeyemi', 'Mary', 'certain', 'active', 'system', 'system', 'user_input', 'Initial creation'),
    ('p_dad_002', 'dad_002', 'Dad', 'John Adeyemi', 'John', 'certain', 'active', 'system', 'system', 'user_input', 'Initial creation'),
    ('p_daughter_003', 'daughter_003', 'Jane', 'Jane Adeyemi', 'Jane', 'certain', 'active', 'system', 'system', 'user_input', 'Initial creation');

INSERT OR IGNORE INTO person_aliases (id, person_id, alias, alias_type, confidence, is_primary, source, provenance)
VALUES
    ('pa_mom_001_1', 'p_mom_001', 'Mom', 'kinship', 'high', true, 'user_input', 'Initial creation'),
    ('pa_mom_001_2', 'p_mom_001', 'Mum', 'kinship', 'high', false, 'user_input', 'Initial creation'),
    ('pa_mom_001_3', 'p_mom_001', 'Mary', 'informal', 'medium', false, 'user_input', 'Initial creation'),
    ('pa_dad_002_1', 'p_dad_002', 'Dad', 'kinship', 'high', true, 'user_input', 'Initial creation'),
    ('pa_dad_002_2', 'p_dad_002', 'John', 'informal', 'medium', false, 'user_input', 'Initial creation');

INSERT OR IGNORE INTO role_assignments (id, person_id, care_recipient_id, role_type, is_primary, confidence, start_date, status, evidence, source, provenance, created_by, updated_by)
VALUES
    ('ra_mom_001', 'p_mom_001', 'p_mom_001', 'care_recipient', true, 'certain', '2024-01-01', 'active', '["Display name: Mom"]', 'user_input', 'Initial creation', 'system', 'system'),
    ('ra_daughter_003_caregiver', 'p_daughter_003', 'p_mom_001', 'primary_caregiver', true, 'certain', '2024-01-01', 'active', '["Daughter of Mom", "Primary contact"]', 'user_input', 'Initial creation', 'system', 'system'),
    ('ra_daughter_003_family', 'p_daughter_003', 'p_mom_001', 'daughter', true, 'certain', '2024-01-01', 'active', '["Daughter of Mom"]', 'user_input', 'Initial creation', 'system', 'system'),
    ('ra_dad_002_family', 'p_dad_002', 'p_mom_001', 'spouse', true, 'certain', '2024-01-01', 'active', '["Spouse of Mom"]', 'user_input', 'Initial creation', 'system', 'system');

INSERT OR IGNORE INTO relationships (id, person_a_id, person_b_id, relationship_type, inverse_relationship_type, direction, confidence, evidence, source, provenance)
VALUES
    ('rel_daughter_mother', 'p_daughter_003', 'p_mom_001', 'daughter', 'mother', 'a_to_b', 'certain', '["Daughter of Mom"]', 'user_input', 'Initial creation'),
    ('rel_spouse_mom', 'p_dad_002', 'p_mom_001', 'spouse', 'spouse', 'a_to_b', 'certain', '["Spouse of Mom"]', 'user_input', 'Initial creation');

INSERT OR IGNORE INTO organizations (id, name, organization_type, confidence, status, source, provenance, created_by, updated_by)
VALUES
    ('org_hospital_001', 'Memorial Hospital', 'hospital', 'certain', 'active', 'user_input', 'Initial creation', 'system', 'system'),
    ('org_pharmacy_001', 'XYZ Pharmacy', 'pharmacy', 'certain', 'active', 'user_input', 'Initial creation', 'system', 'system');

INSERT OR IGNORE INTO provider_affiliations (id, provider_person_id, organization_id, affiliation_type, confidence, status, source, provenance, created_by, updated_by)
VALUES
    ('pa_dr_smith_001', 'p_provider_001', 'org_hospital_001', 'works_at', 'certain', 'active', 'user_input', 'Initial creation', 'system', 'system');
