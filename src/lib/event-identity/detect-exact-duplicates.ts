import {
  IDENTITY_TIME_WINDOWS,
  IDENTITY_CONFIDENCE,
  EVENT_IDENTITY_RESOLUTIONS,
  EVIDENCE_RELATIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
} from "./contract-constants";
import type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
} from "./types";

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]/g, "")
    .trim();
}

function contentHash(text: string): string {
  let hash = 0;
  const normalized = normalizeForComparison(text);
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function sameSourceAndContent(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): boolean {
  if (incoming.source_id !== existing.source_id) return false;
  if (incoming.source_type !== existing.source_type) return false;
  const incomingHash = contentHash(incoming.content);
  const existingHash = contentHash(existing.content);
  return incomingHash === existingHash;
}

function withinExactDuplicateWindow(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): boolean {
  const incomingTime = new Date(incoming.captured_at).getTime();
  const existingTime = new Date(existing.created_at).getTime();
  return Math.abs(incomingTime - existingTime) <= IDENTITY_TIME_WINDOWS.exact_duplicate_ms;
}

/** DUP-001: Same caregiver note uploaded twice */
export function detectExactCaregiverDuplicate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const match = existingEvents.find((e) =>
    e.source_type === "caregiver_note" &&
    e.person_id === incoming.person_id &&
    sameSourceAndContent(incoming, e) &&
    withinExactDuplicateWindow(incoming, e),
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "identical_content",
    reasoning: "Exact duplicate caregiver note: same source, same content, within 10-minute window. Evidence count increases, event count unchanged.",
    failure_labels: ["CAREGIVER_REPORT_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-002: Same document uploaded twice */
export function detectExactDocumentDuplicate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (!incoming.document_id) return null;

  const match = existingEvents.find((e) =>
    e.document_id === incoming.document_id &&
    e.document_version === incoming.document_version &&
    e.person_id === incoming.person_id,
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "identical_content",
    reasoning: "Same document ID and version already processed. Clinical events extracted once.",
    failure_labels: [],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-003: Same medication list duplicated */
export function detectExactMedicationListDuplicate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (incoming.extracted_type !== "medication_list") return null;

  const match = existingEvents.find((e) =>
    e.attributes.medication_list === true &&
    e.source_id === incoming.source_id &&
    e.person_id === incoming.person_id &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= IDENTITY_TIME_WINDOWS.exact_duplicate_ms,
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "identical_content",
    reasoning: "Identical medication list from same source at same timestamp. No duplicate medications created.",
    failure_labels: [],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-004: Same caregiver repeats note minutes apart */
export function detectRepeatedCaregiverNote(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (incoming.source_type !== "caregiver_note") return null;

  const match = existingEvents.find((e) =>
    e.source_type === "caregiver_note" &&
    e.source_id === incoming.source_id &&
    e.person_id === incoming.person_id &&
    contentHash(e.content) === contentHash(incoming.content) &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= IDENTITY_TIME_WINDOWS.exact_duplicate_ms,
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "same_source_repeated",
    reasoning: "Same caregiver repeated identical note within minutes. Likely duplicate documentation, not two distinct nights.",
    failure_labels: ["CAREGIVER_REPORT_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-024: Same lab result in two systems (hospital portal + caregiver app) */
export function detectMultiSystemLabResult(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (incoming.source_type !== "lab_result") return null;

  const match = existingEvents.find((e) =>
    e.person_id === incoming.person_id &&
    e.source_type === "lab_result" &&
    e.source_id !== incoming.source_id &&
    contentHash(e.content) === contentHash(incoming.content) &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= IDENTITY_TIME_WINDOWS.exact_duplicate_ms,
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "multi_system_same_measurement",
    reasoning: `Same lab measurement from different systems (${match.source_id} + ${incoming.source_id}). One clinical measurement, multiple evidence sources.`,
    failure_labels: ["MULTI_SOURCE_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-005: Same event copied into family chat */
export function detectMultiSourceSameEvent(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const match = existingEvents.find((e) =>
    e.person_id === incoming.person_id &&
    contentHash(e.content) === contentHash(incoming.content) &&
    e.source_id !== incoming.source_id &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= IDENTITY_TIME_WINDOWS.semantic_same_event_ms,
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.medium,
    matched_event_id: match.id,
    evidence_relation: "multi_source_same_event",
    reasoning: "Identical content from different sources (daughter/son). One fall event with multiple evidence sources.",
    failure_labels: ["MULTI_SOURCE_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** DUP-025: Imported document + manual entry of same measurement */
export function detectImportedVsManualEntry(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  // Check if incoming is manual_entry and existing is document (or vice versa)
  const isIncomingManual = incoming.source_type === "manual_entry";
  const isIncomingDoc = incoming.source_type === "document";
  if (!isIncomingManual && !isIncomingDoc) return null;

  const measurementKeywords = ["weight", "bp", "blood pressure", "temperature", "heart rate", "pulse", "oxygen", "spo2", "glucose", "sugar"];

  const match = existingEvents.find((e) => {
    const isExistingDoc = e.source_type === "document";
    const isExistingManual = e.source_type === "manual_entry";
    if (!isExistingDoc && !isExistingManual) return false;
    if (isIncomingManual && !isExistingDoc) return false;
    if (isIncomingDoc && !isExistingManual) return false;
    
    // Check if both contain measurement keywords and similar values
    const incomingLower = incoming.content.toLowerCase();
    const existingLower = e.content.toLowerCase();
    
    const hasMeasurement = measurementKeywords.some(k => 
      incomingLower.includes(k) && existingLower.includes(k)
    );
    if (!hasMeasurement) return false;
    
    // Check for similar numeric values
    const incomingNumbers = incomingLower.match(/\d+(?:\.\d+)?/g) || [];
    const existingNumbers = existingLower.match(/\d+(?:\.\d+)?/g) || [];
    const hasMatchingNumber = incomingNumbers.some(n => existingNumbers.includes(n));
    if (!hasMatchingNumber) return false;
    
    // Within time window
    return Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= IDENTITY_TIME_WINDOWS.exact_duplicate_ms;
  });

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "imported_vs_manual_entry",
    reasoning: `Same measurement recorded in document (${match.source_id}) and manual entry (${incoming.source_id}). One clinical measurement, two evidence sources.`,
    failure_labels: ["MULTI_SOURCE_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

/** Main exact duplicate detection orchestrator (Category 9A) */
export function detectExactDuplicates(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  // Order matters: most specific first
  const detectors = [
    detectExactCaregiverDuplicate,
    detectExactDocumentDuplicate,
    detectExactMedicationListDuplicate,
    detectRepeatedCaregiverNote,
    detectMultiSystemLabResult,
    detectImportedVsManualEntry,
    detectMultiSourceSameEvent,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}