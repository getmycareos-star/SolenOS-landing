import type {
  Person,
  PersonAlias,
  RoleAssignment,
  Relationship,
  Organization,
  OrganizationAlias,
  ProviderAffiliation,
  EntityMatch,
  CorrectionRecord,
  CareRecipientAssignment,
  DocumentSubjectResolution,
  PersonIdentityConfidence,
  EntityMatchOutcome,
  EntityStatus,
  ConfidenceLevel,
  SourceType,
  ProfessionalSummary,
  ProfessionalSummaryCorrection,
  ProfessionalSummaryApproval,
  ProfessionalSummarySharing,
  ProfessionalSummaryResponse,
  ProfessionalSummaryAuditEntry,
  ProfessionalSummaryStatus,
} from "./types";

let personIdCounter = 1;
let aliasIdCounter = 1;
let roleIdCounter = 1;
let relationshipIdCounter = 1;
let orgIdCounter = 1;
let affiliationIdCounter = 1;
let matchIdCounter = 1;
let professionalSummaryIdCounter = 1;
let correctionIdCounter = 1;
let approvalIdCounter = 1;
let sharingIdCounter = 1;
let responseIdCounter = 1;
let auditIdCounter = 1;

function generateId(prefix: string, counter: { value: number }): string {
  return `${prefix}_${counter.value.toString(36).padStart(6, "0")}_${Date.now().toString(36).slice(-4)}`;
}

const persons = new Map<string, Person>();
const aliases = new Map<string, PersonAlias>();
const roleAssignments = new Map<string, RoleAssignment>();
const relationships = new Map<string, Relationship>();
const organizations = new Map<string, Organization>();
const orgAliases = new Map<string, OrganizationAlias>();
const affiliations = new Map<string, ProviderAffiliation>();
const entityMatches = new Map<string, EntityMatch>();
const careRecipientAssignments = new Map<string, CareRecipientAssignment>();
const documentSubjectResolutions = new Map<string, DocumentSubjectResolution>();
const professionalSummaries = new Map<string, ProfessionalSummary>();
const professionalSummaryCorrections = new Map<string, ProfessionalSummaryCorrection>();
const professionalSummaryApprovals = new Map<string, ProfessionalSummaryApproval>();
const professionalSummarySharings = new Map<string, ProfessionalSummarySharing>();
const professionalSummaryResponses = new Map<string, ProfessionalSummaryResponse>();
const professionalSummaryAuditTrail = new Map<string, ProfessionalSummaryAuditEntry>();

// ─── Person CRUD ─────────────────────────────────────────────────────────────

export function createPerson(params: {
  display_name?: string | null;
  legal_full_name?: string | null;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  approximate_age?: number | null;
  identity_confidence?: PersonIdentityConfidence;
  identity_confidence_score?: number | null;
  status?: EntityStatus;
  created_by: string;
  source?: SourceType;
  provenance?: string;
}): Person {
  const id = generateId("p", { value: personIdCounter++ });
  const now = new Date().toISOString();
  const person: Person = {
    id,
    display_name: params.display_name?.trim() ?? null,
    legal_full_name: params.legal_full_name?.trim() ?? null,
    preferred_name: params.preferred_name?.trim() ?? null,
    aliases: [],
    date_of_birth: params.date_of_birth ?? null,
    approximate_age: params.approximate_age ?? null,
    sex_gender: null,
    contact_info: {},
    address: null,
    demographic_context: {},
    identity_confidence: params.identity_confidence ?? "unknown",
    identity_confidence_score: params.identity_confidence_score ?? null,
    status: params.status ?? "active",
    created_at: now,
    updated_at: now,
    created_by: params.created_by,
    updated_by: params.created_by,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
    correction_history: [],
    stable_internal_id: id,
  };

  persons.set(id, person);
  return person;
}

export function getPerson(id: string): Person | null {
  return persons.get(id) ?? null;
}

export function updatePerson(id: string, updates: Partial<Person>): Person | null {
  const existing = persons.get(id);
  if (!existing) return null;

  const updated: Person = {
    ...existing,
    ...updates,
    id: existing.id,
    stable_internal_id: existing.stable_internal_id ?? existing.id,
    created_at: existing.created_at,
    created_by: existing.created_by,
    updated_at: new Date().toISOString(),
    updated_by: existing.updated_by,
    aliases: existing.aliases,
    correction_history: existing.correction_history,
    provenance: updates.provenance ?? existing.provenance,
    source: updates.source ?? existing.source,
  };

  persons.set(id, updated);
  return updated;
}

