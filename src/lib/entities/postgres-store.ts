import type { Pool } from "pg";
import type {
  Person,
  PersonAlias,
  RoleAssignment,
  Relationship,
  Organization,
  OrganizationAlias,
  ProviderAffiliation,
  EntityMatch,
  CareRecipientAssignment,
  DocumentSubjectResolution,
  ConfidenceLevel,
  SourceType,
} from "./types";

let poolPromise: Promise<Pool> | null = null;

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    const { Pool } = await import("pg");
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for Postgres entity store");
    }
    poolPromise = Promise.resolve(new Pool({ connectionString, max: 4 }));
  }
  return poolPromise;
}

export function resetEntityPoolForTests(): void {
  poolPromise = null;
}

function personToRow(person: Person): Record<string, unknown> {
  return {
    id: person.id,
    stable_internal_id: person.stable_internal_id ?? person.id,
    display_name: person.display_name,
    legal_full_name: person.legal_full_name,
    preferred_name: person.preferred_name,
    date_of_birth: person.date_of_birth,
    approximate_age: person.approximate_age,
    sex_gender: person.sex_gender,
    contact_info: JSON.stringify(person.contact_info),
    address: person.address,
    demographic_context: JSON.stringify(person.demographic_context),
    identity_confidence: person.identity_confidence,
    identity_confidence_score: person.identity_confidence_score,
    status: person.status,
    created_at: person.created_at,
    updated_at: person.updated_at,
    created_by: person.created_by,
    updated_by: person.updated_by,
    source: person.source,
    provenance: person.provenance,
  };
}

function aliasToRow(alias: PersonAlias): Record<string, unknown> {
  return {
    id: alias.id,
    person_id: alias.person_id,
    alias: alias.alias,
    alias_type: alias.alias_type,
    context: alias.context,
    confidence: alias.confidence,
    is_primary: alias.is_primary,
    created_at: alias.created_at,
    source: alias.source,
    provenance: alias.provenance,
  };
}

function roleToRow(role: RoleAssignment): Record<string, unknown> {
  return {
    id: role.id,
    person_id: role.person_id,
    care_recipient_id: role.care_recipient_id,
    organization_id: role.organization_id,
    role_type: role.role_type,
    role_subtype: role.role_subtype,
    is_primary: role.is_primary,
    confidence: role.confidence,
    start_date: role.start_date,
    end_date: role.end_date,
    status: role.status,
    evidence: JSON.stringify(role.evidence),
    created_at: role.created_at,
    updated_at: role.updated_at,
    source: role.source,
    provenance: role.provenance,
  };
}

function relationshipToRow(rel: Relationship): Record<string, unknown> {
  return {
    id: rel.id,
    person_a_id: rel.person_a_id,
    person_b_id: rel.person_b_id,
    relationship_type: rel.relationship_type,
    inverse_relationship_type: rel.inverse_relationship_type,
    direction: rel.direction,
    confidence: rel.confidence,
    confidence_score: rel.confidence_score,
    start_date: rel.start_date,
    end_date: rel.end_date,
    status: rel.status,
    evidence: JSON.stringify(rel.evidence),
    perspective: rel.perspective,
    created_at: rel.created_at,
    updated_at: rel.updated_at,
    source: rel.source,
    provenance: rel.provenance,
  };
}

function organizationToRow(org: Organization): Record<string, unknown> {
  return {
    id: org.id,
    stable_internal_id: org.stable_internal_id ?? org.id,
    name: org.name,
    organization_type: org.organization_type,
    address: org.address,
    contact_info: JSON.stringify(org.contact_info),
    identifiers: JSON.stringify(org.identifiers),
    confidence: org.confidence,
    confidence_score: org.confidence_score,
    status: org.status,
    created_at: org.created_at,
    updated_at: org.updated_at,
    source: org.source,
    provenance: org.provenance,
  };
}

function orgAliasToRow(alias: OrganizationAlias): Record<string, unknown> {
  return {
    id: alias.id,
    organization_id: alias.organization_id,
    alias: alias.alias,
    context: alias.context,
    confidence: alias.confidence,
    created_at: alias.created_at,
    source: alias.source,
    provenance: alias.provenance,
  };
}

