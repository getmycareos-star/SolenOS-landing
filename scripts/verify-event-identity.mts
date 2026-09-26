/**
 * verify-event-identity.mts
 * Category 9 — Event Identity & Deduplication verification
 */

import fs from "node:fs";
import path from "node:path";
import {
  resolveEventIdentity,
  resolveEventIdentitiesBatch,
  createEventIdentityContext,
  getEventRealityCount,
  getEvidenceCountForEvent,
  detectExactDuplicates,
  detectSemanticSameEvent,
  detectGenuinelySeparateEvents,
  detectRepeatedObservations,
  detectDocumentVersions,
  detectDuplicateVsUpdate,
  recordDocumentVersion,
  clearDocumentVersions,
  EVENT_IDENTITY_FAILURE_LABELS,
} from "../src/lib/event-identity";
import type { IncomingEvidence, ExistingEvent } from "../src/lib/event-identity/types";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function createIncoming(
  id: string,
  content: string,
  options: Partial<IncomingEvidence> = {},
): IncomingEvidence {
  return {
    id,
    content,
    source_id: "caregiver_1",
    source_type: "caregiver_note",
    captured_at: new Date().toISOString(),
    person_id: "person_1",
    ...options,
  };
}

function createExisting(
  id: string,
  content: string,
  options: Partial<ExistingEvent> = {},
): ExistingEvent {
  return {
    id,
    event_type: "incident",
    label: content.slice(0, 100),
    content,
    occurred_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    person_id: "person_1",
    source_id: "caregiver_1",
    source_type: "caregiver_note",
    entities: ["person_1"],
    attributes: {},
    evidence_ids: [id],
    status: "committed",
    confidence: 0.8,
    ...options,
  };
}

console.log("=== SolenOS Category 9 — Event Identity ===\n");

// 9A — Exact Duplicates
console.log("--- 9A: Exact Duplicates ---");

let existing = [createExisting("evt_1", "Mom fell in the bathroom Tuesday morning. No injury reported.", {
  created_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
})];
let incoming = createIncoming("inc_1", "Mom fell in the bathroom Tuesday morning. No injury reported.", {
  captured_at: new Date(Date.now() + 300000).toISOString(), // 5 min from now = 6 min total diff
});
let context = createEventIdentityContext("person_1", existing);
let result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-001: duplicate caregiver note");
assert(result.confidence >= 0.9, "DUP-001: high confidence");
console.log("✓ DUP-001: Same caregiver note uploaded twice");

existing = [createExisting("evt_1", "Discharge summary content", {
  document_id: "doc_123",
  document_version: 1,
  source_type: "document",
  source_id: "doc_123",
})];
incoming = createIncoming("inc_1", "Discharge summary content", {
  document_id: "doc_123",
  document_version: 1,
  source_type: "document",
  source_id: "doc_123",
});
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-002: duplicate document");
console.log("✓ DUP-002: Same document uploaded twice");

existing = [createExisting("evt_1", "Medication A - 10mg\nMedication B - 20mg", {
  attributes: { medication_list: true },
  source_type: "document",
  source_id: "medlist_1",
  created_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
})];
incoming = createIncoming("inc_1", "Medication A - 10mg\nMedication B - 20mg", {
  extracted_type: "medication_list",
  source_type: "document",
  source_id: "medlist_1",
  captured_at: new Date(Date.now() + 1000).toISOString(),
});
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-003: duplicate medication list");
console.log("✓ DUP-003: Same medication list duplicated");

existing = [createExisting("evt_1", "Dad slept badly last night.", { 
  source_id: "caregiver_1",
  created_at: new Date(Date.now() - 60000).toISOString(),
})];
incoming = createIncoming("inc_1", "Dad slept badly last night.", {
  source_id: "caregiver_1",
  captured_at: new Date(Date.now() + 120000).toISOString(),
});
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", `DUP-004: repeated caregiver note - got ${result.resolution}`);
console.log("  resolution:", result.resolution);
console.log("  failure_labels:", result.failure_labels);
assert(result.failure_labels.includes("CAREGIVER_REPORT_DUPLICATION"), "DUP-004: failure label");
console.log("✓ DUP-004: Same caregiver repeats note");

existing = [createExisting("evt_1", "Mom fell yesterday.", { source_id: "daughter_1", source_type: "chat_message" })];
incoming = createIncoming("inc_1", "Mom fell yesterday.", { source_id: "son_1", source_type: "chat_message" });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-005: multi-source");
assert(result.evidence_relation === "multi_source_same_event", "DUP-005: relation");
console.log("✓ DUP-005: Same event copied into family chat");