export function deletePerson(id: string): boolean {
  return persons.delete(id);
}

export function listPersons(): Person[] {
  return [...persons.values()];
}

export function findPersonByAlias(alias: string): Person | null {
  const lowerAlias = alias.toLowerCase().trim();
  for (const person of persons.values()) {
    if (person.display_name?.toLowerCase() === lowerAlias) return person;
    if (person.legal_full_name?.toLowerCase() === lowerAlias) return person;
    if (person.preferred_name?.toLowerCase() === lowerAlias) return person;
    for (const a of person.aliases) {
      if (a.alias.toLowerCase() === lowerAlias) return person;
    }
  }
  return null;
}

// ─── Person Aliases ──────────────────────────────────────────────────────────

export function addPersonAlias(params: {
  person_id: string;
  alias: string;
  alias_type?: PersonAlias["alias_type"];
  context?: string | null;
  confidence?: ConfidenceLevel;
  is_primary?: boolean;
  source?: SourceType;
  provenance?: string;
}): PersonAlias | null {
  const person = persons.get(params.person_id);
  if (!person) return null;

  const id = generateId("pa", { value: aliasIdCounter++ });
  const now = new Date().toISOString();
  const alias: PersonAlias = {
    id,
    person_id: params.person_id,
    alias: params.alias.trim(),
    alias_type: params.alias_type ?? "informal",
    context: params.context ?? null,
    confidence: params.confidence ?? "medium",
    is_primary: params.is_primary ?? false,
    created_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  aliases.set(id, alias);
  person.aliases.push(alias);
  return alias;
}

export function getAliasesForPerson(personId: string): PersonAlias[] {
  return [...aliases.values()].filter((a) => a.person_id === personId);
}

// ─── Organizations ───────────────────────────────────────────────────────────

export function createOrganization(params: {
  name: string;
  organization_type: Organization["organization_type"];
  address?: string | null;
  confidence?: ConfidenceLevel;
  confidence_score?: number | null;
  status?: EntityStatus;
  source?: SourceType;
  provenance?: string;
  created_by: string;
}): Organization {
  const id = generateId("org", { value: orgIdCounter++ });
  const now = new Date().toISOString();
  const org: Organization = {
    id,
    name: params.name.trim(),
    aliases: [],
    organization_type: params.organization_type,
    address: params.address ?? null,
    contact_info: {},
    identifiers: {},
    confidence: params.confidence ?? "unknown",
    confidence_score: params.confidence_score ?? null,
    status: params.status ?? "active",
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
    stable_internal_id: id,
  };

  organizations.set(id, org);
  return org;
}

export function getOrganization(id: string): Organization | null {
  return organizations.get(id) ?? null;
}

export function findOrganizationByName(name: string): Organization | null {
  const lowerName = name.toLowerCase().trim();
  for (const org of organizations.values()) {
    if (org.name.toLowerCase() === lowerName) return org;
    for (const alias of org.aliases) {
      if (alias.alias.toLowerCase() === lowerName) return org;
    }
  }
  return null;
}

export function addOrganizationAlias(params: {
  organization_id: string;
  alias: string;
  context?: string | null;
  confidence?: ConfidenceLevel;
  source?: SourceType;
  provenance?: string;
}): OrganizationAlias | null {
  const org = organizations.get(params.organization_id);
  if (!org) return null;

  const id = generateId("oa", { value: orgIdCounter++ });
  const now = new Date().toISOString();
  const alias: OrganizationAlias = {
    id,
    organization_id: params.organization_id,
    alias: params.alias.trim(),
    context: params.context ?? null,
    confidence: params.confidence ?? "medium",
    created_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  orgAliases.set(id, alias);
  org.aliases.push(alias);
  return alias;
}

// ─── Role Assignments ────────────────────────────────────────────────────────

export function assignRole(params: {
  person_id: string;
  care_recipient_id?: string | null;
  organization_id?: string | null;
  role_type: RoleAssignment["role_type"];
  role_subtype?: string | null;
  is_primary?: boolean;
  confidence?: ConfidenceLevel;
  start_date?: string | null;
  end_date?: string | null;
  evidence?: string[];
  status?: EntityStatus;
  source?: SourceType;
  provenance?: string;
  created_by: string;
}): RoleAssignment | null {
  const person = persons.get(params.person_id);
  if (!person) return null;

  if (params.care_recipient_id) {
    const recipient = persons.get(params.care_recipient_id);
    if (!recipient) return null;
  }

  if (params.organization_id) {
    const org = organizations.get(params.organization_id);
    if (!org) return null;
  }

  const id = generateId("ra", { value: roleIdCounter++ });
  const now = new Date().toISOString();
  const assignment: RoleAssignment = {
    id,
    person_id: params.person_id,
    care_recipient_id: params.care_recipient_id ?? null,
    organization_id: params.organization_id ?? null,
    role_type: params.role_type,
    role_subtype: params.role_subtype ?? null,
    is_primary: params.is_primary ?? false,
    confidence: params.confidence ?? "medium",
    start_date: params.start_date ?? null,
    end_date: params.end_date ?? null,
    status: params.status ?? "active",
    evidence: params.evidence ?? [],
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  roleAssignments.set(id, assignment);
  return assignment;
}

export function getRolesForPerson(personId: string): RoleAssignment[] {
  return [...roleAssignments.values()].filter((r) => r.person_id === personId && r.status === "active");
}

export function getRolesForCareRecipient(careRecipientId: string): RoleAssignment[] {
  return [...roleAssignments.values()].filter(
    (r) => r.care_recipient_id === careRecipientId && r.status === "active",
  );
}

export function getPrimaryCaregiver(careRecipientId: string): RoleAssignment | null {
  const roles = getRolesForCareRecipient(careRecipientId);
  return roles.find((r) => r.role_type === "primary_caregiver" && r.is_primary) ?? null;
}

export function deactivateRole(roleId: string, endDate?: string): RoleAssignment | null {
  const assignment = roleAssignments.get(roleId);
  if (!assignment) return null;

  const updated: RoleAssignment = {
    ...assignment,
    status: "inactive",
    end_date: endDate ?? new Date().toISOString().split("T")[0]!,
    updated_at: new Date().toISOString(),
  };

  roleAssignments.set(roleId, updated);
  return updated;
}

// ─── Relationships ───────────────────────────────────────────────────────────

export function createRelationship(params: {
  person_a_id: string;
  person_b_id: string;
  relationship_type: Relationship["relationship_type"];
  inverse_relationship_type: Relationship["inverse_relationship_type"];
  direction?: Relationship["direction"];
  confidence?: ConfidenceLevel;
  confidence_score?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  evidence?: string[];
  perspective?: string | null;
  source?: SourceType;
  provenance?: string;
  created_by: string;
}): Relationship | null {
  const personA = persons.get(params.person_a_id);
  const personB = persons.get(params.person_b_id);
  if (!personA || !personB) return null;

  const id = generateId("rel", { value: relationshipIdCounter++ });
  const now = new Date().toISOString();
  const relationship: Relationship = {
    id,
    person_a_id: params.person_a_id,
    person_b_id: params.person_b_id,
    relationship_type: params.relationship_type,
    inverse_relationship_type: params.inverse_relationship_type,
    direction: params.direction ?? "a_to_b",
    confidence: params.confidence ?? "medium",
    confidence_score: params.confidence_score ?? null,
    start_date: params.start_date ?? null,
    end_date: params.end_date ?? null,
    status: "active",
    evidence: params.evidence ?? [],
    perspective: params.perspective ?? null,
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  relationships.set(id, relationship);
  return relationship;
}

export function getRelationshipsForPerson(personId: string): Relationship[] {
  return [...relationships.values()].filter(
    (r) =>
      (r.person_a_id === personId || r.person_b_id === personId) &&
      r.status === "active",
  );
}

// ─── Provider Affiliations ───────────────────────────────────────────────────

export function createProviderAffiliation(params: {
  provider_person_id: string;
  organization_id: string;
  affiliation_type?: ProviderAffiliation["affiliation_type"];
  start_date?: string | null;
  end_date?: string | null;
  confidence?: ConfidenceLevel;
  evidence?: string[];
  status?: EntityStatus;
  source?: SourceType;
  provenance?: string;
  created_by: string;
}): ProviderAffiliation | null {
  const provider = persons.get(params.provider_person_id);
  const org = organizations.get(params.organization_id);
  if (!provider || !org) return null;

  const id = generateId("pa", { value: affiliationIdCounter++ });
  const now = new Date().toISOString();
  const affiliation: ProviderAffiliation = {
    id,
    provider_person_id: params.provider_person_id,
    organization_id: params.organization_id,
    affiliation_type: params.affiliation_type ?? "works_at",
    start_date: params.start_date ?? null,
    end_date: params.end_date ?? null,
    status: params.status ?? "active",
    confidence: params.confidence ?? "medium",
    evidence: params.evidence ?? [],
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  affiliations.set(id, affiliation);
  return affiliation;
}

export function getAffiliationsForProvider(providerId: string): ProviderAffiliation[] {
  return [...affiliations.values()].filter(
    (a) => a.provider_person_id === providerId && a.status === "active",
  );
}

// ─── Entity Matches (Resolution) ─────────────────────────────────────────────

export function createEntityMatch(params: {
  entity_a_id: string;
  entity_b_id: string;
  entity_type_a: EntityMatch["entity_type_a"];
  entity_type_b: EntityMatch["entity_type_b"];
  match_outcome: EntityMatchOutcome;
  confidence_score?: number | null;
  match_basis?: string[];
  source?: SourceType;
  provenance?: string;
}): EntityMatch {
  const id = generateId("em", { value: matchIdCounter++ });
  const now = new Date().toISOString();
  const match: EntityMatch = {
    id,
    entity_a_id: params.entity_a_id,
    entity_b_id: params.entity_b_id,
    entity_type_a: params.entity_type_a,
    entity_type_b: params.entity_type_b,
    match_outcome: params.match_outcome,
    confidence_score: params.confidence_score ?? null,
    match_basis: params.match_basis ?? [],
    resolved: params.match_outcome === "CONFIRMED_MATCH",
    resolved_at: params.match_outcome === "CONFIRMED_MATCH" ? now : null,
    resolved_by: params.match_outcome === "CONFIRMED_MATCH" ? "system" : null,
    created_at: now,
    updated_at: now,
    source: params.source ?? "inferred",
    provenance: params.provenance ?? "Initial creation",
  };

  entityMatches.set(id, match);
  return match;
}

export function resolveEntityMatch(
  matchId: string,
  outcome: EntityMatchOutcome,
  resolvedBy: string,
): EntityMatch | null {
  const match = entityMatches.get(matchId);
  if (!match) return null;

  const now = new Date().toISOString();
  const updated: EntityMatch = {
    ...match,
    match_outcome: outcome,
    resolved: outcome === "CONFIRMED_MATCH",
    resolved_at: outcome === "CONFIRMED_MATCH" ? now : null,
    resolved_by: outcome === "CONFIRMED_MATCH" ? resolvedBy : null,
    updated_at: now,
  };

  entityMatches.set(matchId, updated);
  return updated;
}

export function getEntityMatchesForEntity(entityId: string): EntityMatch[] {
  return [...entityMatches.values()].filter(
    (m) => m.entity_a_id === entityId || m.entity_b_id === entityId,
  );
}

// ─── Care Recipient Assignments ──────────────────────────────────────────────

export function assignCareRecipient(params: {
  care_recipient_person_id: string;
  care_record_id: string;
  is_authoritative?: boolean;
  evidence?: string[];
  confidence?: ConfidenceLevel;
  source?: SourceType;
  provenance?: string;
  assigned_by: string;
}): CareRecipientAssignment | null {
  const recipient = persons.get(params.care_recipient_person_id);
  if (!recipient) return null;

  const id = generateId("cra", { value: 1 });
  const now = new Date().toISOString();
  const assignment: CareRecipientAssignment = {
    id,
    care_recipient_person_id: params.care_recipient_person_id,
    care_record_id: params.care_record_id,
    assigned_at: now,
    assigned_by: params.assigned_by,
    is_authoritative: params.is_authoritative ?? false,
    evidence: params.evidence ?? [],
    confidence: params.confidence ?? "medium",
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  careRecipientAssignments.set(id, assignment);
  return assignment;
}

export function getCareRecipientForCareRecord(careRecordId: string): CareRecipientAssignment | null {
  return [...careRecipientAssignments.values()].find(
    (a) => a.care_record_id === careRecordId && a.is_authoritative,
  ) ?? null;
}

// ─── Document Subject Resolutions ────────────────────────────────────────────

export function resolveDocumentSubject(params: {
  document_id: string;
  care_recipient_person_id?: string | null;
  author_person_id?: string | null;
  provider_person_id?: string | null;
  organization_id?: string | null;
  uploader_person_id?: string | null;
  mentioned_person_ids?: string[];
  mentioned_organization_ids?: string[];
  subject_confidence?: ConfidenceLevel;
  subject_confidence_score?: number | null;
  is_ambiguous?: boolean;
  ambiguity_reason?: string | null;
  source?: SourceType;
  provenance?: string;
}): DocumentSubjectResolution {
  const id = generateId("dsr", { value: 1 });
  const now = new Date().toISOString();
  const resolution: DocumentSubjectResolution = {
    id,
    document_id: params.document_id,
    care_recipient_person_id: params.care_recipient_person_id ?? null,
    author_person_id: params.author_person_id ?? null,
    provider_person_id: params.provider_person_id ?? null,
    organization_id: params.organization_id ?? null,
    uploader_person_id: params.uploader_person_id ?? null,
    mentioned_person_ids: params.mentioned_person_ids ?? [],
    mentioned_organization_ids: params.mentioned_organization_ids ?? [],
    subject_confidence: params.subject_confidence ?? "unknown",
    subject_confidence_score: params.subject_confidence_score ?? null,
    is_ambiguous: params.is_ambiguous ?? false,
    ambiguity_reason: params.ambiguity_reason ?? null,
    created_at: now,
    updated_at: now,
    source: params.source ?? "user_input",
    provenance: params.provenance ?? "Initial creation",
  };

  documentSubjectResolutions.set(id, resolution);
  return resolution;
}

export function getDocumentSubjectResolution(documentId: string): DocumentSubjectResolution | null {
  return [...documentSubjectResolutions.values()].find((r) => r.document_id === documentId) ?? null;
}

// ─── Professional Summary CRUD ─────────────────────────────────────────────────────

export function createProfessionalSummary(params: {
  care_recipient_id: string;
  authoring_caregiver_id: string;
  intended_professional_id?: string | null;
  purpose_context?: string | null;
  care_context_version: string;
  source_evidence_references: string[];
  generated_content: string;
  created_by: string;
}): ProfessionalSummary {
  const id = generateId("ps", { value: professionalSummaryIdCounter++ });
  const now = new Date().toISOString();
  const professionalSummary: ProfessionalSummary = {
    id,
    care_recipient_id: params.care_recipient_id,
    authoring_caregiver_id: params.authoring_caregiver_id,
    intended_professional_id: params.intended_professional_id ?? null,
    purpose_context: params.purpose_context ?? null,
    status: "DRAFT",
    care_context_version: params.care_context_version,
    source_evidence_references: params.source_evidence_references,
    generated_content: params.generated_content,
    caregiver_corrections: [],
    approval_info: null,
    sharing_info: null,
    professional_response: null,
    resulting_evidence_ids: [],
    resulting_decision_ids: [],
    timestamps: {
      created_at: now,
      updated_at: now,
      generated_at: null,
      reviewed_at: null,
      corrected_at: null,
      approved_at: null,
      shared_at: null,
      opened_at: null,
      response_received_at: null,
      superseded_at: null,
    },
    version: 1,
    audit_trail: [
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "created",
        performed_by: params.created_by,
        timestamp: now,
        details: {
          care_recipient_id: params.care_recipient_id,
          authoring_caregiver_id: params.authoring_caregiver_id,
        },
      },
    ],
  };

  professionalSummaries.set(id, professionalSummary);
  return professionalSummary;
}

export function getProfessionalSummary(id: string): ProfessionalSummary | null {
  return professionalSummaries.get(id) ?? null;
}

export function updateProfessionalSummary(id: string, updates: Partial<ProfessionalSummary>): ProfessionalSummary | null {
  const existing = professionalSummaries.get(id);
  if (!existing) return null;

  const updated: ProfessionalSummary = {
    ...existing,
    ...updates,
    id: existing.id,
    version: existing.version + 1,
    updated_at: new Date().toISOString(),
    audit_trail: [
      ...existing.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "updated",
        performed_by: updates.updated_by ?? "system",
        timestamp: new Date().toISOString(),
        details: {
          changed_fields: Object.keys(updates),
        },
      },
    ],
  };

  professionalSummaries.set(id, updated);
  return updated;
}

export function deleteProfessionalSummary(id: string): boolean {
  return professionalSummaries.delete(id);
}

export function listProfessionalSummaries(): ProfessionalSummary[] {
  return [...professionalSummaries.values()];
}

export function addProfessionalSummaryCorrection(params: {
  professional_summary_id: string;
  field: string;
  original_content: string;
  corrected_content: string;
  correcting_caregiver_id: string;
  reason?: string | null;
  source_evidence_references?: string[];
}): ProfessionalSummaryCorrection | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;

  const id = generateId("psc", { value: correctionIdCounter++ });
  const now = new Date().toISOString();
  const correction: ProfessionalSummaryCorrection = {
    id,
    field: params.field,
    original_content: params.original_content,
    corrected_content: params.corrected_content,
    correcting_caregiver_id: params.correcting_caregiver_id,
    timestamp: now,
    reason: params.reason ?? null,
    source_evidence_references: params.source_evidence_references ?? [],
  };

  professionalSummaryCorrections.set(id, correction);
  
  // Update the professional summary with the correction
  const updatedSummary = {
    ...professionalSummary,
    caregiver_corrections: [...professionalSummary.caregiver_corrections, correction],
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "corrected",
        performed_by: params.correcting_caregiver_id,
        timestamp: now,
        details: {
          field: params.field,
          correction_id: id,
        },
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return correction;
}

export function approveProfessionalSummary(params: {
  professional_summary_id: string;
  approving_caregiver_id: string;
}): ProfessionalSummaryApproval | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;

  const id = generateId("psa", { value: approvalIdCounter++ });
  const now = new Date().toISOString();
  const approval: ProfessionalSummaryApproval = {
    approving_caregiver_id: params.approving_caregiver_id,
    timestamp: now,
    version_approved: professionalSummary.version,
  };

  professionalSummaryApprovals.set(id, approval);
  
  // Update the professional summary with approval info
  const updatedSummary = {
    ...professionalSummary,
    status: "APPROVED",
    approval_info: approval,
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "approved",
        performed_by: params.approving_caregiver_id,
        timestamp: now,
        details: {
          approval_id: id,
          version_approved: approval.version_approved,
        },
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return approval;
}

export function shareProfessionalSummary(params: {
  professional_summary_id: string;
  shared_by: string;
  shared_with_professional_id: string;
}): ProfessionalSummarySharing | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;
  
  // Can only share approved summaries
  if (professionalSummary.status !== "APPROVED") return null;

  const id = generateId("pssh", { value: sharingIdCounter++ });
  const now = new Date().toISOString();
  const sharing: ProfessionalSummarySharing = {
    shared_by: params.shared_by,
    timestamp: now,
    shared_with_professional_id: params.shared_with_professional_id,
    summary_version_shared: professionalSummary.version,
    access_granted_at: now,
    access_revoked_at: null,
  };

  professionalSummarySharings.set(id, sharing);
  
  // Update the professional summary with sharing info
  const updatedSummary = {
    ...professionalSummary,
    status: "SHARED",
    sharing_info: sharing,
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "shared",
        performed_by: params.shared_by,
        timestamp: now,
        details: {
          sharing_id: id,
          shared_with: params.shared_with_professional_id,
        },
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return sharing;
}

export function recordProfessionalSummaryResponse(params: {
  professional_summary_id: string;
  responding_professional_id: string;
  response_text: string;
  response_type: "clarification" | "comment" | "recommendation" | "decision" | "follow_up_request" | "additional_information" | "acknowledgment";
  is_decision?: boolean;
  decision_text?: string | null;
}): ProfessionalSummaryResponse | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;
  
  // Can only respond to shared summaries that have been opened
  if (professionalSummary.status !== "SHARED" && professionalSummary.status !== "OPENED") return null;

  const id = generateId("psr", { value: responseIdCounter++ });
  const now = new Date().toISOString();
  const response: ProfessionalSummaryResponse = {
    responding_professional_id: params.responding_professional_id,
    timestamp: now,
    response_text: params.response_text,
    response_type: params.response_type,
    is_decision: params.is_decision ?? false,
    decision_text: params.decision_text ?? null,
  };

  professionalSummaryResponses.set(id, response);
  
  // Update the professional summary with response info
  let newStatus: ProfessionalSummaryStatus = "RESPONSE_RECEIVED";
  let resultingEvidenceIds: string[] = [...professionalSummary.resulting_evidence_ids];
  let resultingDecisionIds: string[] = [...professionalSummary.resulting_decision_ids];
  
  // If the response contains a decision, create evidence and decision records
  if (params.is_decision && params.decision_text) {
    // Create evidence record for the professional response
    const evidenceId = generateId("ev", { value: 1 }); // Simplified - in reality would use evidence store
    resultingEvidenceIds.push(evidenceId);
    
    // Create decision record from the professional response
    const decisionId = generateId("dec", { value: 1 }); // Simplified - in reality would use decision store
    resultingDecisionIds.push(decisionId);
    
    newStatus = "RESPONSE_RECEIVED"; // Would lead to CareContext update in real implementation
  }

  const updatedSummary = {
    ...professionalSummary,
    status: newStatus,
    professional_response: response,
    resulting_evidence_ids: resultingEvidenceIds,
    resulting_decision_ids: resultingDecisionIds,
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "professional_responded",
        performed_by: params.responding_professional_id,
        timestamp: now,
        details: {
          response_id: id,
          response_type: params.response_type,
          is_decision: params.is_decision ?? false,
        },
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return response;
}

export function openProfessionalSummary(params: {
  professional_summary_id: string;
  opened_by: string; // The professional who opened it
}): ProfessionalSummary | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;
  
  // Can only open shared summaries
  if (professionalSummary.status !== "SHARED") return null;

  const now = new Date().toISOString();
  const updatedSummary = {
    ...professionalSummary,
    status: "OPENED",
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "opened",
        performed_by: params.opened_by,
        timestamp: now,
        details: {},
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return updatedSummary;
}

export function supersedeProfessionalSummary(params: {
  professional_summary_id: string;
  superseded_by: string; // The caregiver who superseded it (usually by creating a new one)
}): ProfessionalSummary | null {
  const professionalSummary = professionalSummaries.get(params.professional_summary_id);
  if (!professionalSummary) return null;

  const now = new Date().toISOString();
  const updatedSummary = {
    ...professionalSummary,
    status: "SUPERSEDED",
    version: professionalSummary.version + 1,
    updated_at: now,
    audit_trail: [
      ...professionalSummary.audit_trail,
      {
        id: generateId("psa", { value: auditIdCounter++ }),
        action: "superseded",
        performed_by: params.superseded_by,
        timestamp: now,
        details: {
          reason: "Newer summary created",
        },
      },
    ],
  };

  professionalSummaries.set(params.professional_summary_id, updatedSummary);
  return updatedSummary;
}

// ─── Reset for Tests ─────────────────────────────────────────────────────────

export function resetEntityStore(): void {
  persons.clear();
  aliases.clear();
  roleAssignments.clear();
  relationships.clear();
  organizations.clear();
  orgAliases.clear();
  affiliations.clear();
  entityMatches.clear();
  careRecipientAssignments.clear();
  documentSubjectResolutions.clear();
  professionalSummaries.clear();
  professionalSummaryCorrections.clear();
  professionalSummaryApprovals.clear();
  professionalSummarySharings.clear();
  professionalSummaryResponses.clear();
  professionalSummaryAuditTrail.clear();
  personIdCounter = 1;
  aliasIdCounter = 1;
  roleIdCounter = 1;
  relationshipIdCounter = 1;
  orgIdCounter = 1;
  affiliationIdCounter = 1;
  matchIdCounter = 1;
  professionalSummaryIdCounter = 1;
  correctionIdCounter = 1;
  approvalIdCounter = 1;
  sharingIdCounter = 1;
  responseIdCounter = 1;
  auditIdCounter = 1;
}
