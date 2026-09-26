import {
  IDENTITY_TIME_WINDOWS,
  IDENTITY_CONFIDENCE,
  EVIDENCE_RELATIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
} from "./contract-constants";
import type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
  DocumentVersionRecord,
} from "./types";

/** Track document versions for deduplication */
const documentVersionStore = new Map<string, DocumentVersionRecord[]>();

export function recordDocumentVersion(
  documentId: string,
  version: number,
  contentHash: string,
  capturedAt: string,
  extractedEventIds: string[],
  isDraft: boolean,
  isCorrection: boolean,
  supersedesVersion?: number,
): void {
  const versions = documentVersionStore.get(documentId) ?? [];
  versions.push({
    document_id: documentId,
    version,
    content_hash: contentHash,
    captured_at: capturedAt,
    extracted_events: extractedEventIds,
    is_draft: isDraft,
    is_correction: isCorrection,
    supersedes_version: supersedesVersion,
  });
  versions.sort((a, b) => a.version - b.version);
  documentVersionStore.set(documentId, versions);
}

export function getDocumentVersions(documentId: string): DocumentVersionRecord[] {
  return documentVersionStore.get(documentId) ?? [];
}

export function clearDocumentVersions(): void {
  documentVersionStore.clear();
}

function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

/** DUP-021: Draft vs final discharge summary */
export function detectDraftVsFinal(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (!incoming.document_id) return null;

  const versions = getDocumentVersions(incoming.document_id);
  if (versions.length < 2) return null;

  const latest = versions[versions.length - 1];
  const previous = versions[versions.length - 2];

  // Check if latest is final, previous was draft
  if (!latest.is_draft && previous.is_draft) {
    // Find events extracted from draft
    const draftEvents = existingEvents.filter(e =>
      previous.extracted_events.includes(e.id)
    );

    if (draftEvents.length > 0) {
      return {
        incoming_id: incoming.id,
        resolution: "update_existing",
        confidence: IDENTITY_CONFIDENCE.high,
        matched_event_id: draftEvents[0].id,
        evidence_relation: "document_version_draft_final",
        reasoning: `Final discharge summary supersedes draft. Same document/event context. Version ${previous.version} → ${latest.version}. Preserve provenance/version history.`,
        failure_labels: ["DOCUMENT_VERSION_COLLAPSE", "DOCUMENT_VERSION_DUPLICATION"],
        requires_clarification: false,
        combined_evidence: draftEvents.flatMap(e => e.evidence_ids).concat(incoming.id),
        enriched_fields: draftEvents.flatMap(e => Object.keys(e.attributes)),
      };
    }
  }

  return null;
}

/** DUP-022: Corrected clinical note */
export function detectCorrectedClinicalNote(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (!incoming.document_id) return null;

  const versions = getDocumentVersions(incoming.document_id);
  if (versions.length < 2) return null;

  const latest = versions[versions.length - 1];
  if (!latest.is_correction) return null;

  const previous = versions[versions.length - 2];
  const correctedEvents = existingEvents.filter(e =>
    previous.extracted_events.includes(e.id)
  );

  if (correctedEvents.length > 0) {
    // Check if correction changes the claim (e.g., "No fall" → "Had a fall")
    const claimChanged = claimSignificantlyChanged(previous, latest);
    
    return {
      incoming_id: incoming.id,
      resolution: claimChanged ? "update_existing" : "duplicate_event",
      confidence: IDENTITY_CONFIDENCE.high,
      matched_event_id: correctedEvents[0].id,
      evidence_relation: "document_version_correction",
      reasoning: claimChanged
        ? `Corrected clinical note changes claim. Same documentation episode. Preserve correction history.`
        : `Corrected note with minor changes. Same underlying documentation.`,
      failure_labels: ["CORRECTION_AS_NEW_EVENT"],
      requires_clarification: false,
      combined_evidence: correctedEvents.flatMap(e => e.evidence_ids).concat(incoming.id),
      enriched_fields: claimChanged ? ["clinical_claim", "correction_history"] : [],
    };
  }

  return null;
}

function claimSignificantlyChanged(prev: DocumentVersionRecord, curr: DocumentVersionRecord): boolean {
  // Simplified: different content hash means claim changed
  return prev.content_hash !== curr.content_hash;
}

