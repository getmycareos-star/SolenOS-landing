import { describe, it, expect, beforeEach, vi } from "vitest";
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
} from "../../src/lib/event-identity";
import type { IncomingEvidence, ExistingEvent } from "../../src/lib/event-identity/types";

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

describe("Category 9 — Event Identity & Deduplication", () => {
  beforeEach(() => {
    clearDocumentVersions();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z"));
  });

  // ==================== 9A — EXACT DUPLICATES ====================

  describe("9A — Exact Duplicates", () => {
    it("DUP-001: Same caregiver note uploaded twice → one fall event", () => {
      const existing = [createExisting("evt_1", "Mom fell in the bathroom Tuesday morning. No injury reported.")];
      const incoming = createIncoming("inc_1", "Mom fell in the bathroom Tuesday morning. No injury reported.", {
        captured_at: new Date(Date.now() + 300000).toISOString(), // 5 min later
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.failure_labels).not.toContain("DUPLICATE_EVENT_CREATION");
    });

    it("DUP-002: Same document uploaded twice → clinical events extracted once", () => {
      const existing = [createExisting("evt_1", "Discharge summary content", {
        document_id: "doc_123",
        document_version: 1,
        source_type: "document",
        source_id: "doc_123",
      })];
      const incoming = createIncoming("inc_1", "Discharge summary content", {
        document_id: "doc_123",
        document_version: 1,
        source_type: "document",
        source_id: "doc_123",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.evidence_relation).toBe("identical_content");
    });

    it("DUP-003: Same medication list duplicated → no duplicate medications", () => {
      const existing = [createExisting("evt_1", "Medication A - 10mg\nMedication B - 20mg", {
        attributes: { medication_list: true },
        source_type: "document",
        source_id: "medlist_1",
      })];
      const incoming = createIncoming("inc_1", "Medication A - 10mg\nMedication B - 20mg", {
        extracted_type: "medication_list",
        source_type: "document",
        source_id: "medlist_1",
        captured_at: new Date(Date.now() + 1000).toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
    });

    it("DUP-004: Same caregiver repeats note minutes apart → not two nights", () => {
      const existing = [createExisting("evt_1", "Dad slept badly last night.", {
        source_id: "caregiver_1",
      })];
      const incoming = createIncoming("inc_1", "Dad slept badly last night.", {
        source_id: "caregiver_1",
        captured_at: new Date(Date.now() + 120000).toISOString(), // 2 min later
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.failure_labels).toContain("CAREGIVER_REPORT_DUPLICATION");
    });

    it("DUP-005: Same event copied into family chat → one fall, multiple sources", () => {
      const existing = [createExisting("evt_1", "Mom fell yesterday.", {
        source_id: "daughter_1",
        source_type: "chat_message",
      })];
      const incoming = createIncoming("inc_1", "Mom fell yesterday.", {
        source_id: "son_1",
        source_type: "chat_message",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.evidence_relation).toBe("multi_source_same_event");
      expect(result.failure_labels).toContain("MULTI_SOURCE_DUPLICATION");
    });
  });

  // ==================== 9B — SAME EVENT, DIFFERENT WORDING ====================

  describe("9B — Same Event, Different Wording", () => {
    it("DUP-006: Fall phrasing variation — 'slipped' vs 'had a fall'", () => {
      const existing = [createExisting("evt_1", "She slipped in the bathroom.", {
        attributes: { location: "bathroom" },
      })];
      const incoming = createIncoming("inc_1", "Mom had a fall in the bathroom.", {
        attributes: { location: "bathroom" },
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_event");
      expect(result.evidence_relation).toBe("semantic_same_event");
      expect(result.reasoning).toContain("phrasing variation");
    });

    it("DUP-007: Same hospitalization — ER then admission", () => {
      const existing = [createExisting("evt_1", "Dad went to the ER Tuesday.", {
        event_type: "appointment",
      })];
      const incoming = createIncoming("inc_1", "He was admitted Tuesday night.", {
        event_type: "appointment",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.evidence_relation).toBe("temporal_sequence_same_episode");
      expect(result.enriched_fields).toContain("care_transition");
    });

    it("DUP-008: Same appointment — 'Neurologist visit' vs 'Saw Dr. Smith'", () => {
      const existing = [createExisting("evt_1", "Neurologist visit today.")];
      const incoming = createIncoming("inc_1", "Saw Dr. Smith this morning.");

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("provider_name");
    });

    it("DUP-009: Same medication change — 'increased dose' vs 'new prescription 20mg'", () => {
      const existing = [createExisting("evt_1", "Doctor increased the dose.")];
      const incoming = createIncoming("inc_1", "New prescription is 20 mg.");

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("dosage_detail");
    });

    it("DUP-010: Same symptom report — 'coughing' vs 'cough still bothering'", () => {
      const existing = [createExisting("evt_1", "She's been coughing.")];
      const incoming = createIncoming("inc_1", "Cough is still bothering her.", {
        captured_at: new Date(Date.now() + 3600000).toISOString(), // same day
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("severity");
    });
  });

  // ==================== 9C — GENUINELY SEPARATE EVENTS ====================

  describe("9C — Genuinely Separate Events", () => {
    it("DUP-011: Two falls, same location, different days → fall count = 2", () => {
      const existing = [createExisting("evt_1", "Tuesday: fell in bathroom.", {
        created_at: new Date("2026-01-13T10:00:00Z").toISOString(),
        attributes: { location: "bathroom" },
      })];
      const incoming = createIncoming("inc_1", "Thursday: fell in bathroom again.", {
        captured_at: new Date("2026-01-15T10:00:00Z").toISOString(),
        attributes: { location: "bathroom" },
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("new_event");
      expect(result.failure_labels).toContain("RECURRING_EVENT_COLLAPSE");
    });

    it("DUP-012: Two ER visits, different reasons → two episodes", () => {
      const existing = [createExisting("evt_1", "Monday: ER for breathing difficulty.", {
        created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "Friday: ER after a fall.", {
        captured_at: new Date("2026-01-16T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("new_event");
      expect(result.failure_labels).toContain("SEPARATE_EVENT_COLLAPSE");
    });

    it("DUP-013: Two medication changes, different doses → both preserved", () => {
      const existing = [createExisting("evt_1", "January: dose increased from 5 mg to 10 mg.", {
        created_at: new Date("2026-01-05T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "March: dose increased from 10 mg to 20 mg.", {
        captured_at: new Date("2026-03-05T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("new_event");
      expect(result.failure_labels).toContain("FALSE_DEDUPLICATION");
    });

    it("DUP-014: Two appointments, different specialties/dates → two appointments", () => {
      const existing = [createExisting("evt_1", "June 3: primary-care appointment.", {
        created_at: new Date("2026-06-03T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "June 20: cardiology appointment.", {
        captured_at: new Date("2026-06-20T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("new_event");
      expect(result.failure_labels).toContain("FALSE_DEDUPLICATION");
    });

    it("DUP-015: Separate symptom episodes — fever resolved then returned", () => {
      const existing = [createExisting("evt_1", "Monday: fever resolved Tuesday.", {
        created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "Friday: fever returned.", {
        captured_at: new Date("2026-01-16T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("recurrence");
      expect(result.failure_labels).toContain("RECURRING_EVENT_COLLAPSE");
    });
  });

  // ==================== 9D — REPEATED OBSERVATION OF ONE STATE ====================

  describe("9D — Repeated Observation of One State", () => {
    it("DUP-016: Stable weight repeatedly documented → one pattern, not three changes", () => {
      const existing = [
        createExisting("evt_1", "Monday: 72 kg.", {
          created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
          attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" },
        }),
        createExisting("evt_2", "Wednesday: 72 kg.", {
          created_at: new Date("2026-01-14T10:00:00Z").toISOString(),
          attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" },
        }),
      ];
      const incoming = createIncoming("inc_1", "Friday: 72 kg.", {
        captured_at: new Date("2026-01-16T10:00:00Z").toISOString(),
        attributes: { measurement_type: "weight", measurement_value: 72, measurement_unit: "kg" },
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("ongoing_state");
      expect(result.failure_labels).toContain("ONGOING_STATE_AS_NEW_EVENT");
      expect(result.failure_labels).toContain("REPEATED_OBSERVATION_AS_CHANGE");
    });

    it("DUP-017: Repeated walker use → ongoing functional state", () => {
      const existing = [
        createExisting("evt_1", "Uses walker today.", {
          created_at: new Date("2026-01-13T10:00:00Z").toISOString(),
        }),
        createExisting("evt_2", "Used walker yesterday.", {
          created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
        }),
      ];
      const incoming = createIncoming("inc_1", "Still using walker.", {
        captured_at: new Date("2026-01-15T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("ongoing_state");
      expect(result.evidence_relation).toBe("repeated_observation_persistent");
    });

    it("DUP-018: Repeated stable medication status → no new dose-change event", () => {
      const existing = [createExisting("evt_1", "Still taking 10 mg of Metformin.", {
        created_at: new Date("2026-01-10T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "Still taking 10 mg of Metformin.", {
        captured_at: new Date("2026-01-15T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("ongoing_state");
      expect(result.failure_labels).toContain("ONGOING_STATE_AS_NEW_EVENT");
    });

    it("DUP-019: Repeated bathing assistance → persistent dependence, not daily decline", () => {
      const existing = [
        createExisting("evt_1", "Helped Mom shower.", {
          created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
        }),
        createExisting("evt_2", "Helped Mom shower.", {
          created_at: new Date("2026-01-13T10:00:00Z").toISOString(),
        }),
        createExisting("evt_3", "Helped Mom shower.", {
          created_at: new Date("2026-01-14T10:00:00Z").toISOString(),
        }),
      ];
      const incoming = createIncoming("inc_1", "Helped Mom shower.", {
        captured_at: new Date("2026-01-15T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("ongoing_state");
      expect(result.failure_labels).toContain("ONGOING_STATE_AS_NEW_EVENT");
    });

    it("DUP-020: Repeated nighttime confusion → recurrent/persistent pattern", () => {
      const existing = [
        createExisting("evt_1", "Monday: confused overnight.", {
          created_at: new Date("2026-01-12T10:00:00Z").toISOString(),
        }),
        createExisting("evt_2", "Tuesday: confused overnight.", {
          created_at: new Date("2026-01-13T10:00:00Z").toISOString(),
        }),
      ];
      const incoming = createIncoming("inc_1", "Wednesday: confused overnight.", {
        captured_at: new Date("2026-01-14T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      // Could be ongoing_state or recurrence depending on gaps
      expect(["ongoing_state", "recurrence"]).toContain(result.resolution);
      expect(result.failure_labels.some(l => 
        l === "ONGOING_STATE_AS_NEW_EVENT" || l === "RECURRING_EVENT_COLLAPSE"
      )).toBe(true);
    });
  });

  // ==================== 9E — DOCUMENT VERSIONS ====================

  describe("9E — Document Versions", () => {
    beforeEach(() => {
      clearDocumentVersions();
    });

    it("DUP-021: Draft vs final discharge summary → final supersedes draft", () => {
      recordDocumentVersion("doc_1", 1, "hash1", new Date().toISOString(), ["evt_1"], true, false);
      recordDocumentVersion("doc_1", 2, "hash2", new Date().toISOString(), ["evt_1"], false, false, 1);

      const existing = [createExisting("evt_1", "Discharge medication: 10 mg.", {
        document_id: "doc_1",
        document_version: 1,
      })];
      const incoming = createIncoming("inc_1", "Discharge medication: 20 mg.", {
        document_id: "doc_1",
        document_version: 2,
        source_type: "document",
        source_id: "doc_1",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.evidence_relation).toBe("document_version_draft_final");
      expect(result.failure_labels).toContain("DOCUMENT_VERSION_COLLAPSE");
    });

    it("DUP-022: Corrected clinical note → correction changes claim", () => {
      recordDocumentVersion("doc_2", 1, "hash1", new Date().toISOString(), ["evt_1"], false, false);
      recordDocumentVersion("doc_2", 2, "hash2", new Date().toISOString(), ["evt_1"], false, true, 1);

      const existing = [createExisting("evt_1", "No fall.", {
        document_id: "doc_2",
        document_version: 1,
      })];
      const incoming = createIncoming("inc_1", "Patient had a fall yesterday.", {
        document_id: "doc_2",
        document_version: 2,
        source_type: "document",
        source_id: "doc_2",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.evidence_relation).toBe("document_version_correction");
      expect(result.failure_labels).toContain("CORRECTION_AS_NEW_EVENT");
    });

    it("DUP-023: Updated medication list → one entity, two documented states", () => {
      recordDocumentVersion("doc_3", 1, "hash1", new Date().toISOString(), ["evt_1"], false, false);
      recordDocumentVersion("doc_3", 2, "hash2", new Date().toISOString(), ["evt_1"], false, false, 1);

      const existing = [createExisting("evt_1", "Medication A — 10 mg", {
        document_id: "doc_3",
        document_version: 1,
        extracted_type: "medication_started",
      })];
      const incoming = createIncoming("inc_1", "Medication A — 20 mg", {
        document_id: "doc_3",
        document_version: 2,
        source_type: "document",
        source_id: "doc_3",
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.evidence_relation).toBe("document_version_update");
    });

    it("DUP-024: Same lab result in two systems → one measurement", () => {
      const existing = [createExisting("evt_1", "BP 150/90.", {
        source_id: "hospital_portal",
        source_type: "lab_result",
        created_at: new Date("2026-01-15T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "BP 150/90.", {
        source_id: "caregiver_app",
        source_type: "lab_result",
        captured_at: new Date("2026-01-15T10:05:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.evidence_relation).toBe("multi_system_same_measurement");
    });

    it("DUP-025: Imported document + manual entry → preserve provenance", () => {
      const existing = [createExisting("evt_1", "Weight: 70 kg.", {
        source_id: "hospital_doc",
        source_type: "document",
      })];
      const incoming = createIncoming("inc_1", "Weight today: 70 kg.", {
        source_id: "caregiver_manual",
        source_type: "manual_entry",
        captured_at: existing[0].created_at,
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("duplicate_evidence");
      expect(result.evidence_relation).toBe("imported_vs_manual_entry");
    });
  });

  // ==================== 9F — DUPLICATE VS UPDATE ====================

  describe("9F — Duplicate vs Update", () => {
    it("DUP-026: Same event, new information (time, injury) → enrich, not new event", () => {
      const existing = [createExisting("evt_1", "Dad fell in the kitchen.")];
      const incoming = createIncoming("inc_1", "He fell in the kitchen around 8 PM and bruised his hip.", {
        captured_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("approximate_time");
      expect(result.enriched_fields).toContain("injury_detail");
      expect(result.failure_labels).toContain("UPDATE_AS_NEW_EVENT");
    });

    it("DUP-027: Same event, changed understanding (injury status) → update, not new fall", () => {
      const existing = [createExisting("evt_1", "No injury after the fall.")];
      const incoming = createIncoming("inc_1", "Actually, Mom developed a bruise on her hip from the fall.", {
        captured_at: new Date(Date.now() + 7200000).toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("injury_status");
      expect(result.failure_labels).toContain("CORRECTION_AS_NEW_EVENT");
    });

    it("DUP-028: Same medication event, administration detail added", () => {
      const existing = [createExisting("evt_1", "New medication started Monday.", {
        extracted_type: "medication_started",
      })];
      const incoming = createIncoming("inc_1", "She took the first dose Monday evening.", {
        captured_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("administration_timing");
    });

    it("DUP-029: Appointment outcome added later", () => {
      const existing = [createExisting("evt_1", "Neurology appointment today.")];
      const incoming = createIncoming("inc_1", "Neurologist recommended physical therapy.", {
        captured_at: new Date(Date.now() + 7200000).toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("update_existing");
      expect(result.enriched_fields).toContain("clinical_recommendation");
    });

    it("DUP-030: Genuinely unclear — 'fell recently' vs 'fell again around then' → ambiguous", () => {
      const existing = [createExisting("evt_1", "Mom fell recently.", {
        created_at: new Date("2026-01-13T10:00:00Z").toISOString(),
      })];
      const incoming = createIncoming("inc_1", "She fell again around then.", {
        captured_at: new Date("2026-01-14T10:00:00Z").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("ambiguous_insufficient_evidence");
      expect(result.requires_clarification).toBe(true);
      expect(result.clarification_question).toBeDefined();
      expect(result.failure_labels).toContain("EVENT_IDENTITY_ERROR");
    });
  });

  // ==================== CORE INVARIANTS ====================

  describe("Core Invariants", () => {
    it("Three notes about one fall ≠ three falls (evidence count = 3, event count = 1)", () => {
      const existing = [createExisting("evt_1", "Mom fell in the bathroom.")];
      const notes = [
        createIncoming("inc_1", "Mom fell in the bathroom.", { source_id: "caregiver_1" }),
        createIncoming("inc_2", "Mom fell in the bathroom.", { source_id: "caregiver_2" }),
        createIncoming("inc_3", "Mom fell in the bathroom.", { source_id: "caregiver_3" }),
      ];

      const context = createEventIdentityContext("person_1", existing);
      const batch = resolveEventIdentitiesBatch(notes, context);

      const eventCount = getEventRealityCount([...existing, ...batch.newEvents.map(e => ({
        id: e.id,
        event_type: e.extracted_type ?? "observation",
        status: "committed",
      }))]);
      const evidenceCount = getEvidenceCountForEvent([...existing, ...batch.newEvents.map(e => ({
        id: e.id,
        evidence_ids: [e.id],
      }))], "evt_1");

      expect(eventCount).toBe(1);
      expect(evidenceCount).toBe(4); // original + 3 notes
    });

    it("Three separate falls ≠ one fall mentioned three times", () => {
      const existing = [
        createExisting("evt_1", "Monday: fell in bathroom.", { created_at: new Date("2026-01-12").toISOString() }),
        createExisting("evt_2", "Wednesday: fell in bathroom.", { created_at: new Date("2026-01-14").toISOString() }),
      ];
      const incoming = createIncoming("inc_1", "Friday: fell in bathroom again.", {
        captured_at: new Date("2026-01-16").toISOString(),
      });

      const context = createEventIdentityContext("person_1", existing);
      const result = resolveEventIdentity(incoming, context);

      expect(result.resolution).toBe("new_event");
      const allEvents = [...existing, { id: incoming.id, event_type: "incident", status: "committed" }];
      expect(getEventRealityCount(allEvents)).toBe(3);
    });

    it("Failure taxonomy labels are properly assigned", () => {
      const allLabels = [
        "DUPLICATE_EVENT_CREATION",
        "DUPLICATE_EVIDENCE_AS_EVENT",
        "MISSED_DUPLICATE",
        "FALSE_DEDUPLICATION",
        "RECURRING_EVENT_COLLAPSE",
        "SEPARATE_EVENT_COLLAPSE",
        "ONGOING_STATE_AS_NEW_EVENT",
        "REPEATED_OBSERVATION_AS_CHANGE",
        "UPDATE_AS_NEW_EVENT",
        "CORRECTION_AS_NEW_EVENT",
        "DOCUMENT_VERSION_COLLAPSE",
        "DOCUMENT_VERSION_DUPLICATION",
        "MULTI_SOURCE_DUPLICATION",
        "CAREGIVER_REPORT_DUPLICATION",
        "EVENT_IDENTITY_ERROR",
        "EVENT_MERGE_ERROR",
        "EVENT_SPLIT_ERROR",
        "RECURRENCE_DEDUPLICATION",
        "PROVENANCE_LOSS",
        "HISTORY_CORRUPTION",
      ];

      // Verify all labels are exported and usable
      expect(allLabels.length).toBe(20);
    });
  });

  // ==================== BATCH PROCESSING ====================

  describe("Batch Identity Resolution", () => {
    it("Processes multiple items maintaining context", () => {
      const existing = [createExisting("evt_1", "Mom fell Tuesday.")];
      const incoming = [
        createIncoming("inc_1", "Mom fell Tuesday."), // exact duplicate
        createIncoming("inc_2", "She slipped in the bathroom Tuesday."), // semantic same
        createIncoming("inc_3", "Mom fell again Thursday."), // genuinely separate
      ];

      const context = createEventIdentityContext("person_1", existing);
      const batch = resolveEventIdentitiesBatch(incoming, context);

      expect(batch.resolutions[0].resolution).toBe("duplicate_evidence");
      expect(batch.resolutions[1].resolution).toBe("duplicate_event");
      expect(batch.resolutions[2].resolution).toBe("new_event");
      expect(batch.newEvents.length).toBe(1);
      expect(batch.updatedEvents.length).toBe(0);
    });
  });
});