function affiliationToRow(aff: ProviderAffiliation): Record<string, unknown> {
  return {
    id: aff.id,
    provider_person_id: aff.provider_person_id,
    organization_id: aff.organization_id,
    affiliation_type: aff.affiliation_type,
    start_date: aff.start_date,
    end_date: aff.end_date,
    status: aff.status,
    confidence: aff.confidence,
    evidence: JSON.stringify(aff.evidence),
    created_at: aff.created_at,
    updated_at: aff.updated_at,
    source: aff.source,
    provenance: aff.provenance,
  };
}

function entityMatchToRow(match: EntityMatch): Record<string, unknown> {
  return {
    id: match.id,
    entity_a_id: match.entity_a_id,
    entity_b_id: match.entity_b_id,
    entity_type_a: match.entity_type_a,
    entity_type_b: match.entity_type_b,
    match_outcome: match.match_outcome,
    confidence_score: match.confidence_score,
    match_basis: JSON.stringify(match.match_basis),
    resolved: match.resolved,
    resolved_at: match.resolved_at,
    resolved_by: match.resolved_by,
    created_at: match.created_at,
    updated_at: match.updated_at,
    source: match.source,
    provenance: match.provenance,
  };
}

function careRecipientAssignmentToRow(assignment: CareRecipientAssignment): Record<string, unknown> {
  return {
    id: assignment.id,
    care_recipient_person_id: assignment.care_recipient_person_id,
    care_record_id: assignment.care_record_id,
    assigned_at: assignment.assigned_at,
    assigned_by: assignment.assigned_by,
    is_authoritative: assignment.is_authoritative,
    evidence: JSON.stringify(assignment.evidence),
    confidence: assignment.confidence,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
    source: assignment.source,
    provenance: assignment.provenance,
  };
}

function documentSubjectResolutionToRow(resolution: DocumentSubjectResolution): Record<string, unknown> {
  return {
    id: resolution.id,
    document_id: resolution.document_id,
    care_recipient_person_id: resolution.care_recipient_person_id,
    author_person_id: resolution.author_person_id,
    provider_person_id: resolution.provider_person_id,
    organization_id: resolution.organization_id,
    uploader_person_id: resolution.uploader_person_id,
    mentioned_person_ids: JSON.stringify(resolution.mentioned_person_ids),
    mentioned_organization_ids: JSON.stringify(resolution.mentioned_organization_ids),
    subject_confidence: resolution.subject_confidence,
    subject_confidence_score: resolution.subject_confidence_score,
    is_ambiguous: resolution.is_ambiguous,
    ambiguity_reason: resolution.ambiguity_reason,
    created_at: resolution.created_at,
    updated_at: resolution.updated_at,
    source: resolution.source,
    provenance: resolution.provenance,
  };
}

export async function persistPersonToPostgres(pool: Pool, person: Person): Promise<void> {
  const row = personToRow(person);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO persons (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistPersonAliasToPostgres(pool: Pool, alias: PersonAlias): Promise<void> {
  const row = aliasToRow(alias);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO person_aliases (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistRoleAssignmentToPostgres(pool: Pool, role: RoleAssignment): Promise<void> {
  const row = roleToRow(role);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO role_assignments (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistRelationshipToPostgres(pool: Pool, rel: Relationship): Promise<void> {
  const row = relationshipToRow(rel);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO relationships (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistOrganizationToPostgres(pool: Pool, org: Organization): Promise<void> {
  const row = organizationToRow(org);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO organizations (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistOrganizationAliasToPostgres(pool: Pool, alias: OrganizationAlias): Promise<void> {
  const row = orgAliasToRow(alias);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO organization_aliases (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistProviderAffiliationToPostgres(pool: Pool, aff: ProviderAffiliation): Promise<void> {
  const row = affiliationToRow(aff);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO provider_affiliations (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistEntityMatchToPostgres(pool: Pool, match: EntityMatch): Promise<void> {
  const row = entityMatchToRow(match);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO entity_matches (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistCareRecipientAssignmentToPostgres(
  pool: Pool,
  assignment: CareRecipientAssignment,
): Promise<void> {
  const row = careRecipientAssignmentToRow(assignment);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO care_recipient_assignments (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function persistDocumentSubjectResolutionToPostgres(
  pool: Pool,
  resolution: DocumentSubjectResolution,
): Promise<void> {
  const row = documentSubjectResolutionToRow(resolution);
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO document_subject_resolutions (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
    values,
  );
}
