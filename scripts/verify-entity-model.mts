import {
  createPerson,
  addPersonAlias,
  findPersonByAlias,
  assignRole,
  getRolesForPerson,
  getPrimaryCaregiver,
  createRelationship,
  getRelationshipsForPerson,
  createOrganization,
  createProviderAffiliation,
  createEntityMatch,
  resolveEntityMatch,
  assignCareRecipient,
  resolveDocumentSubject,
  resetEntityStore,
} from "@/lib/entities/store";
import type {
  Person,
  RoleAssignment,
  Relationship,
  Organization,
  ProviderAffiliation,
  EntityMatch,
  CareRecipientAssignment,
  DocumentSubjectResolution,
} from "@/lib/entities/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertIncludes<T>(arr: T[], item: T, message: string): void {
  if (!arr.includes(item)) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Array: ${JSON.stringify(arr)}\n  Missing: ${item}`);
  }
}

// ─── Test Suite: Person Identity ─────────────────────────────────────────────

function testPersonCreation(): void {
  resetEntityStore();

  const person = createPerson({
    display_name: "Mom",
    legal_full_name: "Mary Adeyemi",
    preferred_name: "Mary",
    identity_confidence: "probable",
    created_by: "system",
  });

  assert(person.id.length > 0, "Person ID should be non-empty");
  assertEqual(person.display_name, "Mom", "Display name should match");
  assertEqual(person.legal_full_name, "Mary Adeyemi", "Legal name should match");
  assertEqual(person.preferred_name, "Mary", "Preferred name should match");
  assertEqual(person.identity_confidence, "probable", "Identity confidence should match");
  assertEqual(person.status, "active", "Status should default to active");
  assertEqual(person.aliases.length, 0, "Aliases should start empty");
  assert(person.created_at <= new Date().toISOString(), "Created at should be <= now");
}

function testPersonAliases(): void {
  resetEntityStore();

  const person = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  const alias1 = addPersonAlias({
    person_id: person.id,
    alias: "Mum",
    alias_type: "kinship",
    confidence: "high",
    is_primary: false,
  });

  const alias2 = addPersonAlias({
    person_id: person.id,
    alias: "Mary",
    alias_type: "informal",
    confidence: "medium",
    is_primary: false,
  });

  assert(alias1 !== null, "First alias should be created");
  assert(alias2 !== null, "Second alias should be created");
  assertEqual(alias1!.alias, "Mum", "First alias text should match");
  assertEqual(alias2!.alias, "Mary", "Second alias text should match");
  assertEqual(person.aliases.length, 2, "Person should have 2 aliases");
}

function testFindPersonByAlias(): void {
  resetEntityStore();

  const person = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  addPersonAlias({
    person_id: person.id,
    alias: "Mum",
    alias_type: "kinship",
    confidence: "high",
  });

  const foundByDisplay = findPersonByAlias("Mom");
  const foundByAlias = findPersonByAlias("Mum");
  const notFound = findPersonByAlias("Dad");

  assert(foundByDisplay !== null, "Should find by display name");
  assertEqual(foundByDisplay!.id, person.id, "Found person ID should match");
  assert(foundByAlias !== null, "Should find by alias");
  assertEqual(foundByAlias!.id, person.id, "Found person ID should match");
  assertEqual(notFound, null, "Should not find non-existent alias");
}

// ─── Test Suite: Role Assignments ────────────────────────────────────────────

function testRoleAssignments(): void {
  resetEntityStore();

  const careRecipient = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  const caregiver = createPerson({
    display_name: "Jane",
    created_by: "system",
  });

  const careRecipientRole = assignRole({
    person_id: careRecipient.id,
    role_type: "care_recipient",
    is_primary: true,
    confidence: "certain",
    evidence: ["Display name: Mom"],
    created_by: "system",
  });

  const caregiverRole = assignRole({
    person_id: caregiver.id,
    care_recipient_id: careRecipient.id,
    role_type: "primary_caregiver",
    is_primary: true,
    confidence: "certain",
    evidence: ["Daughter of Mom"],
    created_by: "system",
  });

  const familyRole = assignRole({
    person_id: caregiver.id,
    care_recipient_id: careRecipient.id,
    role_type: "daughter",
    is_primary: true,
    confidence: "certain",
    created_by: "system",
  });

  assert(careRecipientRole !== null, "Care recipient role should be created");
  assert(caregiverRole !== null, "Caregiver role should be created");
  assert(familyRole !== null, "Family role should be created");

  const rolesForCaregiver = getRolesForPerson(caregiver.id);
  assertEqual(rolesForCaregiver.length, 2, "Caregiver should have 2 roles");

  const rolesForRecipient = getRolesForCareRecipient(careRecipient.id);
  assertEqual(rolesForRecipient.length, 1, "Care recipient should have 1 role");

  const primaryCaregiver = getPrimaryCaregiver(careRecipient.id);
  assert(primaryCaregiver !== null, "Primary caregiver should be found");
  assertEqual(primaryCaregiver!.person_id, caregiver.id, "Primary caregiver should be Jane");
}

// ─── Test Suite: Relationships ───────────────────────────────────────────────

function testRelationships(): void {
  resetEntityStore();

  const mother = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  const daughter = createPerson({
    display_name: "Jane",
    created_by: "system",
  });

  const relationship = createRelationship({
    person_a_id: daughter.id,
    person_b_id: mother.id,
    relationship_type: "daughter",
    inverse_relationship_type: "mother",
    direction: "a_to_b",
    confidence: "certain",
    evidence: ["Daughter of Mom"],
    created_by: "system",
  });

  assert(relationship !== null, "Relationship should be created");
  assertEqual(relationship!.person_a_id, daughter.id, "Person A should be daughter");
  assertEqual(relationship!.person_b_id, mother.id, "Person B should be mother");
  assertEqual(relationship!.relationship_type, "daughter", "Relationship type should be daughter");

  const daughterRelationships = getRelationshipsForPerson(daughter.id);
  assertEqual(daughterRelationships.length, 1, "Daughter should have 1 relationship");

  const motherRelationships = getRelationshipsForPerson(mother.id);
  assertEqual(motherRelationships.length, 1, "Mother should have 1 relationship");
}

// ─── Test Suite: Organizations ───────────────────────────────────────────────

function testOrganizations(): void {
  resetEntityStore();

  const hospital = createOrganization({
    name: "Memorial Hospital",
    organization_type: "hospital",
    confidence: "certain",
    created_by: "system",
  });

  assertEqual(hospital.name, "Memorial Hospital", "Organization name should match");
  assertEqual(hospital.organization_type, "hospital", "Organization type should match");
  assertEqual(hospital.status, "active", "Status should default to active");

  const found = findOrganizationByName("Memorial Hospital");
  assert(found !== null, "Should find organization by name");
  assertEqual(found!.id, hospital.id, "Found organization ID should match");
}

// ─── Test Suite: Entity Matches ──────────────────────────────────────────────

function testEntityMatches(): void {
  resetEntityStore();

  const personA = createPerson({
    display_name: "Dr. Smith",
    created_by: "system",
  });

  const personB = createPerson({
    display_name: "Dr. Michael Smith",
    created_by: "system",
  });

  const match = createEntityMatch({
    entity_a_id: personA.id,
    entity_b_id: personB.id,
    entity_type_a: "person",
    entity_type_b: "person",
    match_outcome: "PROBABLE_MATCH",
    confidence_score: 0.61,
    match_basis: ["same cardiology clinic", "same appointment context"],
    source: "inferred",
  });

  assert(match !== null, "Entity match should be created");
  assertEqual(match!.match_outcome, "PROBABLE_MATCH", "Match outcome should be PROBABLE_MATCH");
  assertEqual(match!.confidence_score, 0.61, "Confidence score should match");
  assertEqual(match!.resolved, false, "PROBABLE_MATCH should not be auto-resolved");

  const resolved = resolveEntityMatch(match.id, "CONFIRMED_MATCH", "admin");
  assert(resolved !== null, "Match should be resolvable");
  assertEqual(resolved!.resolved, true, "Resolved match should have resolved=true");
  assertEqual(resolved!.match_outcome, "CONFIRMED_MATCH", "Outcome should be CONFIRMED_MATCH");
}

// ─── Test Suite: Care Recipient Assignments ──────────────────────────────────

function testCareRecipientAssignments(): void {
  resetEntityStore();

  const recipient = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  const assignment = assignCareRecipient({
    care_recipient_person_id: recipient.id,
    care_record_id: "cr_001",
    is_authoritative: true,
    confidence: "certain",
    evidence: ["Display name: Mom"],
    assigned_by: "system",
  });

  assert(assignment !== null, "Care recipient assignment should be created");
  assertEqual(assignment!.care_recipient_person_id, recipient.id, "Recipient ID should match");
  assertEqual(assignment!.care_record_id, "cr_001", "Care record ID should match");
  assertEqual(assignment!.is_authoritative, true, "Should be authoritative");

  const found = getCareRecipientForCareRecord("cr_001");
  assert(found !== null, "Should find care recipient for care record");
  assertEqual(found!.care_recipient_person_id, recipient.id, "Found recipient ID should match");
}

// ─── Test Suite: Document Subject Resolutions ────────────────────────────────

function testDocumentSubjectResolutions(): void {
  resetEntityStore();

  const resolution = resolveDocumentSubject({
    document_id: "doc_001",
    care_recipient_person_id: "p_mom_001",
    author_person_id: "p_dr_smith_001",
    provider_person_id: "p_dr_smith_001",
    organization_id: "org_hospital_001",
    uploader_person_id: "p_daughter_001",
    mentioned_person_ids: ["p_mom_001", "p_dad_001"],
    mentioned_organization_ids: ["org_pharmacy_001"],
    subject_confidence: "probable",
    is_ambiguous: false,
    source: "document",
  });

  assertEqual(resolution.document_id, "doc_001", "Document ID should match");
  assertEqual(resolution.care_recipient_person_id, "p_mom_001", "Care recipient should match");
  assertEqual(resolution.author_person_id, "p_dr_smith_001", "Author should match");
  assertEqual(resolution.subject_confidence, "probable", "Confidence should match");
  assertEqual(resolution.is_ambiguous, false, "Should not be ambiguous");

  const found = getDocumentSubjectResolution("doc_001");
  assert(found !== null, "Should find document subject resolution");
  assertEqual(found!.provider_person_id, "p_dr_smith_001", "Provider should match");
}

// ─── Test Suite: Provider Affiliations ───────────────────────────────────────

function testProviderAffiliations(): void {
  resetEntityStore();

  const provider = createPerson({
    display_name: "Dr. Smith",
    created_by: "system",
  });

  const hospital = createOrganization({
    name: "Memorial Hospital",
    organization_type: "hospital",
    created_by: "system",
  });

  const affiliation = createProviderAffiliation({
    provider_person_id: provider.id,
    organization_id: hospital.id,
    affiliation_type: "works_at",
    confidence: "certain",
    created_by: "system",
  });

  assert(affiliation !== null, "Provider affiliation should be created");
  assertEqual(affiliation!.provider_person_id, provider.id, "Provider ID should match");
  assertEqual(affiliation!.organization_id, hospital.id, "Organization ID should match");

  const affiliations = getAffiliationsForProvider(provider.id);
  assertEqual(affiliations.length, 1, "Provider should have 1 affiliation");
  assertEqual(affiliations[0]!.organization_id, hospital.id, "Affiliation org should match");
}

// ─── Test Suite: Critical Identity Assumption Prevention ─────────────────────

function testCriticalIdentityAssumptionPrevention(): void {
  resetEntityStore();

  // The critical bug: contributor ID was silently used as care recipient ID
  // This test verifies that the entity model prevents this

  const caregiver = createPerson({
    display_name: "Jane",
    created_by: "system",
  });

  // Jane should NOT automatically be a care recipient
  const roles = getRolesForPerson(caregiver.id);
  const careRecipientRoles = roles.filter((r) => r.role_type === "care_recipient");
  assertEqual(careRecipientRoles.length, 0, "Caregiver should NOT automatically be a care recipient");

  // Jane must be explicitly assigned as a caregiver
  const recipient = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  assignRole({
    person_id: caregiver.id,
    care_recipient_id: recipient.id,
    role_type: "primary_caregiver",
    created_by: "system",
  });

  const updatedRoles = getRolesForPerson(caregiver.id);
  const caregiverRoles = updatedRoles.filter((r) => r.role_type === "primary_caregiver");
  assertEqual(caregiverRoles.length, 1, "Caregiver should have caregiver role after explicit assignment");
}

// ─── Test Suite: Person Boundary Enforcement ─────────────────────────────────

function testPersonBoundaryEnforcement(): void {
  resetEntityStore();

  // Scenario: "Mom's blood pressure is 145/90. Dad's medication was changed yesterday."
  // SolenOS must NOT merge Mom and Dad into one care state

  const mom = createPerson({
    display_name: "Mom",
    created_by: "system",
  });

  const dad = createPerson({
    display_name: "Dad",
    created_by: "system",
  });

  // Each person must have their own separate identity
  assert(mom.id !== dad.id, "Mom and Dad must have different IDs");

  // Each person can have their own care recipient assignment
  assignCareRecipient({
    care_recipient_person_id: mom.id,
    care_record_id: "cr_mom",
    assigned_by: "system",
  });

  assignCareRecipient({
    care_recipient_person_id: dad.id,
    care_record_id: "cr_dad",
    assigned_by: "system",
  });

  const momAssignment = getCareRecipientForCareRecord("cr_mom");
  const dadAssignment = getCareRecipientForCareRecord("cr_dad");

  assert(momAssignment !== null, "Mom should have care record");
  assert(dadAssignment !== null, "Dad should have care record");
  assertEqual(momAssignment!.care_recipient_person_id, mom.id, "Mom's record should be Mom");
  assertEqual(dadAssignment!.care_recipient_person_id, dad.id, "Dad's record should be Dad");
}

// ─── Run All Tests ───────────────────────────────────────────────────────────

function runAllTests(): void {
  const tests = [
    testPersonCreation,
    testPersonAliases,
    testFindPersonByAlias,
    testRoleAssignments,
    testRelationships,
    testOrganizations,
    testEntityMatches,
    testCareRecipientAssignments,
    testDocumentSubjectResolutions,
    testProviderAffiliations,
    testCriticalIdentityAssumptionPrevention,
    testPersonBoundaryEnforcement,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
      console.log(`PASS: ${test.name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL: ${test.name}\n  ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