// 9B — Same Event, Different Wording
console.log("\n--- 9B: Same Event, Different Wording ---");

existing = [createExisting("evt_1", "She slipped in the bathroom.", { attributes: { location: "bathroom" } })];
incoming = createIncoming("inc_1", "Mom had a fall in the bathroom.", { attributes: { location: "bathroom" } });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_event", `DUP-006: phrasing variation - got ${result.resolution}`);
console.log("  resolution:", result.resolution);
console.log("  evidence_relation:", result.evidence_relation);
assert(result.evidence_relation === "semantic_same_event", "DUP-006: relation");
console.log("✓ DUP-006: Fall phrasing variation");

existing = [createExisting("evt_1", "Dad went to the ER Tuesday.", { event_type: "appointment" })];
incoming = createIncoming("inc_1", "He was admitted Tuesday night.", { event_type: "appointment" });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", `DUP-007: hospitalization - got ${result.resolution}`);
console.log("  resolution:", result.resolution);
console.log("  evidence_relation:", result.evidence_relation);
assert(result.evidence_relation === "temporal_sequence_same_episode", "DUP-007: relation");
console.log("✓ DUP-007: Same hospitalization (ER → admission)");

existing = [createExisting("evt_1", "Neurologist visit today.")];
incoming = createIncoming("inc_1", "Saw Dr. Smith this morning.");
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-008: appointment");
assert(result.enriched_fields?.includes("provider_name"), "DUP-008: enriched");
console.log("✓ DUP-008: Same appointment (different wording)");

existing = [createExisting("evt_1", "Doctor increased the dose.")];
incoming = createIncoming("inc_1", "New prescription is 20 mg.");
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-009: medication change");
assert(result.enriched_fields?.includes("dosage_detail"), "DUP-009: enriched");
console.log("✓ DUP-009: Same medication change");

