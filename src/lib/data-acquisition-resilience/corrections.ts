import { evolveConfidence } from "./confidence-evolution";
import { shouldAutoValidate } from "./extract-candidates";
import {
  createCorrectionId,
  createValidatedEventId,
  deleteValidatedEvent,
  getCandidate,
  getValidatedEvent,
  storeCorrection,
  storeValidatedEvent,
  updateValidatedEvent,
} from "./projection-store";
import { createCorrectionEvent, storeCommittedEvents } from "../event-normalization";
import { appendAuditEntry } from "../care-event-integrity";
import type { ApplyCorrectionInput, CorrectionEvent, ValidatedCareEvent, ConfidenceSource } from "./types";

/** Append-only corrections — never overwrite history. */
export function applyCorrection(input: ApplyCorrectionInput): {
  correction: CorrectionEvent;
  updated_event: ValidatedCareEvent | null;
  deleted_event_id: string | null;
} {
  const correction: CorrectionEvent = {
    id: createCorrectionId(),
    caregiver_id: input.caregiver_id,
    target_event_id: input.target_event_id ?? null,
    target_candidate_id: input.target_candidate_id ?? null,
    correction_type: input.correction_type,
    corrected_fields: input.corrected_fields,
    user_source: input.user_source ?? "user",
    created_at: new Date().toISOString(),
  };

  storeCorrection(correction);

  if (input.correction_type === "delete" && input.target_event_id) {
    const existing = getValidatedEvent(input.target_event_id);
    if (existing) {
      const invalidated: ValidatedCareEvent = {
        ...existing,
        attributes: {
          ...existing.attributes,
          lifecycle_status: "invalidated",
          invalidated_at: new Date().toISOString(),
        },
      };
      updateValidatedEvent(invalidated, input.caregiver_id);
      appendAuditEntry({
        event_id: existing.id,
        caregiver_id: input.caregiver_id,
        action: "invalidate",
        previous_snapshot: { extracted_fact: existing.extracted_fact },
        updated_snapshot: { status: "invalidated" },
        reason: String(input.corrected_fields.reason ?? "user_correction"),
        user_source: input.user_source ?? "user",
      });
      return { correction, updated_event: invalidated, deleted_event_id: null };
    }
    deleteValidatedEvent(input.target_event_id, input.caregiver_id);
    return { correction, updated_event: null, deleted_event_id: input.target_event_id };
  }

  if (input.correction_type === "clarify" && input.target_candidate_id) {
    const candidate = getCandidate(input.target_candidate_id);
    if (candidate) {
      const { score, sources } = evolveConfidence(
        candidate.confidence,
        candidate.confidence_sources,
        "user_confirmation",
      );
      const event: ValidatedCareEvent = {
        id: createValidatedEventId(),
        raw_input_id: candidate.raw_input_id,
        candidate_id: candidate.id,
        extracted_fact: String(input.corrected_fields.extracted_fact ?? candidate.extracted_fact),
        event_signal: String(input.corrected_fields.event_signal ?? candidate.event_signal),
        confidence_score: score,
        confidence_sources: sources,
        validated_at: new Date().toISOString(),
        validation_method: "user_confirmation",
        entities: Array.isArray(input.corrected_fields.entities)
          ? (input.corrected_fields.entities as ValidatedCareEvent["entities"])
          : [],
        attributes: { ...input.corrected_fields },
        document_id: null,
      };
      storeValidatedEvent(event, input.caregiver_id);
      return { correction, updated_event: event, deleted_event_id: null };
    }
  }

  if (input.correction_type === "modify" && input.target_event_id) {
    const existing = getValidatedEvent(input.target_event_id);
    if (existing) {
      const { score, sources } = evolveConfidence(
        existing.confidence_score,
        existing.confidence_sources,
        "user_confirmation",
      );
      const updated: ValidatedCareEvent = {
        ...existing,
        extracted_fact: String(input.corrected_fields.extracted_fact ?? existing.extracted_fact),
        confidence_score: score,
        confidence_sources: sources,
        validated_at: new Date().toISOString(),
        validation_method: "correction",
        attributes: { ...existing.attributes, ...input.corrected_fields },
      };
      updateValidatedEvent(updated, input.caregiver_id);
      const correctionCareEvent = createCorrectionEvent({
        correctedEventId: existing.id,
        previousValue: existing.extracted_fact,
        newValue: input.corrected_fields,
        rawInputId: existing.raw_input_id,
        timestamp: new Date().toISOString(),
      });
      const corrValidated: ValidatedCareEvent = {
        id: createValidatedEventId(),
        raw_input_id: correctionCareEvent.raw_input_id,
        candidate_id: correctionCareEvent.id,
        extracted_fact: correctionCareEvent.label,
        event_signal: "correction",
        confidence_score: 0.95,
        confidence_sources: ["user_confirmation"],
        validated_at: correctionCareEvent.timestamp,
        validation_method: "user_confirmation",
        entities: [],
        attributes: correctionCareEvent.attributes,
        document_id: null,
      };
      storeValidatedEvent(corrValidated, input.caregiver_id);
      storeCommittedEvents(input.caregiver_id, [correctionCareEvent]);
      return { correction, updated_event: updated, deleted_event_id: null };
    }
  }

  return { correction, updated_event: null, deleted_event_id: null };
}

export function promoteCandidateToValidated(
  candidateId: string,
  caregiverId: string,
  method: ValidatedCareEvent["validation_method"] = "auto_threshold",
): ValidatedCareEvent | null {
  let candidate = getCandidate(candidateId);
  if (!candidate) return null;
  if (method === "auto_threshold" && !shouldAutoValidate(candidate)) return null;
  if (method === "user_confirmation") {
    const { score, sources } = evolveConfidence(
      candidate.confidence,
      candidate.confidence_sources,
      "user_confirmation",
    );
    candidate = { ...candidate, confidence: score, confidence_sources: sources };
  }

  const event: ValidatedCareEvent = {
    id: createValidatedEventId(),
    raw_input_id: candidate.raw_input_id,
    candidate_id: candidate.id,
    extracted_fact: candidate.extracted_fact,
    event_signal: candidate.event_signal,
    confidence_score: candidate.confidence,
    confidence_sources: candidate.confidence_sources,
    validated_at: new Date().toISOString(),
    validation_method: method,
    entities: [],
    attributes: {
      completeness: candidate.completeness,
      missing_fields: candidate.missing_fields,
      ambiguity_flags: candidate.ambiguity_flags,
      date_reference:
        candidate.source_span.match(
          /\b(march|january|february|\d{1,2}[/-]\d{1,2}|yesterday|today)\b/i,
        )?.[0] ?? null,
    },
    document_id: null,
  };

  storeValidatedEvent(event, caregiverId);
  return event;
}

export function confirmCandidate(
  candidateId: string,
  caregiverId: string,
): ValidatedCareEvent | null {
  const candidate = getCandidate(candidateId);
  if (!candidate) return null;
  return promoteCandidateToValidated(candidateId, caregiverId, "user_confirmation");
}