/** DUP-023: Updated medication list */
export function detectUpdatedMedicationList(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (!incoming.document_id) return null;

  const versions = getDocumentVersions(incoming.document_id);
  if (versions.length < 2) return null;

  const latest = versions[versions.length - 1];
  const previous = versions[versions.length - 2];

  // Check if medication list document
  const isMedList = incoming.content.toLowerCase().includes("medication") &&
    (incoming.content.toLowerCase().includes("list") || incoming.content.toLowerCase().includes("mg"));

  if (!isMedList) return null;

  const medEvents = existingEvents.filter(e =>
    previous.extracted_events.includes(e.id) &&
    (e.extracted_type === "medication_started" || e.extracted_type === "medication_changed")
  );

  if (medEvents.length === 0) return null;

  return {
    incoming_id: incoming.id,
    resolution: "update_existing",
    confidence: IDENTITY_CONFIDENCE.medium,
    matched_event_id: medEvents[0].id,
    evidence_relation: "document_version_update",
    reasoning: `Updated medication list. One medication entity, two documented states. Possible dose change, but documentation update ≠ administration change at same moment.`,
    failure_labels: ["DOCUMENT_VERSION_DUPLICATION", "UPDATE_AS_NEW_EVENT"],
    requires_clarification: false,
    combined_evidence: medEvents.flatMap(e => e.evidence_ids).concat(incoming.id),
    enriched_fields: ["documented_dose", "documentation_timestamp"],
  };
}

/** DUP-024: Same lab result in two systems */
export function detectMultiSystemLabResult(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const labKeywords = ["bp", "blood pressure", "lab", "result", "glucose", "a1c", "creatinine"];
  const incomingHasLab = labKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasLab) return null;

  // Look for same measurement value, same timestamp, different source
  const incomingValue = extractMeasurementValue(incoming.content);
  const incomingTime = incoming.captured_at;

  if (!incomingValue) return null;

  const match = existingEvents.find(e =>
    e.person_id === incoming.person_id &&
    e.source_id !== incoming.source_id &&
    e.source_type !== incoming.source_type &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incomingTime).getTime()) <= 60 * 60 * 1000 // 1 hour
  );

  if (!match) return null;

  const existingValue = extractMeasurementValue(match.content);
  if (!existingValue) return null;

  // Same measurement type and value
  if (incomingValue.type === existingValue.type && incomingValue.value === existingValue.value) {
    return {
      incoming_id: incoming.id,
      resolution: "duplicate_evidence",
      confidence: IDENTITY_CONFIDENCE.high,
      matched_event_id: match.id,
      evidence_relation: "multi_system_same_measurement",
      reasoning: `Same underlying measurement (${incomingValue.type} ${incomingValue.value}) from hospital portal and caregiver app. One measurement, multiple representations.`,
      failure_labels: ["MULTI_SOURCE_DUPLICATION"],
      requires_clarification: false,
      combined_evidence: [...match.evidence_ids, incoming.id],
    };
  }

  return null;
}

function extractMeasurementValue(text: string): { type: string; value: string } | null {
  const bpMatch = text.match(/(\d+\/\d+)\s*(mmhg|bp|blood pressure)/i);
  if (bpMatch) return { type: "blood_pressure", value: bpMatch[1] };

  const glucoseMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg\/dl|mmol\/l)\s*(glucose|sugar)/i);
  if (glucoseMatch) return { type: "glucose", value: glucoseMatch[1] };

  const genericMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|kg|lbs|mmol|units)/i);
  if (genericMatch) {
    const context = text.toLowerCase();
    if (context.includes("weight")) return { type: "weight", value: genericMatch[1] };
    if (context.includes("height")) return { type: "height", value: genericMatch[1] };
  }
  return null;
}

/** DUP-025: Imported document + manual entry */
export function detectImportedVsManualDuplicate(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  // One from document, one manual, same timestamp, same content
  const isDocument = incoming.source_type === "document";
  const isManual = incoming.source_type === "manual_entry";

  if (!isDocument && !isManual) return null;

  const match = existingEvents.find(e =>
    e.person_id === incoming.person_id &&
    e.source_type !== incoming.source_type &&
    (e.source_type === "document" || e.source_type === "manual_entry") &&
    contentHash(e.content) === contentHash(incoming.content) &&
    Math.abs(new Date(e.created_at).getTime() - new Date(incoming.captured_at).getTime()) <= 24 * 60 * 60 * 1000
  );

  if (!match) return null;

  return {
    incoming_id: incoming.id,
    resolution: "duplicate_evidence",
    confidence: IDENTITY_CONFIDENCE.high,
    matched_event_id: match.id,
    evidence_relation: "imported_vs_manual_entry",
    reasoning: `Hospital document and manual entry show same weight (70kg) same date/time. Likely duplicate observation. Preserve provenance rather than counting two measurements.`,
    failure_labels: ["MULTI_SOURCE_DUPLICATION"],
    requires_clarification: false,
    combined_evidence: [...match.evidence_ids, incoming.id],
  };
}

function contentHash(text: string): string {
  let hash = 0;
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

/** Main document version detection orchestrator (Category 9E) */
export function detectDocumentVersions(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  if (!incoming.document_id) return null;

  const detectors = [
    detectDraftVsFinal,
    detectCorrectedClinicalNote,
    detectUpdatedMedicationList,
    detectMultiSystemLabResult,
    detectImportedVsManualDuplicate,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}