existing = [createExisting("evt_1", "She's been coughing.")];
incoming = createIncoming("inc_1", "Cough is still bothering her.", { captured_at: new Date(Date.now() + 3600000).toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-010: symptom persistence");
assert(result.enriched_fields?.includes("severity"), "DUP-010: enriched");
console.log("✓ DUP-010: Same symptom report (persistence)");

// 9C — Genuinely Separate Events
console.log("\n--- 9C: Genuinely Separate Events ---");

existing = [createExisting("evt_1", "Tuesday: fell in bathroom.", { created_at: new Date("2026-01-13T10:00:00Z").toISOString(), attributes: { location: "bathroom" } })];
incoming = createIncoming("inc_1", "Thursday: fell in bathroom again.", { captured_at: new Date("2026-01-15T10:00:00Z").toISOString(), attributes: { location: "bathroom" } });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "new_event", `DUP-011: separate falls - got ${result.resolution}`);
console.log("  resolution:", result.resolution);
console.log("  reasoning:", result.reasoning);
console.log("  failure_labels:", result.failure_labels);
assert(result.failure_labels.includes("RECURRING_EVENT_COLLAPSE"), "DUP-011: failure label");
console.log("✓ DUP-011: Two falls, same location, different days");

existing = [createExisting("evt_1", "Monday: ER for breathing difficulty.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "Friday: ER after a fall.", { captured_at: new Date("2026-01-16T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "new_event", "DUP-012: separate ER visits");
assert(result.failure_labels.includes("SEPARATE_EVENT_COLLAPSE"), "DUP-012: failure label");
console.log("✓ DUP-012: Two ER visits, different reasons");

existing = [createExisting("evt_1", "January: dose increased from 5 mg to 10 mg.", { created_at: new Date("2026-01-05T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "March: dose increased from 10 mg to 20 mg.", { captured_at: new Date("2026-03-05T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "new_event", "DUP-013: separate med changes");
assert(result.failure_labels.includes("FALSE_DEDUPLICATION"), "DUP-013: failure label");
console.log("✓ DUP-013: Two medication changes, different doses");

existing = [createExisting("evt_1", "June 3: primary-care appointment.", { created_at: new Date("2026-06-03T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "June 20: cardiology appointment.", { captured_at: new Date("2026-06-20T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "new_event", "DUP-014: separate appointments");
assert(result.failure_labels.includes("FALSE_DEDUPLICATION"), "DUP-014: failure label");
console.log("✓ DUP-014: Two appointments, different specialties");

existing = [createExisting("evt_1", "Monday: fever resolved Tuesday.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "Friday: fever returned.", { captured_at: new Date("2026-01-16T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "recurrence", "DUP-015: symptom recurrence");
assert(result.failure_labels.includes("RECURRING_EVENT_COLLAPSE"), "DUP-015: failure label");
console.log("✓ DUP-015: Separate symptom episodes (resolved → returned)");

// 9D — Repeated Observations
console.log("\n--- 9D: Repeated Observation of One State ---");

existing = [
  createExisting("evt_1", "Monday: 72 kg.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString(), attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" } }),
  createExisting("evt_2", "Wednesday: 72 kg.", { created_at: new Date("2026-01-14T10:00:00Z").toISOString(), attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" } }),
];
incoming = createIncoming("inc_1", "Friday: 72 kg.", { captured_at: new Date("2026-01-16T10:00:00Z").toISOString(), attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" } });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "ongoing_state", "DUP-016: stable weight");
assert(result.failure_labels.includes("ONGOING_STATE_AS_NEW_EVENT"), "DUP-016: failure label");
console.log("✓ DUP-016: Stable weight repeatedly documented");

existing = [
  createExisting("evt_1", "Uses walker today.", { created_at: new Date("2026-01-13T10:00:00Z").toISOString() }),
  createExisting("evt_2", "Used walker yesterday.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString() }),
];
incoming = createIncoming("inc_1", "Still using walker.", { captured_at: new Date("2026-01-15T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "ongoing_state", `DUP-017: walker use - got ${result.resolution}`);
console.log("  resolution:", result.resolution);
console.log("  evidence_relation:", result.evidence_relation);
assert(result.evidence_relation === "repeated_observation_persistent", "DUP-017: relation");
console.log("✓ DUP-017: Repeated walker use");

existing = [createExisting("evt_1", "Still taking 10 mg of Metformin.", { created_at: new Date("2026-01-10T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "Still taking 10 mg of Metformin.", { captured_at: new Date("2026-01-15T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "ongoing_state", "DUP-018: stable medication");
assert(result.failure_labels.includes("ONGOING_STATE_AS_NEW_EVENT"), "DUP-018: failure label");
console.log("✓ DUP-018: Repeated stable medication status");

existing = [
  createExisting("evt_1", "Helped Mom shower.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString() }),
  createExisting("evt_2", "Helped Mom shower.", { created_at: new Date("2026-01-13T10:00:00Z").toISOString() }),
  createExisting("evt_3", "Helped Mom shower.", { created_at: new Date("2026-01-14T10:00:00Z").toISOString() }),
];
incoming = createIncoming("inc_1", "Helped Mom shower.", { captured_at: new Date("2026-01-15T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "ongoing_state", "DUP-019: bathing assistance");
assert(result.failure_labels.includes("ONGOING_STATE_AS_NEW_EVENT"), "DUP-019: failure label");
console.log("✓ DUP-019: Repeated bathing assistance");

existing = [
  createExisting("evt_1", "Monday: confused overnight.", { created_at: new Date("2026-01-12T10:00:00Z").toISOString() }),
  createExisting("evt_2", "Tuesday: confused overnight.", { created_at: new Date("2026-01-13T10:00:00Z").toISOString() }),
];
incoming = createIncoming("inc_1", "Wednesday: confused overnight.", { captured_at: new Date("2026-01-14T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(["ongoing_state", "recurrence"].includes(result.resolution), "DUP-020: confusion pattern");
console.log("✓ DUP-020: Repeated nighttime confusion");

// 9E — Document Versions
console.log("\n--- 9E: Document Versions ---");

clearDocumentVersions();
recordDocumentVersion("doc_1", 1, "hash1", new Date().toISOString(), ["evt_1"], true, false);
recordDocumentVersion("doc_1", 2, "hash2", new Date().toISOString(), ["evt_1"], false, false, 1);

existing = [createExisting("evt_1", "Discharge medication: 10 mg.", { document_id: "doc_1", document_version: 1 })];
incoming = createIncoming("inc_1", "Discharge medication: 20 mg.", { document_id: "doc_1", document_version: 2, source_type: "document", source_id: "doc_1" });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-021: draft vs final");
assert(result.evidence_relation === "document_version_draft_final", "DUP-021: relation");
console.log("✓ DUP-021: Draft vs final discharge summary");

clearDocumentVersions();
recordDocumentVersion("doc_2", 1, "hash1", new Date().toISOString(), ["evt_1"], false, false);
recordDocumentVersion("doc_2", 2, "hash2", new Date().toISOString(), ["evt_1"], false, true, 1);

existing = [createExisting("evt_1", "No fall.", { document_id: "doc_2", document_version: 1 })];
incoming = createIncoming("inc_1", "Patient had a fall yesterday.", { document_id: "doc_2", document_version: 2, source_type: "document", source_id: "doc_2" });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-022: corrected note");
assert(result.evidence_relation === "document_version_correction", "DUP-022: relation");
console.log("✓ DUP-022: Corrected clinical note");

clearDocumentVersions();
recordDocumentVersion("doc_3", 1, "hash1", new Date().toISOString(), ["evt_1"], false, false);
recordDocumentVersion("doc_3", 2, "hash2", new Date().toISOString(), ["evt_1"], false, false, 1);

existing = [createExisting("evt_1", "Medication A — 10 mg", { document_id: "doc_3", document_version: 1, extracted_type: "medication_started" })];
incoming = createIncoming("inc_1", "Medication A — 20 mg", { document_id: "doc_3", document_version: 2, source_type: "document", source_id: "doc_3" });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-023: updated med list");
assert(result.evidence_relation === "document_version_update", "DUP-023: relation");
console.log("✓ DUP-023: Updated medication list");

existing = [createExisting("evt_1", "BP 150/90.", { source_id: "hospital_portal", source_type: "lab_result", created_at: new Date("2026-01-15T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "BP 150/90.", { source_id: "caregiver_app", source_type: "lab_result", captured_at: new Date("2026-01-15T10:05:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-024: multi-system");
assert(result.evidence_relation === "multi_system_same_measurement", "DUP-024: relation");
console.log("✓ DUP-024: Same lab result in two systems");

existing = [createExisting("evt_1", "Weight: 70 kg.", { source_id: "hospital_doc", source_type: "document" })];
incoming = createIncoming("inc_1", "Weight today: 70 kg.", { source_id: "caregiver_manual", source_type: "manual_entry", captured_at: existing[0].created_at });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "duplicate_evidence", "DUP-025: imported vs manual");
assert(result.evidence_relation === "imported_vs_manual_entry", "DUP-025: relation");
console.log("✓ DUP-025: Imported document + manual entry");

// 9F — Duplicate vs Update
console.log("\n--- 9F: Duplicate vs Update ---");

existing = [createExisting("evt_1", "Dad fell in the kitchen.")];
incoming = createIncoming("inc_1", "He fell in the kitchen around 8 PM and bruised his hip.", { captured_at: new Date(Date.now() + 3600000).toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-026: enrichment");
assert(result.enriched_fields?.includes("approximate_time"), "DUP-026: time");
assert(result.enriched_fields?.includes("injury_detail"), "DUP-026: injury");
console.log("✓ DUP-026: Same event, new information");

existing = [createExisting("evt_1", "No injury after the fall.")];
incoming = createIncoming("inc_1", "Actually, Mom developed a bruise on her hip from the fall.", { captured_at: new Date(Date.now() + 7200000).toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-027: correction");
assert(result.enriched_fields?.includes("injury_status"), "DUP-027: injury status");
console.log("✓ DUP-027: Same event, changed understanding");

existing = [createExisting("evt_1", "New medication started Monday.", { extracted_type: "medication_started" })];
incoming = createIncoming("inc_1", "She took the first dose Monday evening.", { captured_at: new Date(Date.now() + 3600000).toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-028: admin detail");
assert(result.enriched_fields?.includes("administration_timing"), "DUP-028: admin");
console.log("✓ DUP-028: Same medication event, administration detail");

existing = [createExisting("evt_1", "Neurology appointment today.")];
incoming = createIncoming("inc_1", "Neurologist recommended physical therapy.", { captured_at: new Date(Date.now() + 7200000).toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "update_existing", "DUP-029: appointment outcome");
assert(result.enriched_fields?.includes("clinical_recommendation"), "DUP-029: outcome");
console.log("✓ DUP-029: Appointment outcome added later");

existing = [createExisting("evt_1", "Mom fell recently.", { created_at: new Date("2026-01-13T10:00:00Z").toISOString() })];
incoming = createIncoming("inc_1", "She fell again around then.", { captured_at: new Date("2026-01-14T10:00:00Z").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "ambiguous_insufficient_evidence", "DUP-030: ambiguous");
assert(result.requires_clarification === true, "DUP-030: clarification");
assert(result.clarification_question !== undefined, "DUP-030: question");
console.log("✓ DUP-030: Genuinely unclear (ambiguous)");

// Core Invariants
console.log("\n--- Core Invariants ---");

// Three notes about one fall = 1 event, 3 evidence
// Create existing event within exact duplicate window (10 min)
existing = [createExisting("evt_1", "Mom fell in the bathroom.", { created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() })];
const notes = [
  createIncoming("inc_1", "Mom fell in the bathroom.", { source_id: "caregiver_1" }),
  createIncoming("inc_2", "Mom fell in the bathroom.", { source_id: "caregiver_2" }),
  createIncoming("inc_3", "Mom fell in the bathroom.", { source_id: "caregiver_3" }),
];
context = createEventIdentityContext("person_1", existing);
const batch = resolveEventIdentitiesBatch(notes, context);
const allEvents = [...existing, ...batch.new_events.map(e => ({ id: e.id, event_type: e.extracted_type ?? "observation", status: "committed" }))];
const evidenceCount = getEvidenceCountForEvent([...batch.updated_existing_events, ...batch.new_events.map(e => ({ id: e.id, evidence_ids: [e.id] }))], "evt_1");
assert(getEventRealityCount(allEvents) === 1, "Core: 3 notes = 1 event");
assert(evidenceCount === 4, "Core: 4 evidence (original + 3 notes)");
console.log("✓ Core: Three notes about one fall ≠ three falls (evidence=4, event=1)");

// Three separate falls = 3 events
existing = [
  createExisting("evt_1", "Monday: fell in bathroom.", { created_at: new Date("2026-01-12").toISOString() }),
  createExisting("evt_2", "Wednesday: fell in bathroom.", { created_at: new Date("2026-01-14").toISOString() }),
];
incoming = createIncoming("inc_1", "Friday: fell in bathroom again.", { captured_at: new Date("2026-01-16").toISOString() });
context = createEventIdentityContext("person_1", existing);
result = resolveEventIdentity(incoming, context);
assert(result.resolution === "new_event", "Core: separate falls = new event");
const allEvents2 = [...existing, { id: incoming.id, event_type: "incident", status: "committed" }];
assert(getEventRealityCount(allEvents2) === 3, "Core: 3 separate falls = 3 events");
console.log("✓ Core: Three separate falls ≠ one fall mentioned three times");

// Failure taxonomy
console.log("\n--- Failure Taxonomy ---");
assert(EVENT_IDENTITY_FAILURE_LABELS.length === 20, "All 20 failure labels present");
console.log("✓ All 20 failure taxonomy labels defined");

// Batch Processing
console.log("\n--- Batch Processing ---");
existing = [createExisting("evt_1", "Mom fell in the bathroom Tuesday.", { created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), attributes: { location: "bathroom" } })];
const incomingBatch = [
  createIncoming("inc_1", "Mom fell in the bathroom Tuesday.", { attributes: { location: "bathroom" } }),
  createIncoming("inc_2", "She slipped in the bathroom Tuesday.", { attributes: { location: "bathroom" } }),
  createIncoming("inc_3", "Mom fell again Thursday.", { captured_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), attributes: { location: "bathroom" } }),
];
context = createEventIdentityContext("person_1", existing);
const batchResult = resolveEventIdentitiesBatch(incomingBatch, context);
assert(batchResult.resolutions[0].resolution === "duplicate_evidence", "Batch: exact dup");
assert(batchResult.resolutions[1].resolution === "duplicate_event", "Batch: semantic dup");
assert(batchResult.resolutions[2].resolution === "new_event", "Batch: separate event");
assert(batchResult.new_events.length === 1, "Batch: 1 new event");
console.log("✓ Batch identity resolution maintains context");

// File existence
console.log("\n--- File Structure ---");
const requiredFiles = [
  "src/lib/event-identity/contract-constants.ts",
  "src/lib/event-identity/types.ts",
  "src/lib/event-identity/detect-exact-duplicates.ts",
  "src/lib/event-identity/detect-semantic-same.ts",
  "src/lib/event-identity/detect-separate-events.ts",
  "src/lib/event-identity/detect-repeated-observations.ts",
  "src/lib/event-identity/detect-document-versions.ts",
  "src/lib/event-identity/detect-duplicate-vs-update.ts",
  "src/lib/event-identity/resolve.ts",
  "src/lib/event-identity/index.ts",
];
for (const rel of requiredFiles) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
console.log("✓ All event-identity module files exist");

console.log("\n=== Category 9 Event Identity verification complete ===");
process.exit(